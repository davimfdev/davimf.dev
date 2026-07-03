import { describe, expect, it } from 'vitest';
import { handler as guilds } from '../bot-guilds';
import { handler as getConfig } from '../bot-config-get';
import { handler as patchConfig } from '../bot-config-patch';

describe('dashboard route guards', () => {
  it('requires a dashboard session for guild listing', async () => {
    const response = await guilds({ httpMethod: 'GET', headers: {} } as never, {} as never);
    if (!response) throw new Error('Expected response');
    expect(response.statusCode).toBe(401);
  });

  it('requires a dashboard session for config reads', async () => {
    const response = await getConfig({ httpMethod: 'GET', headers: {}, queryStringParameters: { guildId: 'g1' } } as never, {} as never);
    if (!response) throw new Error('Expected response');
    expect(response.statusCode).toBe(401);
  });

  it('rejects a mutating request from an invalid origin before auth', async () => {
    const response = await patchConfig({
      httpMethod: 'PATCH', headers: { origin: 'https://evil.example' }, body: JSON.stringify({ guildId: 'g1' }),
    } as never, {} as never);
    if (!response) throw new Error('Expected response');
    expect(response.statusCode).toBe(403);
  });
});
