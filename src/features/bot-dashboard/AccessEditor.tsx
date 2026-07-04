import { useState, type FormEvent } from 'react';
import { RoleChip } from './RoleChip';
import { SelectField } from './SelectField';
import type { RoleOption } from './types';

export function AccessEditor({ users, roles, availableRoles, canManage, onSave }: {
  users: string[];
  roles: string[];
  availableRoles: RoleOption[];
  canManage: boolean;
  onSave: (access: { users: string[]; roles: string[] }) => Promise<unknown>;
}) {
  const [userText, setUserText] = useState(users.join('\n'));
  const [selectedRoles, setSelectedRoles] = useState(roles);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  if (!canManage) return <section className="bd-editor bd-access-readonly"><h2>Acesso delegado</h2><p>Você pode configurar os recursos liberados, mas somente o proprietário ou o suporte global gerencia outros administradores.</p></section>;

  const submit = async (event: FormEvent) => {
    event.preventDefault(); setSaving(true); setMessage('');
    const normalizedUsers = [...new Set(userText.split(/[\s,]+/).map((id) => id.trim()).filter(Boolean))];
    try { await onSave({ users: normalizedUsers, roles: selectedRoles }); setMessage('Acessos atualizados.'); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível salvar.'); }
    finally { setSaving(false); }
  };

  return <section className="bd-editor" aria-labelledby="access-editor-title"><header><div><p>Governança</p><h2 id="access-editor-title">Quem pode configurar</h2></div></header>
    <form onSubmit={submit}><div className="bd-editor-grid">
      <label className="bd-field"><span>IDs de usuários</span><small>Um ID Discord por linha.</small><textarea value={userText} onChange={(event) => setUserText(event.target.value)} disabled={saving} /></label>
      <div className="bd-field">
        <span>Cargos delegados</span>
        <div className="bd-chip-row">
          {selectedRoles.length === 0 && <small>Nenhum cargo delegado.</small>}
          {selectedRoles.map((id) => {
            const role = availableRoles.find((r) => r.id === id) ?? { id, name: id };
            return <RoleChip key={id} role={role} onRemove={() => setSelectedRoles((current) => current.filter((r) => r !== id))} />;
          })}
        </div>
        <SelectField id="access-role-add" value="" placeholder="Adicionar cargo…" disabled={saving}
          options={availableRoles.filter((r) => !selectedRoles.includes(r.id)).map((r) => ({ value: r.id, label: r.name, role: r }))}
          onChange={(id) => { if (id) setSelectedRoles((current) => [...new Set([...current, id])]); }} />
      </div>
    </div><footer><span role="status">{message}</span><button type="submit" disabled={saving}>{saving ? 'Salvando…' : 'Salvar acessos'}</button></footer></form>
  </section>;
}
