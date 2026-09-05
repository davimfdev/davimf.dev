import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { LanguageProvider } from './context/LanguageContext';
import { AuthProvider } from './context/AuthContext';
import { NotesProvider } from './context/NotesContext';
import Layout from './components/Layout';
import { ScrollToTop } from './components/ScrollToTop';
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
import TermsOfService from './pages/TermsOfService';
import RefundPolicy from './pages/RefundPolicy';
import LegalCatchAll from './pages/LegalCatchAll';
import Test from './pages/Test';
import Dashboard from './pages/Dashboard';
import BotConfig from './pages/BotConfig';
import { OverviewSection } from './features/bot-dashboard/sections/OverviewSection';
import { ChannelsSection } from './features/bot-dashboard/sections/ChannelsSection';
import { RolesSection } from './features/bot-dashboard/sections/RolesSection';
import { ModerationSection } from './features/bot-dashboard/sections/ModerationSection';
import { SecuritySection } from './features/bot-dashboard/sections/SecuritySection';
import { ModulesSection } from './features/bot-dashboard/sections/ModulesSection';
import FmmPlans from './pages/FmmPlans';
import FmmActivated from './pages/FmmActivated';
import MyKeys from './pages/MyKeys';
import MyOrders from './pages/MyOrders';
import FmmAdmin from './pages/FmmAdmin';
import Notes from './pages/Notes';
import PasswordGenerator from './pages/PasswordGenerator';
import TicketView from './pages/TicketView';
import About from './pages/About';
import Tools from './pages/Tools';
import { NotesFloatingLayer } from './components/notes/NotesFloatingLayer';

function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <NotesProvider>
        <Router>
          <ScrollToTop />
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
              <Route path="/ticket/:id" element={<TicketView />} />
              <Route path="/test" element={<Test/>} />
              <Route path="/dashboard" element={<Dashboard/>} />
              <Route path="/dashboard/:guildId" element={<BotConfig/>}>
                <Route index element={<Navigate to="overview" replace />} />
                <Route path="overview" element={<OverviewSection/>} />
                <Route path="channels" element={<ChannelsSection/>} />
                <Route path="roles" element={<RolesSection/>} />
                <Route path="moderation" element={<ModerationSection/>} />
                <Route path="security" element={<SecuritySection/>} />
                <Route path="modules" element={<ModulesSection/>} />
              </Route>
              <Route path="/privacy-policy" element={<PrivacyPolicy />} />
              <Route path="/terms-of-service" element={<TermsOfService />} />
              <Route path="/refund-policy" element={<RefundPolicy />} />
              <Route path="/legal/:version/terms-of-service" element={<TermsOfService />} />
              <Route path="/legal/:version/privacy-policy" element={<PrivacyPolicy />} />
              <Route path="/legal/:version/refund-policy" element={<RefundPolicy />} />
              {/* Captura qualquer outro caminho sob /legal/ (ex.: segmento de versão
                  vazio) - escopo só desta feature, não um 404 da aplicação inteira. */}
              <Route path="/legal/*" element={<LegalCatchAll />} />
              <Route path="/fmm" element={<FmmPlans />} />
              <Route path="/fmm-activated" element={<FmmActivated />} />
              <Route path="/my-keys" element={<MyKeys />} />
              <Route path="/my-orders" element={<MyOrders />} />
              <Route path="/fmm-admin" element={<FmmAdmin />} />
              <Route path="/notes" element={<Notes />} />
              <Route path="/password-generator" element={<PasswordGenerator />} />
              <Route path="/about" element={<About />} />
              <Route path="/tools" element={<Tools />} />
            </Routes>
          </Layout>
        </Router>
        </NotesProvider>
      </AuthProvider>
    </LanguageProvider>
  );
}

export default App;
