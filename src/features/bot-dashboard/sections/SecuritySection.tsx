import { ConfigMapEditor } from '../ConfigMapEditor';
import { useDashboardContext } from '../dashboardContext';
import { toggleFields } from './fields';

export function SecuritySection() {
  const { configMap, saveMap } = useDashboardContext();
  return <ConfigMapEditor title="Módulos e proteções" column="toggles" values={configMap('toggles')} fields={toggleFields} onSave={saveMap} />;
}
