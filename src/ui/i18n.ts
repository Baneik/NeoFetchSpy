export type Locale = 'zh-CN' | 'en' | 'ja';
export type LanguagePreference = 'auto' | Locale;
export type TranslationValues = Record<string, string | number>;

export const UI_LANGUAGE_STORAGE_KEY = 'neofetchspy_ui_language';

const translations = {
  'zh-CN': {
    optionsTitle: 'NeoFetchSPY 配置',
    enabledCount: '{active} / {total} 启用',
    language: '语言',
    languageAuto: '自动（浏览器）',
    languageChinese: '中文',
    languageEnglish: 'English',
    languageJapanese: '日本語',
    switchGlobalAria: '全局启用',
    switchRuleAria: '启用规则',
    switchDebugAria: '启用调试日志',
    noActiveRules: '暂无启用规则',
    unnamedRule: '未命名规则',
    openOptions: '打开配置页面',
    globalEnabled: '全局启用',
    globalStatusUpdated: '全局状态已更新',
    new: '新建',
    import: '导入',
    export: '导出',
    newRuleName: '新规则',
    ruleCreated: '已新建规则',
    searchRules: '搜索规则或 URL',
    placeholderRuleName: '输入规则名称',
    placeholderPageHosts: 'example.com, *.example.com',
    placeholderUrlWildcard: '输入要匹配的 URL 通配符',
    placeholderEntryKey: '输入键名',
    placeholderEntryValue: '输入匹配值',
    placeholderJsonPath: '输入 JSONPath',
    placeholderArrayPath: '输入数组路径',
    placeholderFieldPath: '输入字段路径',
    placeholderJsonValue: '输入 JSON 值',
    placeholderTextValue: '输入文本',
    placeholderKeywords: '输入关键词，多个用 | 分隔',
    placeholderNumberValue: '输入数值',
    placeholderRegexPattern: '输入正则表达式',
    placeholderRegexFlags: '输入 flags',
    placeholderReplacement: '输入替换内容',
    noMatchingRules: '没有匹配的规则',
    lastUpdated: '最近更新 {date}',
    chooseOrCreateRule: '选择或新建规则',
    newRule: '新建规则',
    ruleStatusUpdated: '规则状态已更新',
    duplicate: '复制',
    delete: '删除',
    save: '保存',
    basic: '基础',
    ruleName: '规则名称',
    pageHosts: '生效页面域名',
    responseType: '响应类型',
    automatic: '自动',
    debugLogs: '调试日志',
    debugUpdated: '调试日志已更新',
    match: '匹配',
    urlWildcard: 'URL 通配符',
    queryParameters: 'Query 参数',
    postFormParameters: 'POST 表单',
    entryKey: '键',
    entryValue: '匹配值',
    actions: '操作',
    addJsonFilter: '添加 JSON 过滤',
    addReplacement: '添加替换',
    addRegex: '添加正则',
    actionNumber: '操作 {index}',
    filterAction: '过滤',
    deleteAction: '删除',
    replaceAction: '替换',
    regexAction: '正则表达式',
    moveUp: '上移',
    moveDown: '下移',
    remove: '移除',
    newValue: '新值',
    arrayPath: '数组路径',
    fieldPath: '字段路径',
    condition: '条件',
    conditionGroupPath: '路径',
    conditionGroupEmpty: '空值',
    conditionGroupText: '文本',
    conditionGroupNumber: '数值',
    exists: '路径存在',
    notExists: '路径不存在',
    isEmpty: '为空',
    isNotEmpty: '不为空',
    textEquals: '文本等于',
    textNotEquals: '文本不等于',
    textContains: '包含关键词',
    textNotContains: '不包含关键词',
    regexMatch: '正则匹配',
    numberEquals: '数值等于',
    numberNotEquals: '数值不等于',
    numberGreaterThan: '大于',
    numberGreaterThanOrEqual: '大于等于',
    numberLessThan: '小于',
    numberLessThanOrEqual: '小于等于',
    compareValue: '比较值',
    replacement: '替换内容',
    add: '添加',
    notSet: '未设置',
    ruleSaved: '规则已保存',
    ruleCopySuffix: '副本',
    ruleCopied: '规则已复制',
    confirmDeleteRule: '删除「{name}」？',
    ruleDeleted: '规则已删除',
    importFinishedWithFailures: '导入完成，{count} 条失败',
    rulesImported: '规则已导入',
    rulesExported: '规则已导出',
    validationRuleNameRequired: '规则名称不能为空',
    validationUrlRequired: 'URL 匹配不能为空',
    validationMethodInvalid: 'HTTP Method 无效',
    validationResponseTypeInvalid: '响应类型无效',
    validationActionRequired: '至少需要一个 action',
    validationJsonPathRequired: 'JSONPath 不能为空',
    validationArrayPathRequired: '数组路径不能为空',
    validationConditionInvalid: '条件无效',
    validationRegexRequired: '正则表达式不能为空',
    validationRegexInvalid: '正则表达式或 flags 无效',
  },
  en: {
    optionsTitle: 'NeoFetchSPY Settings',
    enabledCount: '{active} / {total} enabled',
    language: 'Language',
    languageAuto: 'Automatic (browser)',
    languageChinese: '中文',
    languageEnglish: 'English',
    languageJapanese: '日本語',
    switchGlobalAria: 'Enable globally',
    switchRuleAria: 'Enable rule',
    switchDebugAria: 'Enable debug logs',
    noActiveRules: 'No enabled rules',
    unnamedRule: 'Unnamed rule',
    openOptions: 'Open settings',
    globalEnabled: 'Enabled globally',
    globalStatusUpdated: 'Global status updated',
    new: 'New',
    import: 'Import',
    export: 'Export',
    newRuleName: 'New rule',
    ruleCreated: 'Rule created',
    searchRules: 'Search rules or URL',
    placeholderRuleName: 'Enter a rule name',
    placeholderPageHosts: 'example.com, *.example.com',
    placeholderUrlWildcard: 'Enter a URL wildcard',
    placeholderEntryKey: 'Enter a key',
    placeholderEntryValue: 'Enter a match value',
    placeholderJsonPath: 'Enter JSONPath',
    placeholderArrayPath: 'Enter an array path',
    placeholderFieldPath: 'Enter a field path',
    placeholderJsonValue: 'Enter a JSON value',
    placeholderTextValue: 'Enter text',
    placeholderKeywords: 'Enter keywords separated by |',
    placeholderNumberValue: 'Enter a number',
    placeholderRegexPattern: 'Enter a regular expression',
    placeholderRegexFlags: 'Enter flags',
    placeholderReplacement: 'Enter replacement text',
    noMatchingRules: 'No matching rules',
    lastUpdated: 'Last updated {date}',
    chooseOrCreateRule: 'Select or create a rule',
    newRule: 'New rule',
    ruleStatusUpdated: 'Rule status updated',
    duplicate: 'Duplicate',
    delete: 'Delete',
    save: 'Save',
    basic: 'Basics',
    ruleName: 'Rule name',
    pageHosts: 'Page hosts',
    responseType: 'Response type',
    automatic: 'Automatic',
    debugLogs: 'Debug logs',
    debugUpdated: 'Debug logs updated',
    match: 'Match',
    urlWildcard: 'URL wildcard',
    queryParameters: 'Query parameters',
    postFormParameters: 'POST form',
    entryKey: 'Key',
    entryValue: 'Match value',
    actions: 'Actions',
    addJsonFilter: 'Add JSON filter',
    addReplacement: 'Add replacement',
    addRegex: 'Add regex',
    actionNumber: 'Action {index}',
    filterAction: 'Filter',
    deleteAction: 'Delete',
    replaceAction: 'Replace',
    regexAction: 'Regex',
    moveUp: 'Move up',
    moveDown: 'Move down',
    remove: 'Remove',
    newValue: 'New value',
    arrayPath: 'Array path',
    fieldPath: 'Field path',
    condition: 'Condition',
    conditionGroupPath: 'Path',
    conditionGroupEmpty: 'Empty',
    conditionGroupText: 'Text',
    conditionGroupNumber: 'Number',
    exists: 'Path exists',
    notExists: 'Path does not exist',
    isEmpty: 'Is empty',
    isNotEmpty: 'Is not empty',
    textEquals: 'Text equals',
    textNotEquals: 'Text does not equal',
    textContains: 'Contains keywords',
    textNotContains: 'Does not contain keywords',
    regexMatch: 'Regex match',
    numberEquals: 'Number equals',
    numberNotEquals: 'Number does not equal',
    numberGreaterThan: 'Greater than',
    numberGreaterThanOrEqual: 'Greater than or equal',
    numberLessThan: 'Less than',
    numberLessThanOrEqual: 'Less than or equal',
    compareValue: 'Comparison value',
    replacement: 'Replacement',
    add: 'Add',
    notSet: 'Not set',
    ruleSaved: 'Rule saved',
    ruleCopySuffix: 'copy',
    ruleCopied: 'Rule duplicated',
    confirmDeleteRule: 'Delete "{name}"?',
    ruleDeleted: 'Rule deleted',
    importFinishedWithFailures: 'Import complete, {count} failed',
    rulesImported: 'Rules imported',
    rulesExported: 'Rules exported',
    validationRuleNameRequired: 'Rule name is required',
    validationUrlRequired: 'URL match is required',
    validationMethodInvalid: 'HTTP Method is invalid',
    validationResponseTypeInvalid: 'Response type is invalid',
    validationActionRequired: 'At least one action is required',
    validationJsonPathRequired: 'JSONPath is required',
    validationArrayPathRequired: 'Array path is required',
    validationConditionInvalid: 'Condition is invalid',
    validationRegexRequired: 'Regular expression is required',
    validationRegexInvalid: 'Regular expression or flags are invalid',
  },
  ja: {
    optionsTitle: 'NeoFetchSPY 設定',
    enabledCount: '{active} / {total} 有効',
    language: '言語',
    languageAuto: '自動（ブラウザー）',
    languageChinese: '中文',
    languageEnglish: 'English',
    languageJapanese: '日本語',
    switchGlobalAria: '全体を有効化',
    switchRuleAria: 'ルールを有効化',
    switchDebugAria: 'デバッグログを有効化',
    noActiveRules: '有効なルールはありません',
    unnamedRule: '名称未設定のルール',
    openOptions: '設定を開く',
    globalEnabled: '全体を有効化',
    globalStatusUpdated: '全体の状態を更新しました',
    new: '新規',
    import: 'インポート',
    export: 'エクスポート',
    newRuleName: '新しいルール',
    ruleCreated: 'ルールを作成しました',
    searchRules: 'ルールまたは URL を検索',
    placeholderRuleName: 'ルール名を入力',
    placeholderPageHosts: 'example.com, *.example.com',
    placeholderUrlWildcard: '一致する URL ワイルドカードを入力',
    placeholderEntryKey: 'キーを入力',
    placeholderEntryValue: '一致値を入力',
    placeholderJsonPath: 'JSONPath を入力',
    placeholderArrayPath: '配列パスを入力',
    placeholderFieldPath: 'フィールドパスを入力',
    placeholderJsonValue: 'JSON 値を入力',
    placeholderTextValue: 'テキストを入力',
    placeholderKeywords: 'キーワードを | 区切りで入力',
    placeholderNumberValue: '数値を入力',
    placeholderRegexPattern: '正規表現を入力',
    placeholderRegexFlags: 'flags を入力',
    placeholderReplacement: '置換内容を入力',
    noMatchingRules: '一致するルールはありません',
    lastUpdated: '最終更新 {date}',
    chooseOrCreateRule: 'ルールを選択または作成',
    newRule: '新しいルール',
    ruleStatusUpdated: 'ルールの状態を更新しました',
    duplicate: '複製',
    delete: '削除',
    save: '保存',
    basic: '基本',
    ruleName: 'ルール名',
    pageHosts: '有効なページドメイン',
    responseType: 'レスポンス種別',
    automatic: '自動',
    debugLogs: 'デバッグログ',
    debugUpdated: 'デバッグログを更新しました',
    match: '一致条件',
    urlWildcard: 'URL ワイルドカード',
    queryParameters: 'Query パラメーター',
    postFormParameters: 'POST フォーム',
    entryKey: 'キー',
    entryValue: '一致値',
    actions: 'アクション',
    addJsonFilter: 'JSON フィルターを追加',
    addReplacement: '置換を追加',
    addRegex: '正規表現を追加',
    actionNumber: 'アクション {index}',
    filterAction: 'フィルター',
    deleteAction: '削除',
    replaceAction: '置換',
    regexAction: '正規表現',
    moveUp: '上へ',
    moveDown: '下へ',
    remove: '取り除く',
    newValue: '新しい値',
    arrayPath: '配列パス',
    fieldPath: 'フィールドパス',
    condition: '条件',
    conditionGroupPath: 'パス',
    conditionGroupEmpty: '空値',
    conditionGroupText: 'テキスト',
    conditionGroupNumber: '数値',
    exists: 'パスが存在する',
    notExists: 'パスが存在しない',
    isEmpty: '空',
    isNotEmpty: '空ではない',
    textEquals: 'テキストが等しい',
    textNotEquals: 'テキストが等しくない',
    textContains: 'キーワードを含む',
    textNotContains: 'キーワードを含まない',
    regexMatch: '正規表現に一致',
    numberEquals: '数値が等しい',
    numberNotEquals: '数値が等しくない',
    numberGreaterThan: 'より大きい',
    numberGreaterThanOrEqual: '以上',
    numberLessThan: 'より小さい',
    numberLessThanOrEqual: '以下',
    compareValue: '比較値',
    replacement: '置換内容',
    add: '追加',
    notSet: '未設定',
    ruleSaved: 'ルールを保存しました',
    ruleCopySuffix: 'コピー',
    ruleCopied: 'ルールを複製しました',
    confirmDeleteRule: '「{name}」を削除しますか？',
    ruleDeleted: 'ルールを削除しました',
    importFinishedWithFailures: 'インポート完了、{count} 件失敗',
    rulesImported: 'ルールをインポートしました',
    rulesExported: 'ルールをエクスポートしました',
    validationRuleNameRequired: 'ルール名は必須です',
    validationUrlRequired: 'URL の一致条件は必須です',
    validationMethodInvalid: 'HTTP Method が無効です',
    validationResponseTypeInvalid: 'レスポンス種別が無効です',
    validationActionRequired: '少なくとも 1 つのアクションが必要です',
    validationJsonPathRequired: 'JSONPath は必須です',
    validationArrayPathRequired: '配列パスは必須です',
    validationConditionInvalid: '条件が無効です',
    validationRegexRequired: '正規表現は必須です',
    validationRegexInvalid: '正規表現または flags が無効です',
  },
} satisfies Record<Locale, Record<string, string>>;

