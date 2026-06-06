import React from 'react';
import { ArrowRight, Code, Layout, Smartphone } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';

function FeatureCard({ feature }: { feature: { icon: React.ElementType; title: string; desc: string } }) {
  const Icon = feature.icon;
  return (
    <div className="glass-panel p-8 flex flex-col items-start text-left group cursor-default transition-transform duration-300 ease-out hover:-translate-y-1 will-change-transform">
      <div className="p-3 rounded-xl mb-6 border border-white/[0.08] group-hover:border-accent/40 transition-colors duration-300">
        <Icon size={24} strokeWidth={1.5} className="text-[#A8A8A4] group-hover:text-accent transition-colors duration-300" />
      </div>
      <h3 className="text-lg font-semibold mb-2 text-[#F5F3EF]">{feature.title}</h3>
      <p className="text-[#9B9B97] text-sm leading-relaxed">{feature.desc}</p>
    </div>
  );
}

const Home = () => {
  const { translations } = useLanguage();

  return (
    <div className="min-h-[calc(100vh-16rem)] flex flex-col justify-center py-16 md:py-24 relative z-10">
      <div className="max-w-6xl w-full mx-auto space-y-20 md:space-y-28">

        {/* Hero */}
        <div className="animate-slide-up space-y-8 max-w-5xl">
          <div className="inline-flex items-center gap-2.5 text-sm text-[#9B9B97]">
            <span className="h-1.5 w-1.5 rounded-full bg-accent"></span>
            {translations.availableForWork}
          </div>

          <h1 className="font-display font-extrabold leading-[0.95] tracking-tight text-[#F5F3EF]"
              style={{ fontSize: 'clamp(3rem, 8vw, 6rem)' }}>
            {translations.greeting}{' '}
            <span className="text-accent">Davi</span>
          </h1>

          <p className="text-lg md:text-xl text-[#9B9B97] max-w-2xl leading-relaxed">
            {translations.description}
          </p>

          <div className="flex flex-col sm:flex-row gap-4 pt-2">
            <Link to="/portfolio" className="btn-primary group">
              {translations.viewWork}
              <ArrowRight className="ml-2 group-hover:translate-x-1 transition-transform" size={18} />
            </Link>
            <Link to="/contact" className="btn-secondary">
              {translations.getInTouch}
            </Link>
          </div>
        </div>

        {/* What I do */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-fade-in" style={{ animationDelay: '0.2s' }}>
          {[
            { icon: Code, title: translations.cleanCode, desc: translations.cleanCodeDesc },
            { icon: Layout, title: translations.modernUI, desc: translations.modernUIDesc },
            { icon: Smartphone, title: translations.responsive, desc: translations.responsiveDesc },
          ].map((feature, index) => (
            <FeatureCard key={index} feature={feature} />
          ))}
        </div>

      </div>
    </div>
  );
};

export default Home;
