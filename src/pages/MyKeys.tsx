import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Key, Copy, Check, ShieldCheck, Zap } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

interface LicenseKey {
  key_prefix: string;
  level: string;
  duration_days: number;
  expires_at: string;
  notes: string | null;
  created_at: string;
}

const MyKeys = () => {
  const { translations } = useLanguage();
  const t = translations as any;

  const [keys, setKeys] = useState<LicenseKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('discord_token');
    if (!token) {
      setError('Faça login com Discord para ver suas chaves.');
      setLoading(false);
      return;
    }

    fetch('/.netlify/functions/fmm-my-keys', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) { setError(data.error || 'Erro ao carregar chaves.'); return; }
        setKeys(data);
      })
      .catch(() => setError('Erro de conexão.'))
      .finally(() => setLoading(false));
  }, []);

  const copyPrefix = (prefix: string) => {
    navigator.clipboard.writeText(prefix);
    setCopied(prefix);
    setTimeout(() => setCopied(null), 2000);
  };

  const isExpired = (expires_at: string) => new Date(expires_at) < new Date();
  const isLifetime = (days: number) => days >= 36500;

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-20 text-center animate-fade-in relative z-10">
        <div className="inline-block w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-gray-400">Carregando suas chaves...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-20 text-center animate-fade-in relative z-10">
        <p className="text-red-400 mb-4">{error}</p>
        <Link to="/" className="text-blue-400 hover:underline">Voltar ao início</Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-12 animate-fade-in relative z-10 max-w-3xl">
      <div className="flex items-center gap-3 mb-8">
        <Key size={28} className="text-blue-400" />
        <h1 className="text-3xl font-extrabold text-white">Minhas Chaves FMM</h1>
      </div>

      {keys.length === 0 ? (
        <div className="glass-panel p-10 text-center">
          <Key size={48} className="text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400">Nenhuma chave encontrada.</p>
          <Link to="/fmm" className="mt-4 inline-block text-blue-400 hover:underline">Ver planos</Link>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {keys.map((k) => {
            const expired = isExpired(k.expires_at);
            const lifetime = isLifetime(k.duration_days);
            const levelColor = k.level === 'pro' ? 'text-purple-400' : 'text-blue-400';
            const levelBorder = k.level === 'pro' ? 'border-purple-500/30' : 'border-blue-500/30';
            const levelBg = k.level === 'pro' ? 'bg-purple-500/5' : 'bg-blue-500/5';

            return (
              <div key={k.key_prefix} className={`glass-panel p-5 border ${levelBorder} ${levelBg}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      {k.level === 'pro'
                        ? <ShieldCheck size={16} className="text-purple-400" />
                        : <Zap size={16} className="text-blue-400" />}
                      <span className={`text-xs font-bold uppercase tracking-widest ${levelColor}`}>
                        {k.level}
                      </span>
                      {expired && (
                        <span className="text-xs font-semibold text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full">
                          Expirada
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <code className="font-mono text-gray-300 text-sm">{k.key_prefix}…</code>
                      <button
                        onClick={() => copyPrefix(k.key_prefix)}
                        className="text-gray-600 hover:text-gray-300 transition-colors"
                        title="Copiar prefixo"
                      >
                        {copied === k.key_prefix
                          ? <Check size={14} className="text-green-400" />
                          : <Copy size={14} />}
                      </button>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      {lifetime ? 'Vitalício' : `Expira: ${new Date(k.expires_at).toLocaleDateString('pt-BR')}`}
                      {' · '}
                      Criada em {new Date(k.created_at).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="text-xs text-gray-600 mt-8 text-center">
        Só o prefixo da chave é exibido por segurança. Guarde a chave completa recebida no e-mail.
      </p>
    </div>
  );
};

export default MyKeys;
