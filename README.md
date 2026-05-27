# NeoFetchSpy

[简体中文](./README.zh-CN.md) | English

NeoFetchSpy is a Manifest V3 browser extension for intercepting page `window.fetch` calls and modifying JSON or text responses with user-defined rules.

It is designed for local debugging, response shaping, API inspection, front-end development, and quick experiments where changing the server is slower than changing the response in the browser.

## Features

- Intercepts `window.fetch` in the page MAIN world at `document_start`.
- Matches requests by URL wildcard, HTTP method, query parameters, request headers, and POST form fields.
- Scopes rules to specific page hostnames, so only relevant rules are sent to a page hook.
- Modifies JSON responses with ordered actions:
  - delete JSONPath target
  - replace JSONPath target
  - filter array items by field condition
- Modifies text responses with regular expression replacement.
- Supports configurable response type detection:
  - automatic by `content-type`
  - explicit JSON
  - explicit text
- Supports `fetch(new Request(...))`, including method/header extraction and `init` overrides.
- Parses POST form match data from:
  - `URLSearchParams`
  - `FormData`
  - `application/x-www-form-urlencoded` text/blob/buffer bodies
  - cloned `Request.formData()` without consuming the original request body
- Provides a full options page for rule editing.
- Provides a compact popup for global status and quick access.
- Stores settings in `chrome.storage.local`.
- Includes English, Chinese, and Japanese UI strings.
- Uses a minimal runtime settings payload between the isolated content bridge and the page hook.
- Precompiles rule matchers when settings change, keeping the fetch hot path lightweight.

## How It Works

Chrome extensions cannot directly access page JavaScript objects from an isolated content script. NeoFetchSpy therefore uses two content scripts:

1. `pageHook`
   - Runs in the page MAIN world.
   - Patches `window.fetch` as early as possible.
   - Parses each request, selects the first matching enabled rule, reads the response body only when needed, and returns a rewritten `Response`.

2. `contentBridge`
   - Runs in the isolated extension world.
   - Reads settings from `chrome.storage.local`.
   - Filters rules by the current page hostname.
   - Sends a reduced runtime settings object to the page hook.
   - Listens for storage changes and updates the page hook.

The background service worker initializes settings and responds to extension messages. The popup and options page use the same storage module as the background worker.

## Architecture

```text
public/manifest.json
  Declares MV3 extension entries, popup, options page, background worker,
  and the two content scripts.

src/extension/
  background.ts          Settings initialization and extension message handling.
  content-bridge.ts      Isolated-world settings bridge.
  page-hook.ts           MAIN-world fetch patch entry.
  fetch-interceptor.ts   Fetch interception and response rewrite flow.
  messages.ts            Runtime message schema and validation.
  storage.ts             chrome.storage.local adapter.

src/core/
  matcher.ts             Request parsing and wildcard matching.
  rule-scope.ts          Page hostname scope normalization and filtering.
  rule-index.ts          Precompiled runtime rule index.
  rule-engine.ts         Rule selection and response kind handling.
  modifier.ts            JSON/text action execution.
  jsonpath.ts            JSONPath helpers for delete/replace/filter operations.
  rule-schema.ts         Rule creation, normalization, import, and validation.
  types.ts               Shared rule and settings types.

src/ui/
  options.ts             Full rule editor.
  popup.ts               Compact status popup.
  i18n.ts                UI translations.
  shared.ts              Small DOM utilities.

__tests__/
  Unit tests for matching, JSONPath, modifiers, schema, i18n, messages,
  compiled rule indexes, and fetch interception.
```

## Rule Model

A rule has these important sections:

- `match`: request matching conditions.
- `scope`: optional page hostname scope.
- `responseType`: optional response body type override.
- `actions`: ordered modifications applied to the response body.
- metadata: id, name, enabled state, timestamps, and schema version.

Example:

```json
{
  "schemaVersion": 1,
  "id": "remove-ad-items",
  "name": "Remove ad items",
  "enabled": true,
  "scope": {
    "pageHosts": ["example.com", "*.example.com"]
  },
  "match": {
    "url": "*://api.example.com/feed*",
    "method": "POST",
    "query": {
      "platform": "web"
    },
    "headers": {
      "x-client": "web*"
    },
    "postForm": {
      "scene": "feed"
    }
  },
  "responseType": "json",
  "actions": [
    {
      "type": "filter",
      "iterablePath": "$.data.items",
      "condition": {
        "field": "ad",
        "operator": "exists"
      }
    }
  ],
  "createdAt": 1710000000000,
  "updatedAt": 1710000000000
}
```

## Page Host Scope

`scope.pageHosts` controls which pages a rule can run on. It matches the current page hostname, not the fetch request URL.

Supported patterns:

```text
*
example.com
*.example.com
```

