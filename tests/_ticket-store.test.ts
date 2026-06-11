// netlify/functions/ticket-store.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const sqlMock = vi.fn();
vi.mock('@netlify/neon', () => ({ neon: () => sqlMock }));

import handler from '../netlify/functions/ticket-store';

const SECRET = 'test-secret';
beforeEach(() => {
  process.env.TICKET_INGEST_SECRET = SECRET;
  process.env.TICKETS_NEON = 'postgres://x';
  sqlMock.mockReset();
  sqlMock.mockResolvedValue([]);
});

const body = {
  id: 'abc123', source: 'botMGL', guildName: 'G', channelName: 'c',
  saltKey: 'a', saltHash: 'b', iv: 'c', ciphertext: 'd', passwordHash: 'e', iterations: 210000,
};
const req = (b: unknown, secret?: string) =>
  new Request('https://x/api/ticket-store', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(secret ? { 'x-ticket-secret': secret } : {}) },
    body: JSON.stringify(b),
  });

describe('ticket-store', () => {
  it('rejects without secret', async () => {
    const res = await handler(req(body), {} as any);
    expect(res.status).toBe(401);
  });
  it('rejects bad body', async () => {
    const res = await handler(req({ id: 'x' }, SECRET), {} as any);
    expect(res.status).toBe(400);
  });
  it('inserts and returns id', async () => {
    const res = await handler(req(body, SECRET), {} as any);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ id: 'abc123' });
    expect(sqlMock).toHaveBeenCalledOnce();
  });
});
