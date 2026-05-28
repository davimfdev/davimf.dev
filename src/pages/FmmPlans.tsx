import { useState } from 'react';
import { useLanguage } from "../context/LanguageContext.tsx";
import {
  Check, Minus, Download,
  Package, Server, Settings, Zap, Layers, RefreshCw,
} from 'lucide-react';

type Period = 'monthly' | 'quarterly' | 'lifetime';
type PlanKey = 'basic' | 'pro';

interface FeatureRow {
  key: string;
  Icon: React.ElementType;
  free: boolean;
  basic: boolean;
  pro: boolean;
}

const FEATURE_ROWS: FeatureRow[] = [
  { key: 'fmm_scan_mods',          Icon: Package,    free: true,  basic: true,  pro: true  },
  { key: 'fmm_rpf_mods',           Icon: Package,    free: true,  basic: true,  pro: true  },
  { key: 'fmm_view_optimizations', Icon: Zap,        free: true,  basic: true,  pro: true  },
  { key: 'fmm_sound_packs',        Icon: Package,    free: false, basic: true,  pro: true  },
  { key: 'fmm_citizen_extras',     Icon: Package,    free: false, basic: true,  pro: true  },
  { key: 'fmm_servers_list',       Icon: Server,     free: false, basic: true,  pro: true  },
  { key: 'fmm_one_click_server',   Icon: Server,     free: false, basic: true,  pro: true  },
  { key: 'fmm_favorite_servers',   Icon: Server,     free: false, basic: true,  pro: true  },
  { key: 'fmm_fivem_settings',     Icon: Settings,   free: false, basic: true,  pro: true  },
  { key: 'fmm_settings_presets',   Icon: Settings,   free: false, basic: true,  pro: true  },
  { key: 'fmm_apply_registry',     Icon: Zap,        free: false, basic: true,  pro: true  },
  { key: 'fmm_hardware_analysis',  Icon: Zap,        free: false, basic: true,  pro: true  },
  { key: 'fmm_restore_services',   Icon: Zap,        free: false, basic: false, pro: true  },
  { key: 'fmm_save_profile',       Icon: Layers,     free: false, basic: false, pro: true  },
  { key: 'fmm_load_profile',       Icon: Layers,     free: false, basic: false, pro: true  },
  { key: 'fmm_rename_profile',     Icon: Layers,     free: false, basic: false, pro: true  },
  { key: 'fmm_auto_reconnect',     Icon: RefreshCw,  free: false, basic: false, pro: true  },
];