Missing or empty scope keeps the legacy behavior and runs on all pages. `*.example.com` matches both `example.com` and subdomains such as `api.example.com`.

## Request Matching

NeoFetchSpy evaluates enabled rules in order and uses the first matching rule.

### URL

URL matching uses simple wildcards:

- `*` matches any number of characters.
- `?` matches one character.
- Matching is case-insensitive.

Examples:

```text
*://api.example.com/*
https://example.com/v?/feed
```

### Method

Supported methods:

```text
GET POST PUT DELETE PATCH HEAD OPTIONS *
```

`*` matches any method.

### Query Parameters

`match.query` is a partial map. Every configured key must exist on the request URL and match its wildcard value.

```json
{
  "query": {
    "page": "1",
    "keyword": "dev*"
  }
}
```

### Headers

`match.headers` is also a partial map. Header keys are normalized to lowercase internally.

```json
{
  "headers": {
    "x-token": "abc*"
  }
}
```

### POST Form Fields

`match.postForm` matches parsed POST form fields. It works like query/header matching: every configured key must exist and match the wildcard value.

```json
{
  "postForm": {
    "token": "abc*",
    "scene": "feed"
  }
}
```

Supported form sources:

- `URLSearchParams`
- `FormData` string fields
- `application/x-www-form-urlencoded` bodies
- `Request` objects with cloneable form bodies

File fields are ignored for matching.

## Response Actions

Actions run in order. For JSON responses, only JSON actions run. For text responses, only regex actions run.

### Delete

Deletes a JSONPath target.

```json
{
  "type": "delete",
  "path": "$.data.debug"
}
```

### Replace

Replaces a JSONPath target with a JSON value.

```json
{
  "type": "replace",
  "path": "$.data.status",
  "value": "patched"
}
```

### Filter

Removes items from an array when the condition matches.

```json
{
  "type": "filter",
  "iterablePath": "$.data.items",
  "condition": {
    "field": "jump_url",
    "operator": "exists"
  }
}
```

Supported filter operators:

```text
exists
not_exists
equals
not_equals
regex
non_empty
empty
```

Field paths support dot notation and a simple dynamic-key wildcard:

```text
content.jump_url.*.extra.goods_item_id
```

### Regex

Runs a regular expression replacement on text responses.

```json
{
  "type": "regex",
  "pattern": "<title>.*?</title>",
  "flags": "i",
  "replacement": "<title>Patched</title>"
}
```

## Reliability Notes

- The extension matches the request before reading the response body.
- The isolated content bridge filters rules by page hostname before sending runtime settings to the MAIN-world page hook.
- Response body parsing happens only when a matching rule has actions for the inferred response type.
- `HEAD`, `204`, `205`, and `304` responses are not rewritten because they cannot carry a replacement body safely.
- `content-length` and `content-encoding` are removed from rewritten responses to avoid stale metadata.
- Runtime rules are precompiled when settings change, so wildcard regular expressions are not rebuilt on every fetch.

## Security And Permissions

The extension currently declares:

```json
{
  "permissions": ["storage"],
  "host_permissions": ["<all_urls>"]
}
```

`<all_urls>` is required because the extension can be configured to intercept fetch calls on arbitrary pages. If you publish this extension publicly, consider moving to optional host permissions or limiting the default match scope.

The page hook runs in the page MAIN world because it must patch `window.fetch`. This is a powerful technique with a natural tradeoff: page scripts share the same world. NeoFetchSpy sends only rules scoped to the current page and only as a reduced runtime settings object, and validates messages strictly, but rule matching logic in MAIN world should still be treated as page-visible.

## Development

Requirements:

- Node.js
- npm
- Chromium-based browser for manual extension testing

Install dependencies:

```bash
npm install
```

Run checks:

```bash
npm run typecheck
npm test
```

Build the extension:

```bash
npm run build
```

The build output is written to `dist/`.

Load it in Chromium:

1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Click "Load unpacked".
4. Select the `dist/` directory.

Watch mode:

```bash
npm run dev
```

Release builds do not emit sourcemaps by default. To build with sourcemaps for debugging:

```powershell
$env:SOURCE_MAP=1; npm run build
```

## Test Suite

The project uses Vitest. Current tests cover:

- URL/header/query/form matching
- fetch request parsing
- JSONPath helpers
- JSON and text modifiers
- rule schema normalization and import
- runtime message validation
- compiled rule indexes
- fetch interception behavior
- i18n detection and translation

Run:

```bash
npm test
```

## Build Scripts

The build script combines Vite and esbuild:

- Vite builds the popup and options pages.
- esbuild bundles the extension entries:
  - background service worker
  - isolated content bridge
  - MAIN-world page hook

This keeps the UI and extension-runtime outputs explicit and predictable.
