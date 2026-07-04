import { ConfigMapEditor } from '../ConfigMapEditor';
import { AccessEditor } from '../AccessEditor';
import { dashboardApi } from '../api';
import { useDashboardContext } from '../dashboardContext';
import { roleFields } from './fields';

export function RolesSection() {
  const { guildId, data, configMap, roles, accessMap, setAccessMap, saveMap } = useDashboardContext();
  return (
    <>
      <ConfigMapEditor title="Cargos operacionais" column="roles" values={configMap('roles')} fields={roleFields} roles={roles} onSave={saveMap} />
      <AccessEditor users={accessMap.users} roles={accessMap.roles} availableRoles={roles} canManage={data.guild.canManageAccess}
        onSave={async (access) => { await dashboardApi.updateAccess(guildId, access.users, access.roles); setAccessMap(access); }} />
    </>
  );
}
