import { normalizeSettings, toPageRuntimeSettings } from '../core/rule-schema';
import {
  MESSAGE_CHANNEL,
  MESSAGE_SOURCE_BRIDGE,
  MESSAGE_VERSION,
  isPageReadyMessage,
  type SettingsMessage,
} from './messages';
import { loadSettings, SETTINGS_STORAGE_KEY } from './storage';

const POST_DEBOUNCE_MS = 20;

let lastPostedAt = 0;
let pendingSettings: SettingsMessage['settings'] | null = null;
let pendingPostTimer: ReturnType<typeof setTimeout> | undefined;

void postCurrentSettings();

window.addEventListener('message', (event: MessageEvent<unknown>) => {
  if (event.source !== window || !isPageReadyMessage(event.data)) return;
  void postCurrentSettings();
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'local' || !changes[SETTINGS_STORAGE_KEY]) return;
  const nextSettings = toPageRuntimeSettings(normalizeSettings(changes[SETTINGS_STORAGE_KEY].newValue));
  schedulePostSettings(nextSettings);
});

async function postCurrentSettings(): Promise<void> {
  schedulePostSettings(toPageRuntimeSettings(await loadSettings()));
}

function schedulePostSettings(settings: SettingsMessage['settings']): void {
  pendingSettings = settings;
  const now = Date.now();
  const delay = Math.max(0, POST_DEBOUNCE_MS - (now - lastPostedAt));

  if (delay === 0) {
    flushPendingSettings();
    return;
  }

  pendingPostTimer ??= setTimeout(flushPendingSettings, delay);
}

function flushPendingSettings(): void {
  if (!pendingSettings) return;
  const settings = pendingSettings;
  pendingSettings = null;
  pendingPostTimer = undefined;
  lastPostedAt = Date.now();

  window.postMessage(
    {
      channel: MESSAGE_CHANNEL,
      version: MESSAGE_VERSION,
      source: MESSAGE_SOURCE_BRIDGE,
      type: 'settings',
      settings,
    } satisfies SettingsMessage,
    messageTargetOrigin(),
  );
}

function messageTargetOrigin(): string {
  return window.location.origin && window.location.origin !== 'null' ? window.location.origin : '*';
}
