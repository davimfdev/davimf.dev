import React from 'react';
import { ScrollText } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

const TermsOfService: React.FC = () => {
  const { translations } = useLanguage();
  const t = translations.terms;

  return (
    <div className="max-w-4xl mx-auto p-8 text-gray-300 animate-fade-in relative z-10">
      <div className="flex items-center gap-4 mb-10">
        <div className="p-3 bg-accent/20 rounded-xl border border-accent/30">
          <ScrollText size={32} className="text-accent" />
        </div>
        <h1 className="text-4xl font-extrabold text-gradient">{t.title}</h1>
      </div>

      <div className="space-y-8 glass-panel p-8 sm:p-10 border border-white/10 animate-slide-up">
        <section>
          <h2 className="text-2xl font-bold mb-3 text-gray-100 flex items-center">
            <span className="bg-accent text-ink text-sm w-6 h-6 flex items-center justify-center rounded-full mr-3">1</span>
            {t.acceptance}
          </h2>
          <p className="leading-relaxed pl-9">{t.acceptanceText}</p>
        </section>

        <section>
          <h2 className="text-2xl font-bold mb-3 text-gray-100 flex items-center">
            <span className="bg-accent text-ink text-sm w-6 h-6 flex items-center justify-center rounded-full mr-3">2</span>
            {t.serviceDescription}
          </h2>
          <p className="leading-relaxed pl-9">{t.serviceDescriptionText}</p>
        </section>

        <section>
          <h2 className="text-2xl font-bold mb-3 text-gray-100 flex items-center">
            <span className="bg-accent text-ink text-sm w-6 h-6 flex items-center justify-center rounded-full mr-3">3</span>
            {t.userConduct}
          </h2>
          <p className="leading-relaxed pl-9">{t.userConductText}</p>
        </section>

        <section>
          <h2 className="text-2xl font-bold mb-3 text-gray-100 flex items-center">
            <span className="bg-accent text-ink text-sm w-6 h-6 flex items-center justify-center rounded-full mr-3">4</span>
            {t.googleIntegration}
          </h2>
          <p className="leading-relaxed pl-9">{t.googleIntegrationText}</p>
        </section>

        <section>
          <h2 className="text-2xl font-bold mb-3 text-gray-100 flex items-center">
            <span className="bg-accent text-ink text-sm w-6 h-6 flex items-center justify-center rounded-full mr-3">5</span>
            {t.liabilityLimitation}
          </h2>
          <p className="leading-relaxed pl-9">{t.liabilityLimitationText}</p>
        </section>

        <section>
          <h2 className="text-2xl font-bold mb-3 text-gray-100 flex items-center">
            <span className="bg-accent text-ink text-sm w-6 h-6 flex items-center justify-center rounded-full mr-3">6</span>
            {t.termsModification}
          </h2>
          <p className="leading-relaxed pl-9">{t.termsModificationText}</p>
        </section>

        <section>
          <h2 className="text-2xl font-bold mb-3 text-gray-100 flex items-center">
            <span className="bg-accent text-ink text-sm w-6 h-6 flex items-center justify-center rounded-full mr-3">7</span>
            {t.contact}
          </h2>
          <p className="leading-relaxed pl-9">{t.contactText}</p>
        </section>
      </div>
    </div>
  );
};

export default TermsOfService;
