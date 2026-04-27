import { ArrowRight, Code, Layout, Smartphone } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';

const Home = () => {
  const { translations } = useLanguage();

  return (
    <div className="min-h-[calc(100vh-16rem)] flex flex-col justify-center items-center py-12 relative z-10">
      {/* Background decoration elements */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-amber-500/10 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-orange-600/8 rounded-full blur-[120px] pointer-events-none"></div>

      <div className="max-w-4xl w-full mx-auto text-center space-y-12">
        
        {/* Hero Section */}
        <div className="animate-slide-up space-y-6">
          <div className="inline-flex items-center px-4 py-2 glass-panel rounded-full text-sm font-medium text-amber-400 mb-4 animate-fade-in" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.8rem', letterSpacing: '0.04em' }}>
            <span className="relative flex h-2.5 w-2.5 mr-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
            </span>
            {translations.availableForWork}
          </div>
          
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight">
            {translations.greeting}{' '}
            <span className="text-gradient">
              Davi
            </span>
          </h1>
          
          <p className="text-xl md:text-2xl text-gray-400 max-w-2xl mx-auto leading-relaxed font-light">
            {translations.description}
          </p>
          
          <div className="flex flex-col sm:flex-row gap-6 justify-center pt-8">
            <Link to="/portfolio" className="btn-primary group">
              {translations.viewWork}
              <ArrowRight className="ml-2 group-hover:translate-x-1 transition-transform" size={20} />
            </Link>
            <Link to="/contact" className="btn-secondary group">
              {translations.getInTouch}
            </Link>
          </div>
        </div>

        {/* Feature Cards Showcase (Glassmorphism) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-16 animate-fade-in" style={{ animationDelay: '0.3s' }}>
          {[
            { icon: Code, title: translations.cleanCode, desc: translations.cleanCodeDesc },
            { icon: Layout, title: translations.modernUI, desc: translations.modernUIDesc },
            { icon: Smartphone, title: translations.responsive, desc: translations.responsiveDesc },
          ].map((feature, index) => {
            const Icon = feature.icon;
            return (
              <div key={index} className="glass-panel p-8 flex flex-col items-center text-center transform hover:-translate-y-2 transition-all duration-300 group cursor-default" style={{ animationDelay: `${index * 0.1}s` }}>
                <div className="p-4 bg-white/5 rounded-2xl mb-6 group-hover:bg-amber-500/15 transition-colors duration-300">
                  <Icon size={32} className="text-amber-400 group-hover:text-amber-300" />
                </div>
                <h3 className="text-xl font-bold mb-3 text-gray-100">{feature.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{feature.desc}</p>
              </div>
            );
          })}
        </div>

      </div>
    </div>
  );
};

export default Home;