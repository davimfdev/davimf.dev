import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';

const Home = () => {
  const { translations } = useLanguage();

  return (
    <div className="min-h-[calc(100vh-16rem)] flex flex-col justify-center">
      <div className="max-w-3xl mx-auto text-center">
        <h1 className="text-4xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-blue-500 to-purple-500 bg-clip-text text-transparent">
          {translations.greeting} Davi Monteiro Fonseca
        </h1>
        <p className="text-xl text-gray-400 mb-8">
          {translations.description}
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            to="/portfolio"
            className="inline-flex items-center px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            {translations.viewWork}
            <ArrowRight className="ml-2" size={20} />
          </Link>
          <Link
            to="/contact"
            className="inline-flex items-center px-6 py-3 border border-gray-600 hover:border-gray-500 rounded-lg transition-colors"
          >
            {translations.getInTouch}
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Home;