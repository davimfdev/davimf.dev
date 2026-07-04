import type { GuildConfigResponse } from './api';

export function mergeConfigColumn(
  data: GuildConfigResponse,
  column: string,
  values: Record<string, unknown>,
): GuildConfigResponse {
  return { ...data, config: { ...data.config, [column]: values } };
}

const COLLECTION_KEYS: Record<string, string> = {
  'ticket-categories': 'ticketCategories',
  'self-roles': 'selfRoles',
  'level-rewards': 'levelRewards',
  quiz: 'quiz',
  'shop-items': 'shopItems',
  'fac-action-types': 'actionTypes',
};

export function collectionKeyFor(collection: string): string | null {
  return COLLECTION_KEYS[collection] ?? null;
}

function idOf(row: unknown): string {
  return String((row as Record<string, unknown>)?.id ?? '');
}

export function applyCollectionMutation(
  collections: Record<string, unknown[]>,
  key: string,
  method: 'POST' | 'PATCH' | 'DELETE',
  item: Record<string, unknown> | undefined,
  resourceId: string | undefined,
): Record<string, unknown[]> {
  const list = Array.isArray(collections[key]) ? collections[key] : [];
  let next: unknown[];
  if (method === 'POST' && item) next = [...list, item];
  else if (method === 'PATCH' && item) next = list.map((row) => (idOf(row) === idOf(item) ? item : row));
  else if (method === 'DELETE' && resourceId) next = list.filter((row) => idOf(row) !== resourceId);
  else next = list;
  return { ...collections, [key]: next };
}
