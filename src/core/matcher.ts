import type { MatchCondition, ParsedRequest } from './types';

export type StringMatcher = (value: string) => boolean;

export function matchRequest(condition: MatchCondition, request: ParsedRequest): boolean {
  if (!matchUrl(condition.url, request.url)) return false;

  if (condition.method && condition.method !== '*') {
    if (!matchMethod(condition.method, request.method)) return false;
  }

  if (condition.query && !matchPartial(condition.query, request.query)) return false;

  if (condition.headers) {
    const normalizedHeaderPattern = lowerCaseKeys(condition.headers);
    if (!matchPartial(normalizedHeaderPattern, request.headers)) return false;
  }

  if (condition.postForm && !matchPartial(condition.postForm, request.postForm)) return false;

  return true;
}

export function matchUrl(pattern: string, url: string): boolean {
  return compileWildcardMatcher(pattern)(url);
}

export function matchMethod(pattern: string, method: string): boolean {
  return pattern.toUpperCase() === method.toUpperCase();
}

export function matchPartial(
  pattern: Record<string, string>,
  target: Record<string, string>,
): boolean {
  for (const [key, patternValue] of Object.entries(pattern)) {
    const targetValue = target[key];
    if (targetValue === undefined) return false;
    if (!matchWildcard(patternValue, targetValue)) return false;
  }
  return true;
}

export function matchWildcard(pattern: string, value: string): boolean {
  return compileWildcardMatcher(pattern)(value);
}

export function compileWildcardMatcher(pattern: string): StringMatcher {
  if (pattern === '*') return () => true;
  try {
    const regex = new RegExp(`^${wildcardToRegex(pattern)}$`, 'i');
    return (value) => regex.test(value);
  } catch {
    return () => false;
  }
}

export async function parseFetchRequest(
  input: RequestInfo | URL,
  init?: RequestInit,
  baseHref = getBaseHref(),
): Promise<ParsedRequest> {
  const requestInput = isRequest(input) ? input : null;
  const rawUrl =
    typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.href
        : requestInput?.url ?? String(input);

  const fullUrl = normalizeUrl(rawUrl, baseHref);
  const parsedUrl = safeParseUrl(fullUrl);
  const query: Record<string, string> = {};

  if (parsedUrl) {
    parsedUrl.searchParams.forEach((value, key) => {
      query[key] = value;
    });
  }

  const requestHeaders = requestInput ? headersToRecord(requestInput.headers) : {};
  const initHeaders = headersToRecord(init?.headers);
  const headers = { ...requestHeaders, ...initHeaders };
  const method = (init?.method ?? requestInput?.method ?? 'GET').toUpperCase();

  return {
    url: parsedUrl?.href ?? fullUrl,
    method,
    query,
    headers,
    postForm: await parsePostForm(input, init, headers),
  };
}

export function headersToRecord(headers?: HeadersInit | Headers): Record<string, string> {
  const result: Record<string, string> = {};
  if (!headers) return result;

  if (headers instanceof Headers) {
    headers.forEach((value, key) => {
      result[key.toLowerCase()] = value;
    });
    return result;
  }

  if (Array.isArray(headers)) {
    for (const [key, value] of headers) {
      result[key.toLowerCase()] = value;
    }
    return result;
  }

  for (const [key, value] of Object.entries(headers)) {
    result[key.toLowerCase()] = value;
  }
  return result;
}

function wildcardToRegex(pattern: string): string {
  return pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.');
}

function normalizeUrl(url: string, baseHref: string): string {
  try {
    return new URL(url, baseHref).href;
  } catch {
    return url;
  }
}

function safeParseUrl(url: string): URL | null {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

function lowerCaseKeys(input: Record<string, string>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(input)) {
    result[key.toLowerCase()] = value;
  }
  return result;
}

async function parsePostForm(
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  headers: Record<string, string>,
): Promise<Record<string, string>> {
  if (init?.body !== undefined && init.body !== null) {
    return bodyToFormRecord(init.body, headers);
  }

  if (!isRequest(input)) return {};

  try {
    return formDataToRecord(await input.clone().formData());
  } catch {
    return {};
  }
}

async function bodyToFormRecord(
  body: BodyInit,
  headers: Record<string, string>,
): Promise<Record<string, string>> {
  if (typeof URLSearchParams !== 'undefined' && body instanceof URLSearchParams) {
    return searchParamsToRecord(body);
  }

  if (typeof FormData !== 'undefined' && body instanceof FormData) {
    return formDataToRecord(body);
  }

  if (typeof body === 'string') {
    return parseUrlEncodedText(body, headers);
  }

  if (typeof Blob !== 'undefined' && body instanceof Blob) {
    return parseUrlEncodedText(await body.text(), headers);
  }

  if (typeof ArrayBuffer !== 'undefined' && body instanceof ArrayBuffer) {
    return parseUrlEncodedText(new TextDecoder().decode(body), headers);
  }

  if (ArrayBuffer.isView(body)) {
    const bytes = new Uint8Array(body.buffer, body.byteOffset, body.byteLength);
    return parseUrlEncodedText(new TextDecoder().decode(bytes), headers);
  }

  return {};
}

function parseUrlEncodedText(text: string, headers: Record<string, string>): Record<string, string> {
  if (!isUrlEncoded(headers['content-type'])) return {};
  return searchParamsToRecord(new URLSearchParams(text));
}

function isUrlEncoded(contentType: string | undefined): boolean {
  return contentType !== undefined && /\bapplication\/x-www-form-urlencoded\b/i.test(contentType);
}

function searchParamsToRecord(searchParams: URLSearchParams): Record<string, string> {
  const result: Record<string, string> = {};
  searchParams.forEach((value, key) => {
    result[key] = value;
  });
  return result;
}

function formDataToRecord(formData: FormData): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === 'string') result[key] = value;
  }
  return result;
}

function isRequest(input: RequestInfo | URL): input is Request {
  return typeof Request !== 'undefined' && input instanceof Request;
}

function getBaseHref(): string {
  return globalThis.location?.href ?? 'http://localhost/';
}
