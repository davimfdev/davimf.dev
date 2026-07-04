import { ConfigMapEditor } from '../ConfigMapEditor';
import { useDashboardContext } from '../dashboardContext';
import { channelFields } from './fields';

export function ChannelsSection() {
  const { configMap, channels, saveMap } = useDashboardContext();
  return <ConfigMapEditor title="Canais e logs" column="channels" values={configMap('channels')} fields={channelFields} channels={channels} onSave={saveMap} />;
}
