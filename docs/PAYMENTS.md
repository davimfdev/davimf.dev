# Módulo de pagamentos — Mercado Pago + Resend

Checkout transparente dentro do site, entrega automática de licença FMM e
notificações por e-mail. Provider-agnóstico por construção: Orders, Products e
o sistema de licenças não conhecem o Mercado Pago.

---

## 1. Arquitetura

```
netlify/functions/payments.ts        ← handler HTTP (só delega)
netlify/functions/lib/payments/
  router.ts                          ← rotas /api/payments/*
  http.ts                            ← auth de sessão, validação, erros
  config.ts                          ← URLs públicas e link de download do FMM
  domain/                            ← money, types, errors (nenhum provider aqui)
  application/
    OrderService.ts                  ← pedidos; PREÇO vem do banco
    PaymentService.ts                ← pagamentos, entrega, refund
    SubscriptionService.ts           ← recorrência
    FmmLicenseService.ts             ← gera/reserva/atribui licença
    NotificationService.ts           ← decide QUANDO notificar
  providers/
    PaymentProvider.ts               ← a abstração
    registry.ts                      ← escolhe por PAYMENTS_PROVIDER
    mercadopago/                     ← ÚNICO lugar que conhece o Mercado Pago
      MercadoPagoPaymentProvider.ts
      client.ts                      ← HTTP, idempotência, timeout
      mapping.ts                     ← status do MP → status do domínio
      signature.ts                   ← validação do x-signature
  email/
    EmailProvider.ts                 ← a abstração
    ResendEmailProvider.ts           ← implementação Resend (+ Noop)
    templates/                       ← HTML/texto, identidade DAVIMF
  repositories/                      ← SQL cru sobre PostgreSQL (postgres.js)
  webhooks/WebhookService.ts         ← dedup + despacho
  infrastructure/                    ← acesso ao banco, cifra da licença
```

**Regra de dependência**: `domain` não importa nada; `application` importa
`domain` + `repositories` + a *interface* `PaymentProvider`; só
`providers/mercadopago/` conhece o Mercado Pago. `OrderService`, `Products` e
`FmmLicenseService` nunca importam nada do provider.

O roteador mora dentro do módulo justamente para que extrair `payments/` para um
serviço separado seja mover a pasta e apontar o proxy.

### Prioridades codificadas

`SEGURANÇA > CORREÇÃO FINANCEIRA > IDEMPOTÊNCIA > ENTREGA DA LICENÇA > MODULARIDADE > UX`

---

## 2. Variáveis de ambiente

Obrigatórias (já em `.env.example`, sem valores):

| Variável | O que é |
|---|---|
| `PAYMENTS_PROVIDER` | `mercadopago` |
| `PAYMENTS_ENV` | `sandbox` ou `production` |
| `MERCADOPAGO_PUBLIC_KEY` | Public key — vai para o frontend (é pública) |
| `MERCADOPAGO_ACCESS_TOKEN` | Access token — **nunca sai do servidor** |
| `MERCADOPAGO_WEBHOOK_SECRET_TEST` | Assinatura da aba Modo de teste |
| `MERCADOPAGO_WEBHOOK_SECRET_PRODUCTION` | Assinatura da aba Modo de produção |
| `MERCADOPAGO_WEBHOOK_SECRET` | Compatibilidade legada para ambiente único |
| `MERCADOPAGO_APPLICATION_ID` | Opcional. `application_id` da aplicação dona do webhook; só rotula o log como `application=match/foreign` |
| `RESEND_API_KEY` | Chave do Resend; sem ela o envio vira no-op logado |

Opcionais com padrão no código: `MERCADOPAGO_TIMEOUT_MS` (12000),
`MERCADOPAGO_WEBHOOK_MAX_SKEW_MS` (900000), `RESEND_TIMEOUT_MS` (10000),
`PAYMENTS_EMAIL_FROM`, `PAYMENTS_EMAIL_REPLY_TO`, `PAYMENTS_EMAIL_SUPPORT`,
`PAYMENTS_LICENSE_ENCRYPTION_KEY`, `FMM_DOWNLOAD_URL`.

