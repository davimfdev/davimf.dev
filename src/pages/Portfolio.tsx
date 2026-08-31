import { ExternalLink } from 'lucide-react';
import {useLanguage} from "../context/LanguageContext.tsx";

const Portfolio = () => {
    const { translations } = useLanguage();
    const projects = translations.projectsList;

  return (
    <div className="animate-fade-in relative z-10">
      <h1 className="text-4xl font-bold mb-12 text-gradient inline-block">Portfolio</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {projects.map((project, index) => (
          <div 
            key={project.id} 
            className="glass-panel group overflow-hidden animate-slide-up"
            style={{ animationDelay: `${index * 0.1}s` }}
          >
            <div className="relative overflow-hidden">
              <img
                src={project.image}
                alt={project.title}
                className="w-full h-56 object-cover transform group-hover:scale-110 transition-transform duration-500 ease-out"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/40 to-transparent opacity-60 group-hover:opacity-40 transition-opacity duration-300"></div>
            </div>
            <div className="p-6 relative">
              <h3 className="text-2xl font-semibold mb-3 text-fg group-hover:text-accent transition-colors">{project.title}</h3>
              <p className="text-fg-muted mb-6 leading-relaxed line-clamp-3">{project.description}</p>
              {project.link && (
                <a
                  href={project.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center text-accent hover:text-accent font-medium group/link"
                >
                  {translations.viewProject} 
                  <ExternalLink size={18} className="ml-2 transform group-hover/link:-translate-y-1 group-hover/link:translate-x-1 transition-transform" />
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Portfolio;
