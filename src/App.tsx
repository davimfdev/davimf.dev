import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { LanguageProvider } from './context/LanguageContext';
import Layout from './components/Layout';
import Home from './pages/Home';
import Portfolio from './pages/Portfolio';
import Resume from './pages/Resume';
import Products from './pages/Products';
import Contact from './pages/Contact';
import Calculator from "./pages/Calculator.tsx";

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
          </Routes>
        </Layout>
      </Router>
    </LanguageProvider>
  );
}

export default App;