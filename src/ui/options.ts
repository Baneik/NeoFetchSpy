import { createRule, generateRuleId, parseRulesImport, validateRule } from '../core/rule-schema';
import { formatPageHostsText, parsePageHostsText } from '../core/rule-scope';
import type {
  Action,
  FilterAction,
  FilterOperator,
  RegexAction,
  ReplaceAction,
  Rule,
  RuntimeSettings,
} from '../core/types';
import { loadSettings, saveSettings } from '../extension/storage';
import {
  loadWebDavSyncSettings,
  runWebDavSyncAction,
  saveWebDavSyncSettings,
  validateWebDavSyncSettings,
  type WebDavSyncAction,
  type WebDavSyncResult,
  type WebDavSyncSettings,
} from '../extension/webdav-sync';
import {
  getLanguagePreference,
  getLocale,
  initializeI18n,
  languageOptions,
  setLanguagePreference,
  t,
  translateValidationError,
  type LanguagePreference,
  type TranslationKey,
  type TranslationValues,
} from './i18n';
import { createElement, downloadText, formatDate } from './shared';
import './styles/options.css';

const root = document.getElementById('options-root');
const REPOSITORY_URL = 'https://github.com/Baneik/NeoFetchSpy';
const WEBDAV_QUICK_CONFIG_FORMAT = 'neofetchspy-webdav-config';

type StatusMessage =
  | { key: TranslationKey; values?: TranslationValues }
  | { validationErrors: string[] }
  | { raw: string };

type ActivePane = 'rule' | 'settings';

type FieldSize =
  | 'name'
  | 'page-hosts'
  | 'url'
  | 'path'
  | 'field-path'
  | 'operator'
  | 'json-value'
  | 'replacement'
  | 'pattern'
  | 'flags'
  | 'webdav-url'
  | 'webdav-credential'
  | 'webdav-quick-config';

let settings: RuntimeSettings;
let webDavSettings: WebDavSyncSettings;
let webDavQuickConfigText = '';
let selectedRuleId: string | null = null;
let activePane: ActivePane = 'rule';
let searchText = '';
let statusMessage: StatusMessage | null = null;

void init();

async function init(): Promise<void> {
  if (!root) return;
  const [loadedSettings, loadedWebDavSettings] = await Promise.all([
    loadSettings(),
    loadWebDavSyncSettings(),
    initializeI18n(),
  ]);
  settings = loadedSettings;
  webDavSettings = loadedWebDavSettings;
  webDavQuickConfigText = webDavSettings.quickConfig;
  selectedRuleId = settings.rules[0]?.id ?? null;
  render();
}

function render(): void {
  if (!root) return;
  root.innerHTML = '';
  document.title = t('optionsTitle');

  const shell = createElement('section', { className: 'nfs-shell' });
  shell.appendChild(renderSidebar());
  shell.appendChild(renderEditorPane());
  root.appendChild(shell);
}

function renderSidebar(): HTMLElement {
  const sidebar = createElement('aside', { className: 'nfs-sidebar' });

  const brand = createElement('div', { className: 'nfs-brand' });
  const title = createElement('h1');
  title.appendChild(createElement('a', {
    text: 'NeoFetchSPY',
    attrs: {
      href: REPOSITORY_URL,
      target: '_blank',
      rel: 'noreferrer',
    },
  }));
  brand.appendChild(title);
  brand.appendChild(iconButton('⚙', activePane === 'settings' ? t('closeSettings') : t('openSettings'), () => {
    activePane = activePane === 'settings' ? 'rule' : 'settings';
    render();
  }, activePane === 'settings'));

  const globalRow = createElement('div', { className: 'nfs-global' });
  globalRow.appendChild(createElement('span', { text: t('globalEnabled') }));
  globalRow.appendChild(createSwitch(settings.enabled, t('switchGlobalAria'), async (enabled) => {
    settings.enabled = enabled;
    await persist('globalStatusUpdated');
  }));

  const tools = createElement('div', { className: 'nfs-tools' });
  const addBtn = button(t('new'), 'primary', () => {
    const rule = createEmptyRule();
    activePane = 'rule';
    settings.rules.unshift(rule);
    selectedRuleId = rule.id;
    void persist('ruleCreated');
  });
  const importBtn = button(t('import'), 'secondary', importRules);
  const exportBtn = button(t('export'), 'secondary', exportRules);
  tools.append(addBtn, importBtn, exportBtn);

  const search = createElement('input', {
    className: 'nfs-search',
    attrs: {
      type: 'search',
      placeholder: t('searchRules'),
      value: searchText,
    },
  });
  search.addEventListener('input', () => {
    searchText = search.value;
    render();
  });

  const list = createElement('div', { className: 'nfs-rule-list' });
  const rules = filteredRules();

  if (rules.length === 0) {
    list.appendChild(createElement('div', { className: 'nfs-empty', text: t('noMatchingRules') }));
  } else {
    for (const rule of rules) {
      list.appendChild(renderRuleListItem(rule));
    }
  }

  const footer = createElement('div', { className: 'nfs-sidebar-footer' });
  footer.textContent = renderedStatusMessage();

  sidebar.append(brand, globalRow, tools, search, list, footer);
  return sidebar;
}

