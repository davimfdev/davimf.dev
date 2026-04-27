import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

export default function BotConfig() {
    const { guildId } = useParams();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('personalizacao');
    const [guildData, setGuildData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [prefix, setPrefix] = useState('dm!');
    const [cor, setCor] = useState('#2b2d31');
    const [cargoEntrada, setCargoEntrada] = useState('');
    const [commands, setCommands] = useState<any[]>([]);
    const [securityStatus, setSecurityStatus] = useState(false);

    useEffect(() => {
        const savedToken = localStorage.getItem('discord_token');
        if (!savedToken) {
            navigate('/login');
            return;
        }

        const fetchAllData = async () => {
            try {
                const discordRes = await fetch(`https://discord.com/api/users/@me/guilds`, {
                    headers: { Authorization: `Bearer ${savedToken}` }
                });
                
                if (discordRes.ok) {
                    const guilds = await discordRes.json();
                    const currentGuild = guilds.find((g: any) => g.id === guildId);
                    if (currentGuild) {
                        setGuildData(currentGuild);
                    }
                }

                const configRes = await fetch(`/.netlify/functions/getGuildConfig?guildId=${guildId}`, {
                    headers: { Authorization: `Bearer ${savedToken}` }
                });

                if (configRes.ok) {
                    const { data } = await configRes.json();
                    if (data) {
                        if (data.prefix) setPrefix(data.prefix);
                        if (data.cor) setCor(data.cor);
                        if (data.cargo_entrada) setCargoEntrada(data.cargo_entrada);
                    }
                }

                const commandsRes = await fetch(`/.netlify/functions/getCommands?guildId=${guildId}`, {
                    headers: { Authorization: `Bearer ${savedToken}` }
                });

                if (commandsRes.ok) {
                    const { data } = await commandsRes.json();
                    if (data) {
                        setCommands(data);
                    }
                }

                const securityRes = await fetch(`/.netlify/functions/getSecurityConfig?guildId=${guildId}`, {
                    headers: { Authorization: `Bearer ${savedToken}` }
                });

                if (securityRes.ok) {
                    const { data } = await securityRes.json();
                    if (data && data.status !== undefined) {
                        setSecurityStatus(data.status);
                    }
                }
            } catch (error) {
                console.error("Error fetching guild info:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchAllData();
    }, [guildId, navigate]);

    const handleSavePersonalizacao = async () => {
        setSaving(true);
        const token = localStorage.getItem('discord_token');
        
        try {
            const response = await fetch('/.netlify/functions/updateGuild', {
                method: 'POST',
                body: JSON.stringify({
                    guildId,
                    prefix,
                    cor,
                    cargoEntrada,
                    userToken: token
                })
            });

            if (response.ok) {
                alert('Configurações salvas com sucesso!');
            } else {
                const data = await response.json();
                alert(`Erro: ${data.error}`);
            }
        } catch (error) {
            console.error("Save error:", error);
            alert('Erro ao salvar as configurações.');
        } finally {
            setSaving(false);
        }
    };

    const handleToggleCommand = async (commandId: number, currentStatus: boolean) => {
        const token = localStorage.getItem('discord_token');
        const newStatus = !currentStatus;

        setCommands(prev => prev.map(cmd =>
            cmd.id === commandId ? { ...cmd, is_enabled: newStatus } : cmd
        ));

        try {
            const response = await fetch('/.netlify/functions/updateCommand', {
                method: 'POST',
                body: JSON.stringify({
                    id: commandId,
                    guildId,
                    is_enabled: newStatus,
                    userToken: token
                })
            });

            if (!response.ok) {
                setCommands(prev => prev.map(cmd =>
                    cmd.id === commandId ? { ...cmd, is_enabled: currentStatus } : cmd
                ));
                alert('Erro ao atualizar comando.');
            }
        } catch (error) {
            console.error("Update command error:", error);
            setCommands(prev => prev.map(cmd =>
                cmd.id === commandId ? { ...cmd, is_enabled: currentStatus } : cmd
            ));
            alert('Erro ao atualizar comando.');
        }
    };

    const handleToggleSecurity = async () => {
        const token = localStorage.getItem('discord_token');
        const newStatus = !securityStatus;

        setSecurityStatus(newStatus);

        try {
            const response = await fetch('/.netlify/functions/updateSecurityConfig', {
                method: 'POST',
                body: JSON.stringify({
                    guildId,
                    status: newStatus,
                    userToken: token
                })
            });

            if (!response.ok) {
                setSecurityStatus(!newStatus);
                alert('Erro ao atualizar segurança.');
            }
        } catch (error) {
            console.error("Update security error:", error);
            setSecurityStatus(!newStatus);
            alert('Erro ao atualizar segurança.');
        }
    };

    if (loading) {
        return (
            <div style={styles.container}>
                <h2 style={styles.loadingText}>Carregando configurações...</h2>
            </div>
        );
    }

    return (
        <div style={styles.container}>
            <div style={styles.header}>
                <button style={styles.backButton} onClick={() => navigate('/dashboard')}>
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" width="20" height="20">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                    </svg>
                    Voltar
                </button>
                <div style={{display: 'flex', alignItems: 'center', gap: '15px'}}>
                    {guildData?.icon ? (
                        <img src={`https://cdn.discordapp.com/icons/${guildData.id}/${guildData.icon}.png`} alt={guildData.name} style={{width: 40, height: 40, borderRadius: '50%'}} />
                    ) : (
                        <div style={{width: 40, height: 40, borderRadius: '50%', backgroundColor: '#1e1f22', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold'}}>
                            {guildData?.name?.charAt(0) || '?'}
                        </div>
                    )}
                    <h1 style={styles.title}>{guildData?.name || `Servidor ${guildId}`}</h1>
                </div>
            </div>

            <div style={styles.layout}>
                <aside style={styles.sidebar}>
                    <button 
                        style={{...styles.tabButton, ...(activeTab === 'personalizacao' ? styles.activeTab : {})}} 
                        onClick={() => setActiveTab('personalizacao')}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" width="20" height="20">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.994 15.994 0 011.622-3.395m3.42 3.42a15.995 15.995 0 004.764-4.648l3.876-5.814a1.151 1.151 0 00-1.597-1.597L14.146 6.32a15.996 15.996 0 00-4.649 4.763m3.42 3.42a6.776 6.776 0 00-3.42-3.42" />
                        </svg>
                        Personalização
                    </button>
                    <button 
                        style={{...styles.tabButton, ...(activeTab === 'comandos' ? styles.activeTab : {})}} 
                        onClick={() => setActiveTab('comandos')}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" width="20" height="20">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 7.5l3 2.25-3 2.25m4.5 0h3m-9 8.25h13.5A2.25 2.25 0 0021 18V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v12a2.25 2.25 0 002.25 2.25z" />
                        </svg>
                        Comandos
                    </button>
                    <button 
                        style={{...styles.tabButton, ...(activeTab === 'seguranca' ? styles.activeTab : {})}} 
                        onClick={() => setActiveTab('seguranca')}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" width="20" height="20">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                        </svg>
                        Segurança
                    </button>
                </aside>

                <main style={styles.mainContent}>
                    {activeTab === 'personalizacao' && (
                        <div className="fade-in">
                            <h2 style={styles.sectionTitle}>Personalização</h2>
                            <p style={styles.sectionDescription}>Configure a aparência e as preferências básicas do bot neste servidor.</p>
                            
                            <div style={styles.card}>
                                <div style={styles.inputGroup}>
                                    <label style={styles.label}>Prefixo do Bot</label>
                                    <input 
                                        type="text" 
                                        style={styles.input} 
                                        placeholder="Ex: dm!" 
                                        value={prefix}
                                        onChange={(e) => setPrefix(e.target.value)}
                                    />
                                </div>
                                <div style={styles.inputGroup}>
                                    <label style={styles.label}>Cor Padrão (Hexadecimal)</label>
                                    <div style={{display: 'flex', gap: '10px', alignItems: 'center'}}>
                                        <input 
                                            type="color" 
                                            style={styles.colorPicker} 
                                            value={cor}
                                            onChange={(e) => setCor(e.target.value)}
                                        />
                                        <input 
                                            type="text" 
                                            style={{...styles.input, flex: 1}} 
                                            placeholder="Ex: #2b2d31" 
                                            value={cor}
                                            onChange={(e) => setCor(e.target.value)}
                                        />
                                    </div>
                                </div>
                                <div style={styles.inputGroup}>
                                    <label style={styles.label}>Cargo de Entrada (ID)</label>
                                    <input 
                                        type="text" 
                                        style={styles.input} 
                                        placeholder="ID do cargo que novos membros receberão" 
                                        value={cargoEntrada}
                                        onChange={(e) => setCargoEntrada(e.target.value)}
                                    />
                                </div>
                                <button 
                                    style={{...styles.saveButton, opacity: saving ? 0.7 : 1}} 
                                    onClick={handleSavePersonalizacao}
                                    disabled={saving}
                                >
                                    {saving ? 'Salvando...' : 'Salvar Alterações'}
                                </button>
                            </div>
                        </div>
                    )}

                    {activeTab === 'comandos' && (
                        <div className="fade-in">
                            <h2 style={styles.sectionTitle}>Comandos</h2>
                            <p style={styles.sectionDescription}>Ative ou desative comandos do bot para este servidor.</p>
                            
                            <div style={{...styles.card, padding: 0, overflow: 'hidden'}}>
                                {commands.length === 0 ? (
                                    <div style={{padding: '24px', textAlign: 'center', color: '#949ba4'}}>
                                        Nenhum comando configurado para este servidor ainda.
                                    </div>
                                ) : (
                                    <ul style={{listStyle: 'none', margin: 0, padding: 0}}>
                                        {commands.map((cmd, index) => (
                                            <li key={cmd.id} style={{
                                                display: 'flex', 
                                                justifyContent: 'space-between', 
                                                alignItems: 'center',
                                                padding: '16px 24px',
                                                borderBottom: index < commands.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none'
                                            }}>
                                                <span style={{fontSize: '16px', fontWeight: '500', color: '#dbdee1'}}>
                                                    {cmd.nome}
                                                </span>
                                                <label className="switch" style={styles.switch}>
                                                    <input 
                                                        type="checkbox" 
                                                        checked={cmd.is_enabled}
                                                        onChange={() => handleToggleCommand(cmd.id, cmd.is_enabled)}
                                                    />
                                                    <span className="slider round" style={styles.slider}></span>
                                                </label>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        </div>
                    )}

                    {activeTab === 'seguranca' && (
                        <div className="fade-in">
                            <h2 style={styles.sectionTitle}>Segurança</h2>
                            <p style={styles.sectionDescription}>Módulos de proteção, logs e verificação para manter seu servidor seguro.</p>
                            
                            <div style={styles.card}>
                                <h3 style={{...styles.sectionTitle, fontSize: '18px', marginTop: 0}}>Verificação de Entrada</h3>
                                <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px'}}>
                                    <span style={{color: '#dbdee1'}}>Status do Módulo</span>
                                    <label className="switch" style={styles.switch}>
                                        <input 
                                            type="checkbox" 
                                            checked={securityStatus}
                                            onChange={handleToggleSecurity}
                                        />
                                        <span className="slider round" style={styles.slider}></span>
                                    </label>
                                </div>
                                <p style={{color: '#949ba4', fontStyle: 'italic', fontSize: '14px'}}>A configuração detalhada da verificação estará disponível em breve.</p>
                            </div>
                        </div>
                    )}
                </main>
            </div>

            <style>{`
                .fade-in {
                    animation: fadeIn 0.3s ease-in-out;
                }
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(5px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .switch { position: relative; display: inline-block; width: 44px; height: 24px; }
                .switch input { opacity: 0; width: 0; height: 0; }
                .slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #4e5058; transition: .2s; border-radius: 24px; }
                .slider:before { position: absolute; content: ""; height: 18px; width: 18px; left: 3px; bottom: 3px; background-color: white; transition: .2s; border-radius: 50%; }
                input:checked + .slider { background-color: #5865F2; }
                input:checked + .slider:before { transform: translateX(20px); }
            `}</style>
        </div>
    );
}

const styles = {
    container: { 
        padding: '40px 20px', 
        maxWidth: '1200px', 
        margin: '0 auto', 
        fontFamily: '"Inter", sans-serif', 
        color: '#dbdee1',
        minHeight: '80vh'
    },
    loadingText: { textAlign: 'center' as const, color: '#949ba4', marginTop: '100px' },
    header: {
        display: 'flex',
        alignItems: 'center',
        gap: '20px',
        marginBottom: '40px',
        paddingBottom: '20px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)'
    },
    backButton: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        background: 'none',
        border: 'none',
        color: '#949ba4',
        cursor: 'pointer',
        fontSize: '16px',
        fontWeight: '500',
        padding: '8px 12px',
        borderRadius: '6px',
        transition: 'all 0.2s',
    },
    title: { 
        margin: 0, 
        fontSize: '28px', 
        fontWeight: '800', 
        color: '#ffffff' 
    },
    layout: {
        display: 'flex',
        gap: '40px',
        flexDirection: 'row' as const,
        alignItems: 'flex-start'
    },
    sidebar: {
        width: '250px',
        display: 'flex',
        flexDirection: 'column' as const,
        gap: '8px',
        flexShrink: 0
    },
    tabButton: {
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        width: '100%',
        padding: '12px 16px',
        background: 'transparent',
        border: 'none',
        borderRadius: '8px',
        color: '#949ba4',
        fontSize: '16px',
        fontWeight: '600',
        cursor: 'pointer',
        textAlign: 'left' as const,
        transition: 'all 0.2s',
    },
    activeTab: {
        background: 'rgba(88, 101, 242, 0.1)',
        color: '#5865F2',
    },
    mainContent: {
        flex: 1,
        minWidth: 0
    },
    sectionTitle: {
        margin: '0 0 8px 0',
        fontSize: '24px',
        fontWeight: '700',
        color: '#ffffff'
    },
    sectionDescription: {
        margin: '0 0 24px 0',
        fontSize: '15px',
        color: '#949ba4',
        lineHeight: '1.5'
    },
    card: {
        background: 'rgba(255, 255, 255, 0.03)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '12px',
        padding: '24px',
        boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.2)',
    },
    inputGroup: {
        marginBottom: '20px'
    },
    label: {
        display: 'block',
        marginBottom: '8px',
        fontSize: '14px',
        fontWeight: '600',
        color: '#b5bac1',
        textTransform: 'uppercase' as const,
        letterSpacing: '0.5px'
    },
    input: {
        width: '100%',
        padding: '12px 16px',
        background: '#1e1f22',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '8px',
        color: '#dbdee1',
        fontSize: '15px',
        outline: 'none',
        transition: 'border-color 0.2s'
    },
    colorPicker: {
        width: '44px',
        height: '44px',
        padding: '0',
        border: 'none',
        borderRadius: '8px',
        cursor: 'pointer',
        background: 'none'
    },
    saveButton: {
        background: '#5865F2',
        color: 'white',
        border: 'none',
        padding: '12px 24px',
        borderRadius: '8px',
        fontSize: '15px',
        fontWeight: '600',
        cursor: 'pointer',
        transition: 'background-color 0.2s',
        marginTop: '10px'
    },
    switch: {
        margin: 0
    },
    slider: {
        margin: 0
    }
};
