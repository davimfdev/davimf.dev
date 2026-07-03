import { describe, expect, it, vi } from 'vitest';
import { sanitizeAuditValue, writeAudit } from '../audit';

describe('dashboard audit', () => {
  it('redacts secrets recursively', () => {
    expect(sanitizeAuditValue({ token: 'secret', nested: { password: 'hidden', value: 3 } })).toEqual({
      token: '[REDACTED]', nested: { password: '[REDACTED]', value: 3 },
    });
  });

  it('writes actor, access level, guild and safe change summary', async () => {
    const sql = vi.fn().mockResolvedValue([]);
    await writeAudit({
      actorUserId: 'u1', accessLevel: 'support', targetGuildId: 'g1', method: 'PATCH',
      route: '/api/bot-config-patch', operation: 'patch', resourceType: 'guild_config',
      changeSummary: { authorization: 'secret', set: { 'sec:verify': true } }, result: 'success',
    }, sql as never);
    expect(sql).toHaveBeenCalledOnce();
    expect(JSON.stringify(sql.mock.calls[0])).not.toContain('secret');
  });
});