function renderLanguageField(): HTMLElement {
  const field = createElement('div', { className: 'nfs-field nfs-settings-field' });
  field.appendChild(createElement('label', { text: t('language') }));
  const select = createSelect(languageOptions(), getLanguagePreference(), (value) => {
    void setLanguagePreference(value as LanguagePreference).then(() => render());
  });
  select.setAttribute('aria-label', t('language'));
  field.appendChild(select);
  return field;
}

function renderRuleListItem(rule: Rule): HTMLElement {
  const item = createElement('button', {
    className: `nfs-rule-item${rule.id === selectedRuleId ? ' is-selected' : ''}`,
  });
  item.type = 'button';
  item.addEventListener('click', () => {
    activePane = 'rule';
    selectedRuleId = rule.id;
    render();
  });

  const top = createElement('div', { className: 'nfs-rule-item-top' });
  top.appendChild(createElement('strong', { text: rule.name || t('unnamedRule') }));
  top.appendChild(createElement('span', {
    className: rule.enabled ? 'nfs-pill is-on' : 'nfs-pill',
    text: rule.enabled ? 'ON' : 'OFF',
  }));

  item.appendChild(top);
  item.appendChild(createElement('code', { text: rule.match.url }));
  return item;
}

function renderEditorPane(): HTMLElement {
  const pane = createElement('main', { className: 'nfs-editor-pane' });
  if (activePane === 'settings') return renderSettingsPane(pane);

  const rule = selectedRule();

  if (!rule) {
    const empty = createElement('div', { className: 'nfs-editor-empty' });
    empty.appendChild(createElement('h2', { text: t('chooseOrCreateRule') }));
    empty.appendChild(button(t('newRule'), 'primary', () => {
      const next = createEmptyRule();
      activePane = 'rule';
      settings.rules.unshift(next);
      selectedRuleId = next.id;
      void persist('ruleCreated');
    }));
    pane.appendChild(empty);
    return pane;
  }

  const header = createElement('header', { className: 'nfs-editor-header' });
  const titleBlock = createElement('div');
  titleBlock.appendChild(createElement('h2', { text: rule.name || t('unnamedRule') }));
  titleBlock.appendChild(createElement('p', { text: `ID ${rule.id}` }));

  const headerActions = createElement('div', { className: 'nfs-header-actions' });
  headerActions.appendChild(createSwitch(rule.enabled, t('switchRuleAria'), (enabled) => {
    rule.enabled = enabled;
    void persist('ruleStatusUpdated');
  }));
  headerActions.appendChild(button(t('duplicate'), 'secondary', () => duplicateRule(rule)));
  headerActions.appendChild(button(t('delete'), 'danger', () => deleteRule(rule)));
  headerActions.appendChild(button(t('save'), 'primary', () => saveCurrentRule(rule)));

  header.append(titleBlock, headerActions);

  const body = createElement('div', { className: 'nfs-editor-body' });
  body.appendChild(renderBasicSection(rule));
  body.appendChild(renderMatchSection(rule));
  body.appendChild(renderActionsSection(rule));

  const content = createElement('div', { className: 'nfs-editor-content' });
  content.append(header, body);
  pane.appendChild(content);
  return pane;
}

function renderSettingsPane(pane: HTMLElement): HTMLElement {
  const header = createElement('header', { className: 'nfs-editor-header' });
  const titleBlock = createElement('div');
  titleBlock.appendChild(createElement('h2', { text: t('settings') }));
  header.appendChild(titleBlock);

  const section = sectionCard(t('preferences'), 'nfs-section-settings');
  const fields = createElement('div', { className: 'nfs-settings-fields' });
  fields.appendChild(renderLanguageField());
  section.appendChild(fields);

  const body = createElement('div', { className: 'nfs-editor-body nfs-settings-body' });
  body.appendChild(section);
  body.appendChild(renderWebDavSection());
  body.appendChild(renderPresetsSection());

  const content = createElement('div', { className: 'nfs-editor-content nfs-settings-content' });
  content.append(header, body);
  pane.appendChild(content);
  return pane;
}