export type TranslationKey = keyof typeof translations['zh-CN'];

let preference: LanguagePreference = 'auto';
let activeLocale: Locale = 'en';

export async function initializeI18n(): Promise<void> {
  preference = await loadLanguagePreference();
  activeLocale = resolveLocale(preference);
  updateDocumentLanguage();
}

export function getLocale(): Locale {
  return activeLocale;
}

export function getLanguagePreference(): LanguagePreference {
  return preference;
}

export function t(key: TranslationKey, values: TranslationValues = {}): string {
  return translate(activeLocale, key, values);
}

export function translate(locale: Locale, key: TranslationKey, values: TranslationValues = {}): string {
  return translations[locale][key].replace(/\{(\w+)\}/g, (match, name: string) => {
    return values[name] === undefined ? match : String(values[name]);
  });
}

export function detectLocale(languages: readonly string[]): Locale {
  for (const language of languages) {
    const normalized = language.toLowerCase().replace('_', '-');
    if (normalized.startsWith('zh')) return 'zh-CN';
    if (normalized.startsWith('ja')) return 'ja';
    if (normalized.startsWith('en')) return 'en';
  }
  return 'en';
}

export function languageOptions(): Array<[LanguagePreference, string]> {
  return [
    ['auto', t('languageAuto')],
    ['zh-CN', t('languageChinese')],
    ['en', t('languageEnglish')],
    ['ja', t('languageJapanese')],
  ];
}

