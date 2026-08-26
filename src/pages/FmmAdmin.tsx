import { useEffect, useState, useCallback } from 'react';
import { ShieldCheck, Plus, Copy, Check, Loader, RefreshCw, Trash2, RotateCcw, Clock, Unlink, Search, AlertCircle } from 'lucide-react';

const ConfirmModal: React.FC<{
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}> = ({ isOpen, title, message, onConfirm, onCancel }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex justify-center items-center z-[100] p-4 animate-fade-in">
      <div className="glass-panel p-8 w-full max-w-sm border border-white/20 shadow-2xl animate-slide-up text-center">
        <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6 border border-red-500/30">
          <AlertCircle size={32} className="text-red-400" />
        </div>
        <h3 className="text-2xl font-bold text-white mb-2">{title}</h3>
        <p className="text-gray-400 mb-8 leading-relaxed">{message}</p>
        <div className="flex flex-col gap-3">
          <button onClick={onConfirm} className="w-full py-3 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-red-600/20">
            Confirmar
          </button>
          <button onClick={onCancel} className="w-full py-3 bg-white/5 hover:bg-white/10 text-gray-300 font-medium rounded-xl transition-all">
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
};

const ADMIN_IDS = new Set(['956985471332937778', '344214477069221888']);

interface GeneratedKey { key: string; copied: boolean; }

interface DbKey {
  id: number;
  key_prefix: string;
  level: string;
  duration_days: number;
  expires_at: string | null;
  is_active: boolean;
  is_claimed: boolean;
  notes: string | null;
  discord_user_id: string | null;
  created_at: string;
  last_validated_at: string | null;
}

const PRESETS = [
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
  { label: '1 ano', days: 365 },
  { label: 'Vitalício', days: 36500 },
];

const fmt = (iso: string | null) => iso ? new Date(iso).toLocaleDateString('pt-BR') : '∞';
const isExpired = (iso: string | null) => iso ? new Date(iso) < new Date() : false;

