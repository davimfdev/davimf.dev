import React, { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
// MODIFICADO: Adicionado LogOut na lista de imports
import { Menu, X, Github, Linkedin, Mail, MessageCircle, Phone, User, LogOut } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [discordUser, setDiscordUser] = useState<any>(null);

  const userMenuRef = useRef<HTMLDivElement>(null);
  const mobilePanelRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const location = useLocation();
  const isDashboard = location.pathname === '/dashboard' || location.pathname.startsWith('/dashboard/');

  // Indicador único da nav: em vez de um sublinhado por link (que some/aparece
  // na troca de página), uma única barra de 1px desliza entre os itens. A Map
  // guarda o elemento de cada link (chaveado pelo href) para medir posição e
  // largura; o estado guarda onde a barra deve ficar.
  const navLinksContainerRef = useRef<HTMLDivElement>(null);
  const navLinkElsRef = useRef(new Map<string, HTMLAnchorElement>());
  const [navIndicator, setNavIndicator] = useState({ left: 0, width: 0, visible: false });

  const measureNavIndicator = useCallback(() => {
    let activeEl: HTMLAnchorElement | null = null;
    navLinkElsRef.current.forEach((el) => {
      if (el.getAttribute('aria-current') === 'page') activeEl = el;
    });

    if (activeEl) {
      const el = activeEl as HTMLAnchorElement;
      setNavIndicator({ left: el.offsetLeft, width: el.offsetWidth, visible: true });
    } else {
      // Nenhum item ativo (Home, /fmm, /contact, etc.): a barra some, mas
      // mantém left/width do último item ativo — sumir "no lugar" em vez de
      // recolher para left:0/width:0, o que pareceria a barra disparando
      // para a borda esquerda.
      setNavIndicator((prev) => (prev.visible ? { ...prev, visible: false } : prev));
    }
  }, []);

  // useLayoutEffect (não useEffect) para medir antes do paint: assim a barra
  // nunca pisca na posição errada — nem a antiga, nem left:0 — ao trocar de
  // rota.
  useLayoutEffect(() => {
    measureNavIndicator();
  }, [location.pathname, measureNavIndicator]);

  // Reposiciona se a largura dos links mudar (resize da janela, fonte web
  // carregando tarde) — sem isso a barra fica desalinhada do texto até a
  // próxima navegação.
  useEffect(() => {
    const container = navLinksContainerRef.current;
    if (!container || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => measureNavIndicator());
    observer.observe(container);
    return () => observer.disconnect();
  }, [measureNavIndicator]);

  const handleLogin = () => {
    // Login unificado: passa pelo fluxo seguro (state + sessão no servidor).
    // O callback devolve o token na URL para as features que ainda usam localStorage.
    window.location.href = `/api/dashboard-login?returnTo=${encodeURIComponent(location.pathname)}`;
  };

  const { language, setLanguage, translations, legal } = useLanguage();

  // Contato sai da navbar: a Home passa a ser a entrada, e o fecho da Home mais
  // o footer garantem que continue a um clique. "Ferramentas" aponta para a
  // âncora da Home porque /tools só existe no Plano 4 — link morto é pior.
  const navigation = [
    { name: translations.home.nav.projects, href: '/portfolio' },
    { name: translations.home.nav.products, href: '/products' },
    { name: translations.home.nav.tools, href: '/#tools' },
    { name: translations.home.nav.about, href: '/about' },
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
            // 3. Nenhum redirecionamento aqui: o `returnTo` enviado em handleLogin
            // já trouxe o usuário de volta para a página onde ele estava. Só
            // atualizamos o estado para a navbar refletir que ele está logado.
            setDiscordUser(data);
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
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);

  }, [discordUser, isDashboard]); // discordUser mantém o efeito em sincronia quando o login acontece

  /**
   * O painel mobile cobre a página inteira. Sem estas quatro coisas ele é um
   * `div` bonito: o teclado continua entrando no conteúdo escondido atrás, e
   * o leitor de tela continua anunciando aquele conteúdo como se estivesse
   * visível.
   */
  useEffect(() => {
    if (!isMenuOpen) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    mobilePanelRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsMenuOpen(false);
        return;
      }
      if (event.key !== 'Tab') return;

      // Sem isto o Tab sai do painel e vai para o conteúdo coberto.
      const focusables = mobilePanelRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled])',
      );
      if (!focusables || focusables.length === 0) return;

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = overflow;
      previouslyFocused?.focus();
    };
  }, [isMenuOpen]);

  if (isDashboard) return <>{children}</>;

  return (
      <div className="min-h-screen flex flex-col relative z-0">
        <div className="bg-blobs"></div>

        {/*
          Barra fina, largura total, hairline embaixo. Sem pill, sem sombra,
          sem raio: a nav deixa de parecer um componente flutuante e passa a
          parecer o topo de uma interface.

          O dourado sai da identidade e passa a marcar SÓ estado — o item ativo
          ganha um traço de 1px. Nada mais aqui é accent.
        */}
        <nav className="bg-surface-nav backdrop-blur-xl border-b border-line fixed w-full z-50 top-0">
          <div className="max-w-wide mx-auto px-gutter">
            <div className="flex items-center justify-between h-14">
              <Link to="/" className="text-eyebrow font-semibold text-fg hover:text-accent transition-colors duration-fast">
                DAVIMF<span className="text-fg-muted">.DEV</span>
              </Link>

              <div className="hidden md:flex items-center gap-8 relative" ref={navLinksContainerRef}>
                {navigation.map((item) => (
                  <NavLink
                    key={item.name}
                    to={item.href}
                    ref={(el) => {
                      if (el) navLinkElsRef.current.set(item.href, el);
                      else navLinkElsRef.current.delete(item.href);
                    }}
                    className={({ isActive }) =>
                      `text-sm transition-colors duration-fast py-4 ${
                        isActive ? 'text-fg' : 'text-fg-muted hover:text-fg'
                      }`
                    }
                  >
                    {item.name}
                  </NavLink>
                ))}

                {/*
                  Barra única e compartilhada: desliza de um item para o
                  outro em vez de sumir num link e reaparecer noutro. Some
                  (opacity 0) sem recolher quando nenhum item está ativo —
                  ver measureNavIndicator.
                */}
                <span
                  aria-hidden="true"
                  data-nav-indicator=""
                  className="absolute bottom-3 h-px bg-accent pointer-events-none transition-all duration-base ease-out-token"
                  style={{ left: navIndicator.left, width: navIndicator.width, opacity: navIndicator.visible ? 1 : 0 }}
                />
              </div>

              <div className="hidden md:flex items-center gap-5">
                <button
                  onClick={toggleLanguage}
                  className="text-eyebrow text-fg-muted hover:text-fg transition-colors duration-fast"
                  aria-label="Toggle language"
                >
                  {language === 'pt' ? 'PT' : 'EN'}
                </button>

                <div className="relative" ref={userMenuRef}>
                  <button
                    onClick={() => (discordUser ? setIsUserMenuOpen(!isUserMenuOpen) : handleLogin())}
                    className="flex items-center justify-center overflow-hidden w-7 h-7 rounded-full border border-line hover:border-line-strong text-fg-muted hover:text-fg transition-colors duration-fast"
                    aria-label={translations.home.nav.account}
                  >
                    {discordUser ? (
                      <img src={`https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png`} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <User size={14} />
                    )}
                  </button>

                  <div className={`absolute right-0 mt-3 w-52 bg-surface-2 border border-line py-1 z-50 transition-opacity duration-fast ${isUserMenuOpen ? 'opacity-100' : 'opacity-0'}`} style={{ pointerEvents: isUserMenuOpen ? 'auto' : 'none' }}>
                    {discordUser ? (
                      <>
                        <div className="px-3 py-2 border-b border-line mb-1">
                          <p className="text-eyebrow text-fg-muted">Identificado como</p>
                          <p className="text-sm text-fg truncate">{discordUser.global_name || discordUser.username}</p>
                        </div>
                        <Link to="/dashboard" onClick={() => setIsUserMenuOpen(false)} className="block px-3 py-2 text-sm text-fg-muted hover:text-fg hover:bg-surface-3 transition-colors">Painel do Bot</Link>
                        <Link to="/my-keys" onClick={() => setIsUserMenuOpen(false)} className="block px-3 py-2 text-sm text-fg-muted hover:text-fg hover:bg-surface-3 transition-colors">Minhas Chaves</Link>
                        <Link to="/my-orders" onClick={() => setIsUserMenuOpen(false)} className="block px-3 py-2 text-sm text-fg-muted hover:text-fg hover:bg-surface-3 transition-colors">Meus Pedidos</Link>
                        {['956985471332937778', '344214477069221888'].includes(discordUser?.id) && (
                          <Link to="/fmm-admin" onClick={() => setIsUserMenuOpen(false)} className="block px-3 py-2 text-sm text-accent hover:bg-surface-3 transition-colors">Admin FMM</Link>
                        )}
                        <button onClick={handleLogout} className="flex items-center w-full text-left px-3 py-2 text-sm text-danger hover:bg-surface-3 transition-colors">
                          <LogOut size={13} className="mr-2" />Sair
                        </button>
                      </>
                    ) : (
                      <button onClick={handleLogin} className="block w-full text-left px-3 py-2 text-sm text-fg-muted hover:text-fg hover:bg-surface-3 transition-colors">Entrar com Discord</button>
                    )}
                  </div>
                </div>
              </div>

              <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="md:hidden text-fg-muted hover:text-fg transition-colors" aria-label={translations.home.nav.menu}>
                {isMenuOpen ? <X size={20} /> : <Menu size={20} />}
              </button>
            </div>
          </div>

          {/*
            Mobile: painel de tela cheia, não dropdown. Os links ganham escala
            de display porque numa tela pequena eles SÃO a página enquanto o
            menu está aberto.
          */}
          {isMenuOpen && (
            <div
              ref={mobilePanelRef}
              tabIndex={-1}
              role="dialog"
              aria-modal="true"
              aria-label={translations.home.nav.menu}
              className="md:hidden fixed inset-0 top-14 bg-bg z-40 px-gutter pt-10 flex flex-col"
            >
              {navigation.map((item) => (
                <Link key={item.name} to={item.href} onClick={() => setIsMenuOpen(false)} className="text-display-3 text-fg py-3 border-b border-line">
                  {item.name}
                </Link>
              ))}
              <div className="mt-auto pb-10 flex items-center justify-between">
                <button onClick={toggleLanguage} className="text-eyebrow text-fg-muted" aria-label="Toggle language">
                  {language === 'pt' ? 'PT' : 'EN'}
                </button>
                {discordUser ? (
                  <button onClick={handleLogout} className="text-sm text-danger">Sair</button>
                ) : (
                  <button onClick={handleLogin} className="text-sm text-fg-muted">Entrar com Discord</button>
                )}
              </div>
            </div>
          )}
        </nav>

        <main aria-hidden={isMenuOpen || undefined} className="flex-grow max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-8 w-full animate-fade-in relative z-20">
          {children}
        </main>

        <footer aria-hidden={isMenuOpen || undefined} className="glass-nav relative z-10 mt-auto">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {/* Documentos obrigatórios para venda a consumidor, sempre a um clique. */}
            <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 mb-6 text-sm">
              <Link to="/terms-of-service" className="text-fg-muted hover:text-fg transition-colors">
                {legal.footer.terms}
              </Link>
              <Link to="/privacy-policy" className="text-fg-muted hover:text-fg transition-colors">
                {legal.footer.privacy}
              </Link>
              <Link to="/refund-policy" className="text-fg-muted hover:text-fg transition-colors">
                {legal.footer.refund}
              </Link>
            </div>

            <div className="flex flex-col md:flex-row justify-between items-center">
              <div className="text-fg-muted mb-6 md:mb-0 text-sm text-center md:text-left">
                <div>© {new Date().getFullYear()} Davi Monteiro Fonseca. {translations.rights}</div>
                {/* Identificação do fornecedor exigida pelo CDC. */}
                <div className="text-xs text-fg-muted mt-1">
                  {legal.company.name} — CNPJ {legal.company.cnpj}
                </div>
              </div>
              <div className="flex space-x-4">
                {[
                  { icon: Github, href: "https://github.com/davimfdev" },
                  { icon: Linkedin, href: "https://www.linkedin.com/in/davimfdev" },
                  { icon: Mail, href: "mailto:davi@davimf.dev" },
                  { icon: MessageCircle, href: "https://discord.com/users/344214477069221888" },
                  { icon: Phone, href: "https://api.whatsapp.com/send?phone=%205562986089609&text=Ol%C3%A1%2C+vim+do+seu+site." }
                ].map((social, index) => {
                  const Icon = social.icon;
                  return (
                      <a key={index} href={social.href} target="_blank" rel="noopener noreferrer" className="p-2 text-fg-muted hover:text-fg bg-surface-1 hover:bg-surface-2 border border-line hover:border-line-strong rounded-full transition-all duration-300 transform hover:-translate-y-1">
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
