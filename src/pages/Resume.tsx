import { useLanguage } from "../context/LanguageContext.tsx";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import { useRef } from "react";

const Resume = () => {
  const { translations } = useLanguage();
  const resumeRef = useRef<HTMLDivElement>(null);

  const handleDownloadPDF = async () => {
    if (!resumeRef.current) return;

    // Captura do conteúdo com html2canvas
    const canvas = await html2canvas(resumeRef.current, {
      scale: 2.5,
      backgroundColor: "#111827", // Cor de fundo #111827 (bg-gray-900 do Tailwind)
      scrollY: -window.scrollY,
      x: 0, // Inicia a captura no canto superior esquerdo
      y: 0, // Inicia a captura no canto superior esquerdo
    });

    const imgData = canvas.toDataURL("image/png");

    // Inicialização do PDF
    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
      compress: true,
    });

    const pageWidth = 210; // Largura da página A4 em mm
    const pageHeight = 297; // Altura da página A4 em mm
    const imgWidth = pageWidth; // A largura da imagem será a largura da página
    const imgHeight = (canvas.height * imgWidth) / canvas.width; // Mantém a proporção da imagem

    const adjustedImgHeight = imgHeight;

    // Se a altura da imagem for menor que a página, a parte inferior será preenchida com a cor de fundo
    if (adjustedImgHeight < pageHeight) {
      const remainingSpace = pageHeight - adjustedImgHeight;
      // Preencher a parte inferior com a cor de fundo
      pdf.setFillColor(17, 24, 39); // Cor de fundo RGB equivalente a #111827 (bg-gray-900)
      pdf.rect(0, adjustedImgHeight, pageWidth, remainingSpace, "F");
    }

    // Adiciona a imagem ao PDF no topo
    pdf.addImage(imgData, "PNG", 0, 0, imgWidth, adjustedImgHeight, "", "FAST");

    // Salva o PDF
    pdf.save("Curriculo Davi Monteiro Fonseca.pdf");
  };

  return (
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">{translations.resume}</h1>
          <button
              onClick={handleDownloadPDF}
              className="bg-blue-500 text-white px-3 py-1 rounded-lg hover:bg-blue-600 transition text-sm"
          >
            Download
          </button>
        </div>

        {/* Ajustando as margens no HTML */}
        <div ref={resumeRef} className="bg-gray-900 p-6 rounded-lg shadow-lg text-gray-300 m-6">
          {/* Dados Pessoais */}
          <section className="mb-4">
            <h2 className="text-xl font-semibold mb-3">{translations.personalInfo}</h2>
            <div className="bg-gray-800 p-4 rounded-md">
              <p><strong>👤 Davi Monteiro Fonseca</strong></p>
              <p>📞 <a href="tel:5562986089609">{translations.phone}</a></p>
              <p>📧 <a href="mailto:davimf9702@gmail.com">{translations.email}</a></p>
            </div>
          </section>

          {/* Experiência Profissional */}
          <section className="mb-4">
            <h2 className="text-xl font-semibold mb-3">{translations.experience}</h2>
            {translations.experienceList.map((job, index) => (
                <div key={index} className="bg-gray-800 p-4 rounded-md mb-4">
                  <div className="flex justify-between mb-2">
                    <h3 className="text-lg font-medium">{job.title}</h3>
                    <span className="text-gray-400 text-sm">{job.period}</span>
                  </div>
                  <h4 className="text-blue-400 text-sm">
                    <a href={job.link} target="_blank" rel="noopener noreferrer" className="hover:underline">
                      {job.company}
                    </a>
                  </h4>
                  <p className="text-sm">{job.description}</p>
                </div>
            ))}
          </section>

          {/* Formação Acadêmica */}
          <section className="mb-4">
            <h2 className="text-xl font-semibold mb-3">{translations.education}</h2>
            {translations.educationList.map((edu, index) => (
                <div key={index} className="bg-gray-800 p-4 rounded-md mb-4">
                  <div className="flex justify-between mb-2">
                    <h3 className="text-lg font-medium">{edu.course}</h3>
                    <span className="text-gray-400 text-sm">{edu.period}</span>
                  </div>
                  <h4 className="text-blue-400 text-sm">
                    <a href={edu.link} target="_blank" rel="noopener noreferrer" className="hover:underline">
                      {edu.institution}
                    </a>
                  </h4>
                  <p className="text-sm">{edu.description}</p>
                </div>
            ))}
          </section>

          {/* Conhecimentos, Habilidades e Ferramentas */}
          <section className="mb-4">
            <h2 className="text-xl font-semibold mb-3">{translations.knowledge}</h2>
            <div className="bg-gray-800 p-4 rounded-md grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <h3 className="font-medium mb-2">{translations.knowledge}</h3>
                <ul className="space-y-1">
                  {translations.knowledgeList.map((item, index) => (
                      <li key={index}>• {item}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="font-medium mb-2">{translations.skills}</h3>
                <ul className="space-y-1">
                  {translations.skillsList.map((item, index) => (
                      <li key={index}>• {item}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="font-medium mb-2">{translations.tools}</h3>
                <ul className="space-y-1">
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
