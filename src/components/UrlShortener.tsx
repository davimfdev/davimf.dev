import { useState } from 'react';

/*
  Database schema assumption:
  You need to create a table in your Neon database.
  You can use the following SQL command to create it:

  CREATE TABLE urls (
    id VARCHAR(10) PRIMARY KEY,
    original_url TEXT NOT NULL
  );
*/

const UrlShortener = () => {
  const [originalUrl, setOriginalUrl] = useState('');
  const [shortUrl, setShortUrl] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setShortUrl('');
    setLoading(true);

    try {
      const response = await fetch('/.netlify/functions/shorten', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: originalUrl }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to shorten URL.');
      }

      setShortUrl(data.shortUrl);
    } catch (err: any) {
      setError(err.message || 'An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2>URL Shortener</h2>
      <form onSubmit={handleSubmit}>
        <input
          type="url"
          placeholder="Enter URL to shorten"
          value={originalUrl}
          onChange={(e) => setOriginalUrl(e.target.value)}
          required
        />
        <button type="submit" disabled={loading}>
          {loading ? 'Shortening...' : 'Shorten'}
        </button>
      </form>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {shortUrl && (
        <div>
          <p>Shortened URL:</p>
          <a href={shortUrl} target="_blank" rel="noopener noreferrer">
            {shortUrl}
          </a>
        </div>
      )}
    </div>
  );
};

export default UrlShortener;
