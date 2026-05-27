import { describe, expect, it } from 'vitest';
import { detectLocale, translate } from '../src/ui/i18n';

describe('ui i18n', () => {
  it('detects the first supported browser language', () => {
    expect(detectLocale(['fr-FR', 'ja-JP', 'en-US'])).toBe('ja');
    expect(detectLocale(['zh-TW'])).toBe('zh-CN');
    expect(detectLocale(['de-DE'])).toBe('en');
  });

  it('renders translated messages with variables', () => {
    expect(translate('en', 'enabledCount', { active: 2, total: 3 })).toBe('2 / 3 enabled');
    expect(translate('ja', 'openOptions')).toBe('設定を開く');
    expect(translate('zh-CN', 'actions')).toBe('操作');
    expect(translate('zh-CN', 'filterAction')).toBe('过滤');
  });
});
