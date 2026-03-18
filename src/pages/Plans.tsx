import { useState, useEffect } from 'react';
import { useLanguage } from "../context/LanguageContext.tsx";
import { CheckCircle } from 'lucide-react';
import '../styles/animations.css';

const Plans = () => {
  const { translations } = useLanguage();
  const { discordPlans, fivemPlans, planFeatures, monthly, annually, subscribe, month, year, annualDiscount } = translations;
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annually'>('monthly');
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    const loadMercadoPagoScript = () => {
      const script = document.createElement("script");
      script.type = "text/javascript";
      script.async = true;
      script.src = "https://secure.mlstatic.com/mptools/render.js";
      document.body.appendChild(script);
    };

    if (!(window as any).$MPC_loaded) {
      loadMercadoPagoScript();
      (window as any).$MPC_loaded = true;
    }
  }, []);

  const handleBillingCycleChange = () => {
    setIsAnimating(true);
    setTimeout(() => {
      setBillingCycle(billingCycle === 'monthly' ? 'annually' : 'monthly');
      setIsAnimating(false);
    }, 500);
  };

  const renderPlan = (plan: any, type: 'discord' | 'fivem') => {
    const isAnnual = billingCycle === 'annually';
    const price = isAnnual ? plan.price * 10 : plan.price;

    return (
      <div key={plan.title} className="glass-panel p-8 flex flex-col animate-slide-up transform hover:-translate-y-2 transition-all duration-300">
        <h3 className="text-2xl font-bold mb-4 text-gray-100">{plan.title}</h3>
        <div className={`flex items-baseline mb-8 transition-opacity duration-500 ${isAnimating ? 'opacity-0' : 'opacity-100'}`}>
          <span className="text-4xl font-extrabold text-white">R${price}</span>
          <span className="text-gray-400 ml-2 font-medium">/ {isAnnual ? year : month}</span>
        </div>
        <ul className="space-y-4 mb-8 flex-grow">
          {plan.features.map((feature: string) => (
            <li key={feature} className="flex items-start">
              <CheckCircle className="text-blue-500 mr-3 mt-1 flex-shrink-0" size={20} />
              <span className="text-gray-300">{planFeatures[type][feature]}</span>
            </li>
          ))}
        </ul>
        <a
          href={plan.paymentLinks[billingCycle]}
          className="btn-primary w-full text-center mt-auto"
        >
          {subscribe}
        </a>
      </div>
    );
  };

  return (
    <div className="container mx-auto px-4 py-12 animate-fade-in relative z-10">
      <div className="text-center mb-16">
        <h1 className="text-5xl font-extrabold mb-6 text-gradient inline-block">{translations.plans}</h1>
        
        <div className="flex flex-col justify-center items-center mt-8">
          <div className="flex items-center glass-panel px-6 py-3 rounded-full">
            <span className={`mr-4 font-medium transition-colors ${billingCycle === 'monthly' ? 'text-white' : 'text-gray-400'}`}>{monthly}</span>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={billingCycle === 'annually'}
                onChange={handleBillingCycleChange}
              />
              <div className="w-14 h-7 bg-gray-700 rounded-full peer peer-focus:ring-4 peer-focus:ring-blue-800/50 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-1 after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
            <span className={`ml-4 font-medium transition-colors ${billingCycle === 'annually' ? 'text-white' : 'text-gray-400'}`}>{annually}</span>
          </div>
          <div className={`transition-opacity duration-500 h-8 mt-4 ${isAnimating ? 'opacity-0' : 'opacity-100'}`}>
            {billingCycle === 'annually' && (
              <p className="text-blue-400 font-semibold bg-blue-500/10 px-4 py-1 rounded-full animate-fade-in border border-blue-500/20">{annualDiscount}</p>
            )}
          </div>
        </div>
      </div>

      <section id="discord-bots" className="mb-20">
        <h2 className="text-3xl font-bold text-center mb-12 text-gray-100">{translations.discordBotPlans}</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {discordPlans.map((plan: any) => renderPlan(plan, 'discord'))}
        </div>
      </section>

      <section id="fivem-factions" className="mb-12">
        <h2 className="text-3xl font-bold text-center mb-12 text-gray-100">{translations.fivemFactionPlans}</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {fivemPlans.map((plan: any) => renderPlan(plan, 'fivem'))}
        </div>
      </section>
    </div>
  );
};

export default Plans;