Reaproveitadas do projeto: `NETLIFY_DATABASE_URL`/`DATABASE_URL` (banco),
`DASHBOARD_SESSION_SECRET` + `DASHBOARD_TOKEN_ENCRYPTION_KEY` (sessão e cifra
da licença quando `PAYMENTS_LICENSE_ENCRYPTION_KEY` não é definida),
`BOT_SUPPORT_USER_IDS` (quem pode reembolsar), `URL` (base pública).

`URL` é obrigatória em produção: entra nos links dos e-mails e no `back_url` das
assinaturas. Ela é resolvida no arranque por `server/src/utils/env.ts`, que
aceita os apelidos da plataforma (`PUBLIC_SITE_URL`, `SITE_URL`, `APP_URL`,
`COOLIFY_URL`, `COOLIFY_FQDN`, `SERVICE_FQDN_*`) e normaliza o valor — ver
`docs/VPS_MIGRATION.md`. Sem ela, `siteUrl()` cai em `http://localhost:8888`,
a mesma convenção de `shorten.ts`, e os links do e-mail saem inúteis.

`PAYMENTS_PROVIDER` e `PAYMENTS_ENV` têm padrão no código (`mercadopago` /
`sandbox`) e por isso não bloqueiam o arranque.

Nenhum segredo entra no repositório. `.env` continua fora do git.

---

## 3. Banco

Migração: `db/005_payments.sql`, idempotente, no **banco do site**.

```bash
psql "$NETLIFY_DATABASE_URL" -f db/005_payments.sql
```

| Tabela | Papel |
|---|---|
| `products` | Catálogo. **Fonte de verdade do preço**, em centavos inteiros |
| `orders` | Pedido do usuário |
| `payments` | Tentativas de cobrança |
| `payment_methods` | Cartões salvos (bandeira, últimos 4, validade, id opaco) |
| `subscriptions` | Recorrência |
| `payment_events` | Auditoria **e deduplicação de webhook** |
| `email_dispatches` | Deduplicação de e-mail financeiro |
| `fmm_license_keys` | **Tabela existente**, estendida — não há segundo sistema |

Índices que carregam regra de negócio:

- `payments_idempotency_key_uq` — duplo clique reaproveita a cobrança;
- `orders_idempotency_key_uq` — duplo clique reaproveita o pedido;
- `payment_events_provider_key_uq` — webhook repetido não reprocessa;
- `email_dispatches.dedupe_key` UNIQUE — e-mail não duplica;
- `fmm_license_keys_key_hash_uq` — chave única;
- **`fmm_license_keys_order_uq`** — *uma compra nunca recebe duas chaves*.

Colunas somadas a `fmm_license_keys`: `order_id`, `product_id`, `status`,
`activated_at`, `key_ciphertext`, `metadata`. `is_active` continua sendo
escrita junto de `status`, então `fmm-activate`/`fmm-validate`/`fmm-revoke`
seguem funcionando sem alteração.

### Status normalizados

`PENDING · PROCESSING · PAID · DECLINED · FAILED · CANCELLED · EXPIRED ·
REFUNDED · PARTIALLY_REFUNDED · CHARGEBACK`

Status do Mercado Pago existem **apenas** em `providers/mercadopago/mapping.ts`.

Licenças: `ACTIVE · EXPIRED · SUSPENDED · REVOKED`.

---

## 4. Endpoints

Todos sob `/api/payments/`, registrados em `server/src/routes/functions.ts`.

| Método | Rota | Auth | O que faz |
|---|---|---|---|
| GET | `/config` | pública | provider, ambiente, public key, link de download |
| GET | `/products?family=fmm` | pública | catálogo com preço em centavos |
| POST | `/checkout` | sessão | cria/recupera pedido |
| GET | `/orders` | sessão | pedidos do usuário |
| GET | `/orders/:id` | sessão (dono) | pedido + último pagamento |
| POST | `/pix` | sessão (dono) | cria cobrança Pix |
| POST | `/card` | sessão (dono) | cobra cartão (ou cria assinatura se `autoRenew`) |
| POST | `/boleto` | sessão (dono) | gera boleto |
| POST | `/subscription` | sessão (dono) | cria assinatura |
| GET | `/subscriptions` | sessão | assinaturas do usuário |
| POST | `/subscription/cancel` | sessão (dono) | cancela renovação |
| GET | `/status?paymentId=` | sessão (dono) | reconcilia com o provider (polling) |
| GET | `/licenses` | sessão | licenças + chave completa recuperável |
| POST | `/webhooks/mercadopago` | assinatura | notificações |
| POST | `/admin/refund` | sessão + admin | reembolso total/parcial |

