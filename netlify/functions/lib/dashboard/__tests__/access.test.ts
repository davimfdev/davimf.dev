import { describe, expect, it, vi } from 'vitest';
import { getDashboardAccessView, updateDashboardAccess } from '../access';
import type { GuildAccess } from '../types';

const owner: GuildAccess = {
  ok: true, userId: 'owner', guildId: 'g1', accessLevel: 'owner', accessVia: 'owner',
  canManageAccess: true, roleDelegationAvailable: true,
};
const delegate: GuildAccess = {
  ...owner, userId: 'delegate', accessLevel: 'delegate', accessVia: 'user', canManageAccess: false,
};

describe('dashboard access management', () => {
  it('never exposes the access map to delegates', async () => {
    const sql = vi.fn().mockResolvedValue([{ dashboard_access: { users: ['admin'], roles: ['staff'] } }]);
    await expect(getDashboardAccessView(delegate, sql as never)).resolves.toEqual({
      currentUserAccess: { level: 'delegate', via: 'user' },
    });
  });

  it('rejects delegated writes', async () => {
    await expect(updateDashboardAccess(delegate, { users: [], roles: [] }, { sql: vi.fn() } as never))
      .rejects.toMatchObject({ code: 'ACCESS_MANAGEMENT_FORBIDDEN', status: 403 });
  });

  it('normalizes owner updates and writes audit', async () => {
    const deps = {
      sql: vi.fn().mockResolvedValueOnce([{ dashboard_access: { users: ['111111111111111111'], roles: [] } }]).mockResolvedValueOnce([]),
      validateRoleIds: vi.fn().mockResolvedValue(undefined), audit: vi.fn(),
    };
    await updateDashboardAccess(owner, {
      users: ['956985471332937778', '956985471332937778', '344214477069221888'],
      roles: ['123456789012345678'],
    }, deps as never);
    expect(deps.validateRoleIds).toHaveBeenCalledWith('g1', ['123456789012345678']);
    expect(deps.audit).toHaveBeenCalledWith(expect.objectContaining({
      result: 'success',
      changeSummary: {
        before: { users: ['111111111111111111'], roles: [] },
        after: {
          users: ['344214477069221888', '956985471332937778'],
          roles: ['123456789012345678'],
        },
      },
    }));
  });
});
