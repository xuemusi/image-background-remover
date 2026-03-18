# Image Background Remover

基于 **Next.js + Tailwind CSS** 的轻量 MVP 骨架，目标部署到 **Cloudflare（Pages / Workers 兼容方向）**，后端通过服务端环境变量调用 **remove.bg API**，不做任何持久存储。

## MVP 范围

已实现的骨架：

- Next.js App Router 项目结构
- Tailwind CSS 基础样式与首页 UI
- 首页 Hero / 上传区 / 结果区 / FAQ 区
- `POST /api/remove-background` API route
- 服务端调用 `remove.bg` 的封装
- `.env.example` / `wrangler.toml` / `README` 等基础配置

## 技术说明

- **前端**：Next.js 14 + React 18 + Tailwind CSS
- **后端**：Cloudflare Pages Advanced Mode `_worker.js`（处理 remove.bg 与 OAuth）
- **部署目标**：Cloudflare Pages + 静态导出 + Worker API
- **存储策略**：图片仍是无持久化中转；用户体系 Phase-1 可接 Cloudflare D1（无 D1 时自动降级为内存态）

## 目录结构

```txt
image-background-remover/
├─ app/
│  ├─ api/remove-background/route.ts
│  ├─ globals.css
│  ├─ layout.tsx
│  └─ page.tsx
├─ components/
│  └─ uploader.tsx
├─ lib/
│  └─ removeBg.ts
├─ .env.example
├─ next.config.mjs
├─ package.json
├─ postcss.config.js
├─ tailwind.config.ts
├─ tsconfig.json
└─ wrangler.toml
```

## 环境变量

复制配置文件：

```bash
cp .env.example .env.local
```

然后填写：

```bash
REMOVE_BG_API_KEY=your_remove_bg_api_key_here
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here
AUTH_SESSION_SECRET=replace_with_a_long_random_secret
APP_BASE_URL=http://localhost:3000
PAYPAL_ENV=sandbox
PAYPAL_CLIENT_ID=your_paypal_client_id_here
PAYPAL_CLIENT_SECRET=your_paypal_client_secret_here
# 可选：Webhook 二期使用
# PAYPAL_WEBHOOK_ID=your_paypal_webhook_id_here
```

> 注意：`REMOVE_BG_API_KEY`、`GOOGLE_CLIENT_SECRET`、`AUTH_SESSION_SECRET`、`PAYPAL_CLIENT_SECRET` 必须只保留在服务端，不要暴露到前端。

## 本地启动

```bash
cd image-background-remover
npm install
npm run dev
```

默认访问：

- `http://localhost:3000`

## Google OAuth 配置

请在 Google Cloud Console 创建 OAuth Client（Web 应用），并配置回调：

- 本地：`http://localhost:3000/api/auth/google/callback`
- 生产：`https://<你的域名>/api/auth/google/callback`

例如 Pages 默认域名可用：

- `https://image-background-remover-16e.pages.dev/api/auth/google/callback`

## API 说明

### `POST /api/remove-background`

请求：

- `multipart/form-data`
- 字段名：`image`

成功返回：

- `image/png` 二进制内容

失败返回：

```json
{ "error": "..." }
```

### Google OAuth API（由 `cloudflare/_worker.js` 提供）

- `GET /api/auth/google/start`：发起 Google 登录跳转
- `GET /api/auth/google/callback`：Google 回调，交换 token，自动建档（users + credits）并建立 session cookie
- `GET /api/auth/session`：读取当前登录态（返回 `authenticated` 与 `user`）
- `POST /api/auth/logout`：清除登录态 cookie

### User Center / Dashboard API（由 `cloudflare/_worker.js` 提供）

- `GET /api/me`：当前用户信息 + credits（D1 或内存 fallback）
- `GET /api/me/orders`：当前用户最近订单
- `GET /api/plans`：返回可购买额度套餐

### PayPal API（Phase-1 skeleton）

- `POST /api/paypal/create-order`
  - 入参：`{ "planCode": "pro_50" }`
  - 行为：创建本地 orders 草稿 + 远端 PayPal order
  - 出参：`localOrderId`、`providerOrderId`、`approveUrl`
- `POST /api/paypal/capture-order`
  - 入参：`{ "localOrderId": "..." }` 或 `{ "providerOrderId": "..." }`
  - 行为：调用 PayPal capture，并幂等发放 credits 到 `user_credits`
  - 幂等：已发放过额度的订单重复 capture 不会重复加余额

> 当前为 sandbox-ready 骨架：若缺 `PAYPAL_CLIENT_ID/PAYPAL_CLIENT_SECRET`，接口会返回清晰错误。

## Cloudflare 部署建议

当前代码优先做了**本地可开发 / 结构清晰 / 向 Cloudflare 靠拢**的 MVP 骨架。

部署到 Cloudflare 时，建议二选一：

1. **Cloudflare Pages + Next.js 适配方案**
2. **Workers / Next on Pages 兼容链路**

最关键的是：

- 在 Cloudflare 控制台配置以下变量：
  - `REMOVE_BG_API_KEY`
  - `GOOGLE_CLIENT_ID`
  - `GOOGLE_CLIENT_SECRET`
  - `AUTH_SESSION_SECRET`
  - `PAYPAL_ENV`（建议先 `sandbox`）
  - `PAYPAL_CLIENT_ID`
  - `PAYPAL_CLIENT_SECRET`
  - （可选）`APP_BASE_URL`
- 配置 D1 绑定 `DB`（见 `wrangler.toml`）并执行 `migrations/0001_user_system.sql`
- 不开启图片持久化存储
- remove.bg、OAuth、用户中心 API 都由 Worker 端处理，前端只走同域 API

## 后续建议

下一步优先做：

1. 接入 Cloudflare 的正式 Next 适配构建链路
2. 补充上传状态与错误边界细节
3. 增加埋点（上传 / 成功 / 下载 / 失败）
4. 优化结果对比体验（如 before/after slider）
5. 加上更完整的 SEO 文案

## 限制

- 受 remove.bg API 配额与成本影响
- 受 Cloudflare 请求大小 / 执行时长限制影响
- 当前为 MVP 骨架，部署前建议再做一次实际联调
