import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
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
  const [pos, setPos] = useState<{ top: number; left: number; width: number }>({ top: 0, left: 0, width: 0 });
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => filterOptions(options, query), [options, query]);
  const selected = options.find((option) => option.value === value) ?? null;
  const listId = `${id}-listbox`;

  const updatePosition = () => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) setPos({ top: rect.bottom + 6, left: rect.left, width: rect.width });
  };

  const openMenu = () => { updatePosition(); setQuery(''); setActiveIndex(0); setOpen(true); };
  const closeMenu = () => { setOpen(false); triggerRef.current?.focus(); };

  useEffect(() => { if (open) inputRef.current?.focus(); }, [open]);

  // The popover is portalled to document.body (so it escapes the card's
  // overflow:hidden clipping), positioned via fixed coords from the trigger.
  useEffect(() => {
    if (!open) return;
    const onDocDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || popoverRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onReflow = () => updatePosition();
    document.addEventListener('mousedown', onDocDown);
    window.addEventListener('scroll', onReflow, true);
    window.addEventListener('resize', onReflow);
    return () => {
      document.removeEventListener('mousedown', onDocDown);
      window.removeEventListener('scroll', onReflow, true);
      window.removeEventListener('resize', onReflow);
    };
  }, [open]);

  const choose = (option: SelectOption) => { onChange(option.value); closeMenu(); };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') { event.preventDefault(); closeMenu(); return; }
    if (event.key === 'ArrowDown') { event.preventDefault(); setActiveIndex((i) => Math.min(i + 1, filtered.length - 1)); }
    else if (event.key === 'ArrowUp') { event.preventDefault(); setActiveIndex((i) => Math.max(i - 1, 0)); }
    else if (event.key === 'Enter') { event.preventDefault(); const option = filtered[activeIndex]; if (option) choose(option); }
  };

  return (
    <div className="bd-select" ref={rootRef}>
      <button type="button" id={id} ref={triggerRef} className="bd-select-trigger" disabled={disabled}
        aria-haspopup="listbox" aria-expanded={open} aria-controls={listId}
        onClick={() => (open ? closeMenu() : openMenu())}>
        <span className="bd-select-value">
          {selected
            ? (selected.role ? <RoleChip role={selected.role} /> : selected.label)
            : <span className="bd-select-placeholder">{placeholder}</span>}
        </span>
        <span className="bd-select-caret" aria-hidden>▾</span>
      </button>
      {open && createPortal(
        <div ref={popoverRef} className="bd-select-popover" onKeyDown={onKeyDown}
          style={{ position: 'fixed', top: pos.top, left: pos.left, width: pos.width }}>
          <input ref={inputRef} type="search" className="bd-select-filter" placeholder="Filtrar…"
            aria-label="Filtrar opções" role="combobox" aria-expanded={true} aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={filtered[activeIndex] ? `${id}-opt-${activeIndex}` : undefined}
            value={query} onChange={(event) => { setQuery(event.target.value); setActiveIndex(0); }} />
          <ul className="bd-select-list" role="listbox" id={listId}>
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
        </div>,
        document.body,
      )}
    </div>
  );
}
