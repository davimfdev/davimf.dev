import type { LegalContent } from '../../types';

const COMPANY = {
  name: '66.482.628 DAVI MONTEIRO FONSECA',
  cnpj: '66.482.628/0001-89',
  address: 'Rua 1, nº 281, Casa 2, Lote 22, Quadra 9, Jardim Santo Antônio, Goiânia - GO, CEP 74853-130',
  privacyEmail: 'privacidade@davimf.dev',
  supportEmail: 'contato@davimf.dev',
  billingEmail: 'financeiro@davimf.dev',
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
          'Segurança: um identificador do dispositivo gerado pelo SDK do Mercado Pago no seu navegador, enviado junto da cobrança para prevenção a fraude.',
          'Dados técnicos: como todo servidor web, a infraestrutura que hospeda o site registra endereço IP, data e hora de acesso e informações básicas do navegador e do dispositivo, necessários à segurança, ao diagnóstico e à prevenção de abuso.',
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
        ],
      },
      {
        heading: 'Com quem compartilhamos',
        paragraphs: [
          'Não vendemos seus dados e não os usamos para publicidade de terceiros. Compartilhamos apenas com terceiros necessários à prestação dos serviços.',
          'Conforme a atividade efetivamente realizada, esses terceiros podem atuar como operadores em nosso nome ou como controladores independentes, sujeitos às suas próprias obrigações legais e políticas de privacidade:',
        ],
        bullets: [
          'Mercado Pago: processamento de pagamento, prevenção a fraude e cumprimento de obrigações financeiras e regulatórias próprias. Recebe os dados do pagador necessários para autorizar a cobrança.',
          'Resend: infraestrutura de envio dos e-mails transacionais de confirmação e de entrega da licença.',
          'Discord: autenticação da sua conta, quando você escolhe entrar por ele.',
          'Provedor de infraestrutura: hospedagem do site e do banco de dados.',
        ],
      },
      {
        heading: 'Cookies e tecnologias semelhantes',
        paragraphs: [
          'Usamos apenas cookies estritamente necessários: os que mantêm você autenticado e os que protegem o formulário de pagamento. Eles não dependem de consentimento porque, sem eles, o site não funciona.',
          'Não usamos cookies de análise de audiência, publicidade ou rastreamento de terceiros. Nenhum script de medição é carregado neste site, e por isso não existe aviso de cookies a aceitar ou recusar.',
          'Se um dia passarmos a medir audiência, esta seção será atualizada antes, e qualquer medição que dependa de consentimento só começará depois de você aceitar.',
        ],
      },
      {
        heading: 'Por quanto tempo guardamos',
        paragraphs: [
          'Dados de conta são mantidos enquanto sua conta existir. Registros de compra e pagamento são mantidos pelo prazo exigido pela legislação fiscal, mesmo após o encerramento da conta, porque a guarda é obrigação legal.',
          'Dados de cobrança que você opta por salvar ficam guardados de forma cifrada até você removê-los.',
          'O registro do seu consentimento de cookies fica no seu próprio navegador e some quando você limpa os dados do site.',
          'Registros técnicos da infraestrutura e dados usados na prevenção a fraude são mantidos pelo tempo necessário à segurança da operação e ao cumprimento de obrigações legais.',
          'Mensagens de suporte são mantidas enquanto necessárias ao atendimento e à comprovação do que foi tratado.',
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
          'informação sobre a possibilidade de não fornecer consentimento e sobre as consequências da recusa;',
          'revogação do consentimento, a qualquer momento;',
          'oposição a tratamento realizado sem consentimento, quando houver descumprimento da lei;',
          'revisão de decisões tomadas unicamente com base em tratamento automatizado que afetem seus interesses;',
          'petição perante a ANPD e os órgãos de defesa do consumidor.',
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
        heading: 'Transferências internacionais de dados',
        paragraphs: [
          'O site e o banco de dados são hospedados no BRASIL. Seu cadastro, seus pedidos e suas licenças ficam em território nacional, e essa parte do tratamento não envolve transferência internacional.',
          'Dois serviços tratam dados no exterior, ambos nos Estados Unidos:',
        ],
        bullets: [
          'Resend (Plus Five Five, Inc., São Francisco, Califórnia): envio dos e-mails transacionais. Recebe o endereço de destino e o conteúdo da mensagem, atua como operador, apoia a transferência nas cláusulas contratuais padrão e apaga os dados em até 90 dias após o encerramento da conta.',
          'Discord (São Francisco, Califórnia): autenticação, quando você escolhe entrar com a conta Discord. Atua como controlador independente sobre os dados da sua conta Discord, com política de privacidade própria.',
        ],
      },
      {
        heading: 'Segurança',
        paragraphs: [
          'Todo o tráfego do site é cifrado em trânsito. As chaves de licença e os dados de cobrança salvos são armazenados cifrados. O acesso administrativo é restrito e registrado.',
          'Nenhum sistema é imune a incidentes. Se ocorrer um incidente de segurança que possa acarretar risco ou dano relevante aos titulares, adotaremos as medidas cabíveis e faremos as comunicações exigidas à ANPD e aos titulares afetados, nos prazos previstos na legislação e na regulamentação aplicáveis.',
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
          `Atendimento ao consumidor: ${COMPANY.supportEmail}. Assuntos financeiros e reembolso: ${COMPANY.billingEmail}. Dados pessoais e direitos da LGPD: ${COMPANY.privacyEmail}.`,
          'Ao usar o site ou realizar uma compra, você concorda com estes Termos. Se não concordar, não utilize o serviço.',
        ],
      },
      {
        heading: 'O que é vendido',
        paragraphs: [
          'Vendemos licenças de uso de software. A compra dá a você uma chave de ativação pessoal e intransferível, pelo prazo indicado no produto adquirido, e não transfere a propriedade do software nem qualquer direito autoral sobre ele.',
          'O instalador do software é distribuído gratuitamente. O que você adquire é a licença que o habilita.',
          'Cada chave ativa o software em UM único computador. A primeira ativação vincula a chave àquela máquina, e tentativas de ativar em outra são recusadas.',
          `Trocou de computador, formatou ou mudou de hardware? Peça a desvinculação em ${COMPANY.supportEmail} e a chave volta a poder ser ativada. Enquanto houver suporte ao produto, a desvinculação é gratuita e não tem limite de vezes.`,
          'Produtos identificados como vitalícios são licenças sem renovação periódica, sem nova cobrança e sem data de expiração. Não dependem de assinatura ativa.',
          'Se o software for descontinuado, ou seja, se deixarmos de publicar atualizações, antes disso publicaremos uma versão final e deixaremos de vender novas licenças. Quem já tiver licença vitalícia receberá uma chave definitiva para essa versão, sem prazo e sem vínculo a uma máquina específica.',
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
          'Alterações de preço não afetam períodos já pagos. Em assinaturas, um novo preço é informado a você antes da renovação em que passe a ser aplicado, e você pode cancelar a renovação antes dessa cobrança.',
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
          'Podemos alterar estes Termos a qualquer tempo, e a data da última atualização fica no topo desta página.',
          'Alterações relevantes não modificam retroativamente as condições do período já contratado. Em serviços com renovação periódica, alterações aplicáveis a períodos futuros são informadas a você previamente, e você pode cancelar a renovação antes da próxima cobrança.',
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
          'Por se tratar de compra realizada fora do estabelecimento comercial, você pode exercer o direito de arrependimento no prazo de 7 dias corridos, contado da contratação ou do recebimento/disponibilização do produto ou serviço, conforme aplicável, nos termos do art. 49 do Código de Defesa do Consumidor.',
          'Nesse prazo você não precisa justificar o motivo, e o valor pago é devolvido integralmente.',
        ],
      },
      {
        heading: 'Como solicitar',
        paragraphs: [
          `Você pode solicitar o exercício do direito de arrependimento diretamente na área "Meus pedidos", pelo botão "Solicitar reembolso", ou pelo e-mail ${COMPANY.billingEmail}, informando o e-mail da conta e o número do pedido.`,
          'Confirmamos imediatamente o recebimento da solicitação.',
        ],
      },
      {
        heading: 'Prazos da devolução',
        paragraphs: [
          'Recebida uma solicitação válida de exercício do direito de arrependimento dentro do prazo legal, confirmamos o recebimento e solicitamos o estorno ao Mercado Pago. O prazo até o dinheiro aparecer para você depende do meio de pagamento: no Pix costuma ser rápido; no cartão de crédito, o estorno aparece na fatura do próprio mês ou na seguinte, conforme o ciclo do seu emissor.',
          'Esse prazo final é do emissor do cartão e do Mercado Pago, e está fora do nosso controle.',
        ],
      },
      {
        heading: 'O que acontece com a licença',
        paragraphs: [
          'No reembolso integral, a chave de licença correspondente àquele pedido é revogada e deixa de funcionar. É a contrapartida da devolução integral do valor.',
          'Em caso de reembolso parcial, abatimento proporcional ou outro acordo, os efeitos sobre a licença são definidos conforme a solução adotada e informados a você antes da conclusão.',
        ],
      },
      {
        heading: 'Depois dos 7 dias',
        paragraphs: [
          'Passado o prazo de arrependimento, a compra não é mais reembolsável por simples desistência. Isso não afeta seus direitos em caso de vício ou defeito do produto ou serviço, que continuam assegurados pelo Código de Defesa do Consumidor, inclusive nos termos dos arts. 18, 20 e 26, conforme aplicável.',
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
          'Se algo deu errado, fale conosco primeiro. Enquanto uma contestação de pagamento estiver em análise, a licença relacionada à transação poderá ser suspensa temporariamente até a conclusão da disputa, e o processo costuma demorar mais do que um reembolso pedido diretamente a nós.',
        ],
      },
    ],
  },

  footer: {
    terms: 'Termos de Uso',
    privacy: 'Política de Privacidade',
    refund: 'Política de Reembolso',
  },
};
