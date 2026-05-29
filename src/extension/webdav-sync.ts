import { normalizeSettings } from '../core/rule-schema';
import type { PresetTable, Rule, RuntimeSettings } from '../core/types';
import { loadSettings, saveSettings } from './storage';

export const WEBDAV_SYNC_STORAGE_KEY = 'neofetchspy_webdav_sync';
export const WEBDAV_RULES_DOCUMENT_FORMAT = 'neofetchspy-webdav-rules';
export const WEBDAV_SETTINGS_DOCUMENT_FORMAT = 'neofetchspy-webdav-settings';
export const WEBDAV_PRESETS_DOCUMENT_FORMAT = 'neofetchspy-webdav-presets';
export const WEBDAV_SYNC_SCHEMA_VERSION = 1;
export const WEBDAV_SYNC_REMOTE_DIR = 'NeoFetchSPY';
export const WEBDAV_RULES_FILENAME = 'rule.json';
export const WEBDAV_SETTINGS_FILENAME = 'setting.json';
export const WEBDAV_PRESETS_FILENAME = 'preset.json';

export type WebDavSyncAction = 'test' | 'upload' | 'pull' | 'auto';
export type WebDavLastResult = 'never' | 'success' | 'error' | 'skipped';

export interface WebDavSyncSettings {
  schemaVersion: typeof WEBDAV_SYNC_SCHEMA_VERSION;
  enabled: boolean;
  autoSync: boolean;
  serverUrl: string;
  username: string;
  password: string;
  quickConfig: string;
  clientId: string;
  lastSyncAt: number;
  lastResult: WebDavLastResult;
  lastMessage: string;
  lastLocalHash?: string;
  lastRemoteHash?: string;
  lastRemoteEtag?: string;
}

export interface WebDavSyncSummary {
  added: number;
  updatedFromRemote: number;
  keptLocalNewer: number;
  keptLocalOnly: number;
  uploaded: boolean;
}

export interface WebDavSyncResult {
  ok: boolean;
  action: WebDavSyncAction;
  message: string;
  summary?: WebDavSyncSummary;
}

interface SyncedRuntimeSettings {
  enabled: boolean;
  debug: boolean;
  rules: Rule[];
  presets: PresetTable;
}

interface SyncedAppSettings {
  enabled: boolean;
  debug: boolean;
}

interface WebDavRulesDocument {
  format: typeof WEBDAV_RULES_DOCUMENT_FORMAT;
  version: typeof WEBDAV_SYNC_SCHEMA_VERSION;
  exportedAt: number;
  clientId: string;
  rules: Rule[];
}

interface WebDavSettingsDocument {
  format: typeof WEBDAV_SETTINGS_DOCUMENT_FORMAT;
  version: typeof WEBDAV_SYNC_SCHEMA_VERSION;
  exportedAt: number;
  clientId: string;
  settings: SyncedAppSettings;
}

interface WebDavPresetsDocument {
  format: typeof WEBDAV_PRESETS_DOCUMENT_FORMAT;
  version: typeof WEBDAV_SYNC_SCHEMA_VERSION;
  exportedAt: number;
  clientId: string;
  presets: PresetTable;
}

interface RemoteDocumentResult {
  settings: RuntimeSettings;
  etag?: string;
  hash: string;
}

interface WebDavRequestOptions {
  method: string;
  body?: BodyInit;
  headers?: Record<string, string>;
}

export const DEFAULT_WEBDAV_SYNC_SETTINGS: WebDavSyncSettings = {
  schemaVersion: WEBDAV_SYNC_SCHEMA_VERSION,
  enabled: false,
  autoSync: true,
  serverUrl: '',
  username: '',
  password: '',
  quickConfig: '',
  clientId: '',
  lastSyncAt: 0,
  lastResult: 'never',
  lastMessage: '',
};

let syncInFlight: Promise<WebDavSyncResult> | null = null;

export async function loadWebDavSyncSettings(): Promise<WebDavSyncSettings> {
  const raw = await readStoredWebDavSyncSettings();
  const normalized = normalizeWebDavSyncSettings(raw);
  if (!raw || !isRecord(raw) || raw.clientId !== normalized.clientId) {
    await writeStoredWebDavSyncSettings(normalized);
  }
  return normalized;
}

