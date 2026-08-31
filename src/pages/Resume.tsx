import { useLanguage } from "../context/LanguageContext.tsx";
import { Download, Briefcase, GraduationCap, Mail, Phone, Star, Code, Wrench } from 'lucide-react';

const Resume = () => {
  const { translations } = useLanguage();
  const {
    personalInfo,
    phone,
    email,
    knowledge,
    skills,
    tools,
    experience,
    education,
    knowledgeList,
    skillsList,
    toolsList,
    experienceList,
    educationList,
    downloadPDF,
    fullName
  } = translations;

  const handleDownload = () => {
    window.print();
  };

  return (
    <div className="container mx-auto px-4 py-12 animate-fade-in relative z-10">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-12">
        <div className="mb-4 sm:mb-0">
          <h1 className="text-4xl font-bold text-gradient inline-block">{fullName}</h1>
          <p className="text-fg-muted print:text-print-fg mt-1">{translations.resume}</p>
        </div>
        <button
          onClick={handleDownload}
          className="btn-primary group"
        >
          <Download size={18} className="mr-2 group-hover:-translate-y-0.5 transition-transform" />
          {downloadPDF}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column */}
        <div className="lg:col-span-1 space-y-8">
          <section className="glass-panel p-6 animate-slide-up">
            <h2 className="text-2xl font-semibold mb-6 flex items-center text-accent print:text-print-fg">
              <Mail size={22} className="mr-3" /> {personalInfo}
            </h2>
            <div className="space-y-4">
              <p className="flex items-center text-fg-muted print:text-print-fg"><Phone size={16} className="mr-3 text-fg-muted print:text-print-fg" /> {phone}</p>
              <p className="flex items-center text-fg-muted print:text-print-fg"><Mail size={16} className="mr-3 text-fg-muted print:text-print-fg" /> {email}</p>
            </div>
          </section>

          <section className="glass-panel p-6 animate-slide-up" style={{ animationDelay: '0.1s' }}>
            <h2 className="text-2xl font-semibold mb-6 flex items-center text-accent print:text-print-fg">
              <Code size={22} className="mr-3" /> {knowledge}
            </h2>
            <ul className="space-y-3">
              {knowledgeList.map((item: string) => <li key={item} className="flex items-center text-fg-muted print:text-print-fg"><Star size={14} className="mr-3 text-accent print:text-print-fg" />{item}</li>)}
            </ul>
          </section>

          <section className="glass-panel p-6 animate-slide-up" style={{ animationDelay: '0.2s' }}>
            <h2 className="text-2xl font-semibold mb-6 flex items-center text-accent print:text-print-fg">
              <Star size={22} className="mr-3" /> {skills}
            </h2>
            <ul className="space-y-3">
              {skillsList.map((item: string) => <li key={item} className="flex items-center text-fg-muted print:text-print-fg"><Star size={14} className="mr-3 text-accent print:text-print-fg" />{item}</li>)}
            </ul>
          </section>

          <section className="glass-panel p-6 animate-slide-up" style={{ animationDelay: '0.3s' }}>
            <h2 className="text-2xl font-semibold mb-6 flex items-center text-accent print:text-print-fg">
              <Wrench size={22} className="mr-3" /> {tools}
            </h2>
            <ul className="space-y-3">
              {toolsList.map((item: string) => <li key={item} className="flex items-center text-fg-muted print:text-print-fg"><Star size={14} className="mr-3 text-accent print:text-print-fg" />{item}</li>)}
            </ul>
          </section>
        </div>

        {/* Right Column */}
        <div className="lg:col-span-2 space-y-8">
          <section className="glass-panel p-8 animate-slide-up" style={{ animationDelay: '0.4s' }}>
            <h2 className="text-3xl font-semibold mb-8 flex items-center text-accent print:text-print-fg border-b border-line print:border-print-fg/12 pb-4">
              <Briefcase size={28} className="mr-4" /> {experience}
            </h2>
            <div className="space-y-8">
              {experienceList.map((exp: any, index: number) => (
                <div key={exp.company} className={`relative pl-8 before:absolute before:left-2 before:top-2 before:w-2 before:h-2 before:bg-accent print:before:bg-print-fg before:rounded-full before:ring-4 before:ring-accent/20 print:before:ring-print-fg/20 ${index < experienceList.length - 1 ? 'pb-8 border-l border-dashed border-line-strong print:border-print-fg/20' : ''}`}>
                  <h3 className="text-xl font-bold text-fg print:text-print-fg">{exp.title}</h3>
                  <a href={exp.link} target="_blank" rel="noopener noreferrer" className="text-accent print:text-print-fg hover:text-accent transition-colors">{exp.company}</a>
                  <p className="text-sm text-fg-muted print:text-print-fg mt-1 mb-3">{exp.period}</p>
                  <p className="text-fg-soft print:text-print-fg leading-relaxed">{exp.description}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="glass-panel p-8 animate-slide-up" style={{ animationDelay: '0.5s' }}>
            <h2 className="text-3xl font-semibold mb-8 flex items-center text-accent print:text-print-fg border-b border-line print:border-print-fg/12 pb-4">
              <GraduationCap size={28} className="mr-4" /> {education}
            </h2>
            <div className="space-y-8">
              {educationList.map((edu: any, index: number) => (
                <div key={edu.institution} className={`relative pl-8 before:absolute before:left-2 before:top-2 before:w-2 before:h-2 before:bg-accent print:before:bg-print-fg before:rounded-full before:ring-4 before:ring-accent/20 print:before:ring-print-fg/20 ${index < educationList.length - 1 ? 'pb-8 border-l border-dashed border-line-strong print:border-print-fg/20' : ''}`}>
                  <h3 className="text-xl font-bold text-fg print:text-print-fg">{edu.course}</h3>
                  <a href={edu.link} target="_blank" rel="noopener noreferrer" className="text-accent print:text-print-fg hover:text-accent transition-colors">{edu.institution}</a>
                  <p className="text-sm text-fg-muted print:text-print-fg mt-1 mb-3">{edu.period}</p>
                  <p className="text-fg-soft print:text-print-fg leading-relaxed">{edu.description}</p>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default Resume;
