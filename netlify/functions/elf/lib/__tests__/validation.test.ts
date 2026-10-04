import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { ApiError } from '../http';
import {
  parseBody,
  requireIdempotencyKey,
  endpointKey,
  isResourceId,
  VersionSchema,
} from '../validation';

const Schema = z.object({ name: z.string().min(1), amountCents: z.number().int() }).strict();

const post = (body: unknown, headers: Record<string, string> = {}) =>
  new Request('https://elf.davimf.dev/api/elf/transactions/?x=1', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });

describe('parseBody', () => {
  it('aceita corpo válido', async () => {
    await expect(parseBody(post({ name: 'Mercado', amountCents: -2590 }), Schema)).resolves.toEqual(
      { name: 'Mercado', amountCents: -2590 },
    );
  });
  it('recusa campo desconhecido em vez de descartar', async () => {
    await expect(
      parseBody(post({ name: 'x', amountCents: 1, userId: 'de-outro' }), Schema),
    ).rejects.toThrow(ApiError);
  });
  it('recusa tipo errado', async () => {
    await expect(parseBody(post({ name: 'x', amountCents: '1' }), Schema)).rejects.toThrow(
      ApiError,
    );
  });
  it('recusa valor fracionário onde se espera inteiro', async () => {
    await expect(parseBody(post({ name: 'x', amountCents: 1.5 }), Schema)).rejects.toThrow(
      ApiError,
    );
  });
  it('recusa JSON malformado com VALIDATION_FAILED', async () => {
    await expect(parseBody(post('{nao json'), Schema)).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
      status: 400,
    });
  });
  it('detalha cada campo que falhou', async () => {
    const error: unknown = await parseBody(post({ name: '', amountCents: 1.5 }), Schema).catch(
      (e: unknown) => e,
    );
    const fields = (error as ApiError).extra?.fields as Array<{ path: string }>;
    expect(fields.map((f) => f.path).sort()).toEqual(['amountCents', 'name']);
  });
});

describe('VersionSchema', () => {
  it('aceita inteiro positivo', () => {
    expect(VersionSchema.safeParse(3).success).toBe(true);
  });
  it('recusa zero', () => {
    expect(VersionSchema.safeParse(0).success).toBe(false);
  });
  it('recusa fracionário', () => {
    expect(VersionSchema.safeParse(1.5).success).toBe(false);
  });
});

describe('requireIdempotencyKey', () => {
  it('devolve a chave quando presente', () => {
    expect(requireIdempotencyKey(post({}, { 'Idempotency-Key': 'k1' }))).toBe('k1');
  });
  it('recusa ausência', () => {
    expect(() => requireIdempotencyKey(post({}))).toThrow(ApiError);
  });
  it('recusa chave só com espaços', () => {
    expect(() => requireIdempotencyKey(post({}, { 'Idempotency-Key': '  ' }))).toThrow(ApiError);
  });
});

describe('endpointKey', () => {
  it('usa método e caminho, sem host, query nem barra final', () => {
    expect(endpointKey(post({}))).toBe('POST:/api/elf/transactions');
  });
});

describe('isResourceId', () => {
  it('aceita UUID', () => {
    expect(isResourceId('3f2504e0-4f89-41d3-9a0c-0305e82c3301')).toBe(true);
  });
  it('recusa texto que o Postgres rejeitaria como uuid', () => {
    expect(isResourceId('sess-2')).toBe(false);
  });
  it('recusa ausência', () => {
    expect(isResourceId(undefined)).toBe(false);
  });
});