export async function setLanguagePreference(next: LanguagePreference): Promise<void> {
  preference = next;
  activeLocale = resolveLocale(next);
  updateDocumentLanguage();
  if (hasExtensionStorage()) {
    await chrome.storage.local.set({ [UI_LANGUAGE_STORAGE_KEY]: next });
    return;
  }
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(UI_LANGUAGE_STORAGE_KEY, next);
  }
}

export function translateValidationError(error: string): string {
  const actionError = /^Action (\d+): (.*)$/.exec(error);
  if (actionError) {
    return `${t('actionNumber', { index: actionError[1] })}: ${translateValidationDetail(actionError[2])}`;
  }
  return translateValidationDetail(error);
}

function translateValidationDetail(error: string): string {
  const messageKeys: Record<string, TranslationKey> = {
    '规则名称不能为空': 'validationRuleNameRequired',
    'URL 匹配不能为空': 'validationUrlRequired',
    'HTTP Method 无效': 'validationMethodInvalid',
    '响应类型无效': 'validationResponseTypeInvalid',
    '至少需要一个 action': 'validationActionRequired',
    'JSONPath 不能为空': 'validationJsonPathRequired',
    '数组路径不能为空': 'validationArrayPathRequired',
    '条件无效': 'validationConditionInvalid',
    '正则表达式不能为空': 'validationRegexRequired',
    '正则表达式或 flags 无效': 'validationRegexInvalid',
  };
  const key = messageKeys[error];
  return key ? t(key) : error;
}

