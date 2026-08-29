import React from 'react';
import { ScrollText } from 'lucide-react';
import { useParams } from 'react-router-dom';
import LegalPage from '../components/LegalPage';
import LegalVersionNotFound from '../components/LegalVersionNotFound';
import { useLanguage } from '../context/LanguageContext';
import { legalVersion } from '../content/legal';

const TermsOfService: React.FC = () => {
  const { language, legal: current } = useLanguage();
  const { version } = useParams<{ version?: string }>();

  const content = version ? legalVersion(version)?.[language] : current;
  if (!content) return <LegalVersionNotFound version={version ?? ''} currentPath="/terms-of-service" icon={ScrollText} />;

  return <LegalPage document={content.terms} icon={ScrollText} />;
};

export default TermsOfService;