export async function saveWebDavSyncSettings(
  settings: WebDavSyncSettings,
): Promise<WebDavSyncSettings> {
  const normalized = normalizeWebDavSyncSettings(settings);
  await writeStoredWebDavSyncSettings(normalized);
  return normalized;
}

export async function runWebDavSyncAction(action: WebDavSyncAction): Promise<WebDavSyncResult> {
  if (syncInFlight) return syncInFlight;

  syncInFlight = executeWebDavSyncAction(action)
    .catch((error: unknown) => result(action, false, errorMessage(error)))
    .finally(() => {
      syncInFlight = null;
    });

  return syncInFlight;
}

export async function validateWebDavSyncSettings(
  settings: WebDavSyncSettings,
): Promise<WebDavSyncResult> {
  const syncSettings = normalizeWebDavSyncSettings(settings);
  if (!isWebDavSyncConfigured(syncSettings)) {
    return result('test', false, 'WebDAV server URL is required');
  }

  try {
    const message = await performConnectionTest(syncSettings);
    return result('test', true, message);
  } catch (error) {
    return result('test', false, errorMessage(error));
  }
}

export function isWebDavSyncConfigured(settings: WebDavSyncSettings): boolean {
  return Boolean(settings.serverUrl.trim());
}

export function normalizeWebDavSyncSettings(input: unknown): WebDavSyncSettings {
  const source = isRecord(input) ? input : {};
  const clientId = typeof source.clientId === 'string' && source.clientId
    ? source.clientId
    : createClientId();
  const lastResult = source.lastResult === 'success'
    || source.lastResult === 'error'
    || source.lastResult === 'skipped'
    || source.lastResult === 'never'
    ? source.lastResult
    : 'never';

  return {
    schemaVersion: WEBDAV_SYNC_SCHEMA_VERSION,
    enabled: typeof source.enabled === 'boolean' ? source.enabled : false,
    autoSync: typeof source.autoSync === 'boolean' ? source.autoSync : true,
    serverUrl: typeof source.serverUrl === 'string' ? source.serverUrl : '',
    username: typeof source.username === 'string' ? source.username : '',
    password: typeof source.password === 'string' ? source.password : '',
    quickConfig: typeof source.quickConfig === 'string' ? source.quickConfig : '',
    clientId,
    lastSyncAt: typeof source.lastSyncAt === 'number' ? source.lastSyncAt : 0,
    lastResult,
    lastMessage: typeof source.lastMessage === 'string' ? source.lastMessage : '',
    lastLocalHash: typeof source.lastLocalHash === 'string' ? source.lastLocalHash : undefined,
    lastRemoteHash: typeof source.lastRemoteHash === 'string' ? source.lastRemoteHash : undefined,
    lastRemoteEtag: typeof source.lastRemoteEtag === 'string' ? source.lastRemoteEtag : undefined,
  };
}

async function executeWebDavSyncAction(action: WebDavSyncAction): Promise<WebDavSyncResult> {
  const syncSettings = await loadWebDavSyncSettings();

  if (action === 'auto' && (!syncSettings.enabled || !syncSettings.autoSync)) {
    return result(action, true, 'WebDAV auto sync is disabled');
  }

  if (!isWebDavSyncConfigured(syncSettings)) {
    const message = 'WebDAV server URL is required';
    await saveSyncState(syncSettings, 'error', message);
    return result(action, false, message);
  }

  if (action === 'test') return testConnection(syncSettings);
  if (action === 'upload') return uploadLocalSettings(syncSettings);
  if (action === 'pull') return pullRemoteSettings(syncSettings);
  return autoSync(syncSettings);
}

async function testConnection(syncSettings: WebDavSyncSettings): Promise<WebDavSyncResult> {
  try {
    const message = await performConnectionTest(syncSettings);
    await saveSyncState(syncSettings, 'success', message);
    return result('test', true, message);
  } catch (error) {
    const message = errorMessage(error);
    await saveSyncState(syncSettings, 'error', message);
    return result('test', false, message);
  }
}

