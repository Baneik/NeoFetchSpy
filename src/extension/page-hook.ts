import { DEFAULT_SETTINGS, normalizePageRuntimeSettings, toPageRuntimeSettings } from '../core/rule-schema';
import { createRuleIndex, type CompiledRuleIndex } from '../core/rule-index';
import type { PageRuntimeSettings } from '../core/types';
import { interceptFetch as processInterceptedFetch } from './fetch-interceptor';
import {
  MESSAGE_CHANNEL,
  MESSAGE_SOURCE_BRIDGE,
  MESSAGE_SOURCE_PAGE,
  MESSAGE_VERSION,
  isSettingsMessage,
  type PageReadyMessage,
} from './messages';

const INSTALL_KEY = '__neofetchspy_fetch_interceptor__';

let settings: PageRuntimeSettings = toPageRuntimeSettings(DEFAULT_SETTINGS);
let ruleIndex: CompiledRuleIndex = createRuleIndex(settings);

installInterceptor();
announceReady();

window.addEventListener('message', (event: MessageEvent<unknown>) => {
  if (event.source !== window || !isSettingsMessage(event.data)) return;
  if (event.data.source !== MESSAGE_SOURCE_BRIDGE || event.data.type !== 'settings') return;
  const nextSettings = normalizePageRuntimeSettings(event.data.settings);
  if (!nextSettings) return;
  settings = nextSettings;
  ruleIndex = createRuleIndex(settings);
  debugLog('settings updated', ruleIndex.enabledRuleCount);
});

function installInterceptor(): void {
  const globalFlags = window as Window & typeof globalThis & Record<string, unknown>;
  if (globalFlags[INSTALL_KEY]) return;
  globalFlags[INSTALL_KEY] = true;

  const realFetch = window.fetch.bind(window);

  Object.defineProperty(window, 'fetch', {
    configurable: true,
    enumerable: true,
    writable: true,
    value: new Proxy(realFetch, {
      apply(_target, _thisArg, args: [RequestInfo | URL, RequestInit?]) {
        return processInterceptedFetch(realFetch, args[0], args[1], {
          ruleIndex,
          debugLog,
        });
      },
    }),
  });

  debugLog('fetch interceptor installed');
}

function announceReady(): void {
  window.postMessage(
    {
      channel: MESSAGE_CHANNEL,
      version: MESSAGE_VERSION,
      source: MESSAGE_SOURCE_PAGE,
      type: 'ready',
    } satisfies PageReadyMessage,
    messageTargetOrigin(),
  );
}

function debugLog(...args: unknown[]): void {
  if (settings.debug) {
    console.debug('[NeoFetchSPY]', ...args);
  }
}

function messageTargetOrigin(): string {
  return window.location.origin && window.location.origin !== 'null' ? window.location.origin : '*';
}
