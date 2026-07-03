import { describe, expect, it, vi } from 'vitest';
import { COLLECTION_TABLES, disableCollectionItem, listCollection } from '../collections';
import type { GuildAccess } from '../types';

const access: GuildAccess = {
  ok: true, userId: 'u1', guildId: 'g1', accessLevel: 'owner', accessVia: 'owner',
  canManageAccess: true, roleDelegationAvailable: true,
};

describe('guild-scoped collections', () => {
  it('uses the table names from the applied BaseBot migration', () => {
    expect(COLLECTION_TABLES).toMatchObject({
      'self-roles': 'self_role_panels', quiz: 'quiz_questions', 'action-types': 'fac_action_types',
    });
  });

  it('scopes list queries by guild id', async () => {
    const sql = vi.fn().mockResolvedValue([{ id: 'item-1' }]);
    await listCollection('shop-items', access, sql as never);
    expect(JSON.stringify(sql.mock.calls[0])).toContain('g1');
  });

  it.each(['shop-items', 'self-roles'] as const)('soft deletes %s by guild and resource id', async (collection) => {
    const sql = vi.fn().mockResolvedValue([{ id: 'item-1' }]);
    await disableCollectionItem(collection, access, 'item-1', sql as never);
    const call = JSON.stringify(sql.mock.calls[0]);
    expect(call).toContain('enabled = false');
    expect(call).toContain('g1');
    expect(call).toContain('item-1');
  });
});
