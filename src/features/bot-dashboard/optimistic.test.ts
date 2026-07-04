import { describe, expect, it } from 'vitest';
import { mergeConfigColumn, collectionKeyFor, applyCollectionMutation } from './optimistic';
import type { GuildConfigResponse } from './api';

describe('mergeConfigColumn', () => {
  it('replaces one column and preserves the others immutably', () => {
    const data = { config: { channels: { a: '1' }, roles: { b: '2' } } } as unknown as GuildConfigResponse;
    const next = mergeConfigColumn(data, 'channels', { a: '9' });
    expect(next.config.channels).toEqual({ a: '9' });
    expect(next.config.roles).toEqual({ b: '2' });
    expect(next).not.toBe(data);
  });
});

describe('collectionKeyFor', () => {
  it('maps kebab collection names to data.collections keys', () => {
    expect(collectionKeyFor('ticket-categories')).toBe('ticketCategories');
    expect(collectionKeyFor('shop-items')).toBe('shopItems');
  });
  it('maps action-types to actionTypes', () => {
    expect(collectionKeyFor('action-types')).toBe('actionTypes');
  });
  it('returns null for an unknown collection', () => {
    expect(collectionKeyFor('nope')).toBeNull();
  });
});

describe('applyCollectionMutation', () => {
  const base: Record<string, unknown[]> = { shopItems: [{ id: '1', name: 'A' }] };
  it('appends the new item on POST', () => {
    const next = applyCollectionMutation(base, 'shopItems', 'POST', { id: '2', name: 'B' }, undefined);
    expect(next.shopItems).toHaveLength(2);
  });
  it('replaces the matching item on PATCH', () => {
    const next = applyCollectionMutation(base, 'shopItems', 'PATCH', { id: '1', name: 'Z' }, '1');
    expect((next.shopItems[0] as Record<string, unknown>).name).toBe('Z');
  });
  it('removes the item by resourceId on DELETE', () => {
    const next = applyCollectionMutation(base, 'shopItems', 'DELETE', undefined, '1');
    expect(next.shopItems).toHaveLength(0);
  });
});
