# NeoFetchSpy

简体中文 | [English](./README.md)

NeoFetchSpy 是一个 Manifest V3 浏览器扩展，用于拦截页面中的 `window.fetch` 请求，并根据用户配置的规则修改 JSON 或文本响应。

它适合本地调试、响应数据整形、接口排查、前端联调和快速验证场景：当改动服务端成本较高时，可以直接在浏览器侧观察并重写目标响应。

## 功能特性

- 在 `document_start` 阶段、页面 MAIN world 中拦截 `window.fetch`。
- 按 URL 通配符、HTTP Method、Query 参数、请求 Header 和 POST 表单字段匹配请求。
- 支持按页面域名限制规则作用范围，仅向页面 hook 发送当前页面相关的规则。
- 通过有序 action 修改 JSON 响应：
  - 删除 JSONPath 目标字段
  - 替换 JSONPath 目标值
  - 按字段条件过滤数组元素
- 通过正则替换修改文本响应。
- 支持响应类型判断：
  - 按 `content-type` 自动识别
  - 强制按 JSON 处理
  - 强制按 Text 处理
- 支持 `fetch(new Request(...))`，包括 method/header 读取及 `init` 参数覆盖。
- 支持从以下请求 body 中读取 POST 表单匹配数据：
  - `URLSearchParams`
  - `FormData`
  - `application/x-www-form-urlencoded` 文本、Blob 或 buffer
  - 通过 `Request.clone().formData()` 读取的 Request body，不消耗原始请求体
- 提供完整的配置页面，用于创建、编辑、复制、导入和导出规则。
- 提供简洁 popup，用于查看启用状态、切换全局开关并进入配置页。
- 使用 `chrome.storage.local` 保存配置。
- UI 支持中文、英文和日文。
- isolated content bridge 仅向页面 hook 发送执行所需的精简运行时配置。
- 配置变化时预编译规则 matcher，避免在每一次 fetch 中重复创建匹配表达式。

## 工作原理

浏览器扩展的 isolated content script 无法直接修改页面 JavaScript 环境中的 `window.fetch`。因此 NeoFetchSpy 使用两个内容脚本协作：

1. `pageHook`
   - 运行在页面 MAIN world。
   - 尽早 patch `window.fetch`。
   - 解析请求、选择第一个匹配且启用的规则。
   - 仅在确实需要修改响应时读取 body，并返回重建后的 `Response`。

2. `contentBridge`
   - 运行在扩展 isolated world。
   - 从 `chrome.storage.local` 读取设置。
   - 按当前页面域名过滤运行时规则。
   - 向 `pageHook` 发送精简后的运行时规则。
   - 监听存储变化，并及时同步新的运行配置。

后台 service worker 负责初始化设置和响应扩展消息。popup 与 options 页面通过同一存储模块管理配置。

## 项目结构

```text
public/manifest.json
  MV3 manifest，声明 popup、options、background 与两个 content script。

src/extension/
  background.ts          设置初始化与扩展消息处理。
  content-bridge.ts      isolated world 中的设置桥接。
  page-hook.ts           MAIN world 中的 fetch patch 入口。
  fetch-interceptor.ts   fetch 拦截和响应重写流程。
  messages.ts            运行时消息 schema 与校验。
  storage.ts             chrome.storage.local 适配器。

src/core/
  matcher.ts             请求解析与通配符匹配。
  rule-scope.ts          页面域名作用域归一化与过滤。
  rule-index.ts          预编译运行时规则索引。
  rule-engine.ts         规则选择与响应类型处理。
  modifier.ts            JSON/Text action 执行。
  jsonpath.ts            delete/replace/filter 使用的 JSONPath 辅助函数。
  rule-schema.ts         规则创建、归一化、导入与校验。
  types.ts               规则和设置共享类型。

src/ui/
  options.ts             完整规则编辑器。
  popup.ts               状态 popup。
  i18n.ts                UI 翻译文案。
  shared.ts              DOM 工具函数。

__tests__/
  匹配、JSONPath、修改器、schema、i18n、消息、规则索引和 fetch 拦截测试。
```