async function performConnectionTest(syncSettings: WebDavSyncSettings): Promise<string> {
  assertWebDavUrl(syncSettings);
  await ensureParentCollections(syncSettings);

  const testUrl = buildRemoteFileUrl(syncSettings, `.neofetchspy-test-${syncSettings.clientId}.txt`);
  const body = `NeoFetchSPY WebDAV test ${new Date().toISOString()}`;
  const putResponse = await webDavRequest(syncSettings, testUrl, {
    method: 'PUT',
    body,
    headers: { 'content-type': 'text/plain;charset=utf-8' },
  });
  ensureSuccessfulResponse(putResponse, 'WebDAV test upload failed');

  const getResponse = await webDavRequest(syncSettings, testUrl, { method: 'GET' });
  ensureSuccessfulResponse(getResponse, 'WebDAV test download failed');
  const downloaded = await getResponse.text();
  if (downloaded !== body) throw new Error('WebDAV test file content did not match');

  await webDavRequest(syncSettings, testUrl, { method: 'DELETE' }).catch(() => undefined);
  return 'WebDAV connection test passed';
}

async function uploadLocalSettings(syncSettings: WebDavSyncSettings): Promise<WebDavSyncResult> {
  try {
    assertWebDavUrl(syncSettings);
    const localSettings = await loadSettings();
    const uploadResult = await uploadSettingsDocument(syncSettings, localSettings);
    const message = 'Local rules and settings uploaded to WebDAV';
    await saveSyncState(syncSettings, 'success', message, uploadResult);
    return result('upload', true, message, {
      added: 0,
      updatedFromRemote: 0,
      keptLocalNewer: 0,
      keptLocalOnly: 0,
      uploaded: true,
    });
  } catch (error) {
    const message = errorMessage(error);
    await saveSyncState(syncSettings, 'error', message);
    return result('upload', false, message);
  }
}

async function pullRemoteSettings(syncSettings: WebDavSyncSettings): Promise<WebDavSyncResult> {
  try {
    assertWebDavUrl(syncSettings);
    const [localSettings, remote] = await Promise.all([
      loadSettings(),
      downloadRemoteDocument(syncSettings),
    ]);

    if (!remote) {
      const message = 'Remote WebDAV files do not exist';
      await saveSyncState(syncSettings, 'error', message);
      return result('pull', false, message);
    }

    const merge = mergeRemoteIntoLocal(localSettings, remote.settings);
    await saveSettings(merge.settings);

    const localHash = await hashSettings(merge.settings);
    const message = mergeSummaryMessage('Remote rules pulled from WebDAV', merge.summary);
    await saveSyncState(syncSettings, 'success', message, {
      localHash,
      remoteHash: remote.hash,
      remoteEtag: remote.etag,
    });

    return result('pull', true, message, { ...merge.summary, uploaded: false });
  } catch (error) {
    const message = errorMessage(error);
    await saveSyncState(syncSettings, 'error', message);
    return result('pull', false, message);
  }
}

