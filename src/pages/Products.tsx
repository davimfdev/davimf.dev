import { ExternalLink, ShoppingCart } from 'lucide-react';
import {useLanguage} from "../context/LanguageContext.tsx";
import {Link} from "react-router-dom";

const Products = () => {
  const { translations } = useLanguage();
  const products = translations.productList;

  return (
    <div>
      <h1 className="text-3xl font-bold mb-8">{translations.productsAndServices}</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {products.map((product) => (
          <div key={product.id} className="bg-gray-800 rounded-lg overflow-hidden">
            <img
              src={product.image}
              alt={product.name}
              className="w-full h-48 object-cover"
            />
            <div className="p-6">
              <h3 className="text-xl font-semibold mb-2">{product.name}</h3>
              <p className="text-gray-400 mb-4">{product.description}</p>
              <div className="flex justify-between items-center">
                <a
                  href={product.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center text-blue-400 hover:text-blue-300"
                >
                  {translations.learnMore} <ExternalLink size={16} className="ml-1" />
                </a>
                  <Link to="/contact">
                  <button className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors">
                  <ShoppingCart size={16} className="mr-2" />
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