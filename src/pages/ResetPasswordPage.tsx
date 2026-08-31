import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { KeyRound } from 'lucide-react';

const ResetPasswordPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const [token, setToken] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const tokenFromUrl = searchParams.get('token');
    if (tokenFromUrl) {
      setToken(tokenFromUrl);
    } else {
      setError('Nenhum token encontrado. Solicite um novo link.');
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');

    if (password !== confirmPassword) {
      setError('As senhas não coincidem.');
      return;
    }
    if (!token) {
      setError('Token ausente. Solicite um novo link.');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Falha ao redefinir a senha.');
      }

      setMessage(`${data.message} Você será redirecionado para o login.`);
      setTimeout(() => navigate('/login'), 3000);

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
          <KeyRound size={32} className="text-accent" />
        </div>
      </div>
      <h1 className="text-4xl font-extrabold mb-8 text-center text-gradient">Redefinir Senha</h1>
      
      {message && <div className="bg-green-500/20 border border-green-500/30 text-green-300 px-4 py-3 rounded-lg mb-6 text-sm">{message}</div>}
      {error && (
        <div className="bg-red-500/20 border border-red-500/30 text-red-300 px-4 py-3 rounded-lg mb-6 text-sm">
            <p>{error}</p>
            {error.includes('token') && (
                <p className="mt-3">
                    <Link to="/request-password-reset" className="text-accent hover:text-accent transition-colors font-medium">Solicite um novo link aqui.</Link>
                </p>
            )}
        </div>
      )}

      {token && !message && (
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-fg-muted mb-2">Nova Senha</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent text-fg placeholder-fg-muted transition-all"
              required
              placeholder="••••••••"
            />
          </div>
          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-fg-muted mb-2">Confirmar Nova Senha</label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent text-fg placeholder-fg-muted transition-all"
              required
              placeholder="••••••••"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full btn-primary py-3 text-lg font-bold disabled:opacity-50 disabled:cursor-not-allowed mt-4 bg-gradient-to-r from-accent to-pink-600 hover:from-accent hover:to-pink-500 shadow-accent/30 hover:shadow-accent/50 group"
          >
            {loading ? 'Redefinindo...' : (
              <span className="flex items-center justify-center">
                Redefinir Senha <KeyRound size={20} className="ml-2 group-hover:rotate-12 transition-transform" />
              </span>
            )}
          </button>
        </form>
      )}
    </div>
  );
};

export default ResetPasswordPage;