## 规则模型

每条规则由以下部分组成：

- `match`：请求匹配条件。
- `scope`：可选的页面域名作用域。
- `responseType`：可选的响应 body 类型覆盖。
- `actions`：按顺序执行的响应修改操作。
- 元数据：id、名称、启用状态、时间戳和 schema 版本。

示例：

```json
{
  "schemaVersion": 1,
  "id": "remove-shopping-items",
  "name": "移除购物推广",
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
        "field": "title",
        "operator": "text_contains",
        "value": "淘宝|京东|天猫"
      }
    }
  ],
  "createdAt": 1710000000000,
  "updatedAt": 1710000000000
}
```

## 页面域名作用域

`scope.pageHosts` 控制规则可以在哪些页面上运行。它匹配的是当前页面域名，不是 fetch 请求 URL。

支持的写法：

```text
*
example.com
*.example.com
```

缺失或为空时保持旧行为，在所有页面生效。`*.example.com` 同时匹配 `example.com` 和 `api.example.com` 等子域名。

## 请求匹配

NeoFetchSpy 会按规则列表顺序检查所有启用规则，并使用第一条匹配的规则。

### URL

URL 使用简单通配符匹配：

- `*` 匹配任意数量字符。
- `?` 匹配单个字符。
- 匹配不区分大小写。

示例：

```text
*://api.example.com/*
https://example.com/v?/feed
```

### Method

支持以下值：

```text
GET POST PUT DELETE PATCH HEAD OPTIONS *
```

`*` 表示匹配任意 Method。

### Query 参数

`match.query` 是部分匹配映射。配置中的每个键都必须存在于请求 URL，并满足其通配符匹配值。

```json
{
  "query": {
    "page": "1",
    "keyword": "dev*"
  }
}
```

### Header

`match.headers` 也是部分匹配映射。Header 名称会在内部统一转换为小写。

```json
{
  "headers": {
    "x-token": "abc*"
  }
}
```

### POST 表单字段

`match.postForm` 匹配解析后的 POST 表单字段。与 Query/Header 相同，配置中的所有字段必须存在且满足通配符匹配值。

```json
{
  "postForm": {
    "token": "abc*",
    "scene": "feed"
  }
}
```

当前支持的表单来源：

- `URLSearchParams`
- `FormData` 中的字符串字段
- `application/x-www-form-urlencoded` body
- 可 clone 并读取表单内容的 `Request` 对象

文件字段不会参与匹配。

## 响应 Action

Action 会按配置顺序执行。JSON 响应只执行 JSON action；文本响应只执行 regex action。

### Delete

删除指定 JSONPath 目标。

```json
{
  "type": "delete",
  "path": "$.data.debug"
}
```

### Replace

将指定 JSONPath 目标替换为 JSON 值。

```json
{
  "type": "replace",
  "path": "$.data.status",
  "value": "patched"
}
```

### Filter

当条件匹配时，从数组中移除该元素。

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

支持的条件操作符：

```text
exists
not_exists
is_empty
is_not_empty
text_equals
text_not_equals
text_contains
text_not_contains
text_regex
number_equals
number_not_equals
number_gt
number_gte
number_lt
number_lte
```

`exists` 和 `not_exists` 判断的是字段路径是否存在，而不是字段值是否为真。只要路径存在，值为 `undefined`、`null`、`false`、`0` 或 `""` 都算存在。

`is_empty` 会把 `undefined`、`null`、`""`、`[]` 和 `{}` 视为空；`0` 和 `false` 不视为空。

文本操作符按字符串比较。`text_contains` 和 `text_not_contains` 的比较值支持用 `|` 分隔多个字面量关键词，例如 `淘宝|京东|天猫`。`text_regex` 的比较值填写正则表达式本体，不需要 `/.../` 包裹。

