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
    { name: translations.financeManager, href: '/finances' }, // Rota e chave atualizadas
    { name: translations.calculator, href: '/calc' },
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
    <div className="min-h-screen bg-gray-900 text-gray-100 flex flex-col">
      <nav className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <Link to="/" className="text-xl font-bold">Davimf Dev</Link>
            </div>
            
            {/* Desktop Menu */}
            <div className="hidden md:flex md:items-center">
              <div className="flex items-baseline space-x-4">
                {navigation.map((item) => (
                  <Link key={item.name} to={item.href} className="text-gray-300 hover:bg-gray-700 hover:text-white px-3 py-2 rounded-md text-sm font-medium transition-colors">
                    {item.name}
                  </Link>
                ))}
                <div className="relative" ref={featuresMenuRef}>
                  <button onClick={() => setIsFeaturesMenuOpen(!isFeaturesMenuOpen)} className="text-gray-300 hover:bg-gray-700 hover:text-white px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center">
                    {translations.features}
                    <ChevronDown size={16} className={`ml-1 transition-transform ${isFeaturesMenuOpen ? 'rotate-180' : ''}`} />
                  </button>
                  <div className={`absolute left-0 mt-2 w-48 bg-gray-800 rounded-md shadow-lg py-1 z-50 transition-all duration-200 ease-out transform ${isFeaturesMenuOpen ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`} style={{ pointerEvents: isFeaturesMenuOpen ? 'auto' : 'none' }}>
                    {featureLinks.map(link => (
                      <Link key={link.name} to={link.href} onClick={() => setIsFeaturesMenuOpen(false)} className="block px-4 py-2 text-sm text-gray-300 hover:bg-gray-700">
                        {link.name}
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex items-center ml-4">
                <div className="relative" ref={userMenuRef}>
                  <button onClick={() => setIsUserMenuOpen(!isUserMenuOpen)} className="p-2 text-gray-300 hover:text-white hover:bg-gray-700 rounded-md transition-colors">
                    <User size={20} />
                  </button>
                  <div className={`absolute right-0 mt-2 w-48 bg-gray-800 rounded-md shadow-lg py-1 z-50 transition-all duration-200 ease-out transform ${isUserMenuOpen ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`} style={{ pointerEvents: isUserMenuOpen ? 'auto' : 'none' }}>
                    {isAuthenticated ? (
                      <button onClick={handleLogout} className="block w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-700">
                        {translations.logout}
                      </button>
                    ) : (
                      <>
                        <Link to="/login" onClick={() => setIsUserMenuOpen(false)} className="block px-4 py-2 text-sm text-gray-300 hover:bg-gray-700">{translations.login}</Link>
                        <Link to="/register" onClick={() => setIsUserMenuOpen(false)} className="block px-4 py-2 text-sm text-gray-300 hover:bg-gray-700">{translations.register}</Link>
                      </>
                    )}
                  </div>
                </div>
                <button onClick={toggleLanguage} className="ml-2 p-2 text-gray-300 hover:text-white hover:bg-gray-700 rounded-md transition-colors" aria-label="Toggle language">
                  <Globe size={20} />
                  <span className="ml-1">{language.toUpperCase()}</span>
                </button>
              </div>
            </div>

            {/* Mobile Menu Button */}
            <div className="md:hidden flex items-center">
              <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="text-gray-400 hover:text-white">
                {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="md:hidden">
            <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
              {navigation.map((item) => (
                <Link key={item.name} to={item.href} className="text-gray-300 hover:bg-gray-700 hover:text-white block px-3 py-2 rounded-md text-base font-medium" onClick={() => setIsMenuOpen(false)}>
                  {item.name}
                </Link>
              ))}
              <div className="border-t border-gray-700 my-2"></div>
              <p className="px-3 pt-2 text-xs font-semibold text-gray-400 uppercase">{translations.features}</p>
              {featureLinks.map((item) => (
                <Link key={item.name} to={item.href} className="text-gray-300 hover:bg-gray-700 hover:text-white block px-3 py-2 rounded-md text-base font-medium" onClick={() => setIsMenuOpen(false)}>
                  {item.name}
                </Link>
              ))}
              <div className="border-t border-gray-700 my-2"></div>
              {isAuthenticated ? (
                 <button onClick={handleLogout} className="w-full text-left text-gray-300 hover:bg-gray-700 hover:text-white block px-3 py-2 rounded-md text-base font-medium">
                   {translations.logout}
                 </button>
              ) : (
                <>
                  <Link to="/login" className="text-gray-300 hover:bg-gray-700 hover:text-white block px-3 py-2 rounded-md text-base font-medium" onClick={() => setIsMenuOpen(false)}>{translations.login}</Link>
                  <Link to="/register" className="text-gray-300 hover:bg-gray-700 hover:text-white block px-3 py-2 rounded-md text-base font-medium" onClick={() => setIsMenuOpen(false)}>{translations.register}</Link>
                </>
              )}
            </div>
          </div>
        )}
      </nav>

      <main className="flex-grow max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        {children}
      </main>

      <footer className="bg-gray-800 border-t border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="text-gray-400 mb-4 md:mb-0">
              © {new Date().getFullYear()} Davi Monteiro Fonseca. {translations.rights}
            </div>
            <div className="flex space-x-6">
              <a href="https://github.com/D4emonF" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white transition-colors"><Github size={24} /></a>
              <a href="https://www.linkedin.com/in/davimfdev" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white transition-colors"><Linkedin size={24} /></a>
              <a href="mailto:davimf9702@gmail.com" className="text-gray-400 hover:text-white transition-colors"><Mail size={24} /></a>
              <a href="https://discord.com/users/344214477069221888" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white transition-colors"><MessageCircle size={24} /></a>
              <a href="https://api.whatsapp.com/send?phone=%205562986089609&text=Ol%C3%A1%2C+vim+do+seu+site." target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white transition-colors"><Phone size={24} /></a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Layout;
