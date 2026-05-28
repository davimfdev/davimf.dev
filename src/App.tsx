import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { LanguageProvider } from './context/LanguageContext';
import { AuthProvider } from './context/AuthContext';
import { NotesProvider } from './context/NotesContext';
import Layout from './components/Layout';
import Home from './pages/Home';
import Portfolio from './pages/Portfolio';
import Resume from './pages/Resume';
import Products from './pages/Products';
import Contact from './pages/Contact';
import Calculator from './pages/Calculator';
import Plans from './pages/Plans';
import Roulette from './pages/Roulette';
import TodoList from './pages/TodoList';
import FinanceManager from './pages/FinanceManager';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import RequestPasswordResetPage from './pages/RequestPasswordResetPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import UrlShortener from './components/UrlShortener';
import UrlRedirectPage from './pages/UrlRedirectPage';
import PrivacyPolicy from './pages/PrivacyPolicy';
import Test from './pages/Test';
import Dashboard from './pages/Dashboard';
import BotConfig from './pages/BotConfig';
import FmmPlans from './pages/FmmPlans';
import FmmActivated from './pages/FmmActivated';
import MyKeys from './pages/MyKeys';
import FmmAdmin from './pages/FmmAdmin';
import Notes from './pages/Notes';
import { NotesFloatingLayer } from './components/notes/NotesFloatingLayer';

function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <NotesProvider>
        <Router>
          <NotesFloatingLayer />
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
              <Route path="/dashboard/:guildId" element={<BotConfig/>} />
              <Route path="/privacy-policy" element={<PrivacyPolicy />} />
              <Route path="/fmm" element={<FmmPlans />} />
              <Route path="/fmm-activated" element={<FmmActivated />} />
              <Route path="/my-keys" element={<MyKeys />} />
              <Route path="/fmm-admin" element={<FmmAdmin />} />
              <Route path="/notes" element={<Notes />} />
            </Routes>
          </Layout>
        </Router>
        </NotesProvider>
      </AuthProvider>
    </LanguageProvider>
  );
}

export default App;
