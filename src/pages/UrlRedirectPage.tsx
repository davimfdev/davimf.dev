import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

const UrlRedirectPage = () => {
  const { shortCode } = useParams(); // from the URL, e.g., /r/:shortCode
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUrl = async () => {
      if (!shortCode) {
        setError('No short code provided.');
        setLoading(false);
        return;
      }

      try {
        // Call our new API endpoint
        const response = await fetch(`/api/get-url?code=${shortCode}`);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'URL not found.');
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
    return <p>Redirecting...</p>;
  }

  if (error) {
    return <p style={{ color: 'red' }}>Error: {error}</p>;
  }

  return null;
};

export default UrlRedirectPage;
