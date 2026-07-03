export type MapColumn = 'channels' | 'roles' | 'toggles' | 'settings';
export type ConfigRule = {
  value: 'boolean' | 'string' | 'number' | 'string[]' | 'channel' | 'role';
  min?: number;
  max?: number;
  enum?: readonly string[];
  channelNeedsSend?: boolean;
  roleNeedsAssign?: boolean;
};

const channel = (channelNeedsSend = true): ConfigRule => ({ value: 'channel', channelNeedsSend });
const role = (roleNeedsAssign = true): ConfigRule => ({ value: 'role', roleNeedsAssign });
const boolean: ConfigRule = { value: 'boolean' };
const string: ConfigRule = { value: 'string' };
const nonNegative: ConfigRule = { value: 'number', min: 0 };

export const CONFIG_RULES: Record<MapColumn, Record<string, ConfigRule>> = {
  channels: Object.fromEntries([
    'log-comandos','log-mensagens','log-entradas','log-saidas','log-membros','log-voz','log-canais',
    'log-cargos','log-servidor','log-bans','log-kicks','log-moderacao','log-formularios','log-loja',
    'log-tickets','log-orcamentos','log-vendas','log-farm','log-punicoes','log-hierarquia','log-financeiro',
    'log-acoes','log-pds','log-sets','event-channel','level-notify','welcome:channel',
    'welcome:farewell-channel','acoes-escalacoes','acoes-alinhamentos',
  ].map((key) => [key, channel()])),
  roles: Object.fromEntries([
    'moderador','staff','mutado','nao-verificado','vendedor','lider','sub-lider','gerente-geral',
    'gerente-vendas','gerente-elite','gerente-elite-feminina','gerente-recrutamento','gerente-farm',
    'recrutador','elite','elite-feminina','membro','sem-set','welcome:autorole',
  ].map((key) => [key, role()])),
  toggles: Object.fromEntries([
    'mod:dm-on-action','mod:require-reason','sec:automod','sec:automod-warn',
    'sec:automod-block-invites','sec:verify','sec:antiraid','sec:antinuke','welcome:enabled',
    'welcome:dm','welcome:farewell-enabled','level:enabled','eco:enabled','event:enabled',
  ].map((key) => [key, boolean])),
  settings: {
    'mod:warn-ttl-days': nonNegative,
    'mod:escalation': string,
    'sec:automod-warn-per': nonNegative,
    'sec:automod-window-s': nonNegative,
    'sec:automod-mention-limit': nonNegative,
    'sec:automod-keywords': { value: 'string[]' },
    'sec:exempt-roles': { value: 'string[]' },
    'sec:exempt-channels': { value: 'string[]' },
    'sec:antiraid-joins': nonNegative,
    'sec:antiraid-window-s': nonNegative,
    'sec:antiraid-min-age-days': nonNegative,
    'sec:antiraid-lock-level': nonNegative,
    'sec:antinuke-max': nonNegative,
    'sec:antinuke-window-s': nonNegative,
    'sec:antinuke-whitelist': { value: 'string[]' },
    'welcome:message': string,
    'welcome:image': string,
    'welcome:farewell-message': string,
    'level:notify': { value: 'string', enum: ['atual', 'canal', 'dm', 'off'] },
    'level:ignored-channels': { value: 'string[]' },
    'eco:currency-name': string,
    'eco:currency-emoji': string,
    'eco:daily': nonNegative,
    'eco:work-min': nonNegative,
    'eco:work-max': nonNegative,
    'eco:work-cooldown': nonNegative,
    'event:min-interval': nonNegative,
    'event:max-interval': nonNegative,
    'farm-items': string,
    'farm-payout-cents': nonNegative,
    'hierarchy-channel-id': { value: 'channel', channelNeedsSend: true },
    'hierarchy-message-id': string,
    'perm:acoes': string,
    'perm:financeiro': string,
    'perm:farm': string,
    'perm:recrutamento': string,
    'perm:punicoes': string,
  },
};

export type ValidationResult = { ok: true } | { ok: false; code: string; field: string };

function valueMatches(rule: ConfigRule, value: unknown): boolean {
  if (rule.value === 'boolean') return typeof value === 'boolean';
  if (rule.value === 'number') return typeof value === 'number' && Number.isFinite(value);
  if (rule.value === 'string[]') return Array.isArray(value) && value.every((item) => typeof item === 'string');
  return typeof value === 'string';
}

export function validateMapPatch(column: MapColumn, patch: Record<string, unknown>): ValidationResult {
  for (const [key, value] of Object.entries(patch)) {
    const rule = CONFIG_RULES[column][key];
    if (!rule) return { ok: false, code: 'UNKNOWN_KEY', field: key };
    if (!valueMatches(rule, value)) return { ok: false, code: 'INVALID_TYPE', field: key };
    if (rule.enum && !rule.enum.includes(String(value))) return { ok: false, code: 'INVALID_ENUM', field: key };
    if (typeof value === 'number' && ((rule.min !== undefined && value < rule.min) || (rule.max !== undefined && value > rule.max))) {
      return { ok: false, code: 'OUT_OF_RANGE', field: key };
    }
  }
  return { ok: true };
}
