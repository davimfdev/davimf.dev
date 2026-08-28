import type { LegalContent } from './types';

const COMPANY = {
  name: '66.482.628 DAVI MONTEIRO FONSECA',
  cnpj: '66.482.628/0001-89',
  address: 'Rua 1, nº 281, Casa 2, Lote 22, Quadra 9, Jardim Santo Antônio, CEP 74853-130, Goiás',
  privacyEmail: 'privacidade@davimf.dev',
};

const IDENTIFICATION = `${COMPANY.name}, inscrita no CNPJ sob o nº ${COMPANY.cnpj}, com endereço em ${COMPANY.address}`;

/** Data da última revisão dos três documentos. Atualize ao mudar o texto. */
const UPDATED_AT = '28 de agosto de 2026';

export const legalPt: LegalContent = {
  company: COMPANY,

  privacy: {
    title: 'Política de Privacidade',
    updatedAt: `Última atualização: ${UPDATED_AT}`,
    summary:
      'Como coletamos, usamos, compartilhamos e protegemos seus dados pessoais, e como você exerce seus direitos.',
    sections: [
      {
        heading: 'Quem é o controlador',
        paragraphs: [
          `O controlador dos dados pessoais tratados neste site é ${IDENTIFICATION}.`,
          `Para exercer qualquer direito previsto nesta política, ou para tirar dúvidas sobre o tratamento dos seus dados, escreva para ${COMPANY.privacyEmail}.`,
        ],
      },
      {
        heading: 'Dados que coletamos',
        paragraphs: ['Coletamos apenas o necessário para o que você decide usar:'],
        bullets: [
          'Conta: ao entrar com o Discord, recebemos seu identificador, nome de usuário, avatar e e-mail.',
          'Compra: nome, sobrenome, e-mail, CPF ou CNPJ e telefone. Para boleto, também CEP, rua, número, bairro, cidade e estado.',
          'Pagamento: método, status, valor, e — no cartão — apenas bandeira e os quatro últimos dígitos.',
          'Uso do site: métricas de audiência, somente se você consentir com os cookies de análise.',
          'Suporte: o conteúdo das mensagens que você nos envia.',
        ],
      },
      {
        heading: 'Dados de cartão nunca passam por nós',
        paragraphs: [
          'O número do cartão, a validade e o código de segurança são digitados dentro de campos hospedados pelo Mercado Pago e transformados em um token no seu próprio navegador. Nosso servidor recebe apenas esse token de uso único.',
          'Em nenhum momento armazenamos, registramos ou temos acesso ao número completo do cartão ou ao código de segurança.',
        ],
      },
      {
        heading: 'Para que usamos e com qual base legal',
        paragraphs: [
          'Cada tratamento tem uma base legal da LGPD (Lei 13.709/2018):',
        ],
        bullets: [
          'Execução do contrato (art. 7º, V): processar a compra, entregar a licença, prestar suporte e gerenciar assinaturas.',
          'Obrigação legal e regulatória (art. 7º, II): guarda de registros fiscais e contábeis da venda.',
          'Legítimo interesse (art. 7º, IX): prevenção a fraude e segurança da operação, incluindo o identificador de dispositivo enviado ao Mercado Pago na cobrança.',
          'Consentimento (art. 7º, I): cookies de análise de audiência, que só são carregados após você aceitar.',
        ],
      },
      {
        heading: 'Com quem compartilhamos',
        paragraphs: [
          'Não vendemos seus dados e não os usamos para publicidade de terceiros. Compartilhamos apenas com quem é necessário para a operação, na condição de operadores:',
        ],
        bullets: [
          'Mercado Pago: processamento de pagamento e prevenção a fraude. Recebe os dados do pagador necessários para autorizar a cobrança.',
          'Resend: envio dos e-mails transacionais de confirmação e de entrega da licença.',
          'Discord: autenticação da sua conta, quando você escolhe entrar por ele.',
          'Provedor de infraestrutura: hospedagem do site e do banco de dados.',
        ],
      },
      {
        heading: 'Cookies e tecnologias semelhantes',
        paragraphs: [
          'Usamos cookies estritamente necessários para manter você autenticado e proteger o formulário de pagamento. Eles não dependem de consentimento porque, sem eles, o site não funciona.',
          'Usamos também cookies de análise de audiência (Google Analytics), que só são carregados depois que você aceita no aviso exibido na primeira visita. Se você recusar, o script não é carregado.',
          'Você pode mudar de ideia quando quiser pelo link "Preferências de cookies" no rodapé. Revogar é tão simples quanto aceitar.',
        ],
      },
      {
        heading: 'Por quanto tempo guardamos',
        paragraphs: [
          'Dados de conta são mantidos enquanto sua conta existir. Registros de compra e pagamento são mantidos pelo prazo exigido pela legislação fiscal, mesmo após o encerramento da conta, porque a guarda é obrigação legal.',
          'Dados de cobrança que você opta por salvar ficam guardados de forma cifrada até você removê-los.',
        ],
      },
      {
        heading: 'Seus direitos',
        paragraphs: [
          'O art. 18 da LGPD garante a você, a qualquer momento:',
        ],
        bullets: [
          'confirmação de que tratamos seus dados e acesso a eles;',
          'correção de dados incompletos, inexatos ou desatualizados;',
          'anonimização, bloqueio ou eliminação de dados desnecessários ou tratados em desconformidade;',
          'portabilidade dos dados a outro fornecedor;',
          'eliminação dos dados tratados com base no seu consentimento;',
          'informação sobre com quem compartilhamos seus dados;',
          'revogação do consentimento, a qualquer momento.',
        ],
      },
      {
        heading: 'Como exercer seus direitos',
        paragraphs: [
          `Envie o pedido para ${COMPANY.privacyEmail}. Respondemos no menor prazo possível e, em qualquer caso, dentro dos prazos da LGPD.`,
          'Alguns dados não podem ser eliminados a pedido enquanto durar a obrigação legal de guarda dos registros fiscais da compra. Nesse caso, explicaremos qual dado permanece e por quê.',
        ],
      },
      {
        heading: 'Segurança',
        paragraphs: [
          'Todo o tráfego do site é cifrado em trânsito. As chaves de licença e os dados de cobrança salvos são armazenados cifrados. O acesso administrativo é restrito e registrado.',
          'Nenhum sistema é imune a incidentes. Se ocorrer um incidente de segurança com risco relevante a você, comunicaremos você e a ANPD, conforme o art. 48 da LGPD.',
        ],
      },
      {
        heading: 'Alterações desta política',
        paragraphs: [
          'Podemos atualizar esta política para refletir mudanças no serviço ou na legislação. A data da última atualização fica sempre no topo desta página, e mudanças relevantes serão comunicadas pelos nossos canais.',
        ],
      },
    ],
  },

  terms: {
    title: 'Termos de Uso',
    updatedAt: `Última atualização: ${UPDATED_AT}`,
    summary: 'As regras da relação entre você e nós no uso do site e na compra de licenças.',
    sections: [
      {
        heading: 'Quem contrata com você',
        paragraphs: [
          `Os produtos e serviços deste site são fornecidos por ${IDENTIFICATION}.`,
          'Ao usar o site ou realizar uma compra, você concorda com estes Termos. Se não concordar, não utilize o serviço.',
        ],
      },
      {
        heading: 'O que é vendido',
        paragraphs: [
          'Vendemos licenças de uso de software. A compra dá a você uma chave de ativação pessoal e intransferível, pelo prazo indicado no produto adquirido, e não transfere a propriedade do software nem qualquer direito autoral sobre ele.',
          'O instalador do software é distribuído gratuitamente. O que você adquire é a licença que o habilita.',
        ],
      },
      {
        heading: 'Conta e cadastro',
        paragraphs: [
          'Algumas funções exigem conta, criada por meio do login com Discord. Você é responsável pela veracidade dos dados informados e por manter o acesso à sua conta em segurança.',
          'Os dados de cobrança que você informa no checkout precisam ser verdadeiros e seus. Dados incorretos podem impedir a autorização do pagamento pelo emissor do cartão.',
        ],
      },
      {
        heading: 'Preços e pagamento',
        paragraphs: [
          'Os preços estão em reais (BRL) e são os exibidos no momento da compra. Aceitamos Pix, cartão de crédito e boleto, processados pelo Mercado Pago.',
          'Podemos alterar preços a qualquer momento, mas a alteração nunca afeta uma compra já concluída.',
        ],
      },
      {
        heading: 'Entrega',
        paragraphs: [
          'A licença é liberada automaticamente após a confirmação do pagamento. No Pix e no cartão aprovado, isso costuma ocorrer em instantes; no boleto, após a compensação bancária, o que pode levar alguns dias úteis.',
          'A chave fica disponível na área "Minhas chaves" da sua conta e também é enviada por e-mail. Se o e-mail não chegar, a chave continua recuperável no site.',
        ],
      },
      {
        heading: 'O que você pode e o que não pode fazer',
        paragraphs: ['A licença é concedida para uso próprio. É vedado:'],
        bullets: [
          'revender, sublicenciar, alugar ou ceder a licença ou a chave de ativação;',
          'compartilhar a chave com terceiros ou publicá-la;',
          'realizar engenharia reversa, descompilar ou tentar burlar o mecanismo de licenciamento;',
          'usar o software para qualquer finalidade ilícita.',
        ],
      },
      {
        heading: 'Suporte e disponibilidade',
        paragraphs: [
          'Prestamos suporte pelos canais indicados no site, em horário comercial. Trabalhamos para manter o serviço disponível, mas não garantimos operação ininterrupta: manutenções, falhas de terceiros e casos fortuitos podem causar indisponibilidade temporária.',
        ],
      },
      {
        heading: 'Cancelamento e reembolso',
        paragraphs: [
          'Você tem direito de arrependimento de 7 dias, conforme o art. 49 do Código de Defesa do Consumidor. As condições, os prazos e o procedimento estão detalhados na nossa Política de Reembolso.',
        ],
      },
      {
        heading: 'Responsabilidade',
        paragraphs: [
          'Respondemos pelos vícios e defeitos do produto nos termos do Código de Defesa do Consumidor. Nada nestes Termos exclui ou limita direitos que a lei garante ao consumidor.',
          'Não respondemos por danos decorrentes de uso indevido do software, de alterações feitas por você ou por terceiros, ou de indisponibilidade de serviços de terceiros fora do nosso controle.',
        ],
      },
      {
        heading: 'Alterações destes Termos',
        paragraphs: [
          'Podemos alterar estes Termos a qualquer tempo. A data da última atualização fica no topo desta página. Alterações não retroagem sobre compras já concluídas.',
        ],
      },
      {
        heading: 'Lei aplicável e foro',
        paragraphs: [
          'Estes Termos são regidos pelas leis brasileiras. Fica eleito o foro do domicílio do consumidor para dirimir controvérsias, conforme o Código de Defesa do Consumidor.',
        ],
      },
    ],
  },

  refund: {
    title: 'Política de Reembolso',
    updatedAt: `Última atualização: ${UPDATED_AT}`,
    summary: 'Seu direito de arrependimento, como pedir reembolso e o que acontece com a licença.',
    sections: [
      {
        heading: 'Direito de arrependimento: 7 dias',
        paragraphs: [
          'Por se tratar de compra realizada fora do estabelecimento comercial, você pode desistir da contratação em até 7 dias corridos contados da data da compra, conforme o art. 49 do Código de Defesa do Consumidor.',
          'Nesse prazo você não precisa justificar o motivo, e o valor pago é devolvido integralmente.',
        ],
      },
      {
        heading: 'Como solicitar',
        paragraphs: [
          `Envie um pedido para ${COMPANY.privacyEmail} informando o e-mail da conta e o número do pedido. O número do pedido está no e-mail de confirmação da compra e na área "Meus pedidos".`,
          'Confirmamos o recebimento e processamos o reembolso pelo mesmo meio de pagamento utilizado na compra.',
        ],
      },
      {
        heading: 'Prazos da devolução',
        paragraphs: [
          'O estorno é solicitado ao Mercado Pago assim que aprovamos o pedido. O prazo até o dinheiro aparecer para você depende do meio de pagamento: no Pix costuma ser rápido; no cartão de crédito, o estorno aparece na fatura do próprio mês ou na seguinte, conforme o ciclo do seu emissor.',
          'Esse prazo final é do emissor do cartão e do Mercado Pago, e está fora do nosso controle.',
        ],
      },
      {
        heading: 'O que acontece com a licença',
        paragraphs: [
          'No reembolso integral, a chave de licença correspondente àquele pedido é revogada e deixa de funcionar. No reembolso parcial, a chave é suspensa.',
          'É a contrapartida natural da devolução: o valor volta para você e o produto deixa de ser utilizável.',
        ],
      },
      {
        heading: 'Depois dos 7 dias',
        paragraphs: [
          'Passado o prazo de arrependimento, a compra não é mais reembolsável por simples desistência. Isso não afeta seus direitos em caso de vício do produto: se o software não funcionar como anunciado, você continua amparado pelo art. 26 do Código de Defesa do Consumidor.',
          'Nesses casos, fale conosco: buscamos primeiro corrigir o problema e, não sendo possível, tratamos da devolução.',
        ],
      },
      {
        heading: 'Assinaturas',
        paragraphs: [
          'Em produtos com renovação automática, você pode cancelar a renovação a qualquer momento pela sua conta. O cancelamento impede as cobranças futuras e não devolve, por si só, o período já pago, que segue válido até o fim.',
        ],
      },
      {
        heading: 'Antes de abrir uma contestação',
        paragraphs: [
          'Se algo deu errado, fale conosco primeiro. Uma contestação aberta no cartão (chargeback) suspende a licença automaticamente e costuma demorar mais do que um reembolso pedido diretamente a nós.',
        ],
      },
    ],
  },

  consent: {
    message:
      'Usamos cookies necessários para o site funcionar e, com a sua permissão, cookies de análise para entender como o site é usado. Você pode recusar sem prejuízo de nenhuma funcionalidade.',
    acceptLabel: 'Aceitar análise',
    rejectLabel: 'Recusar',
    policyLinkLabel: 'Política de Privacidade',
    preferencesLabel: 'Preferências de cookies',
  },

  footer: {
    terms: 'Termos de Uso',
    privacy: 'Política de Privacidade',
    refund: 'Política de Reembolso',
  },
};