Autorização: `requireUser()` lê a **sessão** (cookie assinado do login Discord).
`userId` do corpo é ignorado em toda a superfície. Admin = `BOT_SUPPORT_USER_IDS`.

Mutações exigem `Origin`/`Referer` do domínio oficial — exceto o webhook, que é
autenticado pela assinatura.

---

## 5. Mercado Pago

APIs usadas (Checkout Transparente via **Orders API** + Assinaturas):

| Operação | Endpoint |
|---|---|
| Pix / cartão / boleto | `POST /v1/orders` |
| Consulta | `GET /v1/orders/{id}` (ou `/v1/payments/{id}` para id legado) |
| Reembolso | `POST /v1/orders/{id}/refund` |
| Assinatura | `POST /preapproval` (`status: "authorized"`, `card_token_id`) |
| Consulta/cancelamento | `GET`/`PUT /preapproval/{id}` |
| Cartão salvo | `POST /v1/customers/{id}/cards` |

Toda criação envia `X-Idempotency-Key`.

### Sandbox

1. Painel do Mercado Pago → aplicação → credenciais de **teste**.
2. `PAYMENTS_ENV=sandbox` e as chaves `TEST-…` no `.env`.
3. Cartões de teste (BR): aprovado `5031 4332 1540 6351`; para forçar recusa,
   use o nome do titular documentado pelo MP (`OTHE` = outro erro,
   `FUND` = saldo insuficiente). CVV `123`, validade `11/30`, CPF `12345678909`.
4. Pix e boleto em teste não movimentam dinheiro; confirme pelo painel ou
   disparando a notificação manualmente.

### Webhooks

Endpoint: `POST https://davimf.dev/api/payments/webhooks/mercadopago`

No painel do Mercado Pago, cadastre manualmente essa URL e selecione como
tópico principal **Order (Mercado Pago)**. Mantenha também os eventos já usados
pelo projeto quando estiverem disponíveis para a conta: Planos e assinaturas,
Alertas de fraude, Reclamações e Contestações. Como teste e produção podem
apontar para a mesma URL, configure as duas assinaturas em
`MERCADOPAGO_WEBHOOK_SECRET_TEST` e
`MERCADOPAGO_WEBHOOK_SECRET_PRODUCTION`, depois recrie a aplicação. A variável
`MERCADOPAGO_WEBHOOK_SECRET` permanece apenas como compatibilidade legada para
instalações de ambiente único.

Depois do deploy, use a simulação do painel para validar uma assinatura e faça
uma nova medição de qualidade da integração. A confirmação deve aparecer tanto
quando o webhook chega primeiro quanto quando o polling já conciliou o
pagamento; licença e e-mail continuam deduplicados nos dois casos.

Validação (`providers/mercadopago/signature.ts`), conforme a documentação
oficial de *Webhooks → Validação da origem da notificação*:

1. lê `ts` e `v1` de `x-signature`;
2. monta `id:[data.id_url];request-id:[x-request-id_header];ts:[ts_header];`
   — `data.id` sai **da query string**, nunca do corpo; o `id` das notificações
   legadas (`?id=…&topic=…`) **não** entra no manifesto, ele só localiza o
   recurso depois; partes ausentes são omitidas junto com o rótulo;
3. a documentação manda usar o `data.id` alfanumérico em minúsculas
   (`ORD01JQ…` → `ord01jq…`), mas o simulador do painel assina preservando o
   case: as duas formas são testadas, e **ambas** exigem HMAC válido;
4. HMAC-SHA256 hex com cada segredo configurado, comparado em tempo constante;
5. `ts` fora da janela de 15 min → rejeitado (anti-replay).

