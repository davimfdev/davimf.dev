import { Overview } from '../Overview';
import { useDashboardContext } from '../dashboardContext';

export function OverviewSection() {
  const { data } = useDashboardContext();
  return <Overview health={data.health} accessLevel={data.guild.accessLevel} />;
}