function renderWebDavSection(): HTMLElement {
  const section = sectionCard(t('webDavSync'), 'nfs-section-webdav');
  const grid = createElement('div', { className: 'nfs-webdav-grid' });

  const enabledRow = createElement('div', { className: 'nfs-inline-row nfs-webdav-switch' });
  enabledRow.appendChild(createElement('span', { text: t('webDavEnabled') }));
  enabledRow.appendChild(createSwitch(webDavSettings.enabled, t('webDavEnabled'), (enabled) => {
    webDavSettings.enabled = enabled;
    clearWebDavQuickConfig();
    void persistWebDavSettings('webDavSettingsSaved');
  }));

  const autoRow = createElement('div', { className: 'nfs-inline-row nfs-webdav-switch' });
  autoRow.appendChild(createElement('span', { text: t('webDavAutoSync') }));
  autoRow.appendChild(createSwitch(webDavSettings.autoSync, t('webDavAutoSync'), (enabled) => {
    webDavSettings.autoSync = enabled;
    clearWebDavQuickConfig();
    void persistWebDavSettings('webDavSettingsSaved');
  }));

  grid.appendChild(enabledRow);
  grid.appendChild(autoRow);
  grid.appendChild(textField(t('webDavServerUrl'), webDavSettings.serverUrl, (value) => {
    webDavSettings.serverUrl = value;
    clearWebDavQuickConfig();
  }, 'https://example.com/dav/', 'webdav-url'));
  grid.appendChild(webDavUsernameField());
  grid.appendChild(textField(t('webDavPassword'), webDavSettings.password, (value) => {
    webDavSettings.password = value;
    clearWebDavQuickConfig();
  }, '', 'webdav-credential', 'password'));
  grid.appendChild(textField(t('webDavQuickConfig'), webDavQuickConfigText, (value) => {
    webDavQuickConfigText = value;
  }, '', 'webdav-quick-config', 'text', { 'data-nfs-webdav-quick-config': 'true' }));

  const actions = createElement('div', { className: 'nfs-webdav-actions' });
  actions.appendChild(button(t('webDavSave'), 'secondary', () => {
    void validateAndSaveWebDavSettings();
  }));
  actions.appendChild(button(t('webDavParseQuickConfig'), 'secondary', () => {
    void importWebDavQuickConfig();
  }));
  actions.appendChild(button(t('webDavUpload'), 'secondary', () => {
    if (!window.confirm(t('confirmWebDavUpload'))) return;
    void runWebDavAction('upload');
  }));
  actions.appendChild(button(t('webDavPull'), 'secondary', () => {
    if (!window.confirm(t('confirmWebDavPull'))) return;
    void runWebDavAction('pull');
  }));

  const status = createElement('p', {
    className: `nfs-webdav-status is-${webDavSettings.lastResult}`,
    text: webDavStatusText(),
  });

  section.append(grid, actions, status);
  return section;
}

function renderPresetsSection(): HTMLElement {
  const section = sectionCard(t('presets'), 'nfs-section-presets');
  section.appendChild(keyValueEditor(t('presetEntries'), settings.presets, (next) => {
    settings.presets = next;
  }));

  const actions = createElement('div', { className: 'nfs-preset-actions' });
  actions.appendChild(button(t('savePresets'), 'primary', () => {
    void persist('presetsSaved');
  }));
  section.appendChild(actions);
  return section;
}

function renderBasicSection(rule: Rule): HTMLElement {
  const section = sectionCard(t('basic'), 'nfs-section-basic');
  const fields = createElement('div', { className: 'nfs-basic-fields' });
  fields.appendChild(textField(t('ruleName'), rule.name, (value) => {
    rule.name = value;
  }, t('placeholderRuleName'), 'name'));
  fields.appendChild(textField(t('pageHosts'), formatPageHostsText(rule.scope?.pageHosts), (value) => {
    const pageHosts = parsePageHostsText(value);
    rule.scope = pageHosts ? { pageHosts } : undefined;
  }, t('placeholderPageHosts'), 'page-hosts'));

  const responseRow = createElement('div', { className: 'nfs-field nfs-field-response' });
  responseRow.appendChild(createElement('label', { text: t('responseType') }));
  const select = createSelect(
    [
      ['auto', t('automatic')],
      ['json', 'JSON'],
      ['text', 'Text'],
    ],
    rule.responseType ?? 'auto',
    (value) => {
      rule.responseType = value === 'json' || value === 'text' ? value : undefined;
    },
  );
  responseRow.appendChild(select);
  fields.appendChild(responseRow);

  const debugRow = createElement('div', { className: 'nfs-inline-row nfs-basic-debug' });
  debugRow.appendChild(createElement('span', { text: t('debugLogs') }));
  debugRow.appendChild(createSwitch(settings.debug, t('switchDebugAria'), async (enabled) => {
    settings.debug = enabled;
    await persist('debugUpdated');
  }));
  fields.appendChild(debugRow);
  section.appendChild(fields);
  return section;
}

