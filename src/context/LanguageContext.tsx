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
    rights: "Todos os direitos reservados.",
    contactP: "Contate-Me",
    connect: "Conecte-se Comigo",
    name: "Nome",
    message: "Mensagem",
    productsAndServices: "Produtos e Serviços",
    learnMore: "Saiba Mais",
    buyNow: "Comprar",
    productList: [
      {
        id: 1,
        name: "Discord bot",
        description: "Um bot completamente personalizavel, focado em moderação e segurança.",
        image: "https://bs-uploads.toptal.io/blackfish-uploads/components/blog_post_page/4088758/cover_image/retina_1708x683/cover-how-to-make-a-discord-bot-0afaa27d630de8c4b711f5cd5abbf01f.png",
        link: "https://discord.gg/NTNhBhGxeQ"
      }
    ],
    downloadPDF: "Baixar PDF",

    personalInfo: "Dados Pessoais",
    address: "Rua 1, Quadra 9, Lote 22, Casa 2, Goiânia, Goiás, 74853-130",
    phone: "(62) 98608-9609",
    email: "davimf9702@gmail.com",

    knowledge: "Conhecimentos",
    skills: "Habilidades",
    attitudes: "Atitudes",

    knowledgeList: ["Ciência da Computação", "Golang", "Java", "SQL", "T.I", "Analise de Dados"],
    skillsList: [
      "Facilidade para aprender",
      "Ótimo raciocínio lógico",
      "Capacidade para realizar procedimentos de informática",
      "Ingles Avançado"
    ],

    tools: "Ferramentas",
    toolsList: ["Git", "Docker", "D-Guard", "Postman"],

    experience: "Experiência",
    experienceList: [
      {
        title: "Newline",
        company: "New Line Tecnologia Em Seguranca Ltda",
        period: "Agosto 2023 - Atualmente",
        description: "Estagiário de T.I."
      },

      {
        title: "Monitor de Alarmes e Câmeras de Segurança",
        company: "Safety House - Serviços de Segurança LTDA",
        period: "Outubro de 2021 - Março de 2022",
        description: "Monitoramento de alarmes e câmeras de segurança durante o período noturno."
      }


    ],

    education: "Formação",
    educationList: [
      {
        course: "Ciências da Computação (Superior)",
        institution: "Instituto Federal de Goiás, Anápolis",
        period: "Fevereiro de 2020 - Atualmente",
        description:
            "Curso avaliado pelo e-MEC com 5 pontos (nota máxima). Com ênfase em Desenvolvimento de Software, Pesquisa Operacional e Aprendizado de Máquina."
      },
      {
        course: "Ensino Médio",
        institution: "Colégio Protágoras, Goiânia",
        period: "Janeiro de 2017 - Dezembro de 2019",
        description: "Aluno sem reprovações ou dependências. Colégio entre os 3 primeiros colocados de Goiás no ENEM."
      }
    ]
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
    rights: "All rights reserved.",
    contactP: "Contact Me",
    connect: "Connect With Me",
    name: "Name",
    message: "Message",
    productsAndServices: "Product & Services",
    learnMore: "Learn More",
    buyNow: "Buy Now",
    productList: [
      {
        id: 1,
        name: "Product One",
        description: "Description of your first product or service offering.",
        image: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&q=80&w=800",
        link: "https://example.com/product1"
      },
      {
        id: 2,
        name: "Product Two",
        description: "Description of your second product or service offering.",
        image: "https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&q=80&w=800",
        link: "https://example.com/product2"
      }
    ],
    downloadPDF: "Download PDF",

    personalInfo: "Personal Information",
    address: "Rua 1, Quadra 9, Lote 22, Casa 2, Goiânia, Goiás, 74853-130",
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
        title: "Newline",
        company: "New Line Tecnologia Em Seguranca Ltda",
        period: "August 2023 - Today",
        description: "Worked as an I.T trainee."
      },

      {
        title: "Security Alarm and Camera Monitor",
        company: "Safety House - Security Services LTDA",
        period: "October 2021 - March 2022",
        description: "Monitored security alarms and cameras during night shifts."
      }

    ],

    education: "Education",
    educationList: [
      {
        course: "Computer Science (Bachelor's)",
        institution: "Federal Institute of Goiás, Anápolis",
        period: "February 2020 - Present",
        description:
            "Rated 5 stars by e-MEC. Focuses on Software Development, Operational Research, and Machine Learning."
      },
      {
        course: "High School",
        institution: "Colégio Protágoras, Goiânia",
        period: "January 2017 - December 2019",
        description: "Graduated without failures. School ranked among the top 3 in Goiás on ENEM."
      }
    ]
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