async function autoSync(syncSettings: WebDavSyncSettings): Promise<WebDavSyncResult> {
  try {
    assertWebDavUrl(syncSettings);
    const localSettings = await loadSettings();
    const localHash = await hashSettings(localSettings);
    const remote = await downloadRemoteDocument(syncSettings);

    if (!remote) {
      const uploadResult = await uploadSettingsDocument(syncSettings, localSettings);
      const message = 'Remote WebDAV files created from local rules and settings';
      await saveSyncState(syncSettings, 'success', message, uploadResult);
      return result('auto', true, message, {
        added: 0,
        updatedFromRemote: 0,
        keptLocalNewer: 0,
        keptLocalOnly: 0,
        uploaded: true,
      });
    }

    if (localHash === remote.hash) {
      const message = 'WebDAV rules are already in sync';
      await saveSyncState(syncSettings, 'success', message, {
        localHash,
        remoteHash: remote.hash,
        remoteEtag: remote.etag,
      });
      return result('auto', true, message, {
        added: 0,
        updatedFromRemote: 0,
        keptLocalNewer: 0,
        keptLocalOnly: 0,
        uploaded: false,
      });
    }

    const localChanged = syncSettings.lastLocalHash === undefined
      || syncSettings.lastLocalHash !== localHash;
    const remoteChanged = syncSettings.lastRemoteHash === undefined
      || syncSettings.lastRemoteHash !== remote.hash;

    if (localChanged && !remoteChanged) {
      const uploadResult = await uploadSettingsDocument(syncSettings, localSettings);
      const message = 'Local changes synced to WebDAV';
      await saveSyncState(syncSettings, 'success', message, uploadResult);
      return result('auto', true, message, {
        added: 0,
        updatedFromRemote: 0,
        keptLocalNewer: 0,
        keptLocalOnly: 0,
        uploaded: true,
      });
    }

    const merge = mergeRemoteIntoLocal(localSettings, remote.settings);
    await saveSettings(merge.settings);
    const mergedHash = await hashSettings(merge.settings);

    if (mergedHash !== remote.hash) {
      const uploadResult = await uploadSettingsDocument(syncSettings, merge.settings);
      const message = mergeSummaryMessage('WebDAV changes merged and uploaded', merge.summary);
      await saveSyncState(syncSettings, 'success', message, uploadResult);
      return result('auto', true, message, { ...merge.summary, uploaded: true });
    }

    const message = mergeSummaryMessage('WebDAV changes merged locally', merge.summary);
    await saveSyncState(syncSettings, 'success', message, {
      localHash: mergedHash,
      remoteHash: remote.hash,
      remoteEtag: remote.etag,
    });
    return result('auto', true, message, { ...merge.summary, uploaded: false });
  } catch (error) {
    const message = errorMessage(error);
    await saveSyncState(syncSettings, 'error', message);
    return result('auto', false, message);
  }
}

async function uploadSettingsDocument(
  syncSettings: WebDavSyncSettings,
  settings: RuntimeSettings,
): Promise<{ localHash: string; remoteHash: string; remoteEtag?: string }> {
  await ensureParentCollections(syncSettings);
  const documents = createRemoteDocuments(settings, syncSettings.clientId);
  const rulesResponse = await webDavRequest(syncSettings, buildRemoteFileUrl(syncSettings, WEBDAV_RULES_FILENAME), {
    method: 'PUT',
    body: JSON.stringify(documents.rulesDocument, null, 2),
    headers: { 'content-type': 'application/json;charset=utf-8' },
  });
  ensureSuccessfulResponse(rulesResponse, 'WebDAV rule upload failed');

  const settingsResponse = await webDavRequest(
    syncSettings,
    buildRemoteFileUrl(syncSettings, WEBDAV_SETTINGS_FILENAME),
    {
      method: 'PUT',
      body: JSON.stringify(documents.settingsDocument, null, 2),
      headers: { 'content-type': 'application/json;charset=utf-8' },
    },
  );
  ensureSuccessfulResponse(settingsResponse, 'WebDAV setting upload failed');

  const presetsResponse = await webDavRequest(
    syncSettings,
    buildRemoteFileUrl(syncSettings, WEBDAV_PRESETS_FILENAME),
    {
      method: 'PUT',
      body: JSON.stringify(documents.presetsDocument, null, 2),
      headers: { 'content-type': 'application/json;charset=utf-8' },
    },
  );
  ensureSuccessfulResponse(presetsResponse, 'WebDAV preset upload failed');

  const hash = await hashSyncedSettings(toSyncedSettings(settings));
  return {
    localHash: hash,
    remoteHash: hash,
    remoteEtag: combineEtags(
      rulesResponse.headers.get('etag'),
      settingsResponse.headers.get('etag'),
      presetsResponse.headers.get('etag'),
    ),
  };
}