function renderMatchSection(rule: Rule): HTMLElement {
  const section = sectionCard(t('match'), 'nfs-section-match');
  const primaryFields = createElement('div', { className: 'nfs-match-primary' });
  primaryFields.appendChild(textField(t('urlWildcard'), rule.match.url, (value) => {
    rule.match.url = value;
  }, t('placeholderUrlWildcard'), 'url'));

  const methodField = createElement('div', { className: 'nfs-field nfs-field-method' });
  methodField.appendChild(createElement('label', { text: 'HTTP Method' }));
  methodField.appendChild(createSelect(
    ['*', 'GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'].map((method) => [method, method]),
    rule.match.method ?? '*',
    (value) => {
      rule.match.method = value as Rule['match']['method'];
    },
  ));
  primaryFields.appendChild(methodField);
  section.appendChild(primaryFields);

  section.appendChild(keyValueEditor(t('queryParameters'), rule.match.query ?? {}, (next) => {
    rule.match.query = Object.keys(next).length ? next : undefined;
  }));
  section.appendChild(keyValueEditor(t('postFormParameters'), rule.match.postForm ?? {}, (next) => {
    rule.match.postForm = Object.keys(next).length ? next : undefined;
  }));
  section.appendChild(keyValueEditor('Headers', rule.match.headers ?? {}, (next) => {
    rule.match.headers = Object.keys(next).length ? next : undefined;
  }));

  return section;
}

function renderActionsSection(rule: Rule): HTMLElement {
  const section = sectionCard(t('actions'), 'nfs-section-actions');
  const list = createElement('div', { className: 'nfs-actions' });

  rule.actions.forEach((action, index) => {
    list.appendChild(renderActionEditor(rule, action, index));
  });

  const addRow = createElement('div', { className: 'nfs-add-action-row' });
  addRow.appendChild(button(t('addJsonFilter'), 'secondary', () => addAction(rule, {
    type: 'filter',
    iterablePath: '',
    condition: { field: '', operator: 'exists' },
  })));
  addRow.appendChild(button(t('addReplacement'), 'secondary', () => addAction(rule, {
    type: 'replace',
    path: '',
    value: undefined,
  })));
  addRow.appendChild(button(t('addRegex'), 'secondary', () => addAction(rule, {
    type: 'regex',
    pattern: '',
    flags: undefined,
    replacement: '',
  })));

  section.append(list, addRow);
  return section;
}

function renderActionEditor(rule: Rule, action: Action, index: number): HTMLElement {
  const card = createElement('article', { className: 'nfs-action-card' });
  const top = createElement('div', { className: 'nfs-action-top' });
  top.appendChild(createElement('strong', { text: t('actionNumber', { index: index + 1 }) }));

  const controls = createElement('div', { className: 'nfs-action-controls' });
  const actionType = createSelect(
    [
      ['filter', t('filterAction')],
      ['delete', t('deleteAction')],
      ['replace', t('replaceAction')],
      ['regex', t('regexAction')],
    ],
    action.type,
    (value) => {
      rule.actions[index] = defaultAction(value as Action['type']);
      render();
    },
  );
  actionType.className = 'nfs-action-type';
  controls.appendChild(actionType);
  controls.appendChild(button(t('moveUp'), 'ghost', () => moveAction(rule, index, -1)));
  controls.appendChild(button(t('moveDown'), 'ghost', () => moveAction(rule, index, 1)));
  controls.appendChild(button(t('remove'), 'danger-ghost', () => {
    rule.actions.splice(index, 1);
    render();
  }));
  top.appendChild(controls);

  const body = createElement('div', { className: 'nfs-action-body' });
  if (action.type === 'delete') {
    body.appendChild(textField('JSONPath', action.path, (value) => {
      action.path = value;
    }, t('placeholderJsonPath'), 'path'));
  }

  if (action.type === 'replace') {
    body.appendChild(textField('JSONPath', action.path, (value) => {
      action.path = value;
    }, t('placeholderJsonPath'), 'path'));
    body.appendChild(jsonValueField(t('newValue'), action.value, (value) => {
      (action as ReplaceAction).value = value;
    }, 'json-value'));
  }

  if (action.type === 'filter') {
    body.appendChild(textField(t('arrayPath'), action.iterablePath, (value) => {
      (action as FilterAction).iterablePath = value;
    }, t('placeholderArrayPath'), 'path'));
    body.appendChild(textField(t('fieldPath'), action.condition.field, (value) => {
      (action as FilterAction).condition.field = value;
    }, t('placeholderFieldPath'), 'field-path'));

    const operatorField = createElement('div', { className: 'nfs-field nfs-field-operator' });
    operatorField.appendChild(createElement('label', { text: t('condition') }));
    operatorField.appendChild(createConditionSelect(
      action.condition.operator,
      (value) => {
        (action as FilterAction).condition.operator = value as FilterAction['condition']['operator'];
        if (!conditionNeedsValue(value as FilterOperator)) {
          (action as FilterAction).condition.value = undefined;
        } else if ((action as FilterAction).condition.value === undefined) {
          (action as FilterAction).condition.value = '';
        }
        render();
      },
    ));
    body.appendChild(operatorField);

    if (conditionNeedsValue(action.condition.operator)) {
      body.appendChild(textField(t('compareValue'), stringifyValue(action.condition.value), (value) => {
        (action as FilterAction).condition.value = value;
      }, conditionValuePlaceholder(action.condition.operator), 'json-value'));
    }
  }

  if (action.type === 'regex') {
    body.appendChild(textField('Pattern', action.pattern, (value) => {
      (action as RegexAction).pattern = value;
    }, t('placeholderRegexPattern'), 'pattern'));
    body.appendChild(textField('Flags', action.flags ?? '', (value) => {
      (action as RegexAction).flags = value || undefined;
    }, t('placeholderRegexFlags'), 'flags'));
    body.appendChild(textareaField(t('replacement'), action.replacement, (value) => {
      (action as RegexAction).replacement = value;
    }, 'replacement', t('placeholderReplacement')));
  }

  card.append(top, body);
  return card;
}

