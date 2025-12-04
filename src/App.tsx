import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { LanguageProvider } from './context/LanguageContext';
import Layout from './components/Layout';
import Home from './pages/Home';
import Portfolio from './pages/Portfolio';
import Resume from './pages/Resume';
import Products from './pages/Products';
import Contact from './pages/Contact';
import Calculator from "./pages/Calculator.tsx";
import Plans from "./pages/Plans.tsx";
import Roulette from "./pages/Roulette.tsx";
import UrlShortener from "./components/UrlShortener.tsx"; // Import the component
import UrlRedirectPage from "./pages/UrlRedirectPage.tsx"; // Import the redirect page

function App() {
  return (
    <LanguageProvider>
      <Router>
        <Layout>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/portfolio" element={<Portfolio />} />
            <Route path="/resume" element={<Resume />} />
            <Route path="/products" element={<Products />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/calc" element={<Calculator />} />
            <Route path="/plans" element={<Plans />} />
            <Route path="/roulette" element={<Roulette />} />
            {/* Add the new routes for the shortener */}
            <Route path="/shortener" element={<UrlShortener />} />
            <Route path="/r/:shortCode" element={<UrlRedirectPage />} />
          </Routes>
        </Layout>
      </Router>
    </LanguageProvider>
  );
}

export default App;
