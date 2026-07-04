import { ConfigMapEditor } from '../ConfigMapEditor';
import { useDashboardContext } from '../dashboardContext';
import { settingFields } from './fields';

export function ModerationSection() {
  const { configMap, channels, roles, saveMap } = useDashboardContext();
  return <ConfigMapEditor title="Preferências gerais" column="settings" values={configMap('settings')} fields={settingFields} channels={channels} roles={roles} onSave={saveMap} />;
}
