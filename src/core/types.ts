export const RULE_SCHEMA_VERSION = 1;
export const SETTINGS_SCHEMA_VERSION = 1;

export type HttpMethod =
  | 'GET'
  | 'POST'
  | 'PUT'
  | 'DELETE'
  | 'PATCH'
  | 'HEAD'
  | 'OPTIONS'
  | '*';

export type ResponseKind = 'json' | 'text';

export type FilterOperator =
  | 'exists'
  | 'not_exists'
  | 'equals'
  | 'not_equals'
  | 'regex'
  | 'non_empty'
  | 'empty';

export interface FilterCondition {
  field: string;
  operator: FilterOperator;
  value?: unknown;
}

export interface DeleteAction {
  type: 'delete';
  path: string;
}

export interface ReplaceAction {
  type: 'replace';
  path: string;
  value: unknown;
}

export interface FilterAction {
  type: 'filter';
  iterablePath: string;
  condition: FilterCondition;
}

export interface RegexAction {
  type: 'regex';
  pattern: string;
  flags?: string;
  replacement: string;
}

export type Action = DeleteAction | ReplaceAction | FilterAction | RegexAction;

export interface MatchCondition {
  url: string;
  method?: HttpMethod;
  query?: Record<string, string>;
  headers?: Record<string, string>;
  postForm?: Record<string, string>;
}

export interface Rule {
  schemaVersion: typeof RULE_SCHEMA_VERSION;
  id: string;
  name: string;
  enabled: boolean;
  match: MatchCondition;
  responseType?: ResponseKind;
  actions: Action[];
  createdAt: number;
  updatedAt: number;
}

export interface ParsedRequest {
  url: string;
  method: string;
  query: Record<string, string>;
  headers: Record<string, string>;
  postForm: Record<string, string>;
}

export interface RuntimeSettings {
  schemaVersion: typeof SETTINGS_SCHEMA_VERSION;
  enabled: boolean;
  rules: Rule[];
  updatedAt: number;
  debug: boolean;
}

export type RuntimeRule = Pick<Rule, 'id' | 'enabled' | 'match' | 'responseType' | 'actions'>;

export interface PageRuntimeSettings {
  schemaVersion: typeof SETTINGS_SCHEMA_VERSION;
  enabled: boolean;
  rules: RuntimeRule[];
  debug: boolean;
}

export type RuleDraft = Omit<Rule, 'schemaVersion' | 'createdAt' | 'updatedAt'> &
  Partial<Pick<Rule, 'schemaVersion' | 'createdAt' | 'updatedAt'>>;
