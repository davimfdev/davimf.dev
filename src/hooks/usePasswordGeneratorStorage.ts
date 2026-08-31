import { useEffect, useState } from 'react';

export type Tab = 'password' | 'passphrase';
export type PasswordMode = 'random' | 'words';
export type HistoryKind = 'random' | 'words' | 'passphrase';

export interface GeneratorConfig {
  tab: Tab;
  passwordMode: PasswordMode;
  random: {
    length: number;
    upper: boolean;
    lower: boolean;
    digits: boolean;
    symbols: boolean;
    minDigits: number;
    minSymbols: number;
  };
  words: {
    wordCount: number;
    digitCount: number;
    symbolStyle: 'none' | 'separator' | 'wrapped';
    mixedCase: boolean;
  };
  passphrase: {
    wordCount: number;
    separator: '-' | '.' | '_' | ' ' | '';
    capitalize: boolean;
    includeNumber: boolean;
  };
}

export interface HistoryEntry {
  value: string;
  kind: HistoryKind;
  createdAt: number;
}

const CONFIG_KEY = 'pwgen:config';
const HISTORY_KEY = 'pwgen:history';
const HISTORY_LIMIT = 20;

export const DEFAULT_CONFIG: GeneratorConfig = {
  tab: 'password',
  passwordMode: 'random',
  random: {
    length: 18,
    upper: true,
    lower: true,
    digits: true,
    symbols: true,
    minDigits: 1,
    minSymbols: 1,
  },
  words: { wordCount: 4, digitCount: 4, symbolStyle: 'wrapped', mixedCase: false },
  passphrase: { wordCount: 5, separator: '-', capitalize: true, includeNumber: true },
};

function loadConfig(): GeneratorConfig {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    if (!raw) return DEFAULT_CONFIG;
    const parsed = JSON.parse(raw);
    // shallow-merge so new fields fall back to defaults
    return {
      ...DEFAULT_CONFIG,
      ...parsed,
      random: { ...DEFAULT_CONFIG.random, ...parsed.random },
      words: { ...DEFAULT_CONFIG.words, ...parsed.words },
      passphrase: { ...DEFAULT_CONFIG.passphrase, ...parsed.passphrase },
    };
  } catch {
    return DEFAULT_CONFIG;
  }
}

function loadHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? (JSON.parse(raw) as HistoryEntry[]) : [];
  } catch {
    return [];
  }
}

export function usePasswordGeneratorStorage() {
  const [config, setConfig] = useState<GeneratorConfig>(loadConfig);
  const [history, setHistory] = useState<HistoryEntry[]>(loadHistory);

  useEffect(() => {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
  }, [config]);

  useEffect(() => {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  }, [history]);

  const addToHistory = (value: string, kind: HistoryKind) => {
    setHistory((prev) => [{ value, kind, createdAt: Date.now() }, ...prev].slice(0, HISTORY_LIMIT));
  };

  const clearHistory = () => setHistory([]);

  return { config, setConfig, history, addToHistory, clearHistory };
}
