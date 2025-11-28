import { useLanguage } from "../context/LanguageContext.tsx";
import { Download, Briefcase, GraduationCap, Mail, Phone } from 'lucide-react';

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
    downloadPDF
  } = translations;

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-4xl font-bold">{translations.resume}</h1>
        <a
          href="/resume.pdf"
          download
          className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
        >
          <Download size={16} className="mr-2" />
          {downloadPDF}
        </a>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-1 space-y-8">
          <section>
            <h2 className="text-2xl font-semibold border-b-2 border-blue-500 pb-2 mb-4">{personalInfo}</h2>
            <div className="space-y-2">
              <p className="flex items-center"><Phone size={16} className="mr-2" /> {phone}</p>
              <p className="flex items-center"><Mail size={16} className="mr-2" /> {email}</p>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold border-b-2 border-blue-500 pb-2 mb-4">{knowledge}</h2>
            <ul className="list-disc list-inside space-y-1">
              {knowledgeList.map((item: string) => <li key={item}>{item}</li>)}
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold border-b-2 border-blue-500 pb-2 mb-4">{skills}</h2>
            <ul className="list-disc list-inside space-y-1">
              {skillsList.map((item: string) => <li key={item}>{item}</li>)}
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold border-b-2 border-blue-500 pb-2 mb-4">{tools}</h2>
            <ul className="list-disc list-inside space-y-1">
              {toolsList.map((item: string) => <li key={item}>{item}</li>)}
            </ul>
          </section>
        </div>

        <div className="md:col-span-2 space-y-8">
          <section>
            <h2 className="text-2xl font-semibold border-b-2 border-blue-500 pb-2 mb-4 flex items-center">
              <Briefcase size={24} className="mr-2" /> {experience}
            </h2>
            <div className="space-y-6">
              {experienceList.map((exp: any) => (
                <div key={exp.company}>
                  <h3 className="text-xl font-bold">{exp.title}</h3>
                  <a href={exp.link} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">{exp.company}</a>
                  <p className="text-sm text-gray-400">{exp.period}</p>
                  <p className="mt-2">{exp.description}</p>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold border-b-2 border-blue-500 pb-2 mb-4 flex items-center">
              <GraduationCap size={24} className="mr-2" /> {education}
            </h2>
            <div className="space-y-6">
              {educationList.map((edu: any) => (
                <div key={edu.institution}>
                  <h3 className="text-xl font-bold">{edu.course}</h3>
                  <a href={edu.link} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">{edu.institution}</a>
                  <p className="text-sm text-gray-400">{edu.period}</p>
                  <p className="mt-2">{edu.description}</p>
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