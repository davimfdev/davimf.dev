import React, { useState } from 'react';
import { Link } from 'react-router-dom';

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
    <div className="max-w-md mx-auto mt-10 p-6 bg-gray-800 rounded-lg shadow-xl">
      <h1 className="text-3xl font-bold mb-6 text-center text-white">Forgot Password</h1>
      
      {message && !resetLink && <div className="bg-blue-900 border border-blue-700 text-blue-200 px-4 py-3 rounded-md mb-4">{message}</div>}
      {resetLink && (
        <div className="bg-green-900 border border-green-700 text-green-200 px-4 py-3 rounded-md mb-4 break-words">
          <p>{message}</p>
          <p className="mt-2">Click the link below to reset your password:</p>
          <Link to={resetLink} className="font-bold text-white hover:underline break-all">{resetLink}</Link>
        </div>
      )}
      {error && <div className="bg-red-900 border border-red-700 text-red-200 px-4 py-3 rounded-md mb-4">{error}</div>}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-1">Email</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email address"
            className="w-full p-2 bg-gray-700 rounded-md border border-gray-600"
            required
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md disabled:bg-blue-400"
        >
          {loading ? 'Sending...' : 'Send Password Reset Link'}
        </button>
      </form>
      <p className="text-center text-gray-400 mt-6">
        Remembered your password?{' '}
        <Link to="/login" className="text-blue-400 hover:underline">
          Login
        </Link>
      </p>
    </div>
  );
};

export default RequestPasswordResetPage;
