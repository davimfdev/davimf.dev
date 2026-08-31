# Capturas de produto

Estas imagens são **conteúdo**: provas de que os produtos existem. Não são
decoração e não devem ser tratadas.

## Regras

- Não dessature, não recolore, não aplique filtro. Uma captura tratada deixa de
  ser prova e vira ilustração.
- A identidade visual do produto capturado pode divergir da paleta do site.
  Isso é esperado: o retângulo contém o produto real.
- O recorte acontece por CSS, em `src/features/home/homeData.ts`
  (`WORK_IMAGES`), com `scale`, `offsetX` e `offsetY`. Se você depositar uma
  imagem já recortada, zere os três.

## Arquivos esperados

| Arquivo | Conteúdo | Situação |
|---|---|---|
| `fmm-mods.png` | FMM — grade de mods com os grupos ESTRADAS e GRAFICOS | presente |
| `fmm-optimization.png` | FMM — fileira CPU / GPU / RAM / ANÁLISE GERAL | presente |
| `basebot-servers.png` | BaseBot — painel de servidores com servidores reais | **pendente** |
| `basebot-config.png` | BaseBot — painel de configuração de um bot | **pendente** |

## Por que as do BaseBot não foram geradas automaticamente

Não há navegador headless no projeto, e instalar um seria dependência nova. Além
disso o painel exige sessão do Discord (`/api/dashboard-session` responde 401
sem ela) e os dados vêm dos servidores do dono e do banco `bot_configs` — uma
captura automatizada mostraria uma casca vazia, não o produto.
