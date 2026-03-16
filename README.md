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
- **后端**：Next.js Route Handler（`runtime = "edge"`）
- **部署目标**：Cloudflare Pages / Workers 轻量适配方向
- **存储策略**：无数据库、无对象存储、图片仅在请求生命周期内以内存方式中转

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
```

> 注意：`REMOVE_BG_API_KEY` 必须只保留在服务端，不要暴露到前端。

## 本地启动

```bash
cd image-background-remover
npm install
npm run dev
```

默认访问：

- `http://localhost:3000`

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

## Cloudflare 部署建议

当前代码优先做了**本地可开发 / 结构清晰 / 向 Cloudflare 靠拢**的 MVP 骨架。

部署到 Cloudflare 时，建议二选一：

1. **Cloudflare Pages + Next.js 适配方案**
2. **Workers / Next on Pages 兼容链路**

最关键的是：

- 在 Cloudflare 控制台配置 `REMOVE_BG_API_KEY`
- 不开启图片持久化存储
- 仅通过服务端 route 转发到 remove.bg

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