async function downloadRemoteDocument(
  syncSettings: WebDavSyncSettings,
): Promise<RemoteDocumentResult | null> {
  const rulesResponse = await webDavRequest(
    syncSettings,
    buildRemoteFileUrl(syncSettings, WEBDAV_RULES_FILENAME),
    { method: 'GET' },
  );
  if (rulesResponse.status === 404) return null;
  ensureSuccessfulResponse(rulesResponse, 'WebDAV rule download failed');

  const settingsResponse = await webDavRequest(
    syncSettings,
    buildRemoteFileUrl(syncSettings, WEBDAV_SETTINGS_FILENAME),
    { method: 'GET' },
  );
  if (settingsResponse.status !== 404) {
    ensureSuccessfulResponse(settingsResponse, 'WebDAV setting download failed');
  }

  const presetsResponse = await webDavRequest(
    syncSettings,
    buildRemoteFileUrl(syncSettings, WEBDAV_PRESETS_FILENAME),
    { method: 'GET' },
  );
  ensureSuccessfulResponse(presetsResponse, 'WebDAV preset download failed');

  const remoteSettings = parseRemoteDocuments(
    await parseJsonResponse(rulesResponse, 'Remote WebDAV rule file is not valid JSON'),
    settingsResponse.status === 404
      ? undefined
      : await parseJsonResponse(settingsResponse, 'Remote WebDAV setting file is not valid JSON'),
    await parseJsonResponse(presetsResponse, 'Remote WebDAV preset file is not valid JSON'),
  );
  if (!remoteSettings) throw new Error('Remote WebDAV files are not NeoFetchSPY sync files');

  return {
    settings: remoteSettings,
    etag: combineEtags(
      rulesResponse.headers.get('etag'),
      settingsResponse.status === 404 ? null : settingsResponse.headers.get('etag'),
      presetsResponse.headers.get('etag'),
    ),
    hash: await hashSettings(remoteSettings),
  };
}

async function parseJsonResponse(response: Response, invalidMessage: string): Promise<unknown> {
  try {
    return JSON.parse(await response.text()) as unknown;
  } catch {
    throw new Error(invalidMessage);
  }
}

function parseRemoteDocuments(
  rulesInput: unknown,
  settingsInput: unknown,
  presetsInput: unknown,
): RuntimeSettings | null {
  const rules = parseRemoteRules(rulesInput);
  if (!rules) return null;
  const appSettings = parseRemoteAppSettings(settingsInput);
  const presets = parseRemotePresets(presetsInput);
  if (!presets) return null;
  return normalizeSettings({
    ...appSettings,
    rules,
    presets,
  });
}

function parseRemoteRules(input: unknown): Rule[] | null {
  if (Array.isArray(input)) return normalizeSettings({ rules: input }).rules;
  if (!isRecord(input)) return null;

  if (Array.isArray(input.rules)) {
    return normalizeSettings({ rules: input.rules }).rules;
  }

  return null;
}

function parseRemoteAppSettings(input: unknown): Partial<Pick<RuntimeSettings, 'enabled' | 'debug'>> {
  if (!isRecord(input)) return {};
  const source = input.format === WEBDAV_SETTINGS_DOCUMENT_FORMAT && isRecord(input.settings)
    ? input.settings
    : input;
  return {
    enabled: typeof source.enabled === 'boolean' ? source.enabled : undefined,
    debug: typeof source.debug === 'boolean' ? source.debug : undefined,
  };
}

function parseRemotePresets(input: unknown): PresetTable | null {
  if (!isRecord(input)) return null;
  const source = input.format === WEBDAV_PRESETS_DOCUMENT_FORMAT && isRecord(input.presets)
    ? input.presets
    : input;
  const presets: PresetTable = {};
  for (const [key, value] of Object.entries(source)) {
    if (typeof value === 'string') presets[key] = value;
  }
  return presets;
}

function mergeRemoteIntoLocal(
  localSettings: RuntimeSettings,
  remoteSettings: RuntimeSettings,
): { settings: RuntimeSettings; summary: Omit<WebDavSyncSummary, 'uploaded'> } {
  const localRulesById = new Map(localSettings.rules.map((rule) => [rule.id, rule]));
  const remoteRuleIds = new Set(remoteSettings.rules.map((rule) => rule.id));
  const mergedRules: Rule[] = [];
  const summary = {
    added: 0,
    updatedFromRemote: 0,
    keptLocalNewer: 0,
    keptLocalOnly: 0,
  };

  for (const remoteRule of remoteSettings.rules) {
    const localRule = localRulesById.get(remoteRule.id);
    if (!localRule) {
      mergedRules.push(remoteRule);
      summary.added += 1;
      continue;
    }

    mergedRules.push(remoteRule);
    if (!rulesEqualForSync(localRule, remoteRule)) {
      summary.updatedFromRemote += 1;
    }
  }

  for (const localRule of localSettings.rules) {
    if (remoteRuleIds.has(localRule.id)) continue;
    mergedRules.push(localRule);
    summary.keptLocalOnly += 1;
  }

  return {
    settings: normalizeSettings({
      ...localSettings,
      enabled: remoteSettings.enabled,
      debug: remoteSettings.debug,
      rules: mergedRules,
      presets: {
        ...localSettings.presets,
        ...remoteSettings.presets,
      },
    }),
    summary,
  };
}

