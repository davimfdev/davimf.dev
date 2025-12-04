import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom'; // Assuming you use react-router-dom
import { neon } from '@netlify/neon';

const sql = neon();

const UrlRedirectPage = () => {
  const { shortCode } = useParams(); // from the URL, e.g., /r/:shortCode
  const navigate = useNavigate();
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
        const result = await sql`SELECT original_url FROM urls WHERE id = ${shortCode}`;

        if (result.length > 0) {
          const originalUrl = result[0].original_url;
          // It's safer to replace the current entry in the history stack
          window.location.replace(originalUrl);
        } else {
          setError('URL not found.');
        }
      } catch (err) {
        console.error(err);
        setError('An error occurred while fetching the URL.');
      } finally {
        setLoading(false);
      }
    };

    fetchUrl();
  }, [shortCode, navigate]);

  if (loading) {
    return <p>Redirecting...</p>;
  }

  if (error) {
    return <p style={{ color: 'red' }}>{error}</p>;
  }

  // This will likely not be seen by the user unless the redirect fails instantly.
  return null;
};

export default UrlRedirectPage;
