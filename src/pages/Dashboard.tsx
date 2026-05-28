import { useEffect, useState, useRef } from 'react';
import { useNavigate} from "react-router-dom";
import { useLanguage } from '../context/LanguageContext';

export default function Dashboard() {
    const [guilds, setGuilds] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [serverError, setServerError] = useState(false);
    const hasFetched = useRef(false);

    const navigate = useNavigate();
    const { translations } = useLanguage();
    const t = translations as any;

    // Link de convite do seu bot (substitua o CLIENT_ID pelo do seu bot)
    const BOT_INVITE_LINK = "https://discord.com/api/oauth2/authorize?client_id=1484035057478799411&permissions=8&scope=bot%20applications.commands";

    useEffect(() => {
        if (hasFetched.current) return;
        hasFetched.current = true;

        const params = new URLSearchParams(window.location.search);
        const tokenFromUrl = params.get('token');

        // 1. Se chegou token na URL, salva ele
        if (tokenFromUrl) {
            localStorage.setItem('discord_token', tokenFromUrl);

            // 2. O PULO DO GATO: Verifica se o Layout salvou para onde devemos voltar
            const returnPath = localStorage.getItem('return_path');

            if (returnPath && returnPath !== '/dashboard' && returnPath !== '/login') {
                // Limpa o rastro para não ficar voltando sempre
                localStorage.removeItem('return_path');
                // Remove o token da URL visualmente e pula para a página anterior
                window.history.replaceState({}, document.title, returnPath);
                navigate(returnPath);
                return; // Para a execução aqui, não precisa carregar as guilds
            } else {
                // Se não tinha volta, limpa a URL e continua no dashboard
                window.history.replaceState({}, document.title, "/dashboard");
            }
        }

        const savedToken = localStorage.getItem('discord_token');
        if (!savedToken) {
            window.location.href = '/';
            return;
        }

        // 3. Busca os servidores (restante do seu código original)
        fetch('/.netlify/functions/getGuilds', {
            headers: { Authorization: `Bearer ${savedToken}` },
        })
            .then(async (res) => ({ status: res.status, data: await res.json() }))
            .then(({ status, data }) => {
                if (Array.isArray(data)) {
                    const sortedGuilds = data.sort((a, b) => (a.hasBot === b.hasBot ? 0 : a.hasBot ? -1 : 1));
                    setGuilds(sortedGuilds);
                } else {
                    setGuilds([]);
                    if (status === 401) {
                        localStorage.removeItem('discord_token');
                        alert("Sessão expirada. Faça login novamente.");
                        window.location.href = '/';
                    } else if (status === 500) {
                        setServerError(true);
                    }
                }
                setLoading(false);
            })
            .catch(() => {
                setGuilds([]);
                setLoading(false);
            });
    }, [navigate]); // Adicione navigate aqui

    if (loading) {
        return (
            <div style={styles.container}>
                <h2 style={styles.loadingText}>Carregando seus servidores...</h2>
            </div>
        );
    }

    if (serverError) {
        return (
            <div style={styles.container}>
                <div style={{
                    maxWidth: 480,
                    margin: '80px auto',
                    padding: '32px',
                    borderRadius: 16,
                    background: 'rgba(239,68,68,0.08)',
                    border: '1px solid rgba(239,68,68,0.3)',
                    textAlign: 'center',
                }}>
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="#ef4444"
                        style={{ width: 48, height: 48, marginBottom: 16 }}>
                        <path strokeLinecap="round" strokeLinejoin="round"
                            d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                    </svg>
                    <h2 style={{ color: '#ef4444', fontSize: 20, fontWeight: 700, marginBottom: 12 }}>
                        {t.dbOfflineTitle}
                    </h2>
                    <p style={{ color: '#9ca3af', fontSize: 14, lineHeight: 1.6 }}>
                        {t.dbOfflineMessage}
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div style={styles.container}>
            <h1 style={styles.title}>Selecione um Servidor</h1>

            {/* Cenário 1: Não é admin de absolutamente nada */}
            {guilds.length === 0 && !loading && (
                <div style={styles.emptyState}>

                    {/* O SVG ENTRA AQUI, BEM EM CIMA DO TÍTULO */}
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={1.2}
                        stroke="currentColor"
                        style={{
                            width: '64px',
                            height: '64px',
                            marginBottom: '16px',
                            color: '#949ba4',
                            opacity: 0.8
                        }}
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                        />
                    </svg>

                    <h3 style={styles.emptyTitle}>Ops! Nenhum servidor encontrado.</h3>
                    <p style={styles.emptyText}>
                        Você precisa ter a permissão de <strong>"Administrador"</strong> ou <strong>"Gerenciar Servidor"</strong> no Discord para configurar o bot. Verifique suas permissões e tente novamente.
                    </p>
                </div>
            )}

            <div style={styles.grid}>
                {guilds.map((guild) => (
                    <div key={guild.id} style={styles.card}>
                        <div style={styles.cardHeader}>
                            {guild.icon ? (
                                <img src={`https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png`} alt={guild.name} style={styles.icon} />
                            ) : (
                                <div style={styles.iconPlaceholder}>{guild.name.charAt(0)}</div>
                            )}
                            <h3 style={styles.guildName}>{guild.name}</h3>
                        </div>

                        {/* Cenário 2 e 3: O bot está no servidor ou não? */}
                        {guild.hasBot ? (
                            <button style={styles.btnConfig} onClick={() => window.location.href = `/dashboard/${guild.id}`}>
                                Configurar
                            </button>
                        ) : (
                            <button style={styles.btnAdd} onClick={() => window.open(BOT_INVITE_LINK, '_blank')}>
                                Adicionar Bot
                            </button>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}

// Estilos padronizados e elegantes (Dark Theme)
const styles = {
    container: { padding: '40px 20px', maxWidth: '1000px', margin: '0 auto', fontFamily: '"Inter", sans-serif', color: '#dbdee1' },
    loadingText: { textAlign: 'center' as const, color: '#949ba4', marginTop: '100px' },
    title: { textAlign: 'center' as const, fontSize: '32px', fontWeight: '800', marginBottom: '40px', color: '#ffffff' },
    grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' },
    card: { backgroundColor: '#2b2d31', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column' as const, justifyContent: 'space-between', transition: 'transform 0.2s', boxShadow: '0 4px 14px rgba(0,0,0,0.2)' },
    cardHeader: { display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '20px' },
    icon: { width: '50px', height: '50px', borderRadius: '50%', objectFit: 'cover' as const },
    iconPlaceholder: { width: '50px', height: '50px', borderRadius: '50%', backgroundColor: '#1e1f22', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', fontWeight: 'bold' },
    guildName: { margin: 0, fontSize: '18px', fontWeight: '600', color: '#f2f3f5', whiteSpace: 'nowrap' as const, overflow: 'hidden', textOverflow: 'ellipsis' },
    btnConfig: { backgroundColor: '#5865F2', color: 'white', border: 'none', padding: '12px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '15px', transition: 'background-color 0.2s', width: '100%' },
    btnAdd: { backgroundColor: '#4e5058', color: 'white', border: 'none', padding: '12px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '15px', transition: 'background-color 0.2s', width: '100%' },
    emptyState: {
        textAlign: 'center' as const,
        // Fundo semi-transparente (branco quase invisível ou cinza escuro)
        background: 'rgba(255, 255, 255, 0.03)',
        // O desfoque do vidro que faz a mágica
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)', // Suporte para Safari
        // Borda super fina para dar o reflexo do vidro
        border: '1px solid rgba(255, 255, 255, 0.08)',
        // Sombra suave para descolar do fundo
        boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.2)',
        padding: '50px 40px',
        borderRadius: '16px',
        maxWidth: '500px',
        margin: '60px auto',
        display: 'flex',
        flexDirection: 'column' as const,
        alignItems: 'center',
        gap: '12px'
    },
    emptyIcon: {
        fontSize: '48px',
        marginBottom: '10px',
        opacity: 0.8
    },
    emptyTitle: {
        margin: 0,
        fontSize: '22px',
        fontWeight: '800',
        color: '#ffffff'
    },
    emptyText: {
        margin: 0,
        fontSize: '15px',
        color: '#b5bac1',
        lineHeight: '1.6'
    }
};