import { useLanguage } from "../context/LanguageContext.tsx";

const Resume = () => {
  const { translations } = useLanguage();

  return (
      <div className="max-w-4xl mx-auto">
        {/* Título e Download */}
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">{translations.resume}</h1>
        </div>

        <div className="space-y-8">
          {/* Dados Pessoais */}
          <section>
            <h2 className="text-2xl font-semibold mb-4">{translations.personalInfo}</h2>
            <div className="bg-gray-800 p-6 rounded-lg text-gray-300">
              <p><strong>📍 {translations.address}</strong></p>
              <p>📞 {translations.phone}</p>
              <p>📧 {translations.email}</p>
            </div>
          </section>

          {/* Experiência Profissional */}
          <section>
            <h2 className="text-2xl font-semibold mb-4">{translations.experience}</h2>
            {translations.experienceList.map((job, index) => (
                <div key={index} className="bg-gray-800 p-6 rounded-lg mb-4">
                  <div className="flex justify-between mb-2">
                    <h3 className="text-xl font-medium">{job.title}</h3>
                    <span className="text-gray-400">{job.period}</span>
                  </div>
                  <h4 className="text-blue-400 mb-2">{job.company}</h4>
                  <p className="text-gray-300">{job.description}</p>
                </div>
            ))}
          </section>

          {/* Formação Acadêmica */}
          <section>
            <h2 className="text-2xl font-semibold mb-4">{translations.education}</h2>
            {translations.educationList.map((edu, index) => (
                <div key={index} className="bg-gray-800 p-6 rounded-lg mb-4">
                  <div className="flex justify-between mb-2">
                    <h3 className="text-xl font-medium">{edu.course}</h3>
                    <span className="text-gray-400">{edu.period}</span>
                  </div>
                  <h4 className="text-blue-400 mb-2">{edu.institution}</h4>
                  <p className="text-gray-300">{edu.description}</p>
                </div>
            ))}
          </section>

          {/* Conhecimentos, Habilidades e Atitudes */}
          <section>
            <h2 className="text-2xl font-semibold mb-4">{translations.knowledge}</h2>
            <div className="bg-gray-800 p-6 rounded-lg grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <h3 className="font-medium mb-2">{translations.knowledge}</h3>
                <ul className="text-gray-300 space-y-1">
                  {translations.knowledgeList.map((item, index) => (
                      <li key={index}>• {item}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="font-medium mb-2">{translations.skills}</h3>
                <ul className="text-gray-300 space-y-1">
                  {translations.skillsList.map((item, index) => (
                      <li key={index}>• {item}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="font-medium mb-2">{translations.tools}</h3>
                <ul className="text-gray-300 space-y-1">
                  {translations.toolsList.map((item, index) => (
                      <li key={index}>• {item}</li>
                  ))}
                </ul>
              </div>
            </div>
          </section>
        </div>
      </div>
  );
};

export default Resume;
