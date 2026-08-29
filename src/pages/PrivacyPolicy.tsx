import React from 'react';
import { Shield } from 'lucide-react';
import { useParams } from 'react-router-dom';
import LegalPage from '../components/LegalPage';
import LegalVersionNotFound from '../components/LegalVersionNotFound';
import { useLanguage } from '../context/LanguageContext';
import { legalVersion } from '../content/legal';

const PrivacyPolicy: React.FC = () => {
  const { language, legal: current } = useLanguage();
  const { version } = useParams<{ version?: string }>();

  const content = version ? legalVersion(version)?.[language] : current;
  if (!content) return <LegalVersionNotFound version={version ?? ''} currentPath="/privacy-policy" icon={Shield} />;

  return <LegalPage document={content.privacy} icon={Shield} />;
};

export default PrivacyPolicy;
