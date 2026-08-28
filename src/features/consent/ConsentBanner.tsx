import React, { useCallback, useEffect, useState } from 'react';
import { Cookie } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../../context/LanguageContext';
import { applyConsent, readConsent, writeConsent, type ConsentState } from './analyticsConsent';

/**
 * Aviso de cookies de análise.
 *
 * Aparece quando o estado é `unset`, e volta a aparecer quando o usuário pede
 * pelo link "Preferências de cookies" no rodapé — é assim que a revogação fica
 * tão acessível quanto o consentimento.
 *
 * As duas ações têm o MESMO peso visual de propósito: um "aceitar" destacado
 * ao lado de um "recusar" apagado transforma consentimento em obstáculo, e um
 * consentimento obtido assim não é livre.
 */
export function useConsentPreferences() {
  const [state, setState] = useState<ConsentState>('unset');
  const [reopened, setReopened] = useState(false);

  useEffect(() => {
    const stored = readConsent();
    setState(stored);
    applyConsent(stored);
  }, []);

  const decide = useCallback((choice: 'granted' | 'denied') => {
    writeConsent(choice);
    applyConsent(choice);
    setState(choice);
    setReopened(false);
  }, []);

  const reopen = useCallback(() => setReopened(true), []);

  return { visible: state === 'unset' || reopened, decide, reopen };
}

type ConsentBannerProps = {
  visible: boolean;
  onDecide: (choice: 'granted' | 'denied') => void;
};

const ConsentBanner: React.FC<ConsentBannerProps> = ({ visible, onDecide }) => {
  const { legal } = useLanguage();
  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label={legal.consent.preferencesLabel}
      className="fixed bottom-0 inset-x-0 z-50 p-4"
    >
      <div className="max-w-4xl mx-auto glass-panel border border-white/10 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center gap-4 shadow-2xl">
        <Cookie size={24} className="text-accent flex-shrink-0" aria-hidden="true" />

        <p className="text-sm text-gray-300 leading-relaxed flex-1">
          {legal.consent.message}{' '}
          <Link to="/privacy-policy" className="text-accent underline underline-offset-2">
            {legal.consent.policyLinkLabel}
          </Link>
        </p>

        <div className="flex gap-3 flex-shrink-0">
          <button
            type="button"
            onClick={() => onDecide('denied')}
            className="px-4 py-2 text-sm rounded-lg border border-white/20 text-gray-200 hover:bg-white/10 transition-colors"
          >
            {legal.consent.rejectLabel}
          </button>
          <button
            type="button"
            onClick={() => onDecide('granted')}
            className="px-4 py-2 text-sm rounded-lg border border-accent/40 bg-accent/20 text-gray-100 hover:bg-accent/30 transition-colors"
          >
            {legal.consent.acceptLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConsentBanner;
