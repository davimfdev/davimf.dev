/**
 * Forma dos documentos legais.
 *
 * O conteúdo vive aqui, e não em `LanguageContext`, porque aquele arquivo já
 * carrega rótulos de navegação, catálogo de produtos e links de pagamento —
 * somar três documentos jurídicos ali tornaria a manutenção pior.
 *
 * `LegalContent` é o contrato: `pt.ts` e `en.ts` o satisfazem, então uma seção
 * traduzida em um idioma e esquecida no outro é erro de compilação, não uma
 * página quebrada em produção.
 */

export type LegalSection = {
  heading: string;
  /** Parágrafos na ordem de leitura. */
  paragraphs: string[];
  /** Itens destacados em bloco, quando a seção enumera algo. */
  bullets?: string[];
};

export type LegalDocument = {
  title: string;
  /** Texto exibido como "última atualização"; datado à mão a cada revisão. */
  updatedAt: string;
  /** Chamada curta abaixo do título. */
  summary: string;
  sections: LegalSection[];
};

/**
 * Identificação do fornecedor/controlador. Exigida pelo CDC (endereço do
 * fornecedor) e pela LGPD (identidade do controlador e canal do titular).
 */
export type LegalCompany = {
  name: string;
  cnpj: string;
  address: string;
  /** Canal do titular de dados (LGPD). */
  privacyEmail: string;
  /** Atendimento comercial exigido pelo Decreto 7.962/2013. */
  supportEmail: string;
  /** Pedidos de reembolso: assunto financeiro, não de privacidade. */
  billingEmail: string;
};

export type ConsentCopy = {
  message: string;
  acceptLabel: string;
  rejectLabel: string;
  policyLinkLabel: string;
  preferencesLabel: string;
};

export type LegalFooterCopy = {
  terms: string;
  privacy: string;
  refund: string;
};

export type LegalContent = {
  company: LegalCompany;
  privacy: LegalDocument;
  terms: LegalDocument;
  refund: LegalDocument;
  consent: ConsentCopy;
  footer: LegalFooterCopy;
};