function keyValueEditor(
  title: string,
  values: Record<string, string>,
  onChange: (next: Record<string, string>) => void,
): HTMLElement {
  const wrapper = createElement('div', { className: 'nfs-kv' });
  const heading = createElement('div', { className: 'nfs-kv-heading' });
  heading.appendChild(createElement('label', { text: title }));
  heading.appendChild(button(t('add'), 'ghost', () => {
    onChange({ ...values, '': '' });
    render();
  }));
  wrapper.appendChild(heading);

  const entries = Object.entries(values);
  if (entries.length === 0) {
    wrapper.appendChild(createElement('div', { className: 'nfs-kv-empty', text: t('notSet') }));
    return wrapper;
  }

  entries.forEach(([key, value], index) => {
    const row = createElement('div', { className: 'nfs-kv-row' });
    const keyField = createElement('label', { className: 'nfs-kv-cell' });
    keyField.appendChild(createElement('span', { text: t('entryKey') }));
    const keyInput = createElement('input', { attrs: { value: key, placeholder: t('placeholderEntryKey') } });
    const valueField = createElement('label', { className: 'nfs-kv-cell' });
    valueField.appendChild(createElement('span', { text: t('entryValue') }));
    const valueInput = createElement('input', { attrs: { value, placeholder: t('placeholderEntryValue') } });
    const remove = button(t('remove'), 'ghost', () => {
      const next = Object.fromEntries(entries.filter((_, i) => i !== index));
      onChange(next);
      render();
    });

    keyInput.addEventListener('input', () => {
      const next = Object.fromEntries(entries);
      delete next[key];
      if (keyInput.value) next[keyInput.value] = valueInput.value;
      onChange(next);
    });
    valueInput.addEventListener('input', () => {
      const next = Object.fromEntries(entries);
      if (key) next[key] = valueInput.value;
      onChange(next);
    });

    keyField.appendChild(keyInput);
    valueField.appendChild(valueInput);
    row.append(keyField, valueField, remove);
    wrapper.appendChild(row);
  });

  return wrapper;
}

function sectionCard(title: string, className = ''): HTMLElement {
  const section = createElement('section', {
    className: `nfs-section${className ? ` ${className}` : ''}`,
  });
  section.appendChild(createElement('h3', { text: title }));
  return section;
}

function textField(
  label: string,
  value: string,
  onInput: (value: string) => void,
  placeholder = '',
  size?: FieldSize,
  inputType = 'text',
  attrs: Record<string, string> = {},
): HTMLElement {
  const field = createElement('div', {
    className: `nfs-field${size ? ` nfs-field-${size}` : ''}`,
  });
  field.appendChild(createElement('label', { text: label }));
  const input = createElement('input', {
    attrs: {
      ...attrs,
      type: inputType,
      value,
      placeholder,
    },
  });
  input.addEventListener('input', () => onInput(input.value));
  field.appendChild(input);
  return field;
}

function webDavUsernameField(): HTMLElement {
  const field = createElement('div', { className: 'nfs-field nfs-field-webdav-credential' });
  field.appendChild(createElement('label', { text: t('webDavUsername') }));
  const input = createElement('input', {
    attrs: {
      type: 'text',
      value: maskedWebDavUsername(),
    },
  });

  input.addEventListener('focus', () => {
    input.value = webDavSettings.username;
  });
  input.addEventListener('blur', () => {
    input.value = maskedWebDavUsername();
  });
  input.addEventListener('input', () => {
    webDavSettings.username = input.value;
    clearWebDavQuickConfig();
  });

  field.appendChild(input);
  return field;
}

function maskedWebDavUsername(): string {
  return '*'.repeat(webDavSettings.username.length);
}