function createRemoteDocuments(
  settings: RuntimeSettings,
  clientId: string,
): {
  rulesDocument: WebDavRulesDocument;
  settingsDocument: WebDavSettingsDocument;
  presetsDocument: WebDavPresetsDocument;
} {
  const exportedAt = Date.now();
  return {
    rulesDocument: {
      format: WEBDAV_RULES_DOCUMENT_FORMAT,
      version: WEBDAV_SYNC_SCHEMA_VERSION,
      exportedAt,
      clientId,
      rules: settings.rules,
    },
    settingsDocument: {
      format: WEBDAV_SETTINGS_DOCUMENT_FORMAT,
      version: WEBDAV_SYNC_SCHEMA_VERSION,
      exportedAt,
      clientId,
      settings: toSyncedAppSettings(settings),
    },
    presetsDocument: {
      format: WEBDAV_PRESETS_DOCUMENT_FORMAT,
      version: WEBDAV_SYNC_SCHEMA_VERSION,
      exportedAt,
      clientId,
      presets: settings.presets,
    },
  };
}

function toSyncedSettings(settings: RuntimeSettings): SyncedRuntimeSettings {
  return {
    enabled: settings.enabled,
    debug: settings.debug,
    rules: settings.rules,
    presets: settings.presets,
  };
}

function toSyncedAppSettings(settings: RuntimeSettings): SyncedAppSettings {
  return {
    enabled: settings.enabled,
    debug: settings.debug,
  };
}

async function hashSettings(settings: RuntimeSettings): Promise<string> {
  return hashSyncedSettings(toSyncedSettings(settings));
}

async function hashSyncedSettings(settings: SyncedRuntimeSettings): Promise<string> {
  return sha256Hex(JSON.stringify(stableValue(toComparableSyncedSettings(settings))));
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!isRecord(value)) return value;

  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, stableValue(value[key])]),
  );
}

function toComparableSyncedSettings(settings: SyncedRuntimeSettings): SyncedRuntimeSettings {
  return {
    ...settings,
    rules: settings.rules.map((rule) => {
      const { updatedAt: _updatedAt, ...stableRule } = rule;
      return stableRule as Rule;
    }),
  };
}

function rulesEqualForSync(left: Rule, right: Rule): boolean {
  const [{ updatedAt: _leftUpdatedAt, ...stableLeft }, { updatedAt: _rightUpdatedAt, ...stableRight }] = [
    left,
    right,
  ];
  return JSON.stringify(stableValue(stableLeft)) === JSON.stringify(stableValue(stableRight));
}

async function ensureParentCollections(syncSettings: WebDavSyncSettings): Promise<void> {
  const parts = normalizeRemoteDir(WEBDAV_SYNC_REMOTE_DIR).split('/').filter(Boolean);
  if (parts.length === 0) return;

  for (let index = 1; index <= parts.length; index += 1) {
    const collectionPath = parts.slice(0, index).join('/');
    const url = buildRemoteCollectionUrl(syncSettings, collectionPath);
    const response = await webDavRequest(syncSettings, url, { method: 'MKCOL' });
    if (response.ok || response.status === 405 || response.status === 301 || response.status === 302) {
      continue;
    }
    if (response.status === 409) {
      throw new Error(`WebDAV parent collection does not exist: ${collectionPath}`);
    }
    ensureSuccessfulResponse(response, `WebDAV collection create failed: ${collectionPath}`);
  }
}

function buildRemoteFileUrl(syncSettings: WebDavSyncSettings, filename: string): string {
  const base = syncSettings.serverUrl.trim().replace(/\/?$/, '/');
  const dir = normalizeRemoteDir(WEBDAV_SYNC_REMOTE_DIR);
  return new URL(`${dir}/${filename}`, base).href;
}

