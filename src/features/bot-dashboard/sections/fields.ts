import type { ConfigField } from '../ConfigMapEditor';

export const channelFields: ConfigField[] = [
  ['log-comandos','Log de comandos'],['log-mensagens','Log de mensagens'],['log-entradas','Entradas'],['log-saidas','Saídas'],['log-moderacao','Moderação'],['log-tickets','Tickets'],['welcome:channel','Boas-vindas'],['level-notify','Avisos de nível'],
].map(([key,label]) => ({ key, label, kind: 'channel' }));

export const roleFields: ConfigField[] = [
  ['moderador','Moderador'],['staff','Staff'],['mutado','Mutado'],['nao-verificado','Não verificado'],['welcome:autorole','Cargo de entrada'],
].map(([key,label]) => ({ key, label, kind: 'role' }));

export const toggleFields: ConfigField[] = [
  ['mod:dm-on-action','Avisar ações por DM'],['sec:automod','Automod'],['sec:verify','Verificação'],['sec:antiraid','Antiraid'],['sec:antinuke','Antinuke'],['welcome:enabled','Boas-vindas'],['level:enabled','Níveis'],['eco:enabled','Economia'],['event:enabled','Eventos'],
].map(([key,label]) => ({ key, label, kind: 'boolean' }));

export const settingFields: ConfigField[] = [
  { key: 'mod:warn-ttl-days', label: 'Validade de avisos (dias)', kind: 'number' },
  { key: 'sec:automod-mention-limit', label: 'Limite de menções', kind: 'number' },
  { key: 'welcome:message', label: 'Mensagem de boas-vindas', kind: 'string' },
  { key: 'level:notify', label: 'Destino dos avisos de nível', kind: 'string', options: [{value:'atual',label:'Canal atual'},{value:'canal',label:'Canal configurado'},{value:'dm',label:'Mensagem direta'},{value:'off',label:'Desativado'}] },
  { key: 'eco:currency-name', label: 'Nome da moeda', kind: 'string' },
  { key: 'eco:daily', label: 'Recompensa diária', kind: 'number' },
] as ConfigField[];
