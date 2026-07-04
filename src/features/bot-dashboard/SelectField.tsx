import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { RoleChip } from './RoleChip';
import type { RoleOption } from './types';

export type SelectOption = { value: string; label: string; role?: RoleOption };

export function filterOptions(options: SelectOption[], query: string): SelectOption[] {
  const q = query.trim().toLowerCase();
  if (!q) return options;
  return options.filter((option) => option.label.toLowerCase().includes(q));
}

export function SelectField({ id, value, options, placeholder = 'Não definido', disabled = false, onChange }: {
  id: string;
  value: string;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => filterOptions(options, query), [options, query]);
  const selected = options.find((option) => option.value === value) ?? null;
  const listId = `${id}-listbox`;

  useEffect(() => {
    if (!open) return;
    const onDocClick = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  useEffect(() => {
    if (open) { setQuery(''); setActiveIndex(0); inputRef.current?.focus(); }
  }, [open]);

  const choose = (option: SelectOption) => { onChange(option.value); setOpen(false); };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') { setOpen(false); return; }
    if (event.key === 'ArrowDown') { event.preventDefault(); setActiveIndex((i) => Math.min(i + 1, filtered.length - 1)); }
    else if (event.key === 'ArrowUp') { event.preventDefault(); setActiveIndex((i) => Math.max(i - 1, 0)); }
    else if (event.key === 'Enter' && open) { event.preventDefault(); const option = filtered[activeIndex]; if (option) choose(option); }
  };

  return (
    <div className="bd-select" ref={rootRef} onKeyDown={onKeyDown}>
      <button type="button" id={id} className="bd-select-trigger" disabled={disabled}
        aria-haspopup="listbox" aria-expanded={open} aria-controls={listId}
        onClick={() => setOpen((v) => !v)}>
        <span className="bd-select-value">
          {selected
            ? (selected.role ? <RoleChip role={selected.role} /> : selected.label)
            : <span className="bd-select-placeholder">{placeholder}</span>}
        </span>
        <span className="bd-select-caret" aria-hidden>▾</span>
      </button>
      {open && (
        <div className="bd-select-popover">
          <input ref={inputRef} type="search" className="bd-select-filter" placeholder="Filtrar…"
            value={query} onChange={(event) => { setQuery(event.target.value); setActiveIndex(0); }} />
          <ul className="bd-select-list" role="listbox" id={listId}
            aria-activedescendant={filtered[activeIndex] ? `${id}-opt-${activeIndex}` : undefined}>
            {filtered.length === 0 && <li className="bd-select-empty">Nada encontrado</li>}
            {filtered.map((option, index) => (
              <li key={option.value || '__none'} id={`${id}-opt-${index}`} role="option"
                aria-selected={option.value === value}
                className={`bd-select-option${index === activeIndex ? ' is-active' : ''}${option.value === value ? ' is-selected' : ''}`}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => choose(option)}>
                {option.role ? <RoleChip role={option.role} /> : option.label}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