function buildRemoteCollectionUrl(syncSettings: WebDavSyncSettings, collectionPath: string): string {
  const base = syncSettings.serverUrl.trim().replace(/\/?$/, '/');
  return new URL(`${normalizeRemoteDir(collectionPath)}/`, base).href;
}

function normalizeRemoteDir(remoteDir: string): string {
  return remoteDir.trim().replace(/^\/+/, '').replace(/\/+$/, '');
}

async function webDavRequest(
  syncSettings: WebDavSyncSettings,
  url: string,
  options: WebDavRequestOptions,
): Promise<Response> {
  return fetch(url, {
    method: options.method,
    body: options.body,
    headers: {
      ...authorizationHeaders(syncSettings),
      ...(options.headers ?? {}),
    },
  });
}

function authorizationHeaders(syncSettings: WebDavSyncSettings): Record<string, string> {
  if (!syncSettings.username && !syncSettings.password) return {};
  return {
    authorization: `Basic ${base64Encode(`${syncSettings.username}:${syncSettings.password}`)}`,
  };
}

function base64Encode(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function ensureSuccessfulResponse(response: Response, message: string): void {
  if (response.ok || response.status === 207) return;
  throw new Error(`${message}: HTTP ${response.status}`);
}

function assertWebDavUrl(syncSettings: WebDavSyncSettings): void {
  const url = new URL(buildRemoteFileUrl(syncSettings, WEBDAV_RULES_FILENAME));
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error('WebDAV server URL must start with http:// or https://');
  }
}

function combineEtags(...etags: Array<string | null | undefined>): string | undefined {
  const presentEtags = etags.filter((etag): etag is string => Boolean(etag));
  return presentEtags.length > 0 ? presentEtags.join('|') : undefined;
}

async function saveSyncState(
  settings: WebDavSyncSettings,
  lastResult: WebDavLastResult,
  lastMessage: string,
  hashes?: { localHash: string; remoteHash: string; remoteEtag?: string },
): Promise<void> {
  await saveWebDavSyncSettings({
    ...settings,
    lastSyncAt: Date.now(),
    lastResult,
    lastMessage,
    lastLocalHash: hashes?.localHash ?? settings.lastLocalHash,
    lastRemoteHash: hashes?.remoteHash ?? settings.lastRemoteHash,
    lastRemoteEtag: hashes?.remoteEtag ?? settings.lastRemoteEtag,
  });
}

function result(
  action: WebDavSyncAction,
  ok: boolean,
  message: string,
  summary?: WebDavSyncSummary,
): WebDavSyncResult {
  return { action, ok, message, summary };
}

function mergeSummaryMessage(
  base: string,
  summary: Omit<WebDavSyncSummary, 'uploaded'>,
): string {
  return `${base}: ${summary.added} added, ${summary.updatedFromRemote} remote updates, ${summary.keptLocalNewer} local newer, ${summary.keptLocalOnly} local-only kept`;
}

async function readStoredWebDavSyncSettings(): Promise<unknown> {
  if (hasExtensionStorage()) {
    const raw = await chrome.storage.local.get(WEBDAV_SYNC_STORAGE_KEY);
    return raw[WEBDAV_SYNC_STORAGE_KEY];
  }
  if (typeof localStorage === 'undefined') return undefined;
  const raw = localStorage.getItem(WEBDAV_SYNC_STORAGE_KEY);
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return undefined;
  }
}

async function writeStoredWebDavSyncSettings(settings: WebDavSyncSettings): Promise<void> {
  if (hasExtensionStorage()) {
    await chrome.storage.local.set({ [WEBDAV_SYNC_STORAGE_KEY]: settings });
    return;
  }
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(WEBDAV_SYNC_STORAGE_KEY, JSON.stringify(settings));
  }
}

function createClientId(): string {
  if (crypto.randomUUID) return `client_${crypto.randomUUID()}`;
  return `client_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function hasExtensionStorage(): boolean {
  return typeof chrome !== 'undefined' && chrome.storage?.local !== undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
