import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { CheckCircle, Copy, Check, Download, AlertCircle, Loader } from 'lucide-react';

interface ClaimResult {
  key?: string;
  plan?: string;
  period?: string;
  status?: string;
}

const PERIOD_LABEL: Record<string, string> = {
  monthly: 'Mensal (30 dias)',
  quarterly: 'Trimestral (90 dias)',
  lifetime: 'Vitalício',
};

const FmmActivated = () => {
  const [params] = useSearchParams();
  const ref = params.get('ref');

  const [result, setResult] = useState<ClaimResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!ref) {
      setError('Link inválido. Verifique o e-mail de confirmação.');
      return;
    }

    let attempts = 0;
    const MAX = 20;

    const poll = async () => {
      try {
        const res = await fetch(`/.netlify/functions/fmm-claim?ref=${ref}`);
        const data: ClaimResult & { error?: string } = await res.json();

        if (!res.ok) {
          setError(data.error || 'Erro ao verificar pagamento.');
          clearInterval(interval);
          return;
        }

        if (data.key) {
          setResult(data);
          clearInterval(interval);
          return;
        }

        attempts++;
        if (attempts >= MAX) {
          clearInterval(interval);
          setError('Pagamento ainda não confirmado. Aguarde alguns minutos e recarregue a página.');
        }
      } catch {
        attempts++;
        if (attempts >= MAX) {
          clearInterval(interval);
          setError('Erro de conexão. Recarregue a página.');
        }
      }
    };

    poll();
    const interval = setInterval(poll, 3000);
    return () => clearInterval(interval);
  }, [ref]);

  const copyKey = () => {
    if (!result?.key) return;
    navigator.clipboard.writeText(result.key);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] animate-fade-in relative z-10 px-4">
        <div className="glass-panel p-10 max-w-md w-full text-center">
          <AlertCircle className="text-red-400 mx-auto mb-4" size={48} />
          <h2 className="text-2xl font-bold text-white mb-3">Algo deu errado</h2>
          <p className="text-gray-400 mb-6">{error}</p>
          <Link to="/contact" className="btn-primary inline-block">Entrar em Contato</Link>
        </div>
      </div>
    );
  }

  if (!result?.key) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] animate-fade-in relative z-10 px-4">
        <div className="glass-panel p-10 max-w-md w-full text-center">
          <Loader className="text-blue-400 mx-auto mb-4 animate-spin" size={48} />
          <h2 className="text-2xl font-bold text-white mb-3">Confirmando pagamento...</h2>
          <p className="text-gray-400">Isso pode levar alguns segundos.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] animate-fade-in relative z-10 px-4">
      <div className="glass-panel p-10 max-w-lg w-full">
        <div className="text-center mb-8">
          <CheckCircle className="text-green-400 mx-auto mb-4" size={52} />
          <h2 className="text-3xl font-bold text-white mb-1">Pagamento Confirmado!</h2>
          <p className="text-gray-400">
            Plano <span className="text-blue-400 font-semibold capitalize">{result.plan}</span>{' '}
            — {PERIOD_LABEL[result.period ?? ''] ?? result.period}
          </p>
        </div>

        <div className="mb-6">
          <p className="text-sm text-gray-400 mb-2 font-medium">Sua chave de licença:</p>
          <div className="flex items-center gap-3 bg-black/40 border border-white/10 rounded-xl px-4 py-3">
            <code className="text-blue-300 font-mono text-lg tracking-widest flex-grow select-all">
              {result.key}
            </code>
            <button
              onClick={copyKey}
              className="text-gray-400 hover:text-white transition-colors flex-shrink-0"
              title="Copiar chave"
            >
              {copied ? <Check size={20} className="text-green-400" /> : <Copy size={20} />}
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Guarde esta chave em local seguro. Ela não será exibida novamente.
          </p>
        </div>

        <div className="mb-8">
          <p className="text-sm text-gray-400 mb-3 font-medium">Download do aplicativo:</p>
          <a
            href="https://github.com/D4emonF/FMM-Releases/releases/latest/download/FMM.exe"
            className="w-full flex items-center justify-center gap-2 btn-primary"
            download
          >
            <Download size={18} />
            Baixar FMM.exe
          </a>
        </div>

        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 text-sm text-gray-300">
          <p className="font-semibold text-blue-400 mb-1">Como ativar:</p>
          <ol className="list-decimal list-inside space-y-1 text-gray-400">
            <li>Baixe e abra o FiveM Mod Manager</li>
            <li>Vá em <span className="text-white">Configurações → Ativar Licença</span></li>
            <li>Cole a chave acima e confirme</li>
          </ol>
        </div>

        <p className="text-center text-sm text-gray-500 mt-6">
          Dúvidas?{' '}
          <Link to="/contact" className="text-blue-400 hover:underline">Entre em contato</Link>
        </p>
      </div>
    </div>
  );
};

export default FmmActivated;
