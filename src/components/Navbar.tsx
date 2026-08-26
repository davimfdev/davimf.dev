import { useEffect, useState } from 'react';

export default function Navbar() {
  const [user, setUser] = useState<any>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [discordLoginUrl, setDiscordLoginUrl] = useState('');

  useEffect(() => {
    // A URL de login é construída no lado do cliente para garantir que window.location.hostname esteja disponível
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    console.log(window.location.hostname)
    // Fora da Netlify não existe mais a porta 8888 do `netlify dev`: em local o
    // callback é servido pelo próprio dev server do Vite via proxy de /api.
    const redirectUri = isLocalhost ? `${window.location.origin}/api/callback` : "https://davimf.dev/api/callback";
    const url = `https://discord.com/api/oauth2/authorize?client_id=1484035057478799411&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=identify%20guilds`;
    setDiscordLoginUrl(url);

    const token = localStorage.getItem('discord_token');

    if (token) {
      // Bate na API do Discord para pegar o perfil do usuário (!atm, foto, nome)
      fetch('https://discord.com/api/users/@me', {
        headers: {
          Authorization: `Bearer ${token}`
        }
      })
      .then(res => {
        if (!res.ok) throw new Error("Token expirado");
        return res.json();
      })
      .then(data => setUser(data))
      .catch(() => {
        // Se der erro (ex: token velho), limpa o storage
        localStorage.removeItem('discord_token');
        setUser(null);
      });
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('discord_token');
    setUser(null);
    window.location.href = '/'; // Redireciona para a home
  };

  return (
    <nav style={styles.nav}>
      <div style={styles.logo}>davimf.dev</div>

      <div style={styles.authSection}>
        {user ? (
          <div style={{ position: 'relative' }}>
            {/* Foto de Perfil do Discord clicável */}
            <img
              src={`https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`}
              alt="Perfil"
              style={styles.avatar}
              onClick={() => setShowDropdown(!showDropdown)}
            />

            {/* Dropdown de Logoff */}
            {showDropdown && (
              <div style={styles.dropdown}>
                <p style={styles.username}>{user.global_name || user.username}</p>
                <button style={styles.logoutBtn} onClick={handleLogout}>
                  Sair (Logoff)
                </button>
              </div>
            )}
          </div>
        ) : (
          /* Botão de Login antigo */
          <a href={discordLoginUrl} style={styles.loginBtn}>
            Login com Discord
          </a>
        )}
      </div>
    </nav>
  );
}

// Estilos para deixar tudo alinhado e bonito
const styles = {
  nav: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px 40px', backgroundColor: '#1e1f22', color: 'white' },
  logo: { fontSize: '20px', fontWeight: 'bold' },
  authSection: { display: 'flex', alignItems: 'center' },
  avatar: { width: '45px', height: '45px', borderRadius: '50%', cursor: 'pointer', border: '2px solid transparent', transition: 'border 0.2s' },
  loginBtn: { backgroundColor: '#5865F2', color: 'white', padding: '10px 20px', borderRadius: '5px', textDecoration: 'none', fontWeight: 'bold' },
  dropdown: { position: 'absolute' as const, top: '55px', right: '0', backgroundColor: '#2b2d31', borderRadius: '8px', padding: '15px', boxShadow: '0 8px 16px rgba(0,0,0,0.3)', minWidth: '150px', zIndex: 10 },
  username: { margin: '0 0 10px 0', fontSize: '14px', fontWeight: 'bold', color: '#dbdee1', borderBottom: '1px solid #404249', paddingBottom: '10px' },
  logoutBtn: { backgroundColor: '#da373c', color: 'white', border: 'none', width: '100%', padding: '8px', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }
};