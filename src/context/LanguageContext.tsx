import React, { createContext, useContext, useState } from 'react';

type Language = 'pt' | 'en';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  translations: typeof translations[Language];
}

const translations = {
  pt: {
    greeting: "Olá, me chamo",
    description: "Um desenvolvedor especializado em back-end, com experiência em desenvolvimento de bots para Discord. Atualmente sou estagiário de T.I buscando sempre aprender e crescer na área de tecnologia.",
    viewWork: "Ver Meu Trabalho",
    getInTouch: "Entre em Contato",
    home: "Início",
    portfolio: "Portfólio",
    resume: "Currículo",
    products: "Produtos",
    contact: "Contato",
    features: "Funcionalidades",
    todoList: "Lista de Tarefas",
    financeManager: "Finanças",
    calculator: "Calculadora",
    urlShortener: "Encurtador de URL",
    roulette: "Roleta",
    login: "Login",
    register: "Registrar",
    logout: "Sair",
    rights: "Todos os direitos reservados.",
    contactP: "Contate-me",
    connect: "Fale Comigo",
    name: "Nome",
    message: "Mensagem",
    productsAndServices: "Produtos e Serviços",
    learnMore: "Saiba Mais",
    buyNow: "Comprar",
    sendMessage: "Enviar Mensagem",
    viewProject: "Ver projeto",
    projectsList: [
      { id: 1, title: "Discord Bot", description: "Um bot completamente personalizavel, focado em moderação e segurança.", image: "https://bs-uploads.toptal.io/blackfish-uploads/components/blog_post_page/4088758/cover_image/retina_1708x683/cover-how-to-make-a-discord-bot-0afaa27d630de8c4b711f5cd5abbf01f.png", link: "/plans" }
    ],
    productList: [
      { id: 1, name: "Conhecer os bots do discord", description: "Um bot completamente personálizavel, focado em moderação e segurança.", image: "https://bs-uploads.toptal.io/blackfish-uploads/components/blog_post_page/4088758/cover_image/retina_1708x683/cover-how-to-make-a-discord-bot-0afaa27d630de8c4b711f5cd5abbf01f.png", link: "/plans" }
    ],
    downloadPDF: "Baixar PDF",
    personalInfo: "Dados Pessoais",
    phone: "(62) 98608-9609",
    email: "davimf9702@gmail.com",
    knowledge: "Conhecimentos",
    skills: "Habilidades",
    attitudes: "Atitudes",
    knowledgeList: ["Ciência da Computação", "Golang", "Java", "SQL", "T.I", "Analise de Dados"],
    skillsList: ["Facilidade para aprender", "Ótimo raciocínio lógico", "Capacidade para realizar procedimentos de informática", "Ingles Avançado"],
    tools: "Ferramentas",
    toolsList: ["Git", "Docker", "D-Guard", "Postman"],
    experience: "Experiência",
    experienceList: [
      { title: "Estagiário de T.I.", company: "New Line Tecnologia Em Seguranca Ltda", link: "https://newlineseguranca.com.br/", period: "Agosto 2023 - Atualmente", description: "Experiência com redes, manutenção de infraestrutura, ActiveDirectory e outras tecnologias de monitoramento." },
      { title: "Monitor de Alarmes e Câmeras de Segurança", company: "Safety House - Serviços de Segurança LTDA", link: "https://safetyhouse.com.br/", period: "Outubro de 2021 - Março de 2022", description: "Monitoramento de alarmes e câmeras de segurança durante o período noturno." }
    ],
    education: "Formação",
    educationList: [
      { course: "Ciências da Computação (Superior)", institution: "Instituto Federal de Goiás, Anápolis", link: "https://www.ifg.edu.br/", period: "Fevereiro de 2020 - Atualmente", description: "Curso avaliado pelo e-MEC com 5 pontos (nota máxima). Com ênfase em Desenvolvimento de Software, Pesquisa Operacional e Aprendizado de Máquina." },
      { course: "Ensino Médio", institution: "Colégio Protágoras, Goiânia", link: "http://www.colegioprotagoras.com.br/", period: "Janeiro de 2017 - Dezembro de 2019", description: "Aluno sem reprovações ou dependências. Colégio entre os 3 primeiros colocados de Goiás no ENEM." }
    ],
    manager: "Gerente",
    calculatorTitle: "OCEANIA CALC",
    itemCategory: "Categoria do Item",
    selectCategory: "Selecione uma Categoria",
    farm: "Farm",
    weapons: "Armas",
    ammunition: "Munições",
    drugs: "Drogas",
    contraband: "Contrabando",
    illegalServices: "Serviços Ilegais",
    item: "Item",
    quantity: "Quantidade",
    totalWithPartnership: "Total com Parceria",
    totalWithoutPartnership: "Total sem Parceria",
    unitPriceWithPartnership: "Preço Un. (Com Parceria)",
    unitPriceWithoutPartnership: "Preço Un. (Sem Parceria)",
    plans: "Planos",
    discordBotPlans: "Planos de Bot para Discord",
    fivemFactionPlans: "Planos de Facção para FiveM",
    monthly: "Mensal",
    annually: "Anual",
    subscribe: "Assinar",
    month: "mês",
    year: "ano",
    annualDiscount: "Economize 16% com o plano anual!",
    discordPlans: [
        { title: "Básico", price: 35, features: ["logs", "verification", "security", "moderation", "limited_customization", "paid_features"], paymentLinks: { monthly: "https://www.mercadopago.com.br/subscriptions/checkout?preapproval_plan_id=01bac1298ea84b9ea952483a553811ec", annually: "https://www.mercadopago.com.br/subscriptions/checkout?preapproval_plan_id=52e56a46d88345418fe1472f0c443e1d" } },
        { title: "Intermediário", price: 50, features: ["all_basic", "vip", "five_new_features", "advanced_security", "hour_counting"], paymentLinks: { monthly: "https://www.mercadopago.com.br/subscriptions/checkout?preapproval_plan_id=59aab9185a0e4ca4be5334bfabd8dd6d", annually: "https://www.mercadopago.com.br/subscriptions/checkout?preapproval_plan_id=352c67ff541b492fb3126d3164928057" } },
        { title: "Avançado", price: 70, features: ["all_intermediate", "unlimited_features", "full_customization", "large_servers", "priority_support", "proactive_monitoring"], paymentLinks: { monthly: "https://www.mercadopago.com.br/subscriptions/checkout?preapproval_plan_id=47804a73dbed428bb9cec0852384e45c", annually: "https://www.mercadopago.com.br/subscriptions/checkout?preapproval_plan_id=60abafc09b384dee87ea6a0504bdd8cc" } }
    ],
    fivemPlans: [
        { title: "Base", price: 35, features: ["basic_features", "sell_logs", "production_logs", "sets"], paymentLinks: { monthly: "https://www.mercadopago.com.br/subscriptions/checkout?preapproval_plan_id=01bac1298ea84b9ea952483a553811ec", annually: "https://www.mercadopago.com.br/subscriptions/checkout?preapproval_plan_id=52e56a46d88345418fe1472f0c443e1d" } },
        { title: "Intermediário", price: 50, features: ["all_base", "financial_panel", "report_system"], paymentLinks: { monthly: "https://www.mercadopago.com.br/subscriptions/checkout?preapproval_plan_id=59aab9185a0e4ca4be5334bfabd8dd6d", annually: "https://www.mercadopago.com.br/subscriptions/checkout?preapproval_plan_id=352c67ff541b492fb3126d3164928057" } },
        { title: "Avançado", price: 70, features: ["all_intermediate_fivem", "full_customization_fivem", "free_new_features", "priority_support_fivem"], paymentLinks: { monthly: "https://www.mercadopago.com.br/subscriptions/checkout?preapproval_plan_id=47804a73dbed428bb9cec0852384e45c", annually: "https://www.mercadopago.com.br/subscriptions/checkout?preapproval_plan_id=60abafc09b384dee87ea6a0504bdd8cc" } }
    ],
    planFeatures: {
        discord: { logs: "Módulos de log", verification: "Verificação de entrada", security: "Módulos de segurança", moderation: "Moderação", limited_customization: "Customização limitada", paid_features: "Novas funcionalidades pagas à parte", all_basic: "Tudo do plano Básico", vip: "Sistemas de VIP", five_new_features: "Até 5 funcionalidades novas inclusas", advanced_security: "Sistemas de segurança mais avançados", hour_counting: "Sistema de contagem de horas", all_intermediate: "Tudo do plano Intermediário", unlimited_features: "Funcionalidades novas ilimitadas", full_customization: "Bot totalmente customizável", large_servers: "Preparado para GRANDES servidores", priority_support: "Suporte prioritário", proactive_monitoring: "Monitoramento proativo do desempenho" },
        fivem: { basic_features: "Funcionalidades do plano Base", sell_logs: "Logs de venda", production_logs: "Logs de produção", sets: "Sets", all_base: "Tudo do plano Base", financial_panel: "Painel financeiro", report_system: "Sistema de relatórios", all_intermediate_fivem: "Tudo do plano Intermediário", full_customization_fivem: "100% de personalização", free_new_features: "Novas funcionalidades gratuitas", priority_support_fivem: "Suporte prioritário" }
    },
    urlShortenerTitle: "Encurtador de URL",
    urlShortenerPlaceholder: "Digite a URL para encurtar",
    urlShortenerButton: "Encurtar",
    urlShortenerLoading: "Encurtando...",
    urlShortenerResult: "URL Encurtada:",
    urlShortenerError: "Ocorreu um erro. Por favor, tente novamente.",
    urlShortenerEnterUrl: "Por favor, digite uma URL.",
    financeManagerTitle: "Gerenciador Financeiro",
    addTransaction: "Adicionar Transação",
    amount: "Valor",
    category: "Categoria",
    type: "Tipo",
    income: "Receita",
    expense: "Despesa",
    bank: "Banco",
    date: "Data",
    add: "Adicionar",
    totalBalance: "Saldo Total",
    banks: "Bancos",
    addBank: "Adicionar Banco",
    bankName: "Nome do Banco",
    initialBalance: "Saldo Inicial",
    recentTransactions: "Transações Recentes",
    edit: "Editar",
    delete: "Excluir",
    update: "Atualizar",
    cancel: "Cancelar",
    confirm: "Confirmar",
    confirmDelete: "Tem certeza que deseja excluir esta transação?",
    confirmDeleteBank: "Tem certeza que deseja excluir este banco? Todas as transações associadas serão perdidas.",
    expenseByCategory: "Despesas por Categoria",
    expenseByType: "Despesas por Tipo",
    pix: "Pix",
    card: "Cartão",
    futureExpenses: "Despesas Futuras",
    paymentMonth: "Mês de Pagamento",
    pay: "Pagar",
    selectBankToPay: "Selecione o banco para pagar",
    makeTransfer: "Realizar Transferência",
    from: "De",
    to: "Para",
    transfer: "Transferir",
    transferring: "Transferindo...",
    transferSuccess: "Transferência realizada com sucesso.",
    transferError: "Falha ao realizar transferência.",
    allFieldsRequired: "Todos os campos são obrigatórios.",
    transferDescriptionPlaceholder: "Ex: Transferência entre contas"
  },
  en: {
    greeting: "Hello, I'm",
    description: "A backend developer with experience in Discord bot development. Currently working as an I.T trainee, always seeking to learn and grow in the technology field.",
    viewWork: "View My Work",
    getInTouch: "Get in Touch",
    home: "Home",
    portfolio: "Portfolio",
    resume: "Resume",
    products: "Products",
    contact: "Contact",
    features: "Features",
    todoList: "To-Do List",
    financeManager: "Finances",
    calculator: "Calculator",
    urlShortener: "URL Shortener",
    roulette: "Roulette",
    login: "Login",
    register: "Register",
    logout: "Logout",
    rights: "All rights reserved.",
      contactP: "Contact Me",
      connect: "Connect With Me",
      name: "Name",
      message: "Message",
      productsAndServices: "Product & Services",
      learnMore: "Learn More",
      buyNow: "Buy Now",
      sendMessage: "Send Message",
      viewProject: "View project",
      projectsList: [
          {
              id: 1,
              title: "Discord Bot",
              description: "A fully customizable bot focused on moderation and security.",
              image: "https://bs-uploads.toptal.io/blackfish-uploads/components/blog_post_page/4088758/cover_image/retina_1708x683/cover-how-to-make-a-discord-bot-0afaa27d630de8c4b711f5cd5abbf01f.png",
              link: "/plans"
          }
      ],
      productList: [
          {
              id: 1,
              name: "Discover the discord bots",
              description: "A fully customizable bot focused on moderation and security.",
              image: "https://bs-uploads.toptal.io/blackfish-uploads/components/blog_post_page/4088758/cover_image/retina_1708x683/cover-how-to-make-a-discord-bot-0afaa27d630de8c4b711f5cd5abbf01f.png",
              link: "/plans"
          }

      ],
      downloadPDF: "Download PDF",

      personalInfo: "Personal Information",
      phone: "(62) 98608-9609",
      email: "davimf9702@gmail.com",

      knowledge: "Knowledge",
      skills: "Skills",
      attitudes: "Attitudes",

      knowledgeList: ["Computer Science", "Golang", "Java", "SQL", "I.T", "Data Analysis"],
      skillsList: [
          "Fast learner",
          "Great logical reasoning",
          "Ability to perform IT procedures",
          "Advanced English"
      ],

      tools: "Tools",
      toolsList: ["Git", "Docker", "D-Guard", "Postman"],

      experience: "Experience",
      experienceList: [
          {
              title: "IT Intern",
              company: "New Line Tecnologia Em Segurança Ltda",
              link: "https://newlineseguranca.com.br/",
              period: "August 2023 - Present",
              description: "Experience with networks, infrastructure maintenance, Active Directory, and other monitoring technologies."
          },

          {
              title: "Security Alarm and Camera Monitor",
              company: "Safety House - Security Services LTDA",
              link: "https://safetyhouse.com.br/",
              period: "October 2021 - March 2022",
              description: "Monitored security alarms and cameras during night shifts."
          }

      ],

      education: "Education",
      educationList: [
          {
              course: "Computer Science (Bachelor's)",
              institution: "Federal Institute of Goiás, Anápolis",
              link: "https://www.ifg.edu.br/",
              period: "February 2020 - Present",
              description:
                  "Rated 5 stars by e-MEC. Focuses on Software Development, Operational Research, and Machine Learning."
          },
          {
              course: "High School",
              institution: "Colégio Protágoras, Goiânia",
              link: "http://www.colegioprotagoras.com.br/",
              period: "January 2017 - December 2019",
              description: "Graduated without failures. School ranked among the top 3 in Goiás on ENEM."
          }
      ],
      manager: "Manager",

      // Calculator
      calculatorTitle: "OCEANIA CALC",
      itemCategory: "Item Category",
      selectCategory: "Select a Category",
      farm: "Farm",
      weapons: "Weapons",
      ammunition: "Ammunition",
      drugs: "Drugs",
      contraband: "Contraband",
      illegalServices: "Illegal Services",
      item: "Item",
      quantity: "Quantity",
      totalWithPartnership: "Total with Partnership",
      totalWithoutPartnership: "Total without Partnership",
      unitPriceWithPartnership: "Unit Price (with Partnership)",
      unitPriceWithoutPartnership: "Unit Price (without Partnership)",

      plans: "Plans",
      discordBotPlans: "Discord Bot Plans",
      fivemFactionPlans: "FiveM Faction Plans",
      monthly: "Monthly",
      annually: "Annually",
      subscribe: "Subscribe",
      month: "month",
      year: "year",
      annualDiscount: "Save 16% with the annual plan!",
      discordPlans: [
          {
              title: "Basic",
              price: 35,
              features: ["logs", "verification", "security", "moderation", "limited_customization", "paid_features"],
              paymentLinks: {
                  monthly: "https://www.mercadopago.com.br/subscriptions/checkout?preapproval_plan_id=01bac1298ea84b9ea952483a553811ec",
                  annually: "https://www.mercadopago.com.br/subscriptions/checkout?preapproval_plan_id=52e56a46d88345418fe1472f0c443e1d"
              }
          },
          {
              title: "Intermediate",
              price: 50,
              features: ["all_basic", "vip", "five_new_features", "advanced_security", "hour_counting"],
              paymentLinks: {
                  monthly: "https://www.mercadopago.com.br/subscriptions/checkout?preapproval_plan_id=59aab9185a0e4ca4be5334bfabd8dd6d",
                  annually: "https://www.mercadopago.com.br/subscriptions/checkout?preapproval_plan_id=352c67ff541b492fb3126d3164928057"
              }
          },
          {
              title: "Advanced",
              price: 70,
              features: ["all_intermediate", "unlimited_features", "full_customization", "large_servers", "priority_support", "proactive_monitoring"],
              paymentLinks: {
                  monthly: "https://www.mercadopago.com.br/subscriptions/checkout?preapproval_plan_id=47804a73dbed428bb9cec0852384e45c",
                  annually: "https://www.mercadopago.com.br/subscriptions/checkout?preapproval_plan_id=60abafc09b384dee87ea6a0504bdd8cc"
              }
          }
      ],
      fivemPlans: [
          {
              title: "Base",
              price: 35,
              features: ["basic_features", "sell_logs", "production_logs", "sets"],
              paymentLinks: {
                  monthly: "https://www.mercadopago.com.br/subscriptions/checkout?preapproval_plan_id=01bac1298ea84b9ea952483a553811ec",
                  annually: "https://www.mercadopago.com.br/subscriptions/checkout?preapproval_plan_id=52e56a46d88345418fe1472f0c443e1d"
              }
          },
          {
              title: "Intermediate",
              price: 50,
              features: ["all_base", "financial_panel", "report_system"],
              paymentLinks: {
                  monthly: "https://www.mercadopago.com.br/subscriptions/checkout?preapproval_plan_id=59aab9185a0e4ca4be5334bfabd8dd6d",
                  annually: "https://www.mercadopago.com.br/subscriptions/checkout?preapproval_plan_id=352c67ff541b492fb3126d3164928057"
              }
          },
          {
              title: "Advanced",
              price: 70,
              features: ["all_intermediate_fivem", "full_customization_fivem", "free_new_features", "priority_support_fivem"],
              paymentLinks: {
                  monthly: "https://www.mercadopago.com.br/subscriptions/checkout?preapproval_plan_id=47804a73dbed428bb9cec0852384e45c",
                  annually: "https://www.mercadopag.com.br/subscriptions/checkout?preapproval_plan_id=60abafc09b384dee87ea6a0504bdd8cc"
              }
          }
      ],
      planFeatures: {
          discord: {
              logs: "Log modules",
              verification: "Entry verification",
              security: "Security modules",
              moderation: "Moderation",
              limited_customization: "Limited customization",
              paid_features: "New features paid separately",
              all_basic: "Everything from the Basic plan",
              vip: "VIP systems",
              five_new_features: "Up to 5 new features included",
              advanced_security: "Advanced security systems",
              hour_counting: "Hour counting system",
              all_intermediate: "Everything from the Intermediate plan",
              unlimited_features: "Unlimited new features",
              full_customization: "Fully customizable bot",
              large_servers: "Prepared for LARGE servers",
              priority_support: "Priority support",
              proactive_monitoring: "Proactive performance monitoring"
          },
          fivem: {
              basic_features: "Base plan features",
              sell_logs: "Sell logs",
              production_logs: "Production logs",
              sets: "Sets",
              all_base: "Everything from the Base plan",
              financial_panel: "Financial panel",
              report_system: "Reporting system",
              all_intermediate_fivem: "Everything from the Intermediate plan",
              full_customization_fivem: "100% customization",
              free_new_features: "Free new features",
              priority_support_fivem: "Priority support"
          }
      },
      // URL Shortener
      urlShortenerTitle: "URL Shortener",
      urlShortenerPlaceholder: "Enter URL to shorten",
      urlShortenerButton: "Shorten",
      urlShortenerLoading: "Shortening...",
      urlShortenerResult: "Shortened URL:",
      urlShortenerError: "An error occurred. Please try again.",
      urlShortenerEnterUrl: "Please enter a URL.",
      financeManagerTitle: "Finance Manager",
      addTransaction: "Add Transaction",
      amount: "Amount",
      category: "Category",
      type: "Type",
      income: "Income",
      expense: "Expense",
      bank: "Bank",
      date: "Date",
      add: "Add",
      totalBalance: "Total Balance",
      banks: "Banks",
      addBank: "Add Bank",
      bankName: "Bank Name",
      initialBalance: "Initial Balance",
      recentTransactions: "Recent Transactions",
      edit: "Edit",
      delete: "Delete",
      update: "Update",
      cancel: "Cancel",
      confirm: "Confirm",
      confirmDelete: "Are you sure you want to delete this transaction?",
      confirmDeleteBank: "Are you sure you want to delete this bank? All associated transactions will be lost.",
      expenseByCategory: "Expenses by Category",
      expenseByType: "Expenses by Type",
      pix: "Pix",
      card: "Card",
      futureExpenses: "Future Expenses",
      paymentMonth: "Payment Month",
      pay: "Pay",
      selectBankToPay: "Select bank to pay",
      makeTransfer: "Make Transfer",
      from: "From",
      to: "To",
      transfer: "Transfer",
      transferring: "Transferring...",
      transferSuccess: "Transfer completed successfully.",
      transferError: "Failed to complete transfer.",
      allFieldsRequired: "All fields are required.",
      transferDescriptionPlaceholder: "Ex: Transfer between accounts"
  }
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguage] = useState<Language>('pt');
  return (
    <LanguageContext.Provider value={{ language, setLanguage, translations: translations[language] }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