Assinatura inválida ⇒ **401**, nada processado. Não existe fallback permissivo:
mais variantes de manifesto não afrouxam nada, cada uma continua precisando do
HMAC correto com um segredo configurado.

Depois da validação o payload **não** é fonte de verdade: o provider é
reconsultado (`getPayment`/`getSubscription`) para obter o estado real.

#### Respostas e retries

O Mercado Pago considera entregue com **HTTP 200/201 em até 22 s** e reenvia a
cada 15 min (espaçando após a terceira tentativa) enquanto não receber isso.
Por isso o endpoint responde 2xx em todos os casos *reconhecidos*:

| Situação | Resposta | Log |
|---|---|---|
| Assinatura válida, pagamento aplicado | 200 `processed` | `aceito (…)` |
| Assinatura válida, evento repetido | 200 `duplicate` | — |
| Assinatura válida, recurso inexistente (simulador) | 200 `unknown_resource` | `válido para recurso inexistente` |
| Assinatura inválida | 401 | `rejeitado: <motivo>` |
| Falha ao consultar o provider | 500 | `falha ao consultar o provedor` |

Várias notificações para a mesma compra são **normais**: cada evento marcado no
painel (`order.created`, `order.updated`, `order.processed`, …) é uma entrega
distinta. A dedup é por `payment_events(provider, event_key)`, então repetição
não gera segunda licença nem segundo e-mail.

Assinatura inválida continua devolvendo 401 de propósito — devolver 2xx só para
parar retry aceitaria notificação não autenticada.

#### Diagnóstico das rejeições

Uma rejeição vira **uma linha** com o motivo específico e nada sensível
(segredo, manifesto, assinatura, URL e payload nunca são registrados):

```
[payments] webhook Mercado Pago rejeitado: MISMATCH (application=foreign,
application_id=…, live_mode=false, type=order, action=order.updated,
data.id=present, id_source=query, body_id=present, ids_match=yes,
x-request-id=present(1), ts_age_s=2, variants=exact+lowercase,
secrets=test:1a2b3c4d/production:9f8e7d6c)
```

Como ler:

| Campo | O que decide |
|---|---|
| `application` / `application_id` | notificação de OUTRA aplicação do MP (exige `MERCADOPAGO_APPLICATION_ID` para rotular) |
| `live_mode` | credencial de teste (`false`) ou de produção (`true`) |
| `id_source` | `query` = `data.id` presente; `absent` = manifesto sem o rótulo `id` |
| `ids_match` | query vs. corpo — `no` denuncia proxy reescrevendo a URL |
| `x-request-id=present(N)` | **N > 1** = proxy duplicou/injetou o cabeçalho e quebrou o manifesto |
| `ts_age_s` | idade da assinatura; valor grande = relógio fora de hora ou replay |
| `variants` | quais canonicalizações de `data.id` foram testadas |
| `secrets` | conjunto lógico tentado, como `rótulo:fingerprint`. O fingerprint é irreversível (8 hex de SHA-256 com separação de domínio) e serve só para responder duas perguntas: *teste e produção estão com valores diferentes?* (fingerprints iguais = mesmo valor colado duas vezes) e *o valor mudou depois do deploy?* |

A contrapartida aparece nas notificações aceitas, no mesmo formato, para
comparar as duas na mesma busca:

```
[payments] webhook Mercado Pago aceito (application=match, application_id=…,
live_mode=true, type=order, action=order.processed, data.id=present)
```

`MISMATCH` com `ids_match=yes`, `x-request-id=present(1)` e `ts_age_s` pequeno
significa que o manifesto está certo e o HMAC foi calculado com um segredo que
**não** está configurado aqui — ou seja, a notificação é de outra aplicação/modo,
ou o segredo do painel foi regerado sem atualizar o ambiente.

#### Rotação da assinatura secreta

Cada aplicação tem a sua assinatura, e teste e produção têm a sua. Ao gerar uma
nova no painel:

1. gere a nova assinatura (Modo de teste e Modo de produção separadamente);
2. atualize `MERCADOPAGO_WEBHOOK_SECRET_TEST` e
   `MERCADOPAGO_WEBHOOK_SECRET_PRODUCTION` no Coolify — cole **sem** espaço ou
   quebra de linha (o código faz `trim`, mas o painel pode truncar);