function resolveLocale(nextPreference: LanguagePreference): Locale {
  return nextPreference === 'auto' ? detectLocale(browserLanguages()) : nextPreference;
}

function browserLanguages(): string[] {
  const languages: string[] = [];
  if (typeof chrome !== 'undefined' && chrome.i18n?.getUILanguage) {
    languages.push(chrome.i18n.getUILanguage());
  }
  if (typeof navigator !== 'undefined') {
    languages.push(...navigator.languages, navigator.language);
  }
  return languages;
}

async function loadLanguagePreference(): Promise<LanguagePreference> {
  let value: unknown;
  if (hasExtensionStorage()) {
    const raw = await chrome.storage.local.get(UI_LANGUAGE_STORAGE_KEY);
    value = raw[UI_LANGUAGE_STORAGE_KEY];
  } else if (typeof localStorage !== 'undefined') {
    value = localStorage.getItem(UI_LANGUAGE_STORAGE_KEY);
  }
  if (value === 'auto' || value === 'zh-CN' || value === 'en' || value === 'ja') return value;
  return 'auto';
}

function updateDocumentLanguage(): void {
  document.documentElement.lang = activeLocale;
}

function hasExtensionStorage(): boolean {
  return typeof chrome !== 'undefined' && chrome.storage?.local !== undefined;
}