function textareaField(
  label: string,
  value: string,
  onInput: (value: string) => void,
  size?: FieldSize,
  placeholder = '',
): HTMLElement {
  const field = createElement('div', {
    className: `nfs-field${size ? ` nfs-field-${size}` : ''}`,
  });
  field.appendChild(createElement('label', { text: label }));
  const textarea = createElement('textarea');
  textarea.value = value;
  textarea.placeholder = placeholder;
  textarea.addEventListener('input', () => onInput(textarea.value));
  field.appendChild(textarea);
  return field;
}

function jsonValueField(
  label: string,
  value: unknown,
  onInput: (value: unknown) => void,
  size?: FieldSize,
): HTMLElement {
  return textareaField(label, stringifyValue(value), (raw) => {
    try {
      onInput(JSON.parse(raw));
    } catch {
      onInput(raw);
    }
  }, size, t('placeholderJsonValue'));
}

function createSelect(
  options: Array<[string, string]>,
  value: string,
  onChange: (value: string) => void,
): HTMLSelectElement {
  const select = createElement('select');
  for (const [optionValue, label] of options) {
    const option = createElement('option', {
      text: label,
      attrs: { value: optionValue },
    });
    option.selected = optionValue === value;
    select.appendChild(option);
  }
  select.addEventListener('change', () => onChange(select.value));
  return select;
}

function createConditionSelect(
  value: FilterOperator,
  onChange: (value: string) => void,
): HTMLSelectElement {
  const groups: Array<[string, Array<[FilterOperator, string]>]> = [
    [t('conditionGroupPath'), [
      ['exists', t('exists')],
      ['not_exists', t('notExists')],
    ]],
    [t('conditionGroupEmpty'), [
      ['is_empty', t('isEmpty')],
      ['is_not_empty', t('isNotEmpty')],
    ]],
    [t('conditionGroupText'), [
      ['text_equals', t('textEquals')],
      ['text_not_equals', t('textNotEquals')],
      ['text_contains', t('textContains')],
      ['text_not_contains', t('textNotContains')],
      ['text_regex', t('regexMatch')],
    ]],
    [t('conditionGroupNumber'), [
      ['number_equals', t('numberEquals')],
      ['number_not_equals', t('numberNotEquals')],
      ['number_gt', t('numberGreaterThan')],
      ['number_gte', t('numberGreaterThanOrEqual')],
      ['number_lt', t('numberLessThan')],
      ['number_lte', t('numberLessThanOrEqual')],
    ]],
  ];

  const select = createElement('select');
  for (const [label, options] of groups) {
    const group = document.createElement('optgroup');
    group.label = label;
    for (const [optionValue, optionLabel] of options) {
      const option = createElement('option', {
        text: optionLabel,
        attrs: { value: optionValue },
      });
      option.selected = optionValue === value;
      group.appendChild(option);
    }
    select.appendChild(group);
  }
  select.addEventListener('change', () => onChange(select.value));
  return select;
}

function conditionNeedsValue(operator: FilterOperator): boolean {
  return operator.startsWith('text_') || operator.startsWith('number_');
}

function conditionValuePlaceholder(operator: FilterOperator): string {
  if (operator === 'text_regex') return t('placeholderRegexPattern');
  if (operator === 'text_contains' || operator === 'text_not_contains') {
    return t('placeholderKeywords');
  }
  if (operator.startsWith('number_')) return t('placeholderNumberValue');
  return t('placeholderTextValue');
}

function createSwitch(
  checked: boolean,
  accessibleName: string,
  onChange: (checked: boolean) => void | Promise<void>,
): HTMLElement {
  const label = createElement('label', { className: 'nfs-switch' });
  const input = createElement('input', { attrs: { type: 'checkbox', 'aria-label': accessibleName } });
  input.checked = checked;
  input.addEventListener('change', () => void onChange(input.checked));
  label.append(input, createElement('span'));
  return label;
}

function button(
  text: string,
  variant: 'primary' | 'secondary' | 'danger' | 'ghost' | 'danger-ghost',
  onClick: () => void,
): HTMLButtonElement {
  const btn = createElement('button', {
    className: `nfs-btn nfs-btn-${variant}`,
    text,
  });
  btn.type = 'button';
  btn.addEventListener('click', onClick);
  return btn;
}

function iconButton(
  text: string,
  accessibleName: string,
  onClick: () => void,
  pressed = false,
): HTMLButtonElement {
  const btn = createElement('button', {
    className: `nfs-icon-btn${pressed ? ' is-active' : ''}`,
    text,
    title: accessibleName,
    attrs: {
      'aria-label': accessibleName,
      'aria-pressed': String(pressed),
    },
  });
  btn.type = 'button';
  btn.addEventListener('click', onClick);
  return btn;
}

