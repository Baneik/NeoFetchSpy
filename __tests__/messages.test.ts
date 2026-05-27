import { describe, expect, it } from 'vitest';
import { createRule, DEFAULT_SETTINGS, toPageRuntimeSettings } from '../src/core/rule-schema';
import {
  MESSAGE_CHANNEL,
  MESSAGE_SOURCE_BRIDGE,
  MESSAGE_SOURCE_PAGE,
  MESSAGE_VERSION,
  isPageReadyMessage,
  isSettingsMessage,
} from '../src/extension/messages';

describe('extension messages', () => {
  it('accepts strict runtime settings messages only', () => {
    const settings = toPageRuntimeSettings({
      ...DEFAULT_SETTINGS,
      rules: [createRule({
        id: 'r1',
        name: 'private name',
        scope: { pageHosts: ['example.com'] },
      })],
    });
    const message = {
      channel: MESSAGE_CHANNEL,
      version: MESSAGE_VERSION,
      source: MESSAGE_SOURCE_BRIDGE,
      type: 'settings',
      settings,
    };

    expect(isSettingsMessage(message)).toBe(true);
    expect('name' in message.settings.rules[0]).toBe(false);
    expect('scope' in message.settings.rules[0]).toBe(false);
    expect(isSettingsMessage({ ...message, version: 0 })).toBe(false);
    expect(isSettingsMessage({ ...message, source: MESSAGE_SOURCE_PAGE })).toBe(false);
    expect(isSettingsMessage({
      ...message,
      settings: {
        ...settings,
        rules: [{ ...settings.rules[0], actions: [{ type: 'unknown' }] }],
      },
    })).toBe(false);
    expect(isSettingsMessage({
      ...message,
      settings: {
        ...settings,
        rules: [{
          ...settings.rules[0],
          match: { ...settings.rules[0].match, postForm: { token: 123 } },
        }],
      },
    })).toBe(false);
    expect(isSettingsMessage({
      ...message,
      settings: {
        ...settings,
        rules: [{
          ...settings.rules[0],
          actions: [{
            type: 'filter',
            iterablePath: '$.data.items',
            condition: { field: 'title', operator: 'text_contains' },
          }],
        }],
      },
    })).toBe(false);
    expect(isSettingsMessage({
      ...message,
      settings: {
        ...settings,
        rules: [{
          ...settings.rules[0],
          actions: [{
            type: 'filter',
            iterablePath: '$.data.items',
            condition: { field: 'title', operator: 'regex', value: '^ad' },
          }],
        }],
      },
    })).toBe(false);
    expect(isSettingsMessage({
      ...message,
      settings: {
        ...settings,
        rules: [{
          ...settings.rules[0],
          actions: [{
            type: 'filter',
            iterablePath: '$.data.items',
            condition: { field: 'title', operator: 'text_regex', value: '^ad' },
          }],
        }],
      },
    })).toBe(true);
  });

  it('requires versioned page ready messages', () => {
    expect(isPageReadyMessage({
      channel: MESSAGE_CHANNEL,
      version: MESSAGE_VERSION,
      source: MESSAGE_SOURCE_PAGE,
      type: 'ready',
    })).toBe(true);

    expect(isPageReadyMessage({
      channel: MESSAGE_CHANNEL,
      source: MESSAGE_SOURCE_PAGE,
      type: 'ready',
    })).toBe(false);
  });
});
