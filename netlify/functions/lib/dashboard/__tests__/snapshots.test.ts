import { describe, expect, it } from 'vitest';
import { buildGuildHealth, classifySnapshotAge, validateChannel, validateRole } from '../snapshots';

describe('Discord snapshots', () => {
  it.each([
    [9, 'fresh'], [12, 'stale'], [16, 'blocked'],
  ])('classifies %i minutes as %s', (minutes, expected) => {
    expect(classifySnapshotAge(new Date(Date.now() - minutes * 60_000))).toBe(expected);
  });

  it('requires view and send permission for a sending channel', () => {
    expect(validateChannel({ channelId: 'c1', type: 'TEXT', botCanView: true, botCanSend: false }, true))
      .toMatchObject({ ok: false, code: 'CHANNEL_CANNOT_SEND' });
  });

  it('rejects a voice channel for text output', () => {
    expect(validateChannel({ channelId: 'c1', type: 'VOICE', botCanView: true, botCanSend: true }, true))
      .toMatchObject({ ok: false, code: 'CHANNEL_TYPE_INVALID' });
  });

  it('requires assignable roles', () => {
    expect(validateRole({ roleId: 'r1', botCanAssign: false }, true))
      .toMatchObject({ ok: false, code: 'ROLE_NOT_ASSIGNABLE' });
  });

  it('builds the minimum guild health contract', () => {
    const now = Date.now();
    const health = buildGuildHealth({
      botPresent: true,
      lastSeenAt: new Date(now - 2 * 60_000),
      lastConfigReadAt: new Date(now - 60_000),
      channels: [
        { channelId: 'ok', type: 'TEXT', botCanView: true, botCanSend: true },
        { channelId: 'bad', type: 'TEXT', botCanView: true, botCanSend: false },
      ],
      roles: [{ roleId: 'r1', botCanAssign: true }],
      configuredSendingChannelIds: ['bad'],
    }, now);
    expect(health).toMatchObject({
      botPresent: true, snapshotState: 'fresh', channelCount: 2, roleCount: 1,
      inaccessibleConfiguredChannels: ['bad'],
    });
  });
});
