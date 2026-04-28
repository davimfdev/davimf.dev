import { useState } from 'react';
import { useLanguage } from "../context/LanguageContext.tsx";
import { CheckCircle, Zap, Download } from 'lucide-react';

type Period = 'monthly' | 'quarterly' | 'lifetime';
type PlanKey = 'basic' | 'pro';

const FmmPlans = () => {
  const { translations } = useLanguage();
  const t = translations as any;

  const [period, setPeriod] = useState<Period>('monthly');
  const [loading, setLoading] = useState<PlanKey | null>(null);
  const [error, setError] = useState<string | null>(null);

  const periods: { key: Period; label: string }[] = [
    { key: 'monthly',   label: t.monthly },
    { key: 'quarterly', label: t.quarterly },
    { key: 'lifetime',  label: t.lifetime },
  ];

  const planKeys: PlanKey[] = ['basic', 'pro'];

  const handleBuy = async (planIndex: number) => {
    const planKey = planKeys[planIndex];
    setLoading(planKey);
    setError(null);

    try {
      const res = await fetch('/.netlify/functions/abacate-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: planKey, period }),
      });

      const data = await res.json();

      if (!res.ok || !data.url) {
        setError(data.error || 'Erro ao processar pagamento.');
        return;
      }

      window.location.href = data.url;
    } catch {
      setError('Erro de conexão. Tente novamente.');
    } finally {
      setLoading(null);
    }
  };

  const periodSuffix = (p: Period) => {
    if (p === 'monthly') return `/ ${t.month}`;
    if (p === 'quarterly') return `/ ${t.quarterly.toLowerCase()}`;
    return null;
  };

  return (
    <div className="container mx-auto px-4 py-12 animate-fade-in relative z-10">
      <div className="text-center mb-16">
        <h1 className="text-5xl font-extrabold mb-6 text-gradient inline-block">
          {t.fmmModManagerPlans}
        </h1>

        <div className="flex justify-center mt-8">
          <div className="flex glass-panel p-1 rounded-full gap-1">
            {periods.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setPeriod(key)}
                className={`px-5 py-2 rounded-full font-medium transition-all duration-200 ${
                  period === key
                    ? 'bg-blue-600 text-white shadow-lg'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {period === 'quarterly' && (
          <p className="mt-4 text-blue-400 font-semibold bg-blue-500/10 inline-block px-4 py-1 rounded-full border border-blue-500/20 animate-fade-in">
            Economize ~11% vs mensal
          </p>
        )}
        {period === 'lifetime' && (
          <p className="mt-4 text-blue-400 font-semibold bg-blue-500/10 inline-block px-4 py-1 rounded-full border border-blue-500/20 animate-fade-in">
            Pagamento único — acesso para sempre
          </p>
        )}
      </div>

      {error && (
        <p className="text-center text-red-400 mb-6 bg-red-500/10 border border-red-500/20 rounded-lg py-2 px-4 max-w-md mx-auto">
          {error}
        </p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
        {t.fmmPlans.map((plan: any, i: number) => {
          const planKey = planKeys[i];
          const isPro = i === 1;

          return (
            <div
              key={plan.title}
              className={`glass-panel p-8 flex flex-col animate-slide-up transform hover:-translate-y-2 transition-all duration-300 relative ${
                isPro ? 'border border-blue-500/40' : ''
              }`}
              style={{ animationDelay: `${i * 0.1}s` }}
            >
              {isPro && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="flex items-center gap-1 bg-blue-600 text-white text-xs font-bold px-3 py-1 rounded-full">
                    <Zap size={12} /> Popular
                  </span>
                </div>
              )}

              <h3 className="text-2xl font-bold mb-4 text-gray-100">{plan.title}</h3>

              <div className="flex items-baseline mb-8">
                <span className="text-4xl font-extrabold text-white">
                  R${plan.prices[period]}
                </span>
                {periodSuffix(period) && (
                  <span className="text-gray-400 ml-2 font-medium">
                    {periodSuffix(period)}
                  </span>
                )}
              </div>

              <ul className="space-y-4 mb-8 flex-grow">
                {plan.features.map((feature: string) => (
                  <li key={feature} className="flex items-start">
                    <CheckCircle className="text-blue-500 mr-3 mt-1 flex-shrink-0" size={20} />
                    <span className="text-gray-300">{t.fmmPlanFeatures[feature]}</span>
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handleBuy(i)}
                disabled={loading !== null}
                className="btn-primary w-full text-center mt-auto disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading === planKey ? '...' : t.subscribe}
              </button>
            </div>
          );
        })}
      </div>

      <p className="text-center text-gray-500 text-sm mt-10">
        Após o pagamento, envie o comprovante via{' '}
        <a href="/contact" className="text-blue-400 hover:underline">contato</a>{' '}
        para receber sua licença.
      </p>

      <div className="mt-16 max-w-4xl mx-auto">
        <div className="border-t border-white/10 pt-12">
          <h2 className="text-2xl font-bold text-center text-gray-100 mb-2">Versão Gratuita</h2>
          <p className="text-center text-gray-400 mb-8">Sem licença. Funcionalidades básicas de gerenciamento de mods.</p>
          <div className="glass-panel p-8 flex flex-col md:flex-row items-center justify-between gap-6">
            <ul className="space-y-3 flex-grow">
              {['fmm_sound_mods', 'fmm_rpf_mods', 'fmm_one_click', 'fmm_backup'].map((f) => (
                <li key={f} className="flex items-center gap-3 text-gray-300">
                  <CheckCircle className="text-gray-500 flex-shrink-0" size={18} />
                  {t.fmmPlanFeatures[f]}
                </li>
              ))}
            </ul>
            <a
              href="https://github.com/D4emonF/FMM-Releases/releases/latest/download/FMM.exe"
              className="btn-primary flex items-center gap-2 whitespace-nowrap"
              download
            >
              <Download size={18} />
              Download Grátis
            </a>
          </div>
        </div>
      </div>

    </div>
  );
};

export default FmmPlans;
