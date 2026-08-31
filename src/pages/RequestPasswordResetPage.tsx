import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowRight } from 'lucide-react';

const RequestPasswordResetPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [resetLink, setResetLink] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setResetLink('');
    setLoading(true);

    try {
      const response = await fetch('/api/request-password-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to request password reset.');
      }
      
      setMessage(data.message);
      if (data.resetLink) {
        setResetLink(data.resetLink);
      }

    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-20 p-8 glass-panel animate-fade-in relative z-10 border border-white/10 shadow-2xl">
      <div className="flex justify-center mb-6">
        <div className="p-4 bg-accent/20 rounded-full border border-accent/30">
          <Mail size={32} className="text-accent" />
        </div>
      </div>
      <h1 className="text-4xl font-extrabold mb-8 text-center text-gradient">Recuperar Senha</h1>
      
      {message && !resetLink && <div className="bg-accent/20 border border-accent/30 text-accent px-4 py-3 rounded-lg mb-6 text-sm">{message}</div>}
      {resetLink && (
        <div className="bg-green-500/20 border border-green-500/30 text-green-300 px-5 py-4 rounded-lg mb-6 break-words animate-slide-up shadow-inner">
          <p className="font-medium mb-3">{message}</p>
          <p className="text-sm text-green-400/80 mb-2">Para redefinir sua senha no ambiente de desenvolvimento, clique no link abaixo:</p>
          <Link to={resetLink} className="inline-block bg-green-500/30 hover:bg-green-500/50 text-green-200 px-4 py-2 rounded-lg font-bold transition-colors break-all border border-green-500/40">
            {resetLink}
          </Link>
        </div>
      )}
      {error && <div className="bg-red-500/20 border border-red-500/30 text-red-300 px-4 py-3 rounded-lg mb-6 text-sm">{error}</div>}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-fg-muted mb-2">Email</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="seu@email.com"
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent text-fg placeholder-gray-500 transition-all"
            required
            disabled={loading}
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full btn-primary py-3 text-lg font-bold disabled:opacity-50 disabled:cursor-not-allowed mt-4 group"
        >
          {loading ? 'Enviando...' : (
            <span className="flex items-center justify-center">
              Enviar Link <ArrowRight size={20} className="ml-2 group-hover:translate-x-1 transition-transform" />
            </span>
          )}
        </button>
      </form>
      <div className="mt-8 pt-6 border-t border-white/10 text-center">
        <p className="text-fg-muted">
          Lembrou sua senha?{' '}
          <Link to="/login" className="text-accent hover:text-accent font-medium transition-colors">
            Fazer Login
          </Link>
        </p>
      </div>
    </div>
  );
};

export default RequestPasswordResetPage;