async function saveCurrentRule(rule: Rule): Promise<void> {
  rule.updatedAt = Date.now();
  const validation = validateRule(rule, settings.presets);
  if (!validation.valid) {
    statusMessage = { validationErrors: validation.errors };
    render();
    return;
  }
  await persist('ruleSaved');
}

async function persist(key: TranslationKey, values?: TranslationValues): Promise<void> {
  await saveSettings(settings);
  settings = await loadSettings();
  statusMessage = { key, values };
  render();
  triggerAutoWebDavSync();
}

async function persistWebDavSettings(key: TranslationKey): Promise<void> {
  webDavSettings = await saveWebDavSyncSettings(webDavSettings);
  statusMessage = { key };
  render();
}

async function validateAndSaveWebDavSettings(): Promise<void> {
  clearWebDavQuickConfig();
  statusMessage = { key: 'webDavValidating' };
  render();

  const settingsToSave = {
    ...webDavSettings,
    enabled: true,
  };
  const validation = await validateWebDavSyncSettings(settingsToSave);
  if (!validation.ok) {
    statusMessage = { raw: validation.message };
    render();
    return;
  }

  const quickConfig = encodeWebDavQuickConfig(settingsToSave);
  webDavSettings = await saveWebDavSyncSettings({
    ...settingsToSave,
    quickConfig,
    lastSyncAt: Date.now(),
    lastResult: 'success',
    lastMessage: validation.message,
  });
  webDavQuickConfigText = quickConfig;
  statusMessage = { key: 'webDavSettingsSaved' };
  render();
}

function clearWebDavQuickConfig(): void {
  webDavQuickConfigText = '';
  webDavSettings.quickConfig = '';
  const input = document.querySelector<HTMLInputElement>('[data-nfs-webdav-quick-config="true"]');
  if (input) input.value = '';
}

function renderedStatusMessage(): string {
  if (!statusMessage) {
    return t('lastUpdated', { date: formatDate(settings.updatedAt, getLocale()) });
  }
  if ('raw' in statusMessage) return statusMessage.raw;
  if ('validationErrors' in statusMessage) {
    const separator = getLocale() === 'en' ? '; ' : '；';
    return statusMessage.validationErrors.map(translateValidationError).join(separator);
  }
  return t(statusMessage.key, statusMessage.values);
}

function webDavStatusText(): string {
  if (!webDavSettings.lastSyncAt) return t('webDavNeverSynced');
  return t('webDavLastStatus', {
    date: formatDate(webDavSettings.lastSyncAt, getLocale()),
    message: webDavSettings.lastMessage || '-',
  });
}

async function runWebDavAction(action: WebDavSyncAction): Promise<void> {
  webDavSettings = await saveWebDavSyncSettings(webDavSettings);
  statusMessage = { key: 'webDavSyncWorking' };
  render();

  const syncResult = await requestWebDavSyncAction(action);
  settings = await loadSettings();
  webDavSettings = await loadWebDavSyncSettings();
  if (selectedRuleId && !settings.rules.some((rule) => rule.id === selectedRuleId)) {
    selectedRuleId = settings.rules[0]?.id ?? null;
  }
  statusMessage = { raw: syncResult.message };
  render();
}

function triggerAutoWebDavSync(): void {
  if (!webDavSettings.enabled || !webDavSettings.autoSync) return;

  void requestWebDavSyncAction('auto')
    .then(async () => {
      settings = await loadSettings();
      webDavSettings = await loadWebDavSyncSettings();
      if (selectedRuleId && !settings.rules.some((rule) => rule.id === selectedRuleId)) {
        selectedRuleId = settings.rules[0]?.id ?? null;
      }
      render();
    })
    .catch(() => undefined);
}

async function requestWebDavSyncAction(action: WebDavSyncAction): Promise<WebDavSyncResult> {
  if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'neofetchspy:webdav-sync',
        action,
      }) as { ok?: boolean; result?: WebDavSyncResult; error?: string } | undefined;

      if (response?.result) return response.result;
      if (response?.error) throw new Error(response.error);
    } catch {
      // Fall back to direct execution for non-extension development builds.
    }
  }

  return runWebDavSyncAction(action);
}

async function importWebDavQuickConfig(): Promise<void> {
  const imported = decodeWebDavQuickConfig(webDavQuickConfigText);
  if (!imported) {
    statusMessage = { key: 'webDavQuickConfigInvalid' };
    render();
    return;
  }

  webDavSettings = await saveWebDavSyncSettings({
    ...webDavSettings,
    ...imported,
    quickConfig: webDavQuickConfigText.trim(),
  });
  webDavQuickConfigText = webDavSettings.quickConfig;
  statusMessage = { key: 'webDavQuickConfigImported' };
  render();
}