3. faça deploy/restart: as variáveis são lidas do ambiente no arranque;
4. confira nos logs que o `fingerprint` de cada segredo mudou e que os dois são
   **diferentes** entre si;
5. rode o simulador do painel e confirme o `aceito (…)`.

Notificações que já estavam na fila de retry foram assinadas antes da troca e
vão continuar caindo em `MISMATCH` até o Mercado Pago desistir delas. Isso é o
comportamento correto — nenhuma delas deve ser aceita.

---

## 6. Meios de pagamento

### Pix
Backend define o valor, cria a cobrança (expiração 30 min) e persiste
`qr_code`, `qr_code_base64`, `ticket_url` e expiração. A tela mostra
"Aguardando pagamento". Polling só melhora a UX; a confirmação é do webhook.

### Boleto
`bolbradesco`, vencimento em 3 dias. Exige nome, sobrenome, CPF/CNPJ e endereço
(CEP, rua, número) — validado no frontend e no provider. Persiste linha
digitável, código de barras, link e vencimento. **Nada é entregue antes de PAID.**

### Cartão
Tokenização no navegador via **MercadoPago.js v2 Secure Fields**: número,
validade e CVV vivem em iframes do Mercado Pago. O backend recebe apenas
`cardToken` + `paymentMethodId` + `installments`. Parcelamento vem de
`mp.getInstallments()` (máximo 12). Aprovado, recusado, processando e erro têm
tratamento próprio; 3DS, quando o emissor exige, redireciona (exceção permitida).

### Perfil de cobrança reutilizável

A migração `db/006_payer_profiles.sql` cria a tabela de perfis. A persistência
só ocorre com consentimento explícito e exige
`PAYMENTS_PAYER_ENCRYPTION_KEY`, uma chave aleatória de 32 bytes em base64:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Sem a variável, os pagamentos continuam funcionando, mas o perfil não é salvo.
Não gere outra chave a cada boot: perder ou substituir essa chave torna os
perfis existentes impossíveis de descriptografar. Aplique a migração antes de
ativar a persistência e nunca registre o valor da chave nos logs.

### Recorrência
Disponível quando `products.recurring_eligible = true` e
`is_lifetime = false` — **regra do catálogo, não hardcoded para o FMM**. Um
`CHECK` no banco impede vitalício recorrente. O checkout oferece
"Renovar automaticamente" só nesses casos, e apenas no cartão.

---

## 7. Segurança do cartão

- PAN, CVV e dados brutos **nunca** chegam ao backend: tokenização no
  frontend, dentro dos iframes do Mercado Pago.
- `rejectRawCardData()` recusa explicitamente qualquer corpo com
  `card_number`, `cardNumber`, `pan`, `number`, `cvv`, `cvc`, `security_code`,
  `securityCode` — e loga só o *nome* do campo, nunca o valor.
- Armazenamos apenas bandeira, últimos 4, validade e o id opaco do provider.
- Nenhum template de e-mail carrega dado de cartão (há teste para isso).

---

## 8. Idempotência

| Risco | Defesa |
|---|---|
| Duplo clique / refresh | Chave de idempotência do frontend + `ON CONFLICT` em `orders` e `payments` |
| Retry / timeout | `X-Idempotency-Key` no Mercado Pago; falha retentável deixa `PROCESSING`, nunca `FAILED` |
| Requisições simultâneas | Índices únicos decidem o vencedor; o perdedor relê a linha |
| Webhook duplicado | `payment_events(provider, event_key)` UNIQUE — o 2º INSERT volta vazio |
| Duas licenças | `fmm_license_keys(order_id)` UNIQUE parcial |
| Entrega repetida | `UPDATE orders … WHERE status <> 'PAID'` — só transiciona uma vez |
| Reembolso duplo | Chave determinística + estado `REFUNDED` bloqueia novo refund |
| E-mail duplicado | `email_dispatches.dedupe_key` UNIQUE |

