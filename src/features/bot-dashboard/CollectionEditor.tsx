import { useState, type FormEvent } from 'react';
import type { ConfigField } from './ConfigMapEditor';

export function CollectionEditor({ title, collection, items, fields, onCreate, onUpdate, onDelete }: {
  title: string;
  collection: string;
  items: Array<Record<string, unknown>>;
  fields: ConfigField[];
  onCreate: (data: Record<string, unknown>) => Promise<unknown>;
  onUpdate: (resourceId: string, data: Record<string, unknown>) => Promise<unknown>;
  onDelete?: (resourceId: string) => Promise<unknown>;
}) {
  const empty = Object.fromEntries(fields.map((field) => [field.key, field.kind === 'boolean' ? false : field.kind === 'number' ? 0 : '']));
  const [draft, setDraft] = useState<Record<string, unknown>>(empty);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const submit = async (event: FormEvent) => { event.preventDefault(); setBusy('new'); setMessage(''); try { await onCreate(draft); setDraft(empty); setMessage('Item criado.'); } catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível criar.'); } finally { setBusy(''); } };

  const control = (field: ConfigField) => <label className="bd-field" key={field.key}><span>{field.label}</span>{field.kind === 'boolean'
    ? <input type="checkbox" checked={Boolean(draft[field.key])} onChange={(event) => setDraft((current) => ({ ...current, [field.key]: event.target.checked }))} />
    : <input type={field.kind === 'number' ? 'number' : 'text'} value={String(draft[field.key] ?? '')} onChange={(event) => setDraft((current) => ({ ...current, [field.key]: field.kind === 'number' ? Number(event.target.value) : event.target.value }))} />}</label>;

  return <section className="bd-editor bd-collection" data-collection={collection}><header><div><p>Coleção</p><h2>{title}</h2></div><span>{items.length} itens</span></header>
    <div className="bd-collection-list">{items.length === 0 ? <p className="bd-empty">Nenhum item cadastrado.</p> : items.map((item, index) => {
      const resourceId = String(item.id ?? item.level ?? index);
      const label = String(item.name ?? item.title ?? item.label ?? resourceId);
      return <CollectionItem key={resourceId} resourceId={resourceId} label={label} item={item} fields={fields} busy={Boolean(busy)} onSave={async (data) => { setBusy(resourceId); try { await onUpdate(resourceId, data); setMessage('Item atualizado.'); } finally { setBusy(''); } }} onDelete={onDelete ? async () => { setBusy(resourceId); try { await onDelete(resourceId); setMessage('Item desativado.'); } finally { setBusy(''); } } : undefined} />;
    })}</div>
    <form onSubmit={submit}><h3>Novo item</h3><div className="bd-editor-grid">{fields.map(control)}</div><footer><span role="status">{message}</span><button type="submit" disabled={Boolean(busy)}>{busy === 'new' ? 'Criando…' : 'Adicionar item'}</button></footer></form>
  </section>;
}

function CollectionItem({ resourceId, label, item, fields, busy, onSave, onDelete }: { resourceId: string; label: string; item: Record<string, unknown>; fields: ConfigField[]; busy: boolean; onSave: (data: Record<string, unknown>) => Promise<void>; onDelete?: () => Promise<void> }) {
  const [draft, setDraft] = useState(item);
  return <article className="bd-collection-item"><div className="bd-item-heading"><strong>{label}</strong><small>{resourceId}</small></div><div className="bd-item-fields">{fields.map((field) => <label className="bd-field" key={field.key}><span>{field.label}</span>{field.kind === 'boolean' ? <input type="checkbox" checked={Boolean(draft[field.key])} onChange={(event) => setDraft((current) => ({ ...current, [field.key]: event.target.checked }))} /> : <input type={field.kind === 'number' ? 'number' : 'text'} value={String(draft[field.key] ?? '')} onChange={(event) => setDraft((current) => ({ ...current, [field.key]: field.kind === 'number' ? Number(event.target.value) : event.target.value }))} />}</label>)}</div><div className="bd-item-actions"><button type="button" disabled={busy} onClick={() => void onSave(draft)}>Salvar</button>{onDelete && <button className="is-danger" type="button" disabled={busy} onClick={() => void onDelete()}>Desativar</button>}</div></article>;
}
