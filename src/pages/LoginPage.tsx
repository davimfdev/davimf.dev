import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LogIn } from 'lucide-react';

const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = location.state?.from?.pathname || '/';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Falha no login.');
      }

      const { accessToken } = await response.json();
      login(accessToken);
      
      navigate(from, { replace: true });

    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-20 p-8 glass-panel animate-fade-in relative z-10 border border-line shadow-2xl">
      <div className="flex justify-center mb-6">
        <div className="p-4 bg-accent/20 rounded-full border border-accent/30">
          <LogIn size={32} className="text-accent" />
        </div>
      </div>
      <h1 className="text-4xl font-extrabold mb-8 text-center text-gradient">Login</h1>
      {error && <p className="bg-danger/10 border border-danger/30 text-danger px-4 py-3 rounded-lg mb-6 text-sm">{error}</p>}
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-fg-muted mb-2 font-medium" htmlFor="email">Email</label>
          <input
            type="email"
            id="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-3 bg-surface-1 border border-line rounded-lg focus:outline-none focus:ring-2 focus:ring-accent text-fg placeholder-fg-muted transition-all"
            required
            disabled={loading}
            placeholder="seu@email.com"
          />
        </div>
        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="block text-fg-muted font-medium" htmlFor="password">Senha</label>
            <Link to="/request-password-reset" className="text-sm text-accent hover:text-accent transition-colors">
              Esqueceu a senha?
            </Link>
          </div>
          <input
            type="password"
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-3 bg-surface-1 border border-line rounded-lg focus:outline-none focus:ring-2 focus:ring-accent text-fg placeholder-fg-muted transition-all"
            required
            disabled={loading}
            placeholder="••••••••"
          />
        </div>
        <button
          type="submit"
          className="w-full btn-primary py-3 text-lg font-bold disabled:opacity-50 disabled:cursor-not-allowed group mt-2"
          disabled={loading}
        >
          {loading ? 'Entrando...' : (
            <span className="flex items-center justify-center">
              Entrar <LogIn size={20} className="ml-2 group-hover:translate-x-1 transition-transform" />
            </span>
          )}
        </button>
      </form>
      <div className="mt-8 pt-6 border-t border-line text-center">
        <p className="text-fg-muted">
          Não tem uma conta?{' '}
          <Link to="/register" className="text-accent hover:text-accent font-medium transition-colors">
            Registre-se
          </Link>
        </p>
      </div>
    </div>
  );
};

export default LoginPage;