数值操作符只比较有限数字或数字字符串。空字符串和非数字文本不会被当作数字。

字段路径支持点号路径和简单的动态键通配符：

```text
content.jump_url.*.extra.goods_item_id
```

#### Filter 文本匹配的填写方式

如果要移除 `title` 包含“淘宝”“京东”“天猫”任意一个的条目，优先使用“文本包含”，比较值用 `|` 分隔关键词：

```text
数组路径：$.data.items
字段路径：title
条件：文本包含
比较值：淘宝|京东|天猫
```

如果需要更复杂的匹配，再使用“正则匹配”。例如只想匹配字段值完全等于上述任意一个词，则填写：

```regex
^(淘宝|京东|天猫)$
```

目前 filter 条件中的正则不支持额外 flags，默认区分大小写。文本响应的 Regex action 则单独支持 flags。

### Regex

Regex action 对文本响应执行正则替换。

```json
{
  "type": "regex",
  "pattern": "<title>.*?</title>",
  "flags": "i",
  "replacement": "<title>Patched</title>"
}
```

## 可靠性说明

- 扩展会先匹配请求，再决定是否读取响应 body。
- isolated content bridge 会先按页面域名过滤规则，再向 MAIN world 页面 hook 发送运行时配置。
- 仅当匹配规则中存在适用于该响应类型的 action 时，才会解析响应内容。
- `HEAD`、`204`、`205` 和 `304` 响应不会被重写，因为这些响应不适合携带替换 body。
- 重写响应时会移除旧的 `content-length` 和 `content-encoding`，避免响应元信息失效。
- 设置变更时预编译 runtime rule，从而避免每次 fetch 重建通配符正则。

## 安全与权限

扩展目前声明以下权限：

```json
{
  "permissions": ["storage"],
  "host_permissions": ["<all_urls>"]
}
```

由于扩展允许用户配置对任意网站的 fetch 请求进行拦截，因此当前使用 `<all_urls>`。如果将扩展公开上架，建议进一步评估 optional host permissions，或限制默认匹配范围。

`pageHook` 必须运行于页面 MAIN world 才能修改 `window.fetch`。这意味着页面脚本与拦截逻辑处于同一执行环境。NeoFetchSpy 会先按当前页面过滤规则，并仅同步精简的运行时配置，同时严格校验消息；但 MAIN world 中的匹配逻辑仍应视作页面可观察内容。

## 开发方式

环境要求：

- Node.js
- npm
- 用于手动加载扩展的 Chromium 内核浏览器

安装依赖：

```bash
npm install
```

运行类型检查和测试：

```bash
npm run typecheck
npm test
```

构建扩展：

```bash
npm run build
```

构建产物位于 `dist/`。

在 Chromium 中加载：

1. 打开 `chrome://extensions`。
2. 开启“开发者模式”。
3. 点击“加载已解压的扩展程序”。
4. 选择项目中的 `dist/` 目录。

监听构建：

```bash
npm run dev
```

发布构建默认不输出 sourcemap。如需调试构建：

```powershell
$env:SOURCE_MAP=1; npm run build
```

## 测试覆盖

项目使用 Vitest，当前测试覆盖：

- URL/Header/Query/POST 表单匹配
- fetch 请求解析
- JSONPath 辅助函数
- JSON 和文本修改逻辑
- 规则 schema 归一化与导入
- 运行时消息校验
- 预编译规则索引
- fetch 拦截行为
- i18n 检测与翻译

运行：

```bash
npm test
```

## 构建流程

构建脚本组合使用 Vite 和 esbuild：

- Vite 构建 popup 与 options 页面。
- esbuild 构建扩展运行入口：
  - background service worker
  - isolated content bridge
  - MAIN-world page hook

这样可以保持 UI 与扩展运行时产物清晰、可预测。
