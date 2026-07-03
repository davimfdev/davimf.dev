import { describe, expect, it, vi } from 'vitest';
import { patchGuildConfig } from '../guildConfig';
import type { GuildAccess } from '../types';

const access: GuildAccess = {
  ok: true, userId: 'u1', guildId: 'g1', accessLevel: 'owner', accessVia: 'owner',
  canManageAccess: true, roleDelegationAvailable: true,
};

function deps() {
  return {
    sql: vi.fn().mockResolvedValue([]),
    getChannel: vi.fn().mockResolvedValue({ channelId: 'c1', type: 'TEXT', botCanView: true, botCanSend: true }),
    getRole: vi.fn().mockResolvedValue({ roleId: 'r1', botCanAssign: true }),
    getSnapshotUpdatedAt: vi.fn().mockResolvedValue(new Date()),
    audit: vi.fn().mockResolvedValue(undefined),
  };
}

describe('guild config patches', () => {
  it('rejects unknown keys instead of silently dropping them', async () => {
    await expect(patchGuildConfig(access, { column: 'channels', set: { unknown: 'c1' }, remove: [] }, deps() as never))
      .rejects.toMatchObject({ code: 'UNKNOWN_KEY', status: 422 });
  });

  it('merges a channel patch and writes audit', async () => {
    const d = deps();
    await patchGuildConfig(access, { column: 'channels', set: { 'log-mensagens': 'c1' }, remove: [] }, d as never);
    expect(d.sql).toHaveBeenCalledOnce();
    expect(d.audit).toHaveBeenCalledWith(expect.objectContaining({ targetGuildId: 'g1', result: 'success' }));
  });

  it('blocks resource writes with stale snapshots', async () => {
    const d = deps();
    d.getSnapshotUpdatedAt.mockResolvedValue(new Date(Date.now() - 16 * 60_000));
    await expect(patchGuildConfig(access, { column: 'roles', set: { staff: 'r1' }, remove: [] }, d as never))
      .rejects.toMatchObject({ code: 'SNAPSHOT_STALE', status: 409 });
  });

  it('never accepts dashboard_access through the generic patch', async () => {
    await expect(patchGuildConfig(access, { column: 'dashboard_access' as never, set: {}, remove: [] }, deps() as never))
      .rejects.toMatchObject({ code: 'COLUMN_FORBIDDEN', status: 422 });
  });
});
