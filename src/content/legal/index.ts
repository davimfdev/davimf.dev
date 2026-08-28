import { legalEn } from './en';
import { legalPt } from './pt';
import type { LegalContent } from './types';

export type { LegalContent, LegalDocument, LegalSection } from './types';

/** Mesmos idiomas do `LanguageContext`; a chave é a mesma `Language`. */
export const legal: Record<'pt' | 'en', LegalContent> = {
  pt: legalPt,
  en: legalEn,
};
