import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { UserPlus } from 'lucide-react';

const RegisterPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = location.state?.from?.pathname || '/';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('As senhas não coincidem.');
      return;
    }

    setLoading(true);

    try {
      // 1. Tenta registrar o usuário
      const registerResponse = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!registerResponse.ok) {
        const errorData = await registerResponse.json();
        throw new Error(errorData.error || 'Falha ao registrar.');
      }

      // 2. Se o registro for bem-sucedido, tenta fazer o login automaticamente
      const loginResponse = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!loginResponse.ok) {
        // Se o login automático falhar, redireciona para a página de login manual
        navigate('/login');
        return;
      }

      const { token } = await loginResponse.json();
      login(token);
      
      // 3. Redireciona para a página de origem
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
        <div className="p-4 bg-ok/20 rounded-full border border-ok/30">
          <UserPlus size={32} className="text-ok" />
        </div>
      </div>
      <h1 className="text-4xl font-extrabold mb-8 text-center text-gradient">Registrar</h1>
      {error && <p className="bg-danger/20 border border-danger/30 text-danger px-4 py-3 rounded-lg mb-6 text-sm">{error}</p>}
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-fg-muted mb-2 font-medium" htmlFor="email">
            Email
          </label>
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
          <label className="block text-fg-muted mb-2 font-medium" htmlFor="password">
            Senha
          </label>
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
        <div>
          <label className="block text-fg-muted mb-2 font-medium" htmlFor="confirm-password">
            Confirmar Senha
          </label>
          <input
            type="password"
            id="confirm-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full px-4 py-3 bg-surface-1 border border-line rounded-lg focus:outline-none focus:ring-2 focus:ring-accent text-fg placeholder-fg-muted transition-all"
            required
            disabled={loading}
            placeholder="••••••••"
          />
        </div>
        <button
          type="submit"
          className="w-full btn-primary py-3 text-lg font-bold disabled:opacity-50 disabled:cursor-not-allowed group mt-4 bg-gradient-to-r from-ok to-ok hover:from-ok hover:to-ok shadow-ok/30 hover:shadow-ok/50"
          disabled={loading}
        >
          {loading ? 'Registrando...' : (
            <span className="flex items-center justify-center">
              Criar Conta <UserPlus size={20} className="ml-2 group-hover:scale-110 transition-transform" />
            </span>
          )}
        </button>
      </form>
      <div className="mt-8 pt-6 border-t border-line text-center">
        <p className="text-fg-muted">
          Já tem uma conta?{' '}
          <Link to="/login" className="text-accent hover:text-accent font-medium transition-colors">
            Fazer Login
          </Link>
        </p>
      </div>
    </div>
  );
};

export default RegisterPage;
