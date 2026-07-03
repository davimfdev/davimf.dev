import type { Handler } from '@netlify/functions';
import { allowedOrigin } from './lib/cors';
import { writeAudit } from './lib/dashboard/audit';
import {
  COLLECTION_TABLES,
  CollectionError,
  createCollectionItem,
  disableCollectionItem,
  listCollection,
  updateCollectionItem,
  type CollectionName,
} from './lib/dashboard/collections';
import { requireGuildAccess } from './lib/dashboard/guildAccess';

const json = (statusCode: number, body: unknown) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

function isCollection(value: unknown): value is CollectionName {
  return typeof value === 'string' && value in COLLECTION_TABLES;
}

export const handler: Handler = async (event) => {
  if (!['GET', 'POST', 'PATCH', 'DELETE'].includes(event.httpMethod)) return { statusCode: 405, body: 'Method Not Allowed' };
  if (!allowedOrigin(event)) return json(403, { error: { code: 'BAD_ORIGIN', message: 'Origin not allowed.' } });

  let body: { guildId?: string; collection?: unknown; resourceId?: unknown; data?: unknown } = {};
  if (event.httpMethod !== 'GET') {
    try {
      body = JSON.parse(event.body ?? '{}') as typeof body;
    } catch {
      return json(400, { error: { code: 'INVALID_JSON', message: 'Invalid JSON body.' } });
    }
  }
  const guildId = event.httpMethod === 'GET' ? event.queryStringParameters?.guildId : body.guildId;
  const collection = event.httpMethod === 'GET' ? event.queryStringParameters?.collection : body.collection;
  if (!isCollection(collection)) return json(400, { error: { code: 'INVALID_COLLECTION', message: 'Unknown collection.' } });

  const access = await requireGuildAccess(event, guildId);
  if (!access.ok) return json(access.status, { error: { code: access.code, message: 'Guild access denied.' } });

  try {
    if (event.httpMethod === 'GET') return json(200, { items: await listCollection(collection, access) });
    const data = body.data && typeof body.data === 'object' && !Array.isArray(body.data)
      ? body.data as Record<string, unknown>
      : {};
    if (event.httpMethod === 'POST') return json(201, { item: await createCollectionItem(collection, access, data) });
    const resourceId = typeof body.resourceId === 'string' ? body.resourceId : '';
    if (!resourceId) throw new CollectionError(400, 'RESOURCE_ID_REQUIRED', 'resourceId');
    if (event.httpMethod === 'PATCH') return json(200, { item: await updateCollectionItem(collection, access, resourceId, data) });
    if (collection !== 'shop-items' && collection !== 'self-roles') {
      throw new CollectionError(400, 'SOFT_DELETE_UNSUPPORTED', 'collection');
    }
    await disableCollectionItem(collection, access, resourceId);
    return json(200, { ok: true });
  } catch (error) {
    if (error instanceof CollectionError) {
      await writeAudit({
        actorUserId: access.userId, accessLevel: access.accessLevel, targetGuildId: access.guildId,
        method: event.httpMethod, route: '/api/bot-config-collection', operation: event.httpMethod.toLowerCase(),
        resourceType: collection, resourceId: typeof body.resourceId === 'string' ? body.resourceId : undefined,
        changeSummary: { code: error.code, field: error.field }, result: 'rejected',
      });
      return json(error.status, { error: { code: error.code, message: 'Collection operation rejected.', field: error.field } });
    }
    console.error('bot-config-collection failed', error);
    return json(500, { error: { code: 'INTERNAL_ERROR', message: 'Internal error.' } });
  }
};
