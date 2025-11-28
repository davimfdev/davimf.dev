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
      <div key={plan.title} className="bg-gray-800 rounded-lg shadow-lg p-6 flex flex-col">
        <h3 className="text-2xl font-semibold mb-2">{plan.title}</h3>
        <div className={`flex items-baseline mb-6 transition-opacity duration-500 ${isAnimating ? 'opacity-0' : 'opacity-100'}`}>
          <span className="text-4xl font-bold">R${price}</span>
          <span className="text-gray-400 ml-2">/ {isAnnual ? year : month}</span>
        </div>
        <ul className="space-y-4 mb-8 flex-grow">
          {plan.features.map((feature: string) => (
            <li key={feature} className="flex items-center">
              <CheckCircle className="text-green-500 mr-2" />
              <span>{planFeatures[type][feature]}</span>
            </li>
          ))}
        </ul>
        <a
          href={plan.paymentLinks[billingCycle]}
          className="bg-blue-600 text-white text-center py-2 px-4 rounded hover:bg-blue-700 transition-colors"
        >
          {subscribe}
        </a>
      </div>
    );
  };

  return (
    <div className="container mx-auto px-4 py-12">
      <h1 className="text-4xl font-bold text-center mb-8">{translations.plans}</h1>

      <div className="flex flex-col justify-center items-center mb-12">
        <div className="flex items-center">
          <span className={`mr-4 ${billingCycle === 'monthly' ? 'text-white' : 'text-gray-400'}`}>{monthly}</span>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              className="sr-only peer"
              checked={billingCycle === 'annually'}
              onChange={handleBillingCycleChange}
            />
            <div className="w-11 h-6 bg-gray-700 rounded-full peer peer-focus:ring-4 peer-focus:ring-blue-800 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
          </label>
          <span className={`ml-4 ${billingCycle === 'annually' ? 'text-white' : 'text-gray-400'}`}>{annually}</span>
        </div>
        <div className={`transition-opacity duration-500 ${isAnimating ? 'opacity-0' : 'opacity-100'}`}>
          {billingCycle === 'annually' && (
            <p className="text-green-400 mt-4 fade-in">{annualDiscount}</p>
          )}
        </div>
      </div>

      <section id="discord-bots">
        <h2 className="text-3xl font-bold text-center mb-8">{translations.discordBotPlans}</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {discordPlans.map((plan: any) => renderPlan(plan, 'discord'))}
        </div>
      </section>

      <section id="fivem-factions" className="mt-16">
        <h2 className="text-3xl font-bold text-center mb-8">{translations.fivemFactionPlans}</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {fivemPlans.map((plan: any) => renderPlan(plan, 'fivem'))}
        </div>
      </section>
    </div>
  );
};

export default Plans;