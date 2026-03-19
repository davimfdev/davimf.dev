
export default function Test() {
    // 1. Cole seu Client ID diretamente aqui (apenas números, como "1234567890123456")
    // Não use process.env para esse teste rápido, assim garantimos que a variável não está vazia.
    const clientId = "1484035057478799411";

    const redirectUri = encodeURIComponent("http://localhost:8888/.netlify/functions/callback");
    const discordUrl = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=identify%20guilds`;

    return (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '100px' }}>
            {/* Trocamos o <button> por um <a>. Isso é garantido que vai abrir a página. */}
            <a
                href={discordUrl}
                style={{
                    padding: '15px 30px',
                    backgroundColor: '#5865F2',
                    color: 'white',
                    textDecoration: 'none', // Tira o sublinhado padrão de links
                    borderRadius: '8px',
                    fontSize: '18px',
                    fontWeight: 'bold',
                    display: 'inline-block',
                    boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                }}
            >
                Login com Discord
            </a>
        </div>
    );
}