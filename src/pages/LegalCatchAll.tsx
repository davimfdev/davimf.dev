import React from 'react';
import { FileQuestion } from 'lucide-react';
import { useParams } from 'react-router-dom';
import LegalVersionNotFound from '../components/LegalVersionNotFound';

/**
 * Rota de captura para qualquer caminho sob /legal/ que não bata com as três
 * rotas versionadas específicas — por exemplo um segmento de versão vazio,
 * como em "/legal//terms-of-service". Sem isso o React Router não casa
 * nenhuma rota e o visitante vê uma página em branco: sem afirmar um
 * contrato falso, mas também sem dizer nada.
 *
 * Escopo restrito a /legal/* de propósito: não é um catch-all da aplicação
 * inteira, então não muda o comportamento de 404 de nenhuma outra rota.
 */
const LegalCatchAll: React.FC = () => {
  const params = useParams<{ '*': string }>();
  const raw = params['*'] ?? '';
  const version = raw.replace(/^\/+/, '').split('/')[0] ?? '';

  return <LegalVersionNotFound version={version} icon={FileQuestion} />;
};

export default LegalCatchAll;