Falha transitória no webhook **libera** o evento (`releaseEvent`) para que o
retry do provider funcione — sem isso, um pagamento ficaria pago e não entregue.

---

## 9. FMM

O FMM é **gratuito**. O cliente compra a **chave**, não o instalador.

Download oficial (o link que já existia em `FmmPlans.tsx` e `FmmActivated.tsx`):

```
https://github.com/davimfdev/FMM-Releases/releases/latest/download/FMM.exe
```

Centralizado em `lib/payments/config.ts` (`FMM_DOWNLOAD_URL`), sobrescrevível
por env. Nenhum link novo foi inventado.

### Fluxo

```
/fmm → Comprar → CheckoutModal (Pix/Cartão/Boleto)
     → backend cria pedido (preço do banco)
     → cobrança no provider
     → webhook confirma PAID
     → Order PAID
     → procura licença da Order → existe? reutiliza : gera/reserva
     → vincula (order_id, product_id, user_id)
     → PERSISTE
     → mostra na tela + e-mail
```

A chave nunca é liberada antes de `PAID`, e **nunca nasce dentro do e-mail**:
é persistida primeiro. Se o Resend falhar, a licença e a compra continuam
válidas e o envio fica `FAILED` para reenvio.

### Geração

Reutiliza o gerador existente (`lib/fmm-keygen.ts`, extraído de
`lib/fmm-license.ts` sem mudar formato nem algoritmo): `FMM-XXXXXXXX-XXXXXXXX`.
O banco guarda `key_hash` (SHA-256), `key_prefix` e `key_ciphertext`
(AES-256-GCM, mesmo mecanismo de `lib/dashboard/crypto.ts`). A cifra é o que
permite reexibir a chave no painel — o e-mail não é o único lugar onde ela existe.

Chaves emitidas antes desta migração só têm prefixo; a UI diz isso em vez de
fingir que sumiram.

### Onde o cliente vê

- `/fmm-activated?order=<id>` — logo após o pagamento: chave, **Copiar chave**,
  **Baixar FMM**, pedido, plano, valor, método, status e como ativar;
- `/my-keys` — depois, a qualquer momento: chave, validade, status, download e
  as assinaturas ativas com cancelamento.

### Renovação

Vitalício não renova (nem oferece). Planos temporários com renovação aprovada
estendem a validade: `GREATEST(expires_at, now()) + duration_days`, a partir da
maior data entre hoje e a atual. A chave continua a mesma.

### Reembolso e contestação

Licença **nunca** é apagada.

| Evento | Licença | Pedido |
|---|---|---|
| Reembolso integral | `REVOKED` | `REFUNDED` |
| Reembolso parcial | `SUSPENDED` | `PARTIALLY_REFUNDED` |
| Chargeback / contestação | `SUSPENDED` | `CHARGEBACK` |
| Cancelar assinatura | inalterada (`ACTIVE` até expirar) | inalterado |

---

## 10. Resend

`ResendEmailProvider` fala com `POST https://api.resend.com/emails` via `fetch`
(sem o pacote `resend`, que existe só no `package.json` da raiz e não no de
`server/` — uma dependência a mais quebraria o container).

- From: `DAVIMF <noreply@davimf.dev>`
- Reply-To: `financeiro@davimf.dev`
- Suporte no rodapé: `contato@davimf.dev`
- `Idempotency-Key` = a chave de dedup do evento.

Sem `RESEND_API_KEY`, cai no `NoopEmailProvider`: loga e segue — a venda não para.

### Eventos que geram e-mail

pedido criado · Pix criado · boleto criado · pagamento aprovado ·
pagamento recusado · pagamento expirado · pagamento cancelado · reembolso
(total/parcial) · assinatura criada · renovação aprovada · renovação falhou ·
assinatura cancelada · chargeback.

O polling também envia a confirmação quando detecta o pagamento antes do
webhook. A chave `order:<id>:paid` em `email_dispatches` garante que um webhook
posterior não envie o mesmo e-mail novamente.

O e-mail de aprovação do FMM ("FMM — Pagamento aprovado e sua chave") contém:
confirmação, plano, valor, número do pedido, chave, validade, botão de download,
instruções de ativação e os dois contatos.

