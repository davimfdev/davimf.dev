import { useEffect, useState } from 'react';
import { useLanguage } from "../context/LanguageContext.tsx";
import {
  Check, Minus, Download,
  Package, Server, Settings, Zap, Layers, RefreshCw,
} from 'lucide-react';
import { Badge } from '../components/ui';
import { CheckoutModal } from '../features/checkout/CheckoutModal';
import { ApiError, paymentsApi, type CatalogProduct } from '../features/checkout/api';

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
  const [error, setError] = useState<string | null>(null);
  const [catalog, setCatalog] = useState<CatalogProduct[]>([]);
  const [checkoutProduct, setCheckoutProduct] = useState<CatalogProduct | null>(null);

  const periods: { key: Period; label: string }[] = [
    { key: 'monthly',   label: t.monthly },
    { key: 'quarterly', label: t.quarterly },
    { key: 'lifetime',  label: t.lifetime },
  ];

  // Catálogo do backend: o preço mostrado no botão de compra vem do BANCO,
  // nunca desta tela. A tabela comparativa continua usando as traduções.
  useEffect(() => {
    paymentsApi
      .products('fmm')
      .then(({ products }) => setCatalog(products))
      // Mostra o motivo que o backend deu (ex.: banco não migrado) em vez de
      // um "recarregue a página" que esconde a causa.
      .catch((caught: unknown) =>
        setError(
          caught instanceof ApiError && caught.status !== 0
            ? caught.message
            : 'Não foi possível carregar os planos. Recarregue a página.',
        ),
      );
  }, []);

  const handleBuy = (planKey: PlanKey) => {
    setError(null);
    const code = `fmm-${planKey}-${period}`;
    const product = catalog.find((item) => item.code === code);
    if (!product) {
      setError('Plano indisponível no momento. Tente novamente em instantes.');
      return;
    }
    // Checkout acontece DENTRO do site — sem redirect para página do provedor.
    setCheckoutProduct(product);
  };

  const priceSuffix = () => {
    if (period === 'monthly') return `/ ${t.month}`;
    if (period === 'quarterly') return `/ ${t.quarterly.toLowerCase()}`;
    return null;
  };

  const [basicPlan, proPlan] = t.fmmPlans;

  // One entry per stacked mobile card, in table-column order (Free → Básico
  // → Pro). Reuses the exact copy, prices and CTAs the desktop table uses —
  // only the layout differs.
  const mobilePlans = [
    {
      key: 'free',
      icon: Package,
      name: 'Free',
      price: 'R$0',
      priceNote: t.fmmForever,
      surfaceClass: 'bg-surface-1 border-line',
      iconWrapClass: 'bg-surface-1 border-line',
      iconClass: 'text-fg-muted',
      nameClass: 'text-fg-muted',
      recommended: false,
      hasFeature: (row: FeatureRow) => row.free,
      cta: (
        <a
          href="https://github.com/davimfdev/FMM-Releases/releases/latest/download/FMM.exe"
          download
          className="flex items-center justify-center gap-1.5 w-full px-3 py-2.5 rounded-lg text-sm font-semibold text-fg-muted border border-line hover:border-line-strong hover:text-fg transition-all"
        >
          <Download size={13} />
          {t.fmmDownloadFree}
        </a>
      ),
    },
    {
      key: 'basic',
      icon: Zap,
      name: basicPlan.title,
      price: `R$${basicPlan.prices[period]}`,
      priceNote: priceSuffix() ?? t.fmmOneTimePayment,
      surfaceClass: 'bg-surface-2 border-line-strong',
      iconWrapClass: 'bg-surface-2 border-line-strong',
      iconClass: 'text-fg',
      nameClass: 'text-fg',
      recommended: false,
      hasFeature: (row: FeatureRow) => row.basic,
      cta: (
        <button
          onClick={() => handleBuy('basic')}
          disabled={catalog.length === 0}
          className="w-full px-3 py-2.5 rounded-lg text-sm font-semibold text-accent border border-accent/50 hover:bg-accent-bright/10 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {t.subscribe}
        </button>
      ),
    },
    {
      key: 'pro',
      icon: Layers,
      name: proPlan.title,
      price: `R$${proPlan.prices[period]}`,
      priceNote: priceSuffix() ?? t.fmmOneTimePayment,
      // Recommended by composition, not new colour — same surface-3 + accent
      // border the desktop Pro column uses.
      surfaceClass: 'bg-surface-3 border-accent',
      iconWrapClass: 'bg-surface-3 border-accent',
      iconClass: 'text-accent',
      nameClass: 'text-accent',
      recommended: true,
      hasFeature: (row: FeatureRow) => row.pro,
      cta: (
        <button
          onClick={() => handleBuy('pro')}
          disabled={catalog.length === 0}
          className="w-full px-3 py-2.5 rounded-lg text-sm font-bold text-bg bg-accent transition-all disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {t.subscribe}
        </button>
      ),
    },
  ];

  return (
    <div className="container mx-auto px-4 py-12 animate-fade-in relative z-10">

      {/* Title + period toggle */}
      <div className="text-center mb-12">
        <h1 className="text-5xl font-extrabold mb-6 text-gradient inline-block">
          {t.fmmModManagerPlans}
        </h1>

        {/* Pill row — fits on tablet/desktop, where three labels have room. */}
        <div className="hidden md:flex justify-center mt-8">
          <div className="flex glass-panel p-1 rounded-full gap-1">
            {periods.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setPeriod(key)}
                className={`px-5 py-2 rounded-full font-medium transition-all duration-200 ${
                  period === key
                    ? 'bg-accent text-bg shadow-lg'
                    : 'text-fg-muted hover:text-fg'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Full-width 3-part control — a pill row clips "Vitalício" below md. */}
        <div className="grid grid-cols-3 md:hidden glass-panel p-1 rounded-full gap-1 max-w-sm mx-auto mt-8">
          {periods.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setPeriod(key)}
              className={`px-2 py-2 rounded-full text-sm font-medium text-center transition-all duration-200 ${
                period === key
                  ? 'bg-accent text-bg shadow-lg'
                  : 'text-fg-muted hover:text-fg'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {period === 'quarterly' && (
          <p className="mt-4 text-accent font-semibold bg-accent/10 inline-block px-4 py-1 rounded-full border border-accent/20 animate-fade-in">
            {t.fmmQuarterlySavings}
          </p>
        )}
        {period === 'lifetime' && (
          <p className="mt-4 text-accent font-semibold bg-accent/10 inline-block px-4 py-1 rounded-full border border-accent/20 animate-fade-in">
            {t.fmmLifetimeNote}
          </p>
        )}
      </div>

      {error && (
        <p className="text-center text-danger mb-6 bg-danger/10 border border-danger/20 rounded-lg py-2 px-4 max-w-md mx-auto">
          {error}
        </p>
      )}

      {/* Comparison table — the right shape from md up; below that it forced
          horizontal scroll and hid both paid plans, so it is desktop-only. */}
      <div className="hidden md:block max-w-5xl mx-auto overflow-x-auto">
        <div style={{ minWidth: 620 }}>

          {/* ── Plan header cards ── */}
          <div className="grid pb-4" style={{ gridTemplateColumns: COLS }}>
            <div />

            {/* Free */}
            <div className="flex flex-col items-center px-3">
              <div className="h-7 flex items-end pb-1" />
              <div
                className="w-full rounded-panel mb-3 flex items-center justify-center bg-surface-1 border border-line"
                style={{ aspectRatio: '3/4' }}
              >
                <Package size={36} className="text-fg-muted" />
              </div>
              <span className="text-eyebrow font-bold uppercase text-fg-muted">Free</span>
              <span className="text-xl font-extrabold text-fg mt-0.5">R$0</span>
              <span className="text-xs text-fg-muted">{t.fmmForever}</span>
            </div>

            {/* Básico */}
            <div className="flex flex-col items-center px-3">
              <div className="h-7 flex items-end pb-1" />
              <div
                className="w-full rounded-panel mb-3 flex items-center justify-center bg-surface-2 border border-line-strong"
                style={{ aspectRatio: '3/4' }}
              >
                <Zap size={36} className="text-fg" />
              </div>
              <span className="text-eyebrow font-bold uppercase text-fg">{basicPlan.title}</span>
              <span className="text-xl font-extrabold text-fg mt-0.5">R${basicPlan.prices[period]}</span>
              <span className="text-xs text-fg-muted">{priceSuffix() ?? t.fmmOneTimePayment}</span>
            </div>

            {/* Pro — destacado por composição, não por matiz nova. */}
            <div className="flex flex-col items-center px-3">
              <div className="h-7 flex items-end pb-1">
                <Badge tone="accent">{t.fmmRecommended}</Badge>
              </div>
              <div
                className="w-full rounded-panel mb-3 flex items-center justify-center bg-surface-3 border border-accent"
                style={{ aspectRatio: '3/4' }}
              >
                <Layers size={36} className="text-accent" />
              </div>
              <span className="text-eyebrow font-bold uppercase text-accent">{proPlan.title}</span>
              <span className="text-2xl font-extrabold text-fg mt-0.5">R${proPlan.prices[period]}</span>
              <span className="text-xs text-fg-muted">{priceSuffix() ?? t.fmmOneTimePayment}</span>
            </div>
          </div>

          {/* ── Feature rows ── */}
          {FEATURE_ROWS.map(({ key, Icon, free, basic, pro }, idx) => (
            <div
              key={key}
              className="grid items-center"
              style={{
                gridTemplateColumns: COLS,
                background: idx % 2 === 0 ? 'rgb(var(--surface-2))' : 'rgb(var(--surface-1))',
                borderBottom: '1px solid var(--line)',
              }}
            >
              {/* Feature name */}
              <div className="flex items-center gap-3 px-4 py-3.5">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: 'rgb(var(--surface-3))' }}
                >
                  <Icon size={15} className="text-fg-muted" />
                </div>
                <span className="text-sm font-medium text-fg-muted leading-tight">
                  {t.fmmPlanFeatures[key]}
                </span>
              </div>

              {/* Free col */}
              <div className="flex justify-center py-3.5">
                {free
                  ? <Check size={22} strokeWidth={2.5} className="text-fg-muted" />
                  : <Minus size={16} className="text-fg-muted" />}
              </div>

              {/* Basic col */}
              <div className="flex justify-center bg-surface-1 py-3.5">
                {basic
                  ? <Check size={22} strokeWidth={2.5} className="text-accent" />
                  : <Minus size={16} className="text-fg-muted" />}
              </div>

              {/* Pro col */}
              <div className="flex justify-center bg-surface-2 py-3.5">
                {pro
                  ? <Check size={22} strokeWidth={2.5} className="text-accent" />
                  : <Minus size={16} className="text-fg-muted" />}
              </div>
            </div>
          ))}

          {/* ── CTA row ── */}
          <div
            className="grid items-center"
            style={{ gridTemplateColumns: COLS, background: 'rgb(var(--surface-1))', borderTop: '1px solid var(--line-strong)' }}
          >
            <div className="px-4 py-6 text-xs text-fg-muted leading-relaxed">
              {t.fmmLicenseDelivery}
            </div>

            {/* Free */}
            <div className="flex justify-center py-6 px-3">
              <a
                href="https://github.com/davimfdev/FMM-Releases/releases/latest/download/FMM.exe"
                download
                className="flex items-center justify-center gap-1.5 w-full px-3 py-2.5 rounded-lg text-sm font-semibold text-fg-muted border border-line hover:border-line-strong hover:text-fg transition-all"
              >
                <Download size={13} />
                {t.fmmDownloadFree}
              </a>
            </div>

            {/* Basic */}
            <div className="flex justify-center py-6 px-3">
              <button
                onClick={() => handleBuy('basic')}
                disabled={catalog.length === 0}
                className="w-full px-3 py-2.5 rounded-lg text-sm font-semibold text-accent border border-accent/50 hover:bg-accent-bright/10 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {t.subscribe}
              </button>
            </div>

            {/* Pro */}
            <div className="flex justify-center py-6 px-3">
              <button
                onClick={() => handleBuy('pro')}
                disabled={catalog.length === 0}
                className="w-full px-3 py-2.5 rounded-lg text-sm font-bold text-bg bg-accent transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                onMouseEnter={e => (e.currentTarget.style.filter = 'brightness(1.15)')}
                onMouseLeave={e => (e.currentTarget.style.filter = '')}
              >
                {t.subscribe}
              </button>
            </div>
          </div>

        </div>
      </div>

      {/* Stacked plan cards — the native mobile shape for a 3-way comparison
          is one plan after another, compared by scrolling down rather than
          dragging sideways. Reads the same FEATURE_ROWS as the table above,
          so the matrix has one source of truth. */}
      <div className="md:hidden max-w-md mx-auto space-y-5">
        {mobilePlans.map((plan) => (
          <div
            key={plan.key}
            className={`rounded-panel border p-5 ${plan.surfaceClass}`}
          >
            {plan.recommended && (
              <div className="mb-3">
                <Badge tone="accent">{t.fmmRecommended}</Badge>
              </div>
            )}

            {/* Plan identity + price */}
            <div className="flex items-center gap-3 mb-5">
              <div
                className={`w-11 h-11 rounded-lg flex items-center justify-center flex-shrink-0 border ${plan.iconWrapClass}`}
              >
                <plan.icon size={20} className={plan.iconClass} />
              </div>
              <div>
                <div className={`text-eyebrow font-bold uppercase ${plan.nameClass}`}>
                  {plan.name}
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-xl font-extrabold text-fg">{plan.price}</span>
                  <span className="text-xs text-fg-muted">{plan.priceNote}</span>
                </div>
              </div>
            </div>

            {/* Feature list — every row from FEATURE_ROWS, owned or not.
                A plan that lacks a feature still shows the row, de-emphasised,
                rather than omitting it silently. */}
            <ul className="space-y-2.5 mb-5">
              {FEATURE_ROWS.map((row) => {
                const has = plan.hasFeature(row);
                return (
                  <li key={row.key} className="flex items-center gap-3 py-0.5">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: 'rgb(var(--surface-3))' }}
                    >
                      <row.Icon size={15} className="text-fg-muted" />
                    </div>
                    <span
                      className={`flex-1 text-sm font-medium leading-tight ${
                        has ? 'text-fg' : 'text-fg-muted/60'
                      }`}
                    >
                      {t.fmmPlanFeatures[row.key]}
                    </span>
                    {has
                      ? <Check size={18} strokeWidth={2.5} className="text-accent flex-shrink-0" />
                      : <Minus size={14} className="text-fg-muted/50 flex-shrink-0" />}
                  </li>
                );
              })}
            </ul>

            {plan.cta}
          </div>
        ))}
      </div>

      {checkoutProduct && (
        <CheckoutModal product={checkoutProduct} onClose={() => setCheckoutProduct(null)} />
      )}
    </div>
  );
};

export default FmmPlans;
