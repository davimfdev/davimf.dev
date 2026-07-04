import React, { useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
// MODIFICADO: Adicionado LogOut na lista de imports
import { Menu, X, Github, Linkedin, Mail, Globe, MessageCircle, Phone, User, ChevronDown, LogOut } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isFeaturesMenuOpen, setIsFeaturesMenuOpen] = useState(false);
  const [discordUser, setDiscordUser] = useState<any>(null);

  const userMenuRef = useRef<HTMLDivElement>(null);
  const featuresMenuRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const location = useLocation();
  const isDashboard = location.pathname === '/dashboard' || location.pathname.startsWith('/dashboard/');

  const handleLogin = () => {
    // Login unificado: passa pelo fluxo seguro (state + sessão no servidor).
    // O callback devolve o token na URL para as features que ainda usam localStorage.
    window.location.href = `/api/dashboard-login?returnTo=${encodeURIComponent(location.pathname)}`;
  };

  const { language, setLanguage, translations } = useLanguage();

  const navigation = [
    { name: translations.home, href: '/' },
    { name: translations.portfolio, href: '/portfolio' },
    { name: translations.products, href: '/products' },
    { name: translations.contact, href: '/contact' },
  ];

  const featureLinks = [
    { name: translations.todoList, href: '/todo' },
    { name: translations.financeManager, href: '/finances' },
    { name: translations.urlShortener, href: '/encurtador' },
    { name: translations.roulette, href: '/roulette' },
    { name: 'Notas', href: '/notes' },
    { name: translations.passwordGenerator, href: '/password-generator' },
  ];

  const toggleLanguage = () => setLanguage(language === 'pt' ? 'en' : 'pt');

  const handleLogout = () => {
    localStorage.removeItem('discord_token');
    setDiscordUser(null);
    setIsUserMenuOpen(false);
    setIsMenuOpen(false);
    // Revoga também a sessão-cookie do servidor (dashboard).
    fetch('/api/dashboard-logout', { method: 'POST', credentials: 'include' }).finally(() => navigate('/'));
  };

  useEffect(() => {
    if (isDashboard) return;
    // 1. CAÇADOR DE TOKENS: Verifica se o token veio na URL (vinda do backend)
    const params = new URLSearchParams(window.location.search);
    const tokenFromUrl = params.get('token');

    if (tokenFromUrl) {
      localStorage.setItem('discord_token', tokenFromUrl);
      // Limpa a URL para não ficar aquele texto feio e por segurança
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    // 2. Tenta pegar o token (seja o que acabou de salvar ou o que já estava lá)
    const token = localStorage.getItem('discord_token');

    if (token && !discordUser) {
      fetch('https://discord.com/api/users/@me', {
        headers: { Authorization: `Bearer ${token}` }
      })
          .then(res => {
            if (res.ok) return res.json();
            throw new Error('Token inválido');
          })
          .then(data => {
            setDiscordUser(data);

            // 3. REDIRECIONAMENTO INTELIGENTE
            const returnPath = localStorage.getItem('return_path');
            if (returnPath && returnPath !== '/login' && returnPath !== '/') {
              localStorage.removeItem('return_path');
              navigate(returnPath);
            } else if (tokenFromUrl) {
              // Se ele acabou de logar e não tinha rota salva, manda pro dashboard
              navigate('/dashboard');
            }
          })
          .catch(() => {
            localStorage.removeItem('discord_token');
            setDiscordUser(null);
          });
    }

    // Lógica do clique fora (dropdowns)
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
      if (featuresMenuRef.current && !featuresMenuRef.current.contains(event.target as Node)) {
        setIsFeaturesMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);

  }, [navigate, discordUser, isDashboard]); // Adicionado discordUser para atualizar o estado quando logar

  if (isDashboard) return <>{children}</>;

  return (
      <div className="min-h-screen flex flex-col relative z-0">
        <div className="bg-blobs"></div>

        <nav className="glass-nav fixed w-full z-50 top-0">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-20">
              <div className="flex items-center">
                <Link to="/" className="text-2xl font-display font-extrabold text-accent tracking-tight">
                  Davimf<span className="text-[#F5F3EF]">.dev</span>
                </Link>
              </div>

              {/* Desktop Menu */}
              <div className="hidden md:flex md:items-center bg-white/5 backdrop-blur-md rounded-2xl px-4 py-2 border border-white/10 shadow-lg">
                <div className="flex items-baseline space-x-2">
                  {navigation.map((item) => (
                      <Link key={item.name} to={item.href} className="nav-link">
                        {item.name}
                      </Link>
                  ))}

                  <div className="relative" ref={featuresMenuRef}>
                    <button onClick={() => setIsFeaturesMenuOpen(!isFeaturesMenuOpen)} className="nav-link flex items-center">
                      {translations.features}
                      <ChevronDown size={16} className={`ml-1 transition-transform duration-300 ${isFeaturesMenuOpen ? 'rotate-180' : ''}`} />
                    </button>
                    <div className={`absolute left-0 mt-4 w-56 glass-panel py-2 z-50 transition-all duration-300 ease-out transform origin-top ${isFeaturesMenuOpen ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 -translate-y-2'}`} style={{ pointerEvents: isFeaturesMenuOpen ? 'auto' : 'none' }}>
                      {featureLinks.map(link => (
                          <Link key={link.name} to={link.href} onClick={() => setIsFeaturesMenuOpen(false)} className="block px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-white/10 transition-colors">
                            {link.name}
                          </Link>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="hidden md:flex items-center space-x-4">
                <div className="relative" ref={userMenuRef}>
                  <button
                      onClick={() => discordUser ? setIsUserMenuOpen(!isUserMenuOpen) : handleLogin()}
                      className="flex items-center justify-center overflow-hidden w-10 h-10 text-gray-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 rounded-full transition-all duration-300 shadow-inner"
                  >
                    {discordUser ? (
                        <img
                            src={`https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png`}
                            alt="Avatar"
                            className="w-full h-full object-cover"
                        />
                    ) : (
                        <User size={20} />
                    )}
                  </button>

                  <div className={`absolute right-0 mt-4 w-56 glass-panel py-2 z-50 transition-all duration-300 ease-out transform origin-top-right ${isUserMenuOpen ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 -translate-y-2'}`} style={{ pointerEvents: isUserMenuOpen ? 'auto' : 'none' }}>
                    {discordUser ? (
                        <>
                          <div className="px-4 py-3 border-b border-white/10 mb-1">
                            <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest">Identificado como</p>
                            <p className="text-sm font-bold text-white truncate">{discordUser.global_name || discordUser.username}</p>
                          </div>
                          <Link to="/dashboard" onClick={() => setIsUserMenuOpen(false)} className="block px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-white/10 transition-colors">
                            Painel do Bot
                          </Link>
                          <Link to="/my-keys" onClick={() => setIsUserMenuOpen(false)} className="block px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-white/10 transition-colors">
                            Minhas Chaves
                          </Link>
                          {['956985471332937778', '344214477069221888'].includes(discordUser?.id) && (
                            <Link to="/fmm-admin" onClick={() => setIsUserMenuOpen(false)} className="block px-4 py-2 text-sm text-accent hover:text-accent hover:bg-accent-soft/10 transition-colors">
                              Admin FMM
                            </Link>
                          )}
                          <button onClick={handleLogout} className="flex items-center w-full text-left px-4 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors">
                            <LogOut size={14} className="mr-2" />
                            Sair (Logoff)
                          </button>
                        </>
                    ) : (
                        <button onClick={handleLogin} className="block w-full text-left px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-white/10 transition-colors">
                          Entrar com Discord
                        </button>
                    )}
                  </div>
                </div>

                <button onClick={toggleLanguage} className="flex items-center p-2 text-gray-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 rounded-full transition-all duration-300" aria-label="Toggle language">
                  <Globe size={18} />
                  <span className="ml-2 text-sm font-medium">{language.toUpperCase()}</span>
                </button>
              </div>

              <div className="md:hidden flex items-center">
                <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="p-2 text-gray-300 hover:text-white bg-white/5 rounded-lg border border-white/10 transition-all">
                  {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
                </button>
              </div>
            </div>
          </div>

          {isMenuOpen && (
              <div className="md:hidden glass-panel mx-4 mt-2 mb-4 overflow-hidden animate-slide-up">
                <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
                  {navigation.map((item) => (
                      <Link key={item.name} to={item.href} className="text-gray-300 hover:bg-white/10 hover:text-white block px-3 py-2 rounded-lg text-base font-medium transition-colors" onClick={() => setIsMenuOpen(false)}>
                        {item.name}
                      </Link>
                  ))}
                  <div className="border-t border-white/10 my-2"></div>
                  <p className="px-3 pt-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">{translations.features}</p>
                  {featureLinks.map((item) => (
                      <Link key={item.name} to={item.href} className="text-gray-300 hover:bg-white/10 hover:text-white block px-3 py-2 rounded-lg text-base font-medium transition-colors" onClick={() => setIsMenuOpen(false)}>
                        {item.name}
                      </Link>
                  ))}
                  <div className="border-t border-white/10 my-2"></div>
                  {discordUser ? (
                      <>
                        <div className="px-3 py-2">
                          <p className="text-xs text-gray-500 uppercase">Logado como</p>
                          <p className="text-white font-bold">{discordUser.username}</p>
                        </div>
                        <Link to="/dashboard" className="text-gray-300 hover:bg-white/10 hover:text-white block px-3 py-2 rounded-lg text-base font-medium transition-colors" onClick={() => setIsMenuOpen(false)}>
                          Painel do Bot
                        </Link>
                        <Link to="/my-keys" className="text-gray-300 hover:bg-white/10 hover:text-white block px-3 py-2 rounded-lg text-base font-medium transition-colors" onClick={() => setIsMenuOpen(false)}>
                          Minhas Chaves
                        </Link>
                        {['956985471332937778', '344214477069221888'].includes(discordUser?.id) && (
                          <Link to="/fmm-admin" className="text-accent hover:bg-accent-soft/10 hover:text-accent block px-3 py-2 rounded-lg text-base font-medium transition-colors" onClick={() => setIsMenuOpen(false)}>
                            Admin FMM
                          </Link>
                        )}
                        <button onClick={handleLogout} className="w-full text-left text-red-400 hover:bg-red-500/10 block px-3 py-2 rounded-lg text-base font-medium transition-colors">
                          Sair (Logoff)
                        </button>
                      </>
                  ) : (
                      <button onClick={handleLogin} className="w-full text-left text-gray-300 hover:bg-white/10 hover:text-white block px-3 py-2 rounded-lg text-base font-medium transition-colors">
                        Entrar com Discord
                      </button>
                  )}
                </div>
              </div>
          )}
        </nav>

        <main className="flex-grow max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-8 w-full animate-fade-in relative z-20">
          {children}
        </main>

        <footer className="glass-nav relative z-10 mt-auto">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="flex flex-col md:flex-row justify-between items-center">
              <div className="text-gray-400 mb-6 md:mb-0 text-sm">
                © {new Date().getFullYear()} Davi Monteiro Fonseca. {translations.rights}
              </div>
              <div className="flex space-x-4">
                {[
                  { icon: Github, href: "https://github.com/D4emonF" },
                  { icon: Linkedin, href: "https://www.linkedin.com/in/davimfdev" },
                  { icon: Mail, href: "mailto:davimf9702@gmail.com" },
                  { icon: MessageCircle, href: "https://discord.com/users/344214477069221888" },
                  { icon: Phone, href: "https://api.whatsapp.com/send?phone=%205562986089609&text=Ol%C3%A1%2C+vim+do+seu+site." }
                ].map((social, index) => {
                  const Icon = social.icon;
                  return (
                      <a key={index} href={social.href} target="_blank" rel="noopener noreferrer" className="p-2 text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/20 rounded-full transition-all duration-300 transform hover:-translate-y-1">
                        <Icon size={20} />
                      </a>
                  );
                })}
              </div>
            </div>
          </div>
        </footer>
      </div>
  );
};

export default Layout;
