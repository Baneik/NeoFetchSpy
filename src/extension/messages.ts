import {
  SETTINGS_SCHEMA_VERSION,
  type Action,
  type FilterOperator,
  type HttpMethod,
  type PageRuntimeSettings,
  type ResponseKind,
} from '../core/types';

export const MESSAGE_CHANNEL = 'neofetchspy';
export const MESSAGE_VERSION = 1;
export const MESSAGE_SOURCE_BRIDGE = 'neofetchspy-bridge';
export const MESSAGE_SOURCE_PAGE = 'neofetchspy-page';

export interface SettingsMessage {
  channel: typeof MESSAGE_CHANNEL;
  version: typeof MESSAGE_VERSION;
  source: typeof MESSAGE_SOURCE_BRIDGE;
  type: 'settings';
  settings: PageRuntimeSettings;
}

export interface PageReadyMessage {
  channel: typeof MESSAGE_CHANNEL;
  version: typeof MESSAGE_VERSION;
  source: typeof MESSAGE_SOURCE_PAGE;
  type: 'ready';
}

export type NeoFetchSpyMessage = SettingsMessage | PageReadyMessage;

export function isNeoFetchSpyMessage(value: unknown): value is NeoFetchSpyMessage {
  return isSettingsMessage(value) || isPageReadyMessage(value);
}

export function isSettingsMessage(value: unknown): value is SettingsMessage {
  if (value === null || typeof value !== 'object') return false;
  const candidate = value as Partial<SettingsMessage>;
  return candidate.channel === MESSAGE_CHANNEL
    && candidate.version === MESSAGE_VERSION
    && candidate.source === MESSAGE_SOURCE_BRIDGE
    && candidate.type === 'settings'
    && isPageRuntimeSettings(candidate.settings);
}

export function isPageReadyMessage(value: unknown): value is PageReadyMessage {
  if (value === null || typeof value !== 'object') return false;
  const candidate = value as Partial<PageReadyMessage>;
  return candidate.channel === MESSAGE_CHANNEL
    && candidate.version === MESSAGE_VERSION
    && candidate.source === MESSAGE_SOURCE_PAGE
    && candidate.type === 'ready';
}

function isPageRuntimeSettings(value: unknown): value is PageRuntimeSettings {
  if (!isRecord(value)) return false;
  return value.schemaVersion === SETTINGS_SCHEMA_VERSION
    && typeof value.enabled === 'boolean'
    && typeof value.debug === 'boolean'
    && Array.isArray(value.rules)
    && value.rules.every(isRuntimeRule);
}

function isRuntimeRule(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return typeof value.id === 'string'
    && typeof value.enabled === 'boolean'
    && isMatchCondition(value.match)
    && isResponseKind(value.responseType)
    && Array.isArray(value.actions)
    && value.actions.every(isAction);
}

function isMatchCondition(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return typeof value.url === 'string'
    && isHttpMethod(value.method)
    && isStringMap(value.query)
    && isStringMap(value.headers)
    && isStringMap(value.postForm);
}

function isAction(value: unknown): value is Action {
  if (!isRecord(value) || typeof value.type !== 'string') return false;
  if (value.type === 'delete') return typeof value.path === 'string';
  if (value.type === 'replace') return typeof value.path === 'string';
  if (value.type === 'regex') {
    return typeof value.pattern === 'string'
      && (value.flags === undefined || typeof value.flags === 'string')
      && typeof value.replacement === 'string';
  }
  if (value.type === 'filter') {
    return typeof value.iterablePath === 'string' && isFilterCondition(value.condition);
  }
  return false;
}

function isFilterCondition(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return typeof value.field === 'string' && isFilterOperator(value.operator);
}

function isHttpMethod(value: unknown): value is HttpMethod | undefined {
  return value === undefined
    || value === 'GET'
    || value === 'POST'
    || value === 'PUT'
    || value === 'DELETE'
    || value === 'PATCH'
    || value === 'HEAD'
    || value === 'OPTIONS'
    || value === '*';
}

function isResponseKind(value: unknown): value is ResponseKind | undefined {
  return value === undefined || value === 'json' || value === 'text';
}

function isFilterOperator(value: unknown): value is FilterOperator {
  return value === 'exists'
    || value === 'not_exists'
    || value === 'equals'
    || value === 'not_equals'
    || value === 'regex'
    || value === 'non_empty'
    || value === 'empty';
}

function isStringMap(value: unknown): value is Record<string, string> | undefined {
  if (value === undefined) return true;
  if (!isRecord(value)) return false;
  return Object.values(value).every((entry) => typeof entry === 'string');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
