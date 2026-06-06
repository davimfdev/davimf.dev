import React from 'react';
import { Shield } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

const PrivacyPolicy: React.FC = () => {
  const { translations } = useLanguage();
  const p = translations.privacy;

  return (
    <div className="max-w-4xl mx-auto p-8 text-gray-300 animate-fade-in relative z-10">
      <div className="flex items-center gap-4 mb-10">
        <div className="p-3 bg-accent/20 rounded-xl border border-accent/30">
          <Shield size={32} className="text-accent" />
        </div>
        <h1 className="text-4xl font-extrabold text-gradient">{p.title}</h1>
      </div>

      <div className="space-y-8 glass-panel p-8 sm:p-10 border border-white/10 animate-slide-up">
        <section>
          <h2 className="text-2xl font-bold mb-3 text-gray-100 flex items-center">
            <span className="bg-accent text-ink text-sm w-6 h-6 flex items-center justify-center rounded-full mr-3">1</span>
            {p.introduction}
          </h2>
          <p className="leading-relaxed pl-9">{p.introductionText}</p>
        </section>

        <section>
          <h2 className="text-2xl font-bold mb-3 text-gray-100 flex items-center">
            <span className="bg-accent text-ink text-sm w-6 h-6 flex items-center justify-center rounded-full mr-3">2</span>
            {p.dataCollection}
          </h2>
          <div className="pl-9">
            <p className="leading-relaxed mb-4">{p.dataCollectionText}</p>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-bold mb-3 text-gray-100 flex items-center">
            <span className="bg-accent text-ink text-sm w-6 h-6 flex items-center justify-center rounded-full mr-3">3</span>
            {p.dataUsage}
          </h2>
          <div className="pl-9">
            <p className="leading-relaxed mb-4">{p.dataUsageText}</p>
            <ul className="space-y-3 bg-white/5 p-4 rounded-lg border border-white/10 text-gray-300">
              <li className="flex items-start">
                <div className="w-1.5 h-1.5 rounded-full bg-accent mt-2 mr-3 flex-shrink-0"></div>
                <span><strong className="text-gray-200">{p.dataUsageImport.split(':')[0]}:</strong>{p.dataUsageImport.split(':').slice(1).join(':')}</span>
              </li>
              <li className="flex items-start">
                <div className="w-1.5 h-1.5 rounded-full bg-accent mt-2 mr-3 flex-shrink-0"></div>
                <span><strong className="text-gray-200">{p.dataUsageCreate.split(':')[0]}:</strong>{p.dataUsageCreate.split(':').slice(1).join(':')}</span>
              </li>
            </ul>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-bold mb-3 text-gray-100 flex items-center">
            <span className="bg-accent text-ink text-sm w-6 h-6 flex items-center justify-center rounded-full mr-3">4</span>
            {p.dataSharing}
          </h2>
          <p className="leading-relaxed pl-9">{p.dataSharingText}</p>
        </section>

        <section>
          <h2 className="text-2xl font-bold mb-3 text-gray-100 flex items-center">
            <span className="bg-accent text-ink text-sm w-6 h-6 flex items-center justify-center rounded-full mr-3">5</span>
            {p.security}
          </h2>
          <p className="leading-relaxed pl-9">{p.securityText}</p>
        </section>

        <section>
          <h2 className="text-2xl font-bold mb-3 text-gray-100 flex items-center">
            <span className="bg-accent text-ink text-sm w-6 h-6 flex items-center justify-center rounded-full mr-3">6</span>
            {p.contact}
          </h2>
          <p className="leading-relaxed pl-9">{p.contactText}</p>
        </section>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
