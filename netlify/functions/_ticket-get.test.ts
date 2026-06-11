// netlify/functions/ticket-get.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const sqlMock = vi.fn();
vi.mock('@netlify/neon', () => ({ neon: () => sqlMock }));

import handler from './ticket-get';

beforeEach(() => {
  process.env.TICKETS_NEON = 'postgres://x';
  sqlMock.mockReset();
});

const get = (id?: string) =>
  handler(new Request(`https://x/api/ticket${id ? `?id=${id}` : ''}`), {} as any);

describe('ticket-get', () => {
  it('400 without id', async () => {
    expect((await get()).status).toBe(400);
  });
  it('404 when missing', async () => {
    sqlMock.mockResolvedValue([]);
    expect((await get('nope')).status).toBe(404);
  });
  it('returns bundle', async () => {
    sqlMock.mockResolvedValue([{
      guild_name: 'G', channel_name: 'c', salt_key: 'a', salt_hash: 'b',
      iv: 'c', ciphertext: 'd', password_hash: 'e', iterations: 210000,
    }]);
    const res = await get('abc123');
    expect(res.status).toBe(200);
    const j = await res.json();
    expect(j).toMatchObject({ guildName: 'G', channelName: 'c', iterations: 210000 });
  });
});