const COLS = '1fr repeat(3, minmax(130px, 170px))';

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

  const handleBuy = async (planKey: PlanKey) => {
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

  const priceSuffix = () => {
    if (period === 'monthly') return `/ ${t.month}`;
    if (period === 'quarterly') return `/ ${t.quarterly.toLowerCase()}`;
    return null;
  };

  const [basicPlan, proPlan] = t.fmmPlans;

  return (
    <div className="container mx-auto px-4 py-12 animate-fade-in relative z-10">

      {/* Title + period toggle */}
      <div className="text-center mb-12">
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
            {t.fmmQuarterlySavings}
          </p>
        )}
        {period === 'lifetime' && (
          <p className="mt-4 text-blue-400 font-semibold bg-blue-500/10 inline-block px-4 py-1 rounded-full border border-blue-500/20 animate-fade-in">
            {t.fmmLifetimeNote}
          </p>
        )}
      </div>

      {error && (
        <p className="text-center text-red-400 mb-6 bg-red-500/10 border border-red-500/20 rounded-lg py-2 px-4 max-w-md mx-auto">
          {error}
        </p>
      )}

      {/* Comparison table */}
      <div className="max-w-5xl mx-auto overflow-x-auto">
        <div style={{ minWidth: 620 }}>

          {/* ── Plan header cards ── */}
          <div className="grid pb-4" style={{ gridTemplateColumns: COLS }}>
            <div />

            {/* Free */}
            <div className="flex flex-col items-center px-3">
              <div
                className="w-full rounded-xl mb-3 flex items-center justify-center"
                style={{
                  aspectRatio: '3/4',
                  background: 'linear-gradient(160deg,#1c2333 0%,#111827 100%)',
                  border: '1px solid #374151',
                }}
              >
                <Package size={36} className="text-gray-600" />
              </div>
              <span className="text-xs font-bold tracking-[0.15em] uppercase text-gray-500">Free</span>
              <span className="text-xl font-extrabold text-white mt-0.5">R$0</span>
              <span className="text-xs text-gray-600">{t.fmmForever}</span>
            </div>

            {/* Basic */}
            <div className="flex flex-col items-center px-3">
              <div
                className="w-full rounded-xl mb-3 flex items-center justify-center"
                style={{
                  aspectRatio: '3/4',
                  background: 'linear-gradient(160deg,#1e3a5f 0%,#1e3a8a 100%)',
                  border: '1px solid #3b82f6',
                }}
              >
                <Zap size={36} className="text-blue-400" />
              </div>
              <span className="text-xs font-bold tracking-[0.15em] uppercase text-blue-400">Básico</span>
              <span className="text-xl font-extrabold text-white mt-0.5">R${basicPlan.prices[period]}</span>
              <span className="text-xs text-gray-600">{priceSuffix() ?? t.fmmOneTimePayment}</span>
            </div>

            {/* Pro */}
            <div className="flex flex-col items-center px-3 relative">
              <span
                className="absolute -top-1 left-1/2 -translate-x-1/2 text-[10px] font-bold tracking-wider uppercase text-white px-3 py-0.5 rounded-full z-10"
                style={{ background: 'linear-gradient(90deg,#6d28d9,#8b5cf6)' }}
              >
                {t.fmmRecommended}
              </span>
              <div
                className="w-full rounded-xl mb-3 flex items-center justify-center mt-1"
                style={{
                  aspectRatio: '3/4',
                  background: 'linear-gradient(160deg,#3b1f6b 0%,#4c1d95 100%)',
                  border: '2px solid #8b5cf6',
                }}
              >
                <Layers size={36} className="text-purple-400" />
              </div>
              <span className="text-xs font-bold tracking-[0.15em] uppercase text-purple-400">Pro</span>
              <span className="text-xl font-extrabold text-white mt-0.5">R${proPlan.prices[period]}</span>
              <span className="text-xs text-gray-600">{priceSuffix() ?? t.fmmOneTimePayment}</span>
            </div>
          </div>

          {/* ── Feature rows ── */}
          {FEATURE_ROWS.map(({ key, Icon, free, basic, pro }, idx) => (
            <div
              key={key}
              className="grid items-center"
              style={{
                gridTemplateColumns: COLS,
                background: idx % 2 === 0 ? '#141414' : '#0f0f0f',
                borderBottom: '1px solid #1a1a1a',
              }}
            >
              {/* Feature name */}
              <div className="flex items-center gap-3 px-4 py-3.5">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: '#1e1e1e' }}
                >
                  <Icon size={15} className="text-gray-500" />
                </div>
                <span className="text-sm font-medium text-gray-300 leading-tight">
                  {t.fmmPlanFeatures[key]}
                </span>
              </div>

              {/* Free col */}
              <div className="flex justify-center py-3.5">
                {free
                  ? <Check size={22} strokeWidth={2.5} className="text-gray-400" />
                  : <Minus size={16} className="text-gray-800" />}
              </div>

              {/* Basic col */}
              <div className="flex justify-center py-3.5" style={{ background: 'rgba(59,130,246,0.03)' }}>
                {basic
                  ? <Check size={22} strokeWidth={2.5} className="text-blue-400" />
                  : <Minus size={16} className="text-gray-800" />}
              </div>

              {/* Pro col */}
              <div className="flex justify-center py-3.5" style={{ background: 'rgba(139,92,246,0.04)' }}>
                {pro
                  ? <Check size={22} strokeWidth={2.5} className="text-purple-400" />
                  : <Minus size={16} className="text-gray-800" />}
              </div>
            </div>
          ))}

          {/* ── CTA row ── */}
          <div
            className="grid items-center"
            style={{ gridTemplateColumns: COLS, background: '#0d0d0d', borderTop: '1px solid #222' }}
          >
            <div className="px-4 py-6 text-xs text-gray-600 leading-relaxed">
              {t.fmmLicenseDelivery}
            </div>

            {/* Free */}
            <div className="flex justify-center py-6 px-3">
              <a
                href="https://github.com/D4emonF/FMM-Releases/releases/latest/download/FMM.exe"
                download
                className="flex items-center justify-center gap-1.5 w-full px-3 py-2.5 rounded-lg text-sm font-semibold text-gray-400 border border-gray-700 hover:border-gray-500 hover:text-gray-200 transition-all"
              >
                <Download size={13} />
                {t.fmmDownloadFree}
              </a>
            </div>

            {/* Basic */}
            <div className="flex justify-center py-6 px-3">
              <button
                onClick={() => handleBuy('basic')}
                disabled={loading !== null}
                className="w-full px-3 py-2.5 rounded-lg text-sm font-semibold text-blue-400 border border-blue-500/50 hover:bg-blue-500/10 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading === 'basic' ? '...' : t.subscribe}
              </button>
            </div>

            {/* Pro */}
            <div className="flex justify-center py-6 px-3">
              <button
                onClick={() => handleBuy('pro')}
                disabled={loading !== null}
                className="w-full px-3 py-2.5 rounded-lg text-sm font-bold text-white transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                style={{ background: 'linear-gradient(90deg,#2563eb,#7c3aed)' }}
                onMouseEnter={e => (e.currentTarget.style.filter = 'brightness(1.15)')}
                onMouseLeave={e => (e.currentTarget.style.filter = '')}
              >
                {loading === 'pro' ? '...' : t.subscribe}
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default FmmPlans;