---

## 11. Testes

```bash
npm test                                  # suíte completa
npx vitest run netlify/functions/lib/payments/__tests__
```

Cobertura por arquivo:

| Arquivo | Cobre |
|---|---|
| `money.test.ts` | centavos inteiros, ida e volta, recusa de float |
| `signature.test.ts` | manifesto, assinatura válida/inválida, adulteração de `data.id`, replay, sem segredo |
| `mercadopagoProvider.test.ts` | Pix, cartão aprovado/recusado, boleto, assinatura, cancelamento, refund, timeout, não-vazamento de mensagem do provider, mapeamento de status |
| `fmmLicense.test.ts` | geração, reuso, corrida do índice único, cifra recuperável, revogação/suspensão sem delete, vitalício não renova |
| `notification.test.ts` | envio, dedup, falha do Resend sem perder licença, contrato REST do Resend, conteúdo dos templates |
| `paymentFlow.test.ts` | preço do banco vs. adulteração, duplo clique, Pix criado/confirmado/expirado, polling sem e-mail, cartão aprovado/recusado, timeout → `PROCESSING`, boleto, refund, refund duplo, chargeback, webhook válido/duplicado/assinatura inválida |
| `subscription.test.ts` | criação, vitalício bloqueado, renovação aprovada/falha, renovação repetida, cancelamento preservando histórico |
| `router.test.ts` | public key exposta sem access token, catálogo, origem bloqueada, 401 sem sessão, 405/404, webhook 401, rejeição de PAN/CVV |

---

## 12. Como estender

### Outro PaymentProvider

1. `providers/pagarme/PagarMePaymentProvider.ts` implementando `PaymentProvider`
   (11 métodos) — o mapeamento de status fica em `providers/pagarme/mapping.ts`;
2. registre em `providers/registry.ts`:
   ```ts
   const FACTORIES = {
     mercadopago: () => new MercadoPagoPaymentProvider(),
     pagarme: () => new PagarMePaymentProvider(),
   };
   ```
3. `PAYMENTS_PROVIDER=pagarme`.

Nenhuma regra de negócio muda: Orders, Products, licenças e e-mails só falam com
a interface.

### Outro EmailProvider

1. implemente `EmailProvider` (`send`);
2. troque a escolha em `email/ResendEmailProvider.ts → getEmailProvider()`.

Os templates são funções puras e não mudam.

---

## 13. Produção

Antes de virar a chave:

1. aplicar `db/005_payments.sql` no banco de produção;
2. conferir/ajustar os preços em `products` — o banco é a fonte de verdade;
3. trocar as credenciais de teste pelas de produção e `PAYMENTS_ENV=production`;
4. cadastrar o webhook de produção e colar as assinaturas em
   `MERCADOPAGO_WEBHOOK_SECRET_TEST`/`MERCADOPAGO_WEBHOOK_SECRET_PRODUCTION`
   (e, opcionalmente, `MERCADOPAGO_APPLICATION_ID` para rotular o log);
5. verificar o domínio `davimf.dev` no Resend (SPF/DKIM) e criar as caixas
   `noreply@`, `financeiro@` e `contato@`;
6. definir `PAYMENTS_LICENSE_ENCRYPTION_KEY` (32 bytes base64) e **guardá-la**:
   perder essa chave torna as cópias cifradas irrecuperáveis (o hash, e portanto
   a ativação, continua funcionando);
7. `BOT_SUPPORT_USER_IDS` populado — sem isso ninguém consegue reembolsar;
8. teste de ponta a ponta em sandbox: Pix pago, cartão aprovado, cartão
   recusado, boleto, webhook duplicado, refund.

Pendências conhecidas:

- `abacate-checkout` / `fmm-claim` continuam registrados para não quebrar links
  antigos; remover quando não houver mais pedidos AbacatePay em aberto;
- webhook perdido: a licença e o e-mail de confirmação são entregues pela
  reconciliação do polling; um webhook posterior é deduplicado;
- cobrança de cartão salvo (`chargeSavedPaymentMethod`) exige um token novo do
  frontend — o Mercado Pago não permite cobrar só com o id do cartão.
