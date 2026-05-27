import { parseFetchRequest } from '../core/matcher';
import type { CompiledRuleIndex } from '../core/rule-index';
import {
  filterActionsByResponseKind,
  inferResponseKind,
  processResponseForRule,
} from '../core/rule-engine';
import type { ResponseKind } from '../core/types';

export interface FetchInterceptorRuntime {
  ruleIndex: CompiledRuleIndex;
  debugLog?: (...args: unknown[]) => void;
}

export async function interceptFetch(
  realFetch: typeof window.fetch,
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  runtime: FetchInterceptorRuntime,
): Promise<Response> {
  const request = await parseFetchRequest(input, init);
  const rule = runtime.ruleIndex.selectFirstMatchingRule(request);

  if (!rule) {
    return realFetch(input, init);
  }

  const response = await realFetch(input, init);
  if (shouldSkipBodyRewrite(request.method, response.status)) return response;

  const responseKind = inferResponseKind(rule, response.headers.get('content-type'));
  const actions = filterActionsByResponseKind(rule.actions, responseKind);

  if (actions.length === 0) {
    return response;
  }

  try {
    const body = responseKind === 'json'
      ? await response.clone().json()
      : await response.clone().text();
    const result = processResponseForRule({ ...rule, actions }, body, responseKind);

    if (!result.matched || result.modifiedBody === undefined) return response;

    runtime.debugLog?.('response modified', rule.id, request.url);
    return createModifiedResponse(response, result.modifiedBody, responseKind);
  } catch (error) {
    runtime.debugLog?.('response processing failed', rule.id, error);
    return response;
  }
}

export function createModifiedResponse(
  original: Response,
  modifiedBody: unknown,
  responseKind: ResponseKind,
): Response {
  const headers = new Headers(original.headers);
  headers.delete('content-length');
  headers.delete('content-encoding');

  if (responseKind === 'json' && !headers.has('content-type')) {
    headers.set('content-type', 'application/json; charset=utf-8');
  }

  const body = responseKind === 'json'
    ? JSON.stringify(modifiedBody) ?? 'null'
    : String(modifiedBody);

  return new Response(body, {
    status: original.status,
    statusText: original.statusText,
    headers,
  });
}

export function shouldSkipBodyRewrite(method: string, status: number): boolean {
  return method.toUpperCase() === 'HEAD' || status === 204 || status === 205 || status === 304;
}
