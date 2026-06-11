// src/pages/TicketView.tsx
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Loader2, AlertCircle, Lock } from 'lucide-react';
import { decryptBundle, type EncryptedBundle } from '../lib/ticketCrypto';

interface Field { name: string; value: string; inline: boolean }
interface Embed {
  authorName?: string; title?: string; description?: string; color?: number | null;
  fields?: Field[]; footer?: string; thumbnailUrl?: string; imageUrl?: string;
}
interface Msg {
  authorName: string; avatarUrl: string; timestampMillis: number; content: string;
  bot: boolean; edited: boolean; attachments: string[]; embeds?: Embed[];
}
interface Transcript {
  categoryLabel: string; openerName: string; openedAt: string; closedByName: string;
  closedAt: string; closeReason: string | null; messages: Msg[];
  emojiImages?: Record<string, string>;
}

const esc = (s: string) => {
  const d = document.createElement('div');
  d.textContent = s ?? '';
  return d.innerHTML;
};

function md(s: string | null | undefined, emoji: Record<string, string>): string {
  if (s == null || s === '') return '';
  let out = esc(s);
  out = out.replace(/&lt;(a?):(\w+):(\d+)&gt;/g, (_f, a, name, id) => {
    const uri = emoji[`<${a}:${name}:${id}>`];
    return uri ? `<img class="inline h-5 w-5 align-text-bottom" src="${uri}" alt=":${name}:">` : `:${name}:`;
  });
  out = out.replace(/```([^`]+)```/g, '<code>$1</code>').replace(/`([^`\n]+)`/g, '<code>$1</code>');
  out = out.replace(/\*\*([^*\n]+)\*\*/g, '<b>$1</b>').replace(/\*([^*\n]+)\*/g, '<i>$1</i>');
  out = out.replace(/__([^_\n]+)__/g, '<u>$1</u>').replace(/~~([^~\n]+)~~/g, '<s>$1</s>');
  return out;
}

export default function TicketView() {
  const { id } = useParams();
  const [bundle, setBundle] = useState<EncryptedBundle | null>(null);
  const [loadErr, setLoadErr] = useState('');
  const [loading, setLoading] = useState(true);
  const [password, setPassword] = useState('');
  const [unlockErr, setUnlockErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [data, setData] = useState<Transcript | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/ticket?id=${id}`);
        const j = await res.json();
        if (!res.ok) throw new Error(j.error || 'Ticket não encontrado.');
        setBundle(j as EncryptedBundle);
      } catch (e: any) {
        setLoadErr(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  async function unlock() {
    if (!bundle) return;
    setBusy(true); setUnlockErr('');
    try {
      const plain = await decryptBundle(bundle, password);
      setData(JSON.parse(plain) as Transcript);
    } catch (e: any) {
      setUnlockErr(e.message === 'WRONG_PASSWORD' ? 'Senha incorreta.' : 'Falha ao decifrar.');
    } finally {
      setBusy(false);
    }
  }

  if (loading)
    return <div className="min-h-[50vh] flex items-center justify-center"><Loader2 size={48} className="text-accent animate-spin" /></div>;

  if (loadErr)
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center p-4">
        <div className="glass-panel p-8 max-w-md w-full text-center border border-red-500/20">
          <AlertCircle size={32} className="text-red-400 mx-auto mb-4" />
          <p className="text-red-400">{loadErr}</p>
        </div>
      </div>
    );

  if (!data)
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center p-4">
        <div className="glass-panel p-8 max-w-md w-full">
          <div className="text-center mb-6">
            <Lock size={32} className="text-accent mx-auto mb-3" />
            <h1 className="text-2xl font-bold">#{bundle?.channelName}</h1>
            <p className="text-gray-400">{bundle?.guildName}</p>
          </div>
          <input
            type="password" value={password} autoFocus
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') unlock(); }}
            placeholder="Senha do transcript"
            className="w-full bg-black/30 border border-white/10 rounded-lg px-4 py-3 mb-3 outline-none focus:border-accent"
          />
          {unlockErr && <p className="text-red-400 text-sm mb-3">{unlockErr}</p>}
          <button onClick={unlock} disabled={busy} className="btn-primary w-full">
            {busy ? 'Verificando...' : 'Desbloquear'}
          </button>
        </div>
      </div>
    );

  const emoji = data.emojiImages || {};
  const fmt = (ts: number) => new Date(ts).toLocaleString('pt-BR');
  return (
    <div className="max-w-3xl mx-auto p-4">
      <header className="mb-6 border-b border-white/10 pb-4">
        <p className="text-accent text-sm">{esc(data.categoryLabel)}</p>
        <h1 className="text-2xl font-bold">#{bundle?.channelName}</h1>
        <p className="text-gray-400 text-sm mt-1">
          Aberto por <b>{esc(data.openerName)}</b> em {esc(data.openedAt)} · Fechado por{' '}
          <b>{esc(data.closedByName)}</b> em {esc(data.closedAt)} · {data.messages.length} mensagens
          {data.closeReason ? <> · Motivo: {esc(data.closeReason)}</> : null}
        </p>
      </header>
      <main className="space-y-4">
        {data.messages.map((m, i) => (
          <div key={i} className="flex gap-3">
            <img src={m.avatarUrl} alt="" className="h-10 w-10 rounded-full" onError={(e) => ((e.target as HTMLImageElement).style.visibility = 'hidden')} />
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-sm">
                <span className="font-semibold">{esc(m.authorName)}</span>
                {m.bot && <span className="text-[10px] bg-accent/20 text-accent px-1 rounded">bot</span>}
                <span className="text-gray-500">{fmt(m.timestampMillis)}</span>
                {m.edited && <span className="text-gray-600 text-xs">(editada)</span>}
              </div>
              {m.content && <div className="text-gray-200 break-words" dangerouslySetInnerHTML={{ __html: md(m.content, emoji) }} />}
              {(m.embeds || []).map((e, j) => (
                <div key={j} className="mt-1 border-l-4 pl-3 py-1 bg-black/20 rounded" style={{ borderColor: e.color != null ? '#' + ((e.color >>> 0) & 0xffffff).toString(16).padStart(6, '0') : '#E6B566' }}>
                  {e.authorName && <div className="text-xs text-gray-400">{esc(e.authorName)}</div>}
                  {e.title && <div className="font-semibold" dangerouslySetInnerHTML={{ __html: md(e.title, emoji) }} />}
                  {e.description && <div className="text-sm text-gray-300" dangerouslySetInnerHTML={{ __html: md(e.description, emoji) }} />}
                  {(e.fields || []).map((f, k) => (
                    <div key={k} className="mt-1">
                      <div className="text-xs font-semibold" dangerouslySetInnerHTML={{ __html: md(f.name, emoji) }} />
                      <div className="text-sm" dangerouslySetInnerHTML={{ __html: md(f.value, emoji) }} />
                    </div>
                  ))}
                  {e.imageUrl && <img src={e.imageUrl} alt="" className="mt-2 rounded max-h-80" onError={(ev) => ((ev.target as HTMLImageElement).style.display = 'none')} />}
                  {e.footer && <div className="text-xs text-gray-500 mt-1">{esc(e.footer)}</div>}
                </div>
              ))}
              {m.attachments.map((a, j) => (
                <span key={j} className="inline-block text-xs bg-white/5 border border-white/10 rounded px-2 py-0.5 mt-1 mr-1">{esc(a)}</span>
              ))}
            </div>
          </div>
        ))}
      </main>
    </div>
  );
}
