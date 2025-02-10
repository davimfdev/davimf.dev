import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {Menu, X, Github, Linkedin, Mail, Globe, MessageCircle, Phone} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);
  const location = useLocation();
  const { language, setLanguage, translations } = useLanguage();

  const navigation = [
    { name: translations.home, href: '/' },
    { name: translations.portfolio, href: '/portfolio' },
    { name: translations.resume, href: '/resume' },
    { name: translations.products, href: '/products' },
    { name: translations.contact, href: '/contact' },
  ];

  const isActive = (path: string) => {
    return location.pathname === path;
  };

  const toggleLanguage = () => {
    setLanguage(language === 'pt' ? 'en' : 'pt');
  };

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100">
      <nav className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <Link to="/" className="text-xl font-bold">Davimf Dev</Link>
            </div>
            
            <div className="hidden md:flex md:items-center">
              <div className="flex items-baseline space-x-4">
                {navigation.map((item) => (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={`${
                      isActive(item.href)
                        ? 'bg-gray-700 text-white'
                        : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                    } px-3 py-2 rounded-md text-sm font-medium transition-colors`}
                  >
                    {item.name}
                  </Link>
                ))}
              </div>
              <button
                onClick={toggleLanguage}
                className="ml-4 p-2 text-gray-300 hover:text-white hover:bg-gray-700 rounded-md transition-colors"
                aria-label="Toggle language"
              >
                <Globe size={20} />
                <span className="ml-1">{language.toUpperCase()}</span>
              </button>
            </div>

            <div className="md:hidden flex items-center">
              <button
                onClick={toggleLanguage}
                className="mr-2 p-2 text-gray-300 hover:text-white hover:bg-gray-700 rounded-md transition-colors"
                aria-label="Toggle language"
              >
                <Globe size={20} />
              </button>
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="text-gray-400 hover:text-white"
              >
                {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
              </button>
            </div>
          </div>
        </div>

        {isMenuOpen && (
          <div className="md:hidden">
            <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
              {navigation.map((item) => (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`${
                    isActive(item.href)
                      ? 'bg-gray-700 text-white'
                      : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                  } block px-3 py-2 rounded-md text-base font-medium`}
                  onClick={() => setIsMenuOpen(false)}
                >
                  {item.name}
                </Link>
              ))}
            </div>
          </div>
        )}
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>

      <footer className="bg-gray-800 border-t border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="text-gray-400 mb-4 md:mb-0">
              © {new Date().getFullYear()} Davi Monteiro Fonseca. {translations.rights}
            </div>
            <div className="flex space-x-6">
              <a href="https://github.com/D4emonF" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white transition-colors">
                <Github size={24} />
              </a>
              <a href="https://www.linkedin.com/in/davimfdev" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white transition-colors">
                <Linkedin size={24} />
              </a>
              <a href="mailto:davimf9702@gmail.com" className="text-gray-400 hover:text-white transition-colors">
                <Mail size={24} />
              </a>
              <a href="https://discord.com/users/344214477069221888" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white transition-colors">
                <MessageCircle size={24} />
              </a>
              <a href="https://api.whatsapp.com/send?phone=%205562986089609&text=Ol%C3%A1%2C+vim+do+seu+site." target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white transition-colors">
                <Phone size={24} />
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Layout;