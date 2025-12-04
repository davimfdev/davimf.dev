import { useState } from 'react';
import { useLanguage } from '../context/LanguageContext'; // Import the useLanguage hook

const UrlShortener = () => {
  const { translations } = useLanguage(); // Get translations from the context
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

      // **FIX:** Check if the request was successful before parsing JSON.
      if (!response.ok) {
        let message = translations.urlShortenerError;
        try {
          // Try to get a specific error message from the server response
          const errorData = await response.json();
          message = errorData.error || message;
        } catch {
          // This catches cases where the server returns HTML or an empty response instead of JSON
          console.error("Received a non-JSON error response from the server.");
        }
        throw new Error(message);
      }

      // If we get here, the response is OK and we can safely parse it.
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
      setTimeout(() => setCopied(false), 2000); // Reset after 2 seconds
    });
  };

  return (
    <div className="container mx-auto px-4 py-8 text-center" style={{ maxWidth: '600px' }}>
      <h1 className="text-4xl font-bold mb-4">{translations.urlShortenerTitle}</h1>
      <div className="bg-white shadow-lg rounded-lg p-6">
        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-4">
          <input
            type="url"
            placeholder={translations.urlShortenerPlaceholder}
            value={originalUrl}
            onChange={(e) => setOriginalUrl(e.target.value)}
            required
            // **FIX:** Added 'text-gray-900' to ensure text is dark and readable
            className="flex-grow p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
          />
          <button
            type="submit"
            disabled={loading}
            className="bg-blue-600 text-white font-bold py-3 px-6 rounded-md hover:bg-blue-700 disabled:bg-blue-300 transition-colors"
          >
            {loading ? translations.urlShortenerLoading : translations.urlShortenerButton}
          </button>
        </form>
        {error && <p className="text-red-500 mt-4">{error}</p>}
        {shortUrl && (
          <div className="mt-6 p-4 bg-gray-100 rounded-md text-left">
            <p className="font-semibold">{translations.urlShortenerResult}</p>
            <div className="flex flex-col sm:flex-row items-center gap-4 mt-2">
              <a
                href={shortUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline break-all flex-grow"
              >
                {shortUrl}
              </a>
              <button
                onClick={handleCopyToClipboard}
                className="bg-gray-200 text-gray-800 font-bold py-2 px-4 rounded-md hover:bg-gray-300 transition-colors"
              >
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default UrlShortener;
