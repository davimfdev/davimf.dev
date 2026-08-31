import React, { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { Link2, Copy, Scissors, Trash2, ExternalLink, History, AlertCircle, Loader2 } from 'lucide-react';

// --- Types ---
interface ShortUrl {
  id: string;
  original_url?: string;
  originalUrl?: string;
  originalurl?: string;
  short_url?: string;
  shortUrl?: string;
  shorturl?: string;
  created_at: string;
}

// --- Componente do Modal de Confirmação ---
const ConfirmModal: React.FC<{ isOpen: boolean; title: string; message: string; onConfirm: () => void; onCancel: () => void; }> = ({ isOpen, title, message, onConfirm, onCancel }) => {
  if (!isOpen) return null;
  return (
      <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex justify-center items-center z-[100] p-4 animate-fade-in">
        <div className="glass-panel p-8 w-full max-w-sm border border-line-strong shadow-2xl animate-slide-up text-center">
          <div className="w-16 h-16 bg-danger/20 rounded-full flex items-center justify-center mx-auto mb-6 border border-danger/30">
            <AlertCircle size={32} className="text-danger" />
          </div>
          <h3 className="text-2xl font-bold text-fg mb-2">{title}</h3>
          <p className="text-fg-muted mb-8 leading-relaxed">{message}</p>
          <div className="flex flex-col gap-3">
            <button onClick={onConfirm} className="w-full py-3 bg-danger hover:bg-danger text-bg font-bold rounded-xl transition-all shadow-lg shadow-danger/20">Confirmar Exclusão</button>
            <button onClick={onCancel} className="w-full py-3 bg-surface-1 hover:bg-surface-2 text-fg-muted font-medium rounded-xl transition-all">Cancelar</button>
          </div>
        </div>
      </div>
  );
};

const UrlShortener = () => {
  const { translations } = useLanguage();
  const [originalUrl, setOriginalUrl] = useState('');
  const [shortUrl, setShortUrl] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [myUrls, setMyUrls] = useState<ShortUrl[]>([]);

  // Modal de exclusão
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, urlId: '' });

  const token = localStorage.getItem('discord_token');

  const fetchMyUrls = useCallback(async () => {
    if (!token) { setHistoryLoading(false); return; }
    try {
      const response = await fetch('/api/getmyurls', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setMyUrls(data);
      }
    } catch (err) { console.error(err); } finally { setHistoryLoading(false); }
  }, [token]);

  useEffect(() => { fetchMyUrls(); }, [fetchMyUrls]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setShortUrl('');
    setLoading(true);

    try {
      const response = await fetch('/api/create-short-url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ originalUrl }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Erro ao criar link.');

      // Pega o link curto de qualquer formato que o backend retornar
      const newShortUrl = data.shortUrl || data.short_url || data.shorturl;
      setShortUrl(newShortUrl);
      setOriginalUrl('');
      fetchMyUrls();

    } catch (err: any) {
      setError(err.message);
    } finally { setLoading(false); }
  };

  const handleDeleteUrl = async () => {
    if (!token || !confirmModal.urlId) return;
    try {
      const response = await fetch('/api/delete-url', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ id: confirmModal.urlId }),
      });
      if (response.ok) {
        setMyUrls(prev => prev.filter(u => u.id !== confirmModal.urlId));
        setConfirmModal({ isOpen: false, urlId: '' });
      }
    } catch (err) { console.error(err); }
  };

  const copyToClipboard = (text: string) => {
    if (!text || text === 'undefined') return;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
      <div className="container mx-auto px-4 py-12 animate-fade-in relative z-10" style={{ maxWidth: '800px' }}>

        <ConfirmModal
            isOpen={confirmModal.isOpen}
            title="Apagar Link?"
            message="Isso desativará o redirecionamento permanentemente."
            onConfirm={handleDeleteUrl}
            onCancel={() => setConfirmModal({ isOpen: false, urlId: '' })}
        />

        <div className="flex flex-col items-center mb-10">
          <div className="p-4 bg-accent/20 rounded-full border border-accent/30 mb-6 shadow-[0_0_30px_rgba(59,130,246,0.2)]">
            <Scissors size={36} className="text-accent" />
          </div>
          <h1 className="text-4xl font-extrabold text-gradient text-center">Encurtador de Links</h1>
          <p className="text-fg-muted mt-4 text-center">Crie e gerencie seus links curtos.</p>
        </div>

        {/* Formulário principal */}
        <div className="glass-panel p-6 md:p-8 border-t border-line shadow-2xl mb-12">
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div className="relative">
              <Link2 className="absolute left-4 top-4 text-accent" size={20} />
              <input
                  type="url"
                  placeholder="Cole sua URL longa (https://...)"
                  value={originalUrl}
                  onChange={(e) => setOriginalUrl(e.target.value)}
                  required
                  className="w-full pl-12 pr-4 py-4 bg-surface-1/60 border border-line rounded-xl focus:ring-2 focus:ring-accent text-fg outline-none transition-all"
              />
            </div>
            <button type="submit" disabled={loading} className="w-full btn-primary py-4 font-bold text-lg flex justify-center items-center gap-2">
              {loading ? <Loader2 className="animate-spin" /> : <Scissors size={20} />}
              Encurtar Link
            </button>
          </form>

          {error && <div className="mt-4 text-danger text-sm bg-danger/10 p-3 rounded-lg border border-danger/20">{error}</div>}

          {shortUrl && (
            <div className="mt-4 p-4 bg-accent/10 border border-accent/30 rounded-xl flex items-center justify-between gap-3 animate-slide-up">
              <div className="overflow-hidden">
                <p className="text-xs text-accent font-semibold uppercase tracking-wider mb-1">Link encurtado</p>
                <p className="text-accent font-mono font-bold truncate">{shortUrl}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => copyToClipboard(shortUrl)}
                  className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent-bright text-bg text-sm font-semibold rounded-lg transition-all"
                >
                  <Copy size={15} />
                  {copied ? 'Copiado!' : 'Copiar'}
                </button>
                <a href={shortUrl} target="_blank" rel="noreferrer" className="p-2 bg-surface-1 hover:bg-surface-2 rounded-lg text-fg-muted transition-colors" title="Abrir">
                  <ExternalLink size={16} />
                </a>
              </div>
            </div>
          )}
        </div>

        {/* Histórico do Usuário */}
        {token && (
            <div className="animate-slide-up">
              <h2 className="text-2xl font-bold text-fg mb-6 flex items-center gap-2">
                <History className="text-accent" /> Meus Links
              </h2>

              <div className="space-y-4">
                {historyLoading ? (
                    <div className="flex justify-center p-10"><Loader2 className="animate-spin text-accent" /></div>
                ) : myUrls.length > 0 ? (
                    myUrls.map(url => {
                      // Previne o undefined checando todas as chaves possíveis do banco
                      const displayShortUrl = url.short_url || url.shortUrl || url.shorturl || '';
                      const displayOriginalUrl = url.original_url || url.originalUrl || url.originalurl || '';

                      return (
                          <div key={url.id} className="glass-panel p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 group border border-line hover:border-accent/30 transition-all">
                            <div className="overflow-hidden w-full sm:w-2/3">
                              {/* Link Curto */}
                              <p className="text-accent font-mono font-bold text-lg truncate">
                                {displayShortUrl ? displayShortUrl : 'Erro: Link curto não encontrado'}
                              </p>
                              {/* Link Longo (Cores ajustadas para ficarem bem visíveis) */}
                              <p className="text-fg-muted text-sm truncate mt-1">
                                {displayOriginalUrl}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                              <button onClick={() => copyToClipboard(displayShortUrl)} className="p-2 bg-surface-1 hover:bg-surface-2 rounded-lg text-fg-muted transition-colors" title="Copiar"><Copy size={18}/></button>
                              <a href={displayShortUrl} target="_blank" rel="noreferrer" className="p-2 bg-surface-1 hover:bg-surface-2 rounded-lg text-fg-muted transition-colors" title="Abrir"><ExternalLink size={18}/></a>
                              <button onClick={() => setConfirmModal({ isOpen: true, urlId: url.id })} className="p-2 bg-danger/5 hover:bg-danger/20 rounded-lg text-fg-muted hover:text-danger transition-colors" title="Apagar"><Trash2 size={18}/></button>
                            </div>
                          </div>
                      );
                    })
                ) : (
                    <div className="glass-panel p-10 text-center text-fg-muted border-dashed border-line">Você ainda não criou nenhum link encurtado.</div>
                )}
              </div>
            </div>
        )}
      </div>
  );
};

export default UrlShortener;
