import { loadSettings, saveSettings } from '../extension/storage';
import type { RuntimeSettings } from '../core/types';
import {
  getLanguagePreference,
  initializeI18n,
  languageOptions,
  setLanguagePreference,
  t,
  type LanguagePreference,
} from './i18n';
import { createElement } from './shared';
import './styles/popup.css';

const root = document.getElementById('popup-root');
let settings: RuntimeSettings;

void init();

async function init(): Promise<void> {
  if (!root) return;
  const [loadedSettings] = await Promise.all([loadSettings(), initializeI18n()]);
  settings = loadedSettings;
  render();
}

function render(): void {
  if (!root) return;
  root.innerHTML = '';

  const card = createElement('section', { className: 'nfs-popup' });
  const header = createElement('header');
  const title = createElement('div');
  title.appendChild(createElement('h1', { text: 'NeoFetchSPY' }));
  title.appendChild(createElement('p', {
    text: t('enabledCount', { active: activeRuleCount(), total: settings.rules.length }),
  }));
  header.append(title, createSwitch(settings.enabled, t('switchGlobalAria'), async (enabled) => {
    settings.enabled = enabled;
    await saveSettings(settings);
    settings = await loadSettings();
    render();
  }));

  const language = createElement('label', { className: 'nfs-popup-language' });
  language.appendChild(createElement('span', { text: t('language') }));
  language.appendChild(createLanguageSelect());

  const rules = createElement('div', { className: 'nfs-popup-rules' });
  if (settings.rules.length === 0) {
    rules.appendChild(createElement('div', { className: 'nfs-popup-empty', text: t('noMatchingRules') }));
  } else {
    for (const rule of settings.rules) {
      const ruleName = rule.name || t('unnamedRule');
      const row = createElement('div', {
        className: `nfs-popup-rule${rule.enabled ? '' : ' is-disabled'}`,
      });
      row.appendChild(createElement('strong', { text: ruleName }));
      row.appendChild(createSwitch(rule.enabled, `${t('switchRuleAria')}: ${ruleName}`, async (enabled) => {
        rule.enabled = enabled;
        await saveSettings(settings);
        settings = await loadSettings();
        render();
      }));
      rules.appendChild(row);
    }
  }

  const openOptions = createElement('button', {
    className: 'nfs-popup-primary',
    text: t('openOptions'),
  });
  openOptions.type = 'button';
  openOptions.addEventListener('click', () => {
    if (typeof chrome !== 'undefined' && chrome.runtime?.openOptionsPage) {
      void chrome.runtime.openOptionsPage();
      window.close();
      return;
    }
    window.location.assign('./options.html');
  });

  card.append(header, language, rules, openOptions);
  root.appendChild(card);
}

function activeRuleCount(): number {
  return settings.rules.filter((rule) => rule.enabled).length;
}

function createLanguageSelect(): HTMLSelectElement {
  const select = createElement('select', { attrs: { 'aria-label': t('language') } });
  for (const [value, label] of languageOptions()) {
    const option = createElement('option', { text: label, attrs: { value } });
    option.selected = value === getLanguagePreference();
    select.appendChild(option);
  }
  select.addEventListener('change', () => {
    void setLanguagePreference(select.value as LanguagePreference).then(() => render());
  });
  return select;
}

function createSwitch(
  checked: boolean,
  accessibleName: string,
  onChange: (checked: boolean) => void | Promise<void>,
): HTMLElement {
  const label = createElement('label', { className: 'nfs-popup-switch' });
  const input = createElement('input', { attrs: { type: 'checkbox', 'aria-label': accessibleName } });
  input.checked = checked;
  input.addEventListener('change', () => void onChange(input.checked));
  label.append(input, createElement('span'));
  return label;
}
