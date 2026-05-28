import { ensureSettings, loadSettings } from './storage';
import { runWebDavSyncAction, type WebDavSyncAction } from './webdav-sync';

chrome.runtime.onInstalled.addListener(() => {
  void ensureSettings();
});

chrome.runtime.onStartup.addListener(() => {
  void ensureSettings();
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'neofetchspy:get-settings') {
    void loadSettings()
      .then((settings) => sendResponse({ ok: true, settings }))
      .catch((error) => sendResponse({ ok: false, error: String(error) }));

    return true;
  }

  if (message?.type === 'neofetchspy:webdav-sync' && isWebDavSyncAction(message.action)) {
    void runWebDavSyncAction(message.action)
      .then((syncResult) => sendResponse({ ok: syncResult.ok, result: syncResult }))
      .catch((error) => sendResponse({ ok: false, error: String(error) }));

    return true;
  }

  return false;
});

function isWebDavSyncAction(value: unknown): value is WebDavSyncAction {
  return value === 'test' || value === 'upload' || value === 'pull' || value === 'auto';
}