function encodeWebDavQuickConfig(settingsToEncode: WebDavSyncSettings): string {
  return toBase64Utf8(JSON.stringify({
    format: WEBDAV_QUICK_CONFIG_FORMAT,
    version: 1,
    enabled: settingsToEncode.enabled,
    autoSync: settingsToEncode.autoSync,
    serverUrl: settingsToEncode.serverUrl,
    username: settingsToEncode.username,
    password: settingsToEncode.password,
  }));
}

function decodeWebDavQuickConfig(value: string): Partial<WebDavSyncSettings> | null {
  const text = value.trim();
  if (!text) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(fromBase64Utf8(text)) as unknown;
  } catch {
    return null;
  }

  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
  const candidate = parsed as Record<string, unknown>;
  if (
    candidate.format !== undefined
    && candidate.format !== WEBDAV_QUICK_CONFIG_FORMAT
  ) {
    return null;
  }
  if (typeof candidate.serverUrl !== 'string') return null;

  return {
    enabled: typeof candidate.enabled === 'boolean' ? candidate.enabled : webDavSettings.enabled,
    autoSync: typeof candidate.autoSync === 'boolean' ? candidate.autoSync : webDavSettings.autoSync,
    serverUrl: candidate.serverUrl,
    username: typeof candidate.username === 'string' ? candidate.username : '',
    password: typeof candidate.password === 'string' ? candidate.password : '',
  };
}

function toBase64Utf8(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64Utf8(value: string): string {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

function duplicateRule(rule: Rule): void {
  const now = Date.now();
  const copy: Rule = {
    ...structuredClone(rule),
    id: generateRuleId(now),
    name: `${rule.name || t('unnamedRule')} ${t('ruleCopySuffix')}`,
    createdAt: now,
    updatedAt: now,
  };
  settings.rules.unshift(copy);
  selectedRuleId = copy.id;
  void persist('ruleCopied');
}

function deleteRule(rule: Rule): void {
  if (!window.confirm(t('confirmDeleteRule', { name: rule.name || t('unnamedRule') }))) return;
  settings.rules = settings.rules.filter((candidate) => candidate.id !== rule.id);
  selectedRuleId = settings.rules[0]?.id ?? null;
  void persist('ruleDeleted');
}

function addAction(rule: Rule, action: Action): void {
  rule.actions.push(action);
  render();
}

function moveAction(rule: Rule, index: number, direction: -1 | 1): void {
  const nextIndex = index + direction;
  if (nextIndex < 0 || nextIndex >= rule.actions.length) return;
  const [action] = rule.actions.splice(index, 1);
  rule.actions.splice(nextIndex, 0, action);
  render();
}

function defaultAction(type: Action['type']): Action {
  if (type === 'delete') return { type, path: '' };
  if (type === 'replace') return { type, path: '', value: undefined };
  if (type === 'regex') return { type, pattern: '', flags: undefined, replacement: '' };
  return {
    type: 'filter',
    iterablePath: '',
    condition: { field: '', operator: 'exists' },
  };
}

function createEmptyRule(): Rule {
  return createRule({
    name: '',
    match: { url: '', method: '*' },
    actions: [
      {
        type: 'filter',
        iterablePath: '',
        condition: { field: '', operator: 'exists' },
      },
    ],
  });
}

function selectedRule(): Rule | null {
  return settings.rules.find((rule) => rule.id === selectedRuleId) ?? null;
}

function filteredRules(): Rule[] {
  const query = searchText.trim().toLowerCase();
  if (!query) return settings.rules;
  return settings.rules.filter((rule) =>
    rule.name.toLowerCase().includes(query)
      || rule.match.url.toLowerCase().includes(query)
      || (rule.scope?.pageHosts?.some((host) => host.toLowerCase().includes(query)) ?? false),
  );
}

function importRules(): void {
  const input = createElement('input', {
    attrs: {
      type: 'file',
      accept: '.json,application/json',
    },
  });
  input.addEventListener('change', () => {
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.addEventListener('load', () => {
      const result = parseRulesImport(String(reader.result ?? ''));
      const existingIds = new Set(settings.rules.map((rule) => rule.id));
      for (const rule of result.rules) {
        if (existingIds.has(rule.id)) rule.id = generateRuleId();
        existingIds.add(rule.id);
      }
      settings.rules = [...result.rules, ...settings.rules];
      selectedRuleId = result.rules[0]?.id ?? selectedRuleId;
      void persist(
        result.errors.length ? 'importFinishedWithFailures' : 'rulesImported',
        result.errors.length ? { count: result.errors.length } : undefined,
      );
    });
    reader.readAsText(file);
  });
  input.click();
}

function exportRules(): void {
  downloadText('neofetchspy-rules.json', JSON.stringify(settings.rules, null, 2));
  statusMessage = { key: 'rulesExported' };
  render();
}

function stringifyValue(value: unknown): string {
  if (value === undefined) return '';
  if (typeof value === 'string') return value;
  return JSON.stringify(value, null, 2);
}
