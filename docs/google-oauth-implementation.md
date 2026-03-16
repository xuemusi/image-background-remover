# Google OAuth 实施说明（Cloudflare Pages Advanced Mode）

更新时间：2026-03-17

## 为什么没选 NextAuth/Auth.js

当前项目是 **Next.js 静态导出（`output: 'export'`）+ Cloudflare Pages Advanced Mode `_worker.js`**。

在这个架构下：
- Next.js 服务器路由不会随静态导出一起部署
- OAuth 回调与 session 更适合直接在 Worker 层实现

因此本次采用：

> **Cloudflare Worker 内实现 Google OAuth + 签名 session cookie（无数据库）**

优点：
- 不破坏现有部署链路
- 保持轻量，无需引入数据库
- 同域 API，前端改动小

## 已完成能力

- 登录按钮（首页）
- 未登录/已登录态 UI
- 会话接口：`/api/auth/session`
- 登出接口：`/api/auth/logout`
- Google OAuth 跳转与回调
- 使用 `AUTH_SESSION_SECRET` 对 session JWT 进行 HMAC-SHA256 签名

## Worker API

- `GET /api/auth/google/start?locale=en|zh`
- `GET /api/auth/google/callback`
- `GET /api/auth/session`
- `POST /api/auth/logout`

## 必需环境变量

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `AUTH_SESSION_SECRET`
- （原有）`REMOVE_BG_API_KEY`
- （可选）`APP_BASE_URL`

## Google Console 回调地址

- 本地：`http://localhost:3000/api/auth/google/callback`
- 线上：`https://<你的域名>/api/auth/google/callback`

## 注意事项

- 由于当前环境没有真实 Google 凭证，本次未做完整线上联调
- 代码接入点、路由和 session 结构已就位，填入凭证即可联调
