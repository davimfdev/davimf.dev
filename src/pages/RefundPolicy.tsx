import React from 'react';
import { Undo2 } from 'lucide-react';
import { useParams } from 'react-router-dom';
import LegalPage from '../components/LegalPage';
import LegalVersionNotFound from '../components/LegalVersionNotFound';
import { useLanguage } from '../context/LanguageContext';
import { legalVersion } from '../content/legal';

const RefundPolicy: React.FC = () => {
  const { language, legal: current } = useLanguage();
  const { version } = useParams<{ version?: string }>();

  const content = version ? legalVersion(version)?.[language] : current;
  if (!content) return <LegalVersionNotFound version={version ?? ''} currentPath="/refund-policy" icon={Undo2} />;

  return <LegalPage document={content.refund} icon={Undo2} />;
};

export default RefundPolicy;
