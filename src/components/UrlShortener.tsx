import { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { Link2, Copy, CheckCircle2, Scissors } from 'lucide-react';

const UrlShortener = () => {
  const { translations } = useLanguage();
  const [originalUrl, setOriginalUrl] = useState('');
  const [shortUrl, setShortUrl] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setShortUrl('');
    setCopied(false);
    setLoading(true);

    if (!originalUrl) {
      setError(translations.urlShortenerEnterUrl);
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/create-short-url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ originalUrl }),
      });

      if (!response.ok) {
        let message = translations.urlShortenerError;
        try {
          const errorData = await response.json();
          message = errorData.error || message;
        } catch {
          console.error("Received a non-JSON error response from the server.");
        }
        throw new Error(message);
      }

      const data = await response.json();
      setShortUrl(data.shortUrl);

    } catch (err: any) {
      console.error(err);
      setError(err.message || translations.urlShortenerError);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyToClipboard = () => {
    navigator.clipboard.writeText(shortUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="container mx-auto px-4 py-12 animate-fade-in relative z-10" style={{ maxWidth: '600px' }}>
      <div className="flex flex-col items-center mb-10">
        <div className="p-4 bg-blue-500/20 rounded-full border border-blue-500/30 mb-6 shadow-[0_0_30px_rgba(59,130,246,0.2)]">
          <Scissors size={36} className="text-blue-400" />
        </div>
        <h1 className="text-4xl font-extrabold text-gradient text-center">{translations.urlShortenerTitle}</h1>
        <p className="text-gray-400 mt-4 text-center">Transforme links longos em URLs curtas e fáceis de compartilhar.</p>
      </div>
      
      <div className="glass-panel p-6 md:p-8 border-t border-white/10 shadow-2xl animate-slide-up">
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Cole sua URL longa aqui</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Link2 size={20} className="text-blue-400" />
              </div>
              <input
                type="url"
                placeholder={translations.urlShortenerPlaceholder}
                value={originalUrl}
                onChange={(e) => setOriginalUrl(e.target.value)}
                required
                className="w-full pl-12 pr-4 py-4 bg-gray-900/60 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-100 placeholder-gray-500 transition-all text-lg shadow-inner"
              />
            </div>
          </div>
          
          <button
            type="submit"
            disabled={loading}
            className="w-full btn-primary py-4 text-lg font-bold disabled:opacity-50 disabled:cursor-not-allowed group mt-2 shadow-[0_4px_15px_rgba(37,99,235,0.2)] hover:shadow-[0_6px_25px_rgba(37,99,235,0.4)]"
          >
            {loading ? (
              <span className="flex items-center justify-center animate-pulse">
                {translations.urlShortenerLoading} <Scissors size={20} className="ml-2" />
              </span>
            ) : (
              <span className="flex items-center justify-center">
                {translations.urlShortenerButton} <Scissors size={20} className="ml-2 group-hover:-rotate-12 group-hover:scale-110 transition-transform" />
              </span>
            )}
          </button>
        </form>

        {error && (
          <div className="mt-6 bg-red-500/10 border border-red-500/30 text-red-400 px-5 py-4 rounded-xl animate-fade-in flex items-start gap-3">
            <div className="mt-0.5">⚠️</div>
            <p className="font-medium text-sm">{error}</p>
          </div>
        )}

        {shortUrl && (
          <div className="mt-8 p-6 bg-gray-800/60 border border-blue-500/20 rounded-xl animate-slide-up shadow-inner relative overflow-hidden group">
            {/* Decoração sutil no fundo do card de resultado */}
            <div className="absolute top-0 right-0 w-40 h-40 bg-blue-500/10 rounded-full blur-[50px] pointer-events-none group-hover:bg-blue-500/20 transition-colors"></div>
            
            <p className="font-bold text-gray-300 mb-4 uppercase tracking-wider text-xs flex items-center">
              <span className="w-2 h-2 rounded-full bg-green-500 mr-2 animate-pulse"></span>
              {translations.urlShortenerResult}
            </p>
            
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 relative z-10">
              <div className="flex-grow bg-gray-900 border border-white/10 rounded-lg p-4 flex items-center shadow-inner overflow-hidden">
                <a
                  href={shortUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:text-blue-300 hover:underline break-all text-lg font-mono font-medium truncate"
                  title={shortUrl}
                >
                  {shortUrl}
                </a>
              </div>
              <button
                onClick={handleCopyToClipboard}
                className={`flex items-center justify-center py-4 px-6 rounded-lg font-bold transition-all sm:w-auto w-full ${
                  copied 
                  ? 'bg-green-500/20 text-green-400 border border-green-500/30 shadow-[0_0_15px_rgba(34,197,94,0.2)]'
                  : 'bg-white/10 hover:bg-white/20 text-white border border-white/10 hover:border-white/20'
                }`}
              >
                {copied ? (
                  <>
                    <CheckCircle2 size={18} className="mr-2" />
                    Copiado!
                  </>
                ) : (
                  <>
                    <Copy size={18} className="mr-2" />
                    Copiar
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default UrlShortener;
