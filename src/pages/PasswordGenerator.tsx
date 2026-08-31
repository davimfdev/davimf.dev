import { useEffect, useState, useCallback } from 'react';
import { RefreshCw, Copy, Check, Eye, EyeOff, Trash2 } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import {
  usePasswordGeneratorStorage,
  type HistoryKind,
} from '../hooks/usePasswordGeneratorStorage';
import {
  generateRandomPassword,
  generateWordsPassword,
  generatePassphrase,
} from '../utils/passwordGenerator';

// Colorize digits/symbols differently from letters (Bitwarden-style readout).
function ColoredValue({ value }: { value: string }) {
  return (
    <span className="break-all font-mono text-lg">
      {value.split('').map((ch, i) => {
        let cls = 'text-fg';
        if (/[0-9]/.test(ch)) cls = 'text-accent';
        else if (/[^a-zA-Z0-9]/.test(ch)) cls = 'text-danger';
        return (
          <span key={i} className={cls}>
            {ch}
          </span>
        );
      })}
    </span>
  );
}

const PasswordGenerator = () => {
  const { translations: t } = useLanguage();
  const { config, setConfig, history, addToHistory, clearHistory } =
    usePasswordGeneratorStorage();

  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [revealed, setRevealed] = useState<Record<number, boolean>>({});

  const generate = useCallback((): { value: string; kind: HistoryKind } | null => {
    setError('');
    try {
      if (config.tab === 'passphrase') {
        const v = generatePassphrase(config.passphrase);
        return { value: v, kind: 'passphrase' };
      }
      if (config.passwordMode === 'words') {
        const v = generateWordsPassword(config.words);
        return { value: v, kind: 'words' };
      }
      const v = generateRandomPassword({
        length: config.random.length,
        enabled: {
          upper: config.random.upper,
          lower: config.random.lower,
          digits: config.random.digits,
          symbols: config.random.symbols,
        },
        minDigits: config.random.minDigits,
        minSymbols: config.random.minSymbols,
      });
      return { value: v, kind: 'random' };
    } catch (e) {
      const msg = (e as Error).message;
      if (msg === 'NO_CHARSET') setError(t.pwgenNoCharset);
      else if (msg === 'MIN_EXCEEDS_LENGTH') setError(t.pwgenMinError);
      else setError(msg);
      return null;
    }
  }, [config, t]);

  const regenerate = useCallback(() => {
    const result = generate();
    if (result) {
      setValue(result.value);
      addToHistory(result.value, result.kind);
    } else {
      setValue('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [generate]);

  // Regenerate whenever the relevant config changes.
  useEffect(() => {
    regenerate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config]);

  const copy = async (text: string) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard blocked; ignore silently
    }
  };

  const updateRandom = (patch: Partial<typeof config.random>) =>
    setConfig({ ...config, random: { ...config.random, ...patch } });
  const updateWords = (patch: Partial<typeof config.words>) =>
    setConfig({ ...config, words: { ...config.words, ...patch } });
  const updatePassphrase = (patch: Partial<typeof config.passphrase>) =>
    setConfig({ ...config, passphrase: { ...config.passphrase, ...patch } });

  const card = 'bg-surface-2/60 border border-line rounded-xl p-4';
  const label = 'text-sm text-fg-muted';
  const input =
    'bg-surface-1 border border-line rounded-lg px-3 py-2 text-fg w-full';

  return (
    <div className="min-h-screen pt-24 pb-16 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-fg">{t.pwgenTitle}</h1>
          <p className="text-fg-muted mt-1">{t.pwgenSubtitle}</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2">
          {(['password', 'passphrase'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setConfig({ ...config, tab })}
              className={`flex-1 py-2 rounded-lg font-medium transition ${
                config.tab === tab
                  ? 'bg-accent text-bg'
                  : 'bg-surface-2 text-fg-muted hover:bg-surface-3'
              }`}
            >
              {tab === 'password' ? t.pwgenTabPassword : t.pwgenTabPassphrase}
            </button>
          ))}
        </div>

        {/* Output card */}
        <div className={`${card} flex items-center justify-between gap-3`}>
          <div className="min-h-[28px] flex-1">
            {value ? <ColoredValue value={value} /> : <span className="text-fg-muted">—</span>}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={regenerate} title={t.pwgenRegenerate} className="p-2 hover:bg-surface-3 rounded-lg">
              <RefreshCw size={18} className="text-fg" />
            </button>
            <button onClick={() => copy(value)} title={t.pwgenCopy} className="p-2 hover:bg-surface-3 rounded-lg">
              {copied ? <Check size={18} className="text-ok" /> : <Copy size={18} className="text-fg" />}
            </button>
          </div>
        </div>
        {error && <p className="text-danger text-sm">{error}</p>}

        {/* Options */}
        <div className={`${card} space-y-4`}>
          <h2 className="text-lg font-semibold text-fg">{t.pwgenOptions}</h2>

          {config.tab === 'password' && (
            <>
              {/* sub-mode */}
              <div className="flex gap-2">
                {(['random', 'words'] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setConfig({ ...config, passwordMode: m })}
                    className={`flex-1 py-1.5 rounded-lg text-sm ${
                      config.passwordMode === m
                        ? 'bg-accent text-bg'
                        : 'bg-surface-1 text-fg-muted hover:bg-surface-3'
                    }`}
                  >
                    {m === 'random' ? t.pwgenModeRandom : t.pwgenModeWords}
                  </button>
                ))}
              </div>

              {config.passwordMode === 'random' && (
                <div className="space-y-3">
                  <div>
                    <label className={label}>{t.pwgenLength}</label>
                    <input
                      type="number"
                      min={5}
                      max={128}
                      value={config.random.length}
                      onChange={(e) =>
                        updateRandom({
                          length: Math.max(5, Math.min(128, Number(e.target.value) || 5)),
                        })
                      }
                      className={input}
                    />
                    <p className="text-xs text-fg-muted mt-1">{t.pwgenLengthHint}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {([
                      ['upper', t.pwgenUppercase],
                      ['lower', t.pwgenLowercase],
                      ['digits', t.pwgenNumbers],
                      ['symbols', t.pwgenSymbols],
                    ] as const).map(([key, lbl]) => (
                      <label key={key} className="flex items-center gap-2 text-fg">
                        <input
                          type="checkbox"
                          checked={config.random[key]}
                          onChange={(e) => updateRandom({ [key]: e.target.checked } as never)}
                        />
                        {lbl}
                      </label>
                    ))}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={label}>{t.pwgenMinNumbers}</label>
                      <input
                        type="number"
                        min={0}
                        max={config.random.length}
                        value={config.random.minDigits}
                        onChange={(e) => updateRandom({ minDigits: Math.max(0, Number(e.target.value) || 0) })}
                        className={input}
                      />
                    </div>
                    <div>
                      <label className={label}>{t.pwgenMinSymbols}</label>
                      <input
                        type="number"
                        min={0}
                        max={config.random.length}
                        value={config.random.minSymbols}
                        onChange={(e) => updateRandom({ minSymbols: Math.max(0, Number(e.target.value) || 0) })}
                        className={input}
                      />
                    </div>
                  </div>
                </div>
              )}

              {config.passwordMode === 'words' && (
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className={label}>{t.pwgenWordCount}</label>
                    <input
                      type="number"
                      min={2}
                      max={5}
                      value={config.words.wordCount}
                      onChange={(e) => updateWords({ wordCount: Math.max(2, Math.min(5, Number(e.target.value) || 2)) })}
                      className={input}
                    />
                  </div>
                  <div>
                    <label className={label}>{t.pwgenMinNumbers}</label>
                    <input
                      type="number"
                      min={0}
                      max={8}
                      value={config.words.minDigits}
                      onChange={(e) => updateWords({ minDigits: Math.max(0, Number(e.target.value) || 0) })}
                      className={input}
                    />
                  </div>
                  <div>
                    <label className={label}>{t.pwgenMinSymbols}</label>
                    <input
                      type="number"
                      min={0}
                      max={8}
                      value={config.words.minSymbols}
                      onChange={(e) => updateWords({ minSymbols: Math.max(0, Number(e.target.value) || 0) })}
                      className={input}
                    />
                  </div>
                </div>
              )}
            </>
          )}

          {config.tab === 'passphrase' && (
            <div className="space-y-3">
              <div>
                <label className={label}>{t.pwgenWordCount}</label>
                <input
                  type="number"
                  min={3}
                  max={10}
                  value={config.passphrase.wordCount}
                  onChange={(e) =>
                    updatePassphrase({ wordCount: Math.max(3, Math.min(10, Number(e.target.value) || 3)) })
                  }
                  className={input}
                />
              </div>
              <div>
                <label className={label}>{t.pwgenSeparator}</label>
                <select
                  value={config.passphrase.separator}
                  onChange={(e) => updatePassphrase({ separator: e.target.value as never })}
                  className={input}
                >
                  <option value="-">{t.pwgenSepDash}</option>
                  <option value=".">{t.pwgenSepDot}</option>
                  <option value="_">{t.pwgenSepUnderscore}</option>
                  <option value=" ">{t.pwgenSepSpace}</option>
                  <option value="">{t.pwgenSepNone}</option>
                </select>
              </div>
              <label className="flex items-center gap-2 text-fg">
                <input
                  type="checkbox"
                  checked={config.passphrase.capitalize}
                  onChange={(e) => updatePassphrase({ capitalize: e.target.checked })}
                />
                {t.pwgenCapitalize}
              </label>
              <label className="flex items-center gap-2 text-fg">
                <input
                  type="checkbox"
                  checked={config.passphrase.includeNumber}
                  onChange={(e) => updatePassphrase({ includeNumber: e.target.checked })}
                />
                {t.pwgenIncludeNumber}
              </label>
            </div>
          )}
        </div>

        {/* History */}
        <div className={`${card} space-y-3`}>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-fg">{t.pwgenHistory}</h2>
            {history.length > 0 && (
              <button
                onClick={clearHistory}
                className="flex items-center gap-1 text-sm text-danger hover:text-danger"
              >
                <Trash2 size={16} /> {t.pwgenClearHistory}
              </button>
            )}
          </div>
          {history.length === 0 ? (
            <p className="text-fg-muted text-sm">{t.pwgenHistoryEmpty}</p>
          ) : (
            <ul className="space-y-2">
              {history.map((entry, i) => (
                <li key={entry.createdAt + '-' + i} className="flex items-center justify-between gap-2 bg-surface-1 rounded-lg px-3 py-2">
                  <span className="font-mono text-sm text-fg break-all">
                    {revealed[i] ? entry.value : '•'.repeat(Math.min(entry.value.length, 16))}
                  </span>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => setRevealed((r) => ({ ...r, [i]: !r[i] }))}
                      title={revealed[i] ? t.pwgenHide : t.pwgenShow}
                      className="p-1.5 hover:bg-surface-3 rounded"
                    >
                      {revealed[i] ? <EyeOff size={16} className="text-fg-muted" /> : <Eye size={16} className="text-fg-muted" />}
                    </button>
                    <button onClick={() => copy(entry.value)} title={t.pwgenCopy} className="p-1.5 hover:bg-surface-3 rounded">
                      <Copy size={16} className="text-fg-muted" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

export default PasswordGenerator;
