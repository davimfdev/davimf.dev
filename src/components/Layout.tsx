import React, { useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Menu, X, Github, Linkedin, Mail, Globe, MessageCircle, Phone, User, ChevronDown } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isFeaturesMenuOpen, setIsFeaturesMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const featuresMenuRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const { language, setLanguage, translations } = useLanguage();
  const { isAuthenticated, logout } = useAuth();

  const navigation = [
    { name: translations.home, href: '/' },
    { name: translations.portfolio, href: '/portfolio' },
    { name: translations.resume, href: '/resume' },
    { name: translations.products, href: '/products' },
    { name: translations.contact, href: '/contact' },
  ];

  const featureLinks = [
    { name: translations.todoList, href: '/todo' },
    { name: translations.financeManager, href: '/finances' },
    { name: translations.urlShortener, href: '/shortener' },
    { name: translations.roulette, href: '/roulette' },
  ];

  const toggleLanguage = () => setLanguage(language === 'pt' ? 'en' : 'pt');

  const handleLogout = () => {
    logout();
    setIsUserMenuOpen(false);
    setIsMenuOpen(false);
    navigate('/');
  };

  useEffect(() => {
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
  }, []);

  return (
    <div className="min-h-screen flex flex-col relative z-0">
      {/* Background blobs for visual flair */}
      <div className="bg-blobs"></div>

      {/* Modern Glass Navbar */}
      <nav className="glass-nav fixed w-full z-50 top-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            <div className="flex items-center">
              <Link to="/" className="text-2xl font-bold text-gradient tracking-wide">
                Davimf<span className="text-white">.dev</span>
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
                <button onClick={() => setIsUserMenuOpen(!isUserMenuOpen)} className="p-2 text-gray-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 rounded-full transition-all duration-300">
                  <User size={20} />
                </button>
                <div className={`absolute right-0 mt-4 w-48 glass-panel py-2 z-50 transition-all duration-300 ease-out transform origin-top-right ${isUserMenuOpen ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 -translate-y-2'}`} style={{ pointerEvents: isUserMenuOpen ? 'auto' : 'none' }}>
                  {isAuthenticated ? (
                    <button onClick={handleLogout} className="block w-full text-left px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-white/10 transition-colors">
                      {translations.logout}
                    </button>
                  ) : (
                    <>
                      <Link to="/login" onClick={() => setIsUserMenuOpen(false)} className="block px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-white/10 transition-colors">{translations.login}</Link>
                      <Link to="/register" onClick={() => setIsUserMenuOpen(false)} className="block px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-white/10 transition-colors">{translations.register}</Link>
                    </>
                  )}
                </div>
              </div>
              <button onClick={toggleLanguage} className="flex items-center p-2 text-gray-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 rounded-full transition-all duration-300" aria-label="Toggle language">
                <Globe size={18} />
                <span className="ml-2 text-sm font-medium">{language.toUpperCase()}</span>
              </button>
            </div>

            {/* Mobile Menu Button */}
            <div className="md:hidden flex items-center">
              <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="p-2 text-gray-300 hover:text-white bg-white/5 rounded-lg border border-white/10 transition-all">
                {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Menu Content */}
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
              {isAuthenticated ? (
                 <button onClick={handleLogout} className="w-full text-left text-gray-300 hover:bg-white/10 hover:text-white block px-3 py-2 rounded-lg text-base font-medium transition-colors">
                   {translations.logout}
                 </button>
              ) : (
                <>
                  <Link to="/login" className="text-gray-300 hover:bg-white/10 hover:text-white block px-3 py-2 rounded-lg text-base font-medium transition-colors" onClick={() => setIsMenuOpen(false)}>{translations.login}</Link>
                  <Link to="/register" className="text-gray-300 hover:bg-white/10 hover:text-white block px-3 py-2 rounded-lg text-base font-medium transition-colors" onClick={() => setIsMenuOpen(false)}>{translations.register}</Link>
                </>
              )}
            </div>
          </div>
        )}
      </nav>

      {/* Padding top to account for fixed navbar */}
      <main className="flex-grow max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-8 w-full animate-fade-in relative z-10">
        {children}
      </main>

      {/* Modern Footer */}
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
