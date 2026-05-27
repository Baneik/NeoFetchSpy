import { DEFAULT_SETTINGS, normalizeSettings } from '../core/rule-schema';
import type { RuntimeSettings } from '../core/types';

export const SETTINGS_STORAGE_KEY = 'neofetchspy_settings';

export async function ensureSettings(): Promise<RuntimeSettings> {
  const raw = await readStoredSettings();
  if (raw === undefined) {
    const settings = { ...DEFAULT_SETTINGS, updatedAt: Date.now() };
    await saveSettings(settings);
    return settings;
  }
  return normalizeSettings(raw);
}

export async function loadSettings(): Promise<RuntimeSettings> {
  return normalizeSettings(await readStoredSettings());
}

export async function saveSettings(settings: RuntimeSettings): Promise<void> {
  await writeStoredSettings({
    ...settings,
    updatedAt: Date.now(),
  });
}

export async function updateSettings(
  updater: (settings: RuntimeSettings) => RuntimeSettings,
): Promise<RuntimeSettings> {
  const current = await loadSettings();
  const next = updater(current);
  await saveSettings(next);
  return next;
}

async function readStoredSettings(): Promise<unknown> {
  if (hasExtensionStorage()) {
    const raw = await chrome.storage.local.get(SETTINGS_STORAGE_KEY);
    return raw[SETTINGS_STORAGE_KEY];
  }
  if (typeof localStorage === 'undefined') return undefined;
  const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return undefined;
  }
}

async function writeStoredSettings(settings: RuntimeSettings): Promise<void> {
  if (hasExtensionStorage()) {
    await chrome.storage.local.set({ [SETTINGS_STORAGE_KEY]: settings });
    return;
  }
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  }
}

function hasExtensionStorage(): boolean {
  return typeof chrome !== 'undefined' && chrome.storage?.local !== undefined;
}
