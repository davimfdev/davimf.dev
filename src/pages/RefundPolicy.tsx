import React from 'react';
import { Undo2 } from 'lucide-react';
import LegalPage from '../components/LegalPage';
import { useLanguage } from '../context/LanguageContext';

const RefundPolicy: React.FC = () => {
  const { legal } = useLanguage();
  return <LegalPage document={legal.refund} icon={Undo2} />;
};

export default RefundPolicy;
