# Product

## Register

product

## Users

Donos de comunidades Discord que contratam e configuram o BaseBot, pessoas e cargos delegados por esses donos e a equipe de suporte global. Eles precisam diagnosticar a saúde da integração e ajustar muitos módulos com segurança, sem conhecer a estrutura interna do banco ou digitar IDs manualmente.

## Product Purpose

O dashboard é o painel operacional do BaseBot. Ele transforma a configuração centralizada no Neon em fluxos compreensíveis, valida recursos contra snapshots reais do Discord e deixa claro quando uma alteração está pronta, bloqueada ou exige ação no servidor. O produto tem sucesso quando o dono consegue instalar, configurar e manter o bot sem assistência, enquanto o suporte consegue intervir com contexto e auditoria.

## Brand Personality

Preciso, confiável e acolhedor. A interface deve transmitir domínio técnico sem parecer uma ferramenta interna hostil, mantendo a identidade escura e expressiva do davimf.dev com uma camada de produto mais disciplinada.

## Anti-references

- Painéis SaaS genéricos compostos por grades intermináveis de cards idênticos.
- Interfaces gamer excessivamente neon, saturadas ou ornamentadas.
- Admins corporativos cinzentos, densos e sem hierarquia visual.
- Glassmorphism decorativo, gradientes de texto e animações que atrasam o trabalho.
- Formulários que expõem nomes de colunas, JSON ou IDs Discord como principal modelo mental.

## Design Principles

1. Saúde antes de configuração: presença do bot, frescor dos snapshots e bloqueios aparecem antes dos controles afetados.
2. Complexidade progressiva: a navegação apresenta módulos e tarefas; detalhes técnicos aparecem somente quando ajudam a decidir ou corrigir.
3. Autoridade visível e segura: dono, delegado e suporte entendem claramente seu nível de acesso, sem o frontend assumir autorização.
4. Familiaridade operacional: controles, tabelas, feedback e navegação seguem padrões reconhecíveis e consistentes.
5. Recuperação orientada: estados vazios e erros explicam a próxima ação possível em vez de apenas anunciar falha.

## Accessibility & Inclusion

Alvo WCAG 2.1 AA. Todo fluxo essencial deve funcionar por teclado, com foco visível, contraste mínimo adequado, alvos confortáveis e estados que não dependem apenas de cor. Movimento respeita `prefers-reduced-motion`; drawers, menus e mensagens possuem semântica e rótulos acessíveis.
