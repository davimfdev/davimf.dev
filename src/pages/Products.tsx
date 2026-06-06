import { ExternalLink, ShoppingCart } from 'lucide-react';
import { useLanguage } from "../context/LanguageContext.tsx";
import { Link } from "react-router-dom";

const Products = () => {
  const { translations } = useLanguage();
  const products = translations.productList;

  return (
    <div className="animate-fade-in relative z-10 py-8">
      <h1 className="text-4xl font-bold mb-12 text-gradient inline-block">{translations.productsAndServices}</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {products.map((product, index) => (
          <div 
            key={product.id} 
            className="glass-panel group overflow-hidden flex flex-col animate-slide-up"
            style={{ animationDelay: `${index * 0.1}s` }}
          >
            <div className="relative overflow-hidden">
              <img
                src={product.image}
                alt={product.name}
                className="w-full h-56 object-cover transform group-hover:scale-110 transition-transform duration-500 ease-out"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-transparent to-transparent opacity-80"></div>
            </div>
            
            <div className="p-6 flex flex-col flex-grow relative z-10">
              <h3 className="text-2xl font-bold mb-3 text-gray-100 group-hover:text-accent transition-colors">{product.name}</h3>
              <p className="text-gray-400 mb-6 flex-grow leading-relaxed line-clamp-3">{product.description}</p>
              
              <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mt-auto pt-4 border-t border-white/10">
                <Link
                  to="/contact"
                  className="inline-flex items-center text-accent hover:text-accent font-medium transition-colors group/link"
                >
                  {translations.learnMore} 
                  <ExternalLink size={18} className="ml-2 transform group-hover/link:-translate-y-1 group-hover/link:translate-x-1 transition-transform" />
                </Link>
                
                <Link to={product.link} className="w-full sm:w-auto">
                  <button className="btn-primary w-full group/btn py-2 px-5 text-sm">
                    <ShoppingCart size={18} className="mr-2 group-hover/btn:-rotate-12 transition-transform" />
                    {translations.buyNow}
                  </button>
                </Link>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Products;
