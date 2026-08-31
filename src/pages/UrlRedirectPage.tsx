import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Loader2, AlertCircle } from 'lucide-react';

const UrlRedirectPage = () => {
  const { shortCode } = useParams(); // from the URL, e.g., /r/:shortCode
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUrl = async () => {
      if (!shortCode) {
        setError('Nenhum código fornecido.');
        setLoading(false);
        return;
      }

      try {
        // Call our new API endpoint
        const response = await fetch(`/api/get-url?code=${shortCode}`);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'URL não encontrada.');
        }

        // Redirect to the original URL
        window.location.replace(data.originalUrl);

      } catch (err: any) {
        console.error(err);
        setError(err.message);
        setLoading(false);
      }
    };

    fetchUrl();
  }, [shortCode]);

  if (loading) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center animate-fade-in">
        <Loader2 size={48} className="text-accent animate-spin mb-4" />
        <p className="text-xl text-fg-soft font-medium">Redirecionando...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center animate-fade-in p-4">
        <div className="glass-panel p-8 max-w-md w-full text-center border border-red-500/20">
          <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6 border border-red-500/30">
            <AlertCircle size={32} className="text-red-400" />
          </div>
          <h2 className="text-2xl font-bold mb-4 text-fg">Erro de Redirecionamento</h2>
          <p className="text-red-400 font-medium mb-8 bg-red-500/10 p-3 rounded-lg border border-red-500/20">
            {error}
          </p>
          <Link to="/" className="btn-secondary w-full text-center">
            Voltar para o Início
          </Link>
        </div>
      </div>
    );
  }

  return null;
};

export default UrlRedirectPage;
