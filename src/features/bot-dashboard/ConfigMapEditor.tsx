import { useState, type FormEvent } from 'react';
import { SelectField, type SelectOption } from './SelectField';
import type { RoleOption } from './types';

export type ConfigField = {
  key: string;
  label: string;
  kind: 'channel' | 'role' | 'boolean' | 'number' | 'string' | 'string[]';
  description?: string;
  options?: Array<{ value: string; label: string }>;
};

type SnapshotOption = { id: string; name: string };

export function ConfigMapEditor({ title, column, values, fields, channels = [], roles = [], disabled = false, onSave }: {
  title: string;
  column: 'channels' | 'roles' | 'toggles' | 'settings';
  values: Record<string, unknown>;
  fields: ConfigField[];
  channels?: SnapshotOption[];
  roles?: RoleOption[];
  disabled?: boolean;
  onSave: (column: 'channels' | 'roles' | 'toggles' | 'settings', values: Record<string, unknown>) => Promise<unknown>;
}) {
  const [draft, setDraft] = useState(values);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const setValue = (key: string, value: unknown) => setDraft((current) => ({ ...current, [key]: value }));
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setSaving(true); setMessage('');
    try { await onSave(column, draft); setMessage('Alterações salvas.'); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível salvar.'); }
    finally { setSaving(false); }
  };

  return <section className="bd-editor" aria-labelledby={`editor-${column}`}>
    <header><div><p>Configuração</p><h2 id={`editor-${column}`}>{title}</h2></div><span>{fields.length} campos</span></header>
    <form onSubmit={submit}>
      <div className="bd-editor-grid">{fields.map((field) => {
        const id = `${column}-${field.key}`;
        const value = draft[field.key];
        if (field.kind === 'boolean') return <label className="bd-toggle" key={field.key} htmlFor={id}>
          <span><strong>{field.label}</strong>{field.description && <small>{field.description}</small>}</span>
          <input id={id} type="checkbox" checked={Boolean(value)} disabled={disabled || saving} onChange={(event) => setValue(field.key, event.target.checked)} />
        </label>;
        const snapshot = field.kind === 'channel' ? channels : field.kind === 'role' ? roles : undefined;
        if (snapshot || field.options) {
          const opts: SelectOption[] = [{ value: '', label: 'Não definido' }];
          if (field.kind === 'channel') channels.forEach((c) => opts.push({ value: c.id, label: `#${c.name}` }));
          else if (field.kind === 'role') roles.forEach((r) => opts.push({ value: r.id, label: r.name, role: r }));
          field.options?.forEach((o) => opts.push({ value: o.value, label: o.label }));
          return <label className="bd-field" key={field.key}><span>{field.label}</span>{field.description && <small>{field.description}</small>}
            <SelectField id={id} value={String(value ?? '')} options={opts} disabled={disabled || saving} onChange={(next) => setValue(field.key, next)} />
          </label>;
        }
        return <label className="bd-field" key={field.key} htmlFor={id}><span>{field.label}</span>{field.description && <small>{field.description}</small>}
          {field.kind === 'string[]' ? <textarea id={id} value={Array.isArray(value) ? value.join('\n') : ''} disabled={disabled || saving} onChange={(event) => setValue(field.key, event.target.value.split('\n').map((item) => item.trim()).filter(Boolean))} />
          : <input id={id} type={field.kind === 'number' ? 'number' : 'text'} value={String(value ?? '')} disabled={disabled || saving} onChange={(event) => setValue(field.key, field.kind === 'number' ? Number(event.target.value) : event.target.value)} />}
        </label>;
      })}</div>
      <footer><span role="status">{message}</span><button type="submit" disabled={disabled || saving}>{saving ? 'Salvando…' : 'Salvar alterações'}</button></footer>
    </form>
  </section>;
}
