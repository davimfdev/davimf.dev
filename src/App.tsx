import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { LanguageProvider } from './context/LanguageContext';
import { AuthProvider } from './context/AuthContext';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import Home from './pages/Home';
import Portfolio from './pages/Portfolio';
import Resume from './pages/Resume';
import Products from './pages/Products';
import Contact from './pages/Contact';
import Calculator from "./pages/Calculator.tsx";
import Plans from "./pages/Plans.tsx";
import Roulette from "./pages/Roulette.tsx";
import TodoList from "./pages/TodoList.tsx";
import FinanceManager from "./pages/FinanceManager.tsx";
import LoginPage from "./pages/LoginPage.tsx";
import RegisterPage from "./pages/RegisterPage.tsx";
import RequestPasswordResetPage from './pages/RequestPasswordResetPage.tsx';
import ResetPasswordPage from './pages/ResetPasswordPage.tsx';
import UrlShortener from "./components/UrlShortener.tsx";
import UrlRedirectPage from "./pages/UrlRedirectPage.tsx";
import PrivacyPolicy from './pages/PrivacyPolicy.tsx'; // Importa a nova página
import Test from './pages/Test.tsx'
import Dashboard from './pages/Dashboard.tsx'

function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
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
              <Route path="/todo" element={<TodoList />} />
              <Route path="/finances" element={<FinanceManager />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/request-password-reset" element={<RequestPasswordResetPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
              <Route path="/encurtador" element={<UrlShortener />} />
              <Route path="/r/:shortCode" element={<UrlRedirectPage />} />
              <Route path="/test" element={<Test/>} />
              <Route path="/dashboard" element={<Dashboard/>} />
              {/* Rota para a Política de Privacidade */}
              <Route path="/privacy-policy" element={<PrivacyPolicy />} />
            </Routes>
          </Layout>
        </Router>
      </AuthProvider>
    </LanguageProvider>
  );
}

export default App;
