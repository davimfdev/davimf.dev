/**
 * Minhas Chaves — a licença permanece recuperável fora do e-mail.
 *
 * O backend devolve a chave completa quando ela é decifrável (cópia cifrada
 * gravada na compra); chaves antigas, geradas antes do módulo de pagamentos,
 * só têm o prefixo — e a tela diz isso em vez de fingir que sumiu.
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Copy, Download, Key, RefreshCw, ShieldCheck, XCircle, Zap } from 'lucide-react';
import { ApiError, paymentsApi } from '../features/checkout/api';

interface LicenseRow {
  id: number;
  key: string | null;
  keyPrefix: string;
  level: string;
  status: string;
  durationDays: number;
  expiresAt: string | null;
  activatedAt: string | null;
  createdAt: string;
  orderId: string | null;
}

interface SubscriptionRow {
  id: string;
  status: string;
  autoRenew: boolean;
  nextBillingDate: string | null;
  amountCents: number;
  currency: string;
}

const STATUS_STYLE: Record<string, { label: string; className: string }> = {
  ACTIVE: { label: 'Ativa', className: 'text-green-400 bg-green-500/10' },
  EXPIRED: { label: 'Expirada', className: 'text-[#A8A8A4] bg-white/[0.06]' },
  SUSPENDED: { label: 'Suspensa', className: 'text-amber-400 bg-amber-500/10' },
  REVOKED: { label: 'Revogada', className: 'text-red-400 bg-red-500/10' },
};

const isLifetime = (days: number) => days >= 36500;

const formatDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('pt-BR') : '—';

const MyKeys = () => {
  const [licenses, setLicenses] = useState<LicenseRow[]>([]);
  const [subscriptions, setSubscriptions] = useState<SubscriptionRow[]>([]);
  const [downloadUrl, setDownloadUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<number | null>(null);
  const [cancelling, setCancelling] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    Promise.all([paymentsApi.licenses(), paymentsApi.subscriptions().catch(() => ({ subscriptions: [] }))])
      .then(([licenseData, subscriptionData]) => {
        if (!active) return;
        setLicenses(licenseData.licenses);
        setDownloadUrl(licenseData.downloadUrl);
        setSubscriptions(subscriptionData.subscriptions as SubscriptionRow[]);
      })
      .catch((caught: unknown) => {
        if (!active) return;
        setError(
          caught instanceof ApiError && caught.status === 401
            ? 'Faça login com Discord para ver suas chaves.'
            : 'Não foi possível carregar suas chaves.',
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const copyKey = (license: LicenseRow) => {
    if (!license.key) return;
    navigator.clipboard.writeText(license.key);
    setCopied(license.id);
    setTimeout(() => setCopied(null), 2000);
  };

  const cancelSubscription = async (id: string) => {
    setCancelling(id);
    try {
      await paymentsApi.cancelSubscription(id);
      setSubscriptions((current) =>
        current.map((item) => (item.id === id ? { ...item, status: 'CANCELLED', autoRenew: false } : item)),
      );
    } catch {
      setError('Não foi possível cancelar a renovação. Tente novamente.');
    } finally {
      setCancelling(null);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-20 text-center animate-fade-in relative z-10">
        <div className="inline-block w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-[#A8A8A4]">Carregando suas chaves…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-20 text-center animate-fade-in relative z-10">
        <p className="text-red-400 mb-4">{error}</p>
        <Link to="/" className="text-accent hover:underline">Voltar ao início</Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-12 animate-fade-in relative z-10 max-w-3xl">
      <div className="flex items-center gap-3 mb-8">
        <Key size={26} className="text-accent" />
        <h1 className="text-3xl font-display font-extrabold text-[#F5F3EF]">Minhas Chaves FMM</h1>
      </div>

      {licenses.length === 0 ? (
        <div className="glass-panel p-10 text-center">
          <Key size={44} className="text-[#3A3A36] mx-auto mb-4" />
          <p className="text-[#A8A8A4]">Nenhuma chave encontrada.</p>
          <Link to="/fmm" className="mt-4 inline-block text-accent hover:underline">Ver planos</Link>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {licenses.map((license) => {
            const status = STATUS_STYLE[license.status] ?? STATUS_STYLE.ACTIVE;
            const lifetime = isLifetime(license.durationDays);

            return (
              <div key={license.id} className="glass-panel p-5">
                <div className="flex items-center gap-2 mb-3">
                  {license.level === 'pro'
                    ? <ShieldCheck size={15} className="text-accent" />
                    : <Zap size={15} className="text-accent" />}
                  <span className="text-xs font-bold uppercase tracking-widest text-accent">FMM {license.level}</span>
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${status.className}`}>
                    {status.label}
                  </span>
                </div>

                <div className="bg-black/30 border border-white/10 rounded-lg px-3.5 py-2.5 flex items-center gap-3">
                  <code className="font-mono text-sm text-[#F5F3EF] tracking-wider flex-grow break-all select-all">
                    {license.key ?? `${license.keyPrefix}…`}
                  </code>
                  {license.key && (
                    <button
                      onClick={() => copyKey(license)}
                      className="text-[#6B6B67] hover:text-[#F5F3EF] transition-colors flex-shrink-0"
                      title="Copiar chave"
                      aria-label="Copiar chave"
                    >
                      {copied === license.id
                        ? <Check size={16} className="text-green-400" />
                        : <Copy size={16} />}
                    </button>
                  )}
                </div>

                {!license.key && (
                  <p className="text-[11px] text-[#6B6B67] mt-2">
                    Esta chave foi emitida antes do painel guardar a cópia completa — use a chave
                    recebida por e-mail, ou fale com o suporte.
                  </p>
                )}

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 text-xs text-[#6B6B67]">
                  <span>Validade: {lifetime ? 'Vitalícia' : formatDate(license.expiresAt)}</span>
                  <span>Emitida em {formatDate(license.createdAt)}</span>
                  {license.activatedAt && <span>Ativada em {formatDate(license.activatedAt)}</span>}
                </div>

                <div className="flex flex-wrap gap-2 mt-4">
                  <a href={downloadUrl} download className="btn-secondary text-sm py-2 px-4">
                    <Download size={14} className="mr-1.5" /> Baixar FMM
                  </a>
                  {license.orderId && (
                    <Link to={`/fmm-activated?order=${license.orderId}`} className="btn-secondary text-sm py-2 px-4">
                      Ver pedido
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {subscriptions.length > 0 && (
        <section className="mt-10">
          <h2 className="flex items-center gap-2 text-lg font-display font-bold text-[#F5F3EF] mb-4">
            <RefreshCw size={17} className="text-accent" /> Renovação automática
          </h2>
          <div className="flex flex-col gap-3">
            {subscriptions.map((subscription) => (
              <div key={subscription.id} className="glass-panel p-4 flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <p className="text-sm text-[#F5F3EF] font-medium">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: subscription.currency })
                      .format(subscription.amountCents / 100)}
                    <span className="text-[#6B6B67] font-normal"> · {subscription.status === 'ACTIVE' ? 'ativa' : subscription.status.toLowerCase()}</span>
                  </p>
                  <p className="text-xs text-[#6B6B67] mt-0.5">
                    {subscription.autoRenew
                      ? `Próxima cobrança: ${formatDate(subscription.nextBillingDate)}`
                      : 'Sem cobranças futuras. Sua licença continua válida até expirar.'}
                  </p>
                </div>
                {subscription.autoRenew && (
                  <button
                    onClick={() => cancelSubscription(subscription.id)}
                    disabled={cancelling === subscription.id}
                    className="btn-secondary text-sm py-2 px-4 disabled:opacity-60"
                  >
                    <XCircle size={14} className="mr-1.5" />
                    {cancelling === subscription.id ? 'Cancelando…' : 'Cancelar renovação'}
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

export default MyKeys;