const FmmAdmin = () => {
  const [userId, setUserId] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // generator state
  const [level, setLevel] = useState<'basic' | 'pro'>('pro');
  const [durationDays, setDurationDays] = useState<number>(30);
  const [quantity, setQuantity] = useState<number>(1);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [generatedKeys, setGeneratedKeys] = useState<GeneratedKey[]>([]);

  // all-keys state
  const [dbKeys, setDbKeys] = useState<DbKey[]>([]);
  const [keysLoading, setKeysLoading] = useState(false);
  const [keysError, setKeysError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [editingDuration, setEditingDuration] = useState<{ id: number; days: number } | null>(null);
  const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean; title: string; message: string; onConfirm: () => void }>({
    isOpen: false, title: '', message: '', onConfirm: () => {},
  });

  const token = () => localStorage.getItem('discord_token') ?? '';

  useEffect(() => {
    const t = token();
    if (!t) { setAuthError('Login com Discord necessário.'); setLoading(false); return; }
    fetch('https://discord.com/api/users/@me', { headers: { Authorization: `Bearer ${t}` } })
      .then(async (res) => {
        if (!res.ok) { setAuthError('Token inválido.'); return; }
        const u = await res.json();
        if (!ADMIN_IDS.has(u.id)) { setAuthError('Acesso negado.'); return; }
        setUserId(u.id);
      })
      .catch(() => setAuthError('Erro de conexão.'))
      .finally(() => setLoading(false));
  }, []);

  const fetchKeys = useCallback(async () => {
    setKeysLoading(true);
    setKeysError(null);
    try {
      const res = await fetch('/api/fmm-admin-keys', {
        headers: { Authorization: `Bearer ${token()}` },
      });
      const data = await res.json();
      if (!res.ok) { setKeysError(data.error || 'Erro ao carregar chaves.'); return; }
      setDbKeys(data);
    } catch { setKeysError('Erro de conexão.'); }
    finally { setKeysLoading(false); }
  }, []);

  useEffect(() => { if (userId) fetchKeys(); }, [userId, fetchKeys]);

  const doAction = async (action: string, key_id: number, extra?: object) => {
    setActionLoading(key_id);
    try {
      const res = await fetch('/api/fmm-admin-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ action, key_id, ...extra }),
      });
      const data = await res.json();
      if (!res.ok) { alert(data.error || 'Erro.'); return; }
      // optimistic update
      setDbKeys(prev => prev.map(k => {
        if (k.id !== key_id) return k;
        if (action === 'unclaim') return { ...k, is_claimed: false, last_validated_at: null };
        if (action === 'revoke') return { ...k, is_active: false };
        if (action === 'reactivate') return { ...k, is_active: true };
        if (action === 'set_duration') return { ...k, duration_days: data.duration_days, expires_at: data.expires_at };
        return k;
      }));
    } catch { alert('Erro de conexão.'); }
    finally { setActionLoading(null); setEditingDuration(null); }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    setGenError(null);
    try {
      const res = await fetch('/api/fmm-admin-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ level, duration_days: durationDays, quantity }),
      });
      const data = await res.json();
      if (!res.ok) { setGenError(data.error || 'Erro ao gerar.'); return; }
      setGeneratedKeys(prev => [
        ...data.keys.map((k: string) => ({ key: k, copied: false })),
        ...prev,
      ]);
      fetchKeys();
    } catch { setGenError('Erro de conexão.'); }
    finally { setGenerating(false); }
  };

  const copyKey = (index: number) => {
    navigator.clipboard.writeText(generatedKeys[index].key);
    setGeneratedKeys(prev => prev.map((k, i) => i === index ? { ...k, copied: true } : k));
    setTimeout(() => setGeneratedKeys(prev => prev.map((k, i) => i === index ? { ...k, copied: false } : k)), 2000);
  };

  const filtered = dbKeys.filter(k =>
    k.key_prefix.toLowerCase().includes(search.toLowerCase()) ||
    (k.discord_user_id ?? '').includes(search) ||
    (k.notes ?? '').toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader size={32} className="text-accent animate-spin" />
    </div>
  );

  if (authError) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="glass-panel p-10 text-center max-w-sm">
        <ShieldCheck size={48} className="text-red-400 mx-auto mb-4" />
        <p className="text-red-400 font-semibold">{authError}</p>
      </div>
    </div>
  );

  return (
    <>
    <div className="container mx-auto px-4 py-12 animate-fade-in relative z-10 max-w-5xl">
      <div className="flex items-center gap-3 mb-8">
        <ShieldCheck size={28} className="text-accent" />
        <h1 className="text-3xl font-extrabold text-white">Admin FMM</h1>
        <span className="text-xs text-gray-500 font-mono ml-auto">{userId}</span>
      </div>

      {/* ── Generator ── */}
      <div className="glass-panel p-6 mb-6">
        <h2 className="text-lg font-bold text-white mb-5">Gerar Chaves</h2>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="text-xs text-gray-400 uppercase tracking-wider mb-2 block">Plano</label>
            <div className="flex gap-2">
              {(['basic', 'pro'] as const).map((l) => (
                <button key={l} onClick={() => setLevel(l)}
                  className={`flex-1 py-2 rounded-lg text-sm font-semibold capitalize transition-all ${level === l ? (l === 'pro' ? 'bg-accent text-ink' : 'bg-accent text-ink') : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}>
                  {l}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-400 uppercase tracking-wider mb-2 block">Quantidade</label>
            <input type="number" min={1} max={50} value={quantity}
              onChange={(e) => setQuantity(Math.max(1, Math.min(50, parseInt(e.target.value) || 1)))}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent" />
          </div>
        </div>

        <div className="mb-5">
          <label className="text-xs text-gray-400 uppercase tracking-wider mb-2 block">
            Duração — {durationDays >= 36500 ? 'Vitalício' : `${durationDays} dias`}
          </label>
          <div className="flex gap-2 mb-3">
            {PRESETS.map((p) => (
              <button key={p.days} onClick={() => setDurationDays(p.days)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${durationDays === p.days ? 'bg-accent text-ink' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}>
                {p.label}
              </button>
            ))}
          </div>
          <input type="number" min={1} value={durationDays}
            onChange={(e) => setDurationDays(Math.max(1, parseInt(e.target.value) || 1))}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-accent"
            placeholder="Dias personalizados" />
        </div>

        {genError && <p className="text-red-400 text-sm mb-4 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{genError}</p>}

        <button onClick={handleGenerate} disabled={generating}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-lg font-bold text-white transition-all disabled:opacity-60"
          style={{ background: 'linear-gradient(90deg,#2563eb,#7c3aed)' }}
          onMouseEnter={(e) => !generating && (e.currentTarget.style.filter = 'brightness(1.15)')}
          onMouseLeave={(e) => (e.currentTarget.style.filter = '')}>
          {generating ? <Loader size={18} className="animate-spin" /> : <Plus size={18} />}
          {generating ? 'Gerando...' : `Gerar ${quantity > 1 ? `${quantity} chaves` : 'chave'}`}
        </button>
      </div>

      {generatedKeys.length > 0 && (
        <div className="glass-panel p-6 mb-6">
          <h2 className="text-lg font-bold text-white mb-4">Chaves Geradas (sessão atual)</h2>
          <div className="flex flex-col gap-2">
            {generatedKeys.map((k, i) => (
              <div key={k.key} className="flex items-center gap-3 bg-black/30 border border-white/10 rounded-xl px-4 py-3">
                <code className="font-mono text-accent text-sm tracking-widest flex-grow select-all">{k.key}</code>
                <button onClick={() => copyKey(i)} className="text-gray-400 hover:text-white transition-colors flex-shrink-0">
                  {k.copied ? <Check size={16} className="text-green-400" /> : <Copy size={16} />}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── All Keys Table ── */}
      <div className="glass-panel p-6">
        <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
          <h2 className="text-lg font-bold text-white">
            Todas as Chaves{' '}
            <span className="text-sm text-gray-500 font-normal">({filtered.length}/{dbKeys.length})</span>
          </h2>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Prefixo, user ID, notes..."
                className="bg-white/5 border border-white/10 rounded-lg pl-8 pr-3 py-1.5 text-sm text-white focus:outline-none focus:border-accent w-52"
              />
            </div>
            <button onClick={fetchKeys} disabled={keysLoading}
              className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all disabled:opacity-50">
              <RefreshCw size={15} className={keysLoading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {keysError && <p className="text-red-400 text-sm mb-4 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{keysError}</p>}

        {keysLoading && !dbKeys.length ? (
          <div className="text-center py-10"><Loader size={24} className="text-accent animate-spin mx-auto" /></div>
        ) : filtered.length === 0 ? (
          <p className="text-gray-500 text-center py-8">Nenhuma chave encontrada.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 uppercase tracking-wider border-b border-white/10">
                  <th className="pb-3 pr-4">Prefixo</th>
                  <th className="pb-3 pr-4">Plano</th>
                  <th className="pb-3 pr-4">Status</th>
                  <th className="pb-3 pr-4">Vínculo</th>
                  <th className="pb-3 pr-4">Expiração</th>
                  <th className="pb-3 pr-4">User ID</th>
                  <th className="pb-3">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filtered.map((k) => {
                  const expired = isExpired(k.expires_at);
                  const lifetime = k.duration_days >= 36500;
                  const busy = actionLoading === k.id;

                  return (
                    <tr key={k.id} className={`${!k.is_active ? 'opacity-50' : ''} hover:bg-white/2 transition-colors`}>
                      {/* Prefix */}
                      <td className="py-3 pr-4">
                        <code className="font-mono text-gray-300 text-xs">{k.key_prefix}…</code>
                      </td>

                      {/* Level */}
                      <td className="py-3 pr-4">
                        <span className={`text-xs font-bold uppercase ${k.level === 'pro' ? 'text-accent' : 'text-accent'}`}>
                          {k.level}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-3 pr-4">
                        {!k.is_active
                          ? <span className="text-xs text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full">Revogada</span>
                          : expired
                            ? <span className="text-xs text-orange-400 bg-orange-500/10 px-2 py-0.5 rounded-full">Expirada</span>
                            : <span className="text-xs text-green-400 bg-green-500/10 px-2 py-0.5 rounded-full">Ativa</span>}
                      </td>

                      {/* Claimed */}
                      <td className="py-3 pr-4">
                        {k.is_claimed
                          ? <span className="text-xs text-yellow-400 bg-yellow-500/10 px-2 py-0.5 rounded-full">Vinculada</span>
                          : <span className="text-xs text-gray-600">Livre</span>}
                      </td>

                      {/* Expiry */}
                      <td className="py-3 pr-4 text-gray-400 text-xs whitespace-nowrap">
                        {lifetime ? '∞ Vitalício' : fmt(k.expires_at)}
                      </td>

                      {/* Discord user */}
                      <td className="py-3 pr-4">
                        <span className="text-xs text-gray-500 font-mono">{k.discord_user_id ?? '—'}</span>
                      </td>

                      {/* Actions */}
                      <td className="py-3">
                        <div className="flex items-center gap-1 flex-wrap">
                          {/* Unclaim */}
                          {k.is_claimed && (
                            <button
                              onClick={() => doAction('unclaim', k.id)}
                              disabled={busy}
                              title="Desvincular hardware"
                              className="p-1.5 rounded-lg bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400 transition-all disabled:opacity-40"
                            >
                              {busy ? <Loader size={13} className="animate-spin" /> : <Unlink size={13} />}
                            </button>
                          )}

                          {/* Revoke / Reactivate */}
                          {k.is_active ? (
                            <button
                              onClick={() => setConfirmModal({
                                isOpen: true,
                                title: 'Revogar chave?',
                                message: `A chave ${k.key_prefix}… será desativada imediatamente. O usuário perderá acesso.`,
                                onConfirm: () => { setConfirmModal(p => ({ ...p, isOpen: false })); doAction('revoke', k.id); },
                              })}
                              disabled={busy}
                              title="Revogar"
                              className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-all disabled:opacity-40"
                            >
                              {busy ? <Loader size={13} className="animate-spin" /> : <Trash2 size={13} />}
                            </button>
                          ) : (
                            <button
                              onClick={() => doAction('reactivate', k.id)}
                              disabled={busy}
                              title="Reativar"
                              className="p-1.5 rounded-lg bg-green-500/10 hover:bg-green-500/20 text-green-400 transition-all disabled:opacity-40"
                            >
                              {busy ? <Loader size={13} className="animate-spin" /> : <RotateCcw size={13} />}
                            </button>
                          )}

                          {/* Edit duration */}
                          {editingDuration?.id === k.id ? (
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                min={1}
                                value={editingDuration.days}
                                onChange={(e) => setEditingDuration({ id: k.id, days: Math.max(1, parseInt(e.target.value) || 1) })}
                                className="w-16 bg-white/10 border border-white/20 rounded px-1.5 py-0.5 text-xs text-white focus:outline-none focus:border-accent"
                              />
                              <button
                                onClick={() => doAction('set_duration', k.id, { duration_days: editingDuration.days })}
                                disabled={busy}
                                className="p-1 rounded bg-accent hover:bg-accent-soft text-ink text-xs transition-all disabled:opacity-40"
                              >
                                {busy ? <Loader size={11} className="animate-spin" /> : <Check size={11} />}
                              </button>
                              <button
                                onClick={() => setEditingDuration(null)}
                                className="p-1 rounded bg-white/5 hover:bg-white/10 text-gray-400 text-xs transition-all"
                              >
                                ✕
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setEditingDuration({ id: k.id, days: k.duration_days })}
                              disabled={busy}
                              title="Alterar duração"
                              className="p-1.5 rounded-lg bg-accent/10 hover:bg-accent-soft/20 text-accent transition-all disabled:opacity-40"
                            >
                              <Clock size={13} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
    <ConfirmModal
      isOpen={confirmModal.isOpen}
      title={confirmModal.title}
      message={confirmModal.message}
      onConfirm={confirmModal.onConfirm}
      onCancel={() => setConfirmModal(p => ({ ...p, isOpen: false }))}
    />
    </>
  );
};

export default FmmAdmin;
