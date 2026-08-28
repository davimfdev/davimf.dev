import React from 'react';
import { ScrollText } from 'lucide-react';
import LegalPage from '../components/LegalPage';
import { useLanguage } from '../context/LanguageContext';

const TermsOfService: React.FC = () => {
  const { legal } = useLanguage();
  return <LegalPage document={legal.terms} icon={ScrollText} />;
};

export default TermsOfService;
