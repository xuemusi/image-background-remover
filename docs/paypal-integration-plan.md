# Image Background Remover - PayPal 支付接入方案

更新时间：2026-03-17

## 1. 目标

为当前网站接入 **PayPal 支付**，用于后续实现：
- 按次购买
- 套餐包购买
- 订阅制会员（后续可选）

当前阶段建议优先做：

> **一次性支付（One-time payment）**

先完成最小闭环：用户付款 -> 网站确认付款成功 -> 给用户开通额度/权限。

---

## 2. 当前项目背景

项目当前结构：
- Next.js 单页工具站
- Cloudflare Pages
- `_worker.js` 处理 API
- 已规划 Google OAuth 轻量登录
- 目前无数据库

因此支付方案要尽量：
- 不破坏现有 Cloudflare Pages Advanced Mode 架构
- 能在 Worker 层处理 PayPal 服务端逻辑
- 先做轻量 MVP，不上复杂账单系统

---

## 3. 推荐路线

## 第一阶段：PayPal Checkout（推荐）

优先接入：
- **PayPal Checkout / Orders API**
- 做 **一次性支付**

这是最适合你现在 MVP 的路线。

### 适合原因
- 集成难度低于订阅制
- 对当前单页工具站最友好
- 可快速验证用户是否愿意付费
- 更适合先卖：
  - 10 次去背额度包
  - 50 次额度包
  - Pro 单次购买

---

## 4. 不建议现在就做的

暂时不建议一上来做：
- PayPal Subscription 订阅制
- 多币种复杂结算
- 发票系统
- 自动退款后台
- 完整财务对账后台

原因：
- 现在项目还在 MVP 阶段
- 没数据库时，订阅生命周期管理会复杂很多
- 先验证“是否有人付费”更重要

---

## 5. 推荐技术实现

### 前端
- 首页/定价区增加 PayPal 购买按钮
- 用户选择套餐
- 调用后端创建 PayPal order
- 跳转 PayPal 或弹出 PayPal 支付组件

### 后端（推荐放在 Cloudflare Worker）
在 `cloudflare/_worker.js` 增加支付相关 API：
- `POST /api/paypal/create-order`
- `POST /api/paypal/capture-order`
- `POST /api/paypal/webhook`（第二阶段可接）

### 为什么放 Worker
因为你当前：
- API 已在 `_worker.js`
- OAuth 也准备在 Worker 层处理
- 继续把支付放 Worker 层最一致

---

## 6. 第一阶段最小闭环

### 建议先做的支付产品
先只做 2~3 个固定套餐，例如：
- Starter：$4.99 / 10 次
- Pro Pack：$12.99 / 50 次
- Business Pack：$29.99 / 200 次

### 用户流程
1. 用户登录（建议结合 Google 登录）
2. 选择一个套餐
3. 前端请求 `/api/paypal/create-order`
4. PayPal 完成支付
5. 前端/后端调用 `/api/paypal/capture-order`
6. 网站确认支付成功
7. 给该用户增加可用额度

---

## 7. 一个关键前提：你最好先有“用户标识”

如果要做支付，建议至少具备：
- Google 登录
- 或匿名用户唯一 ID

因为支付成功后你必须知道：

> 这笔钱到底记到谁名下？

所以从产品顺序上：
1. 先有登录
2. 再接支付

这是最稳的。

---

## 8. 没数据库时怎么做

### 短期可行，但不优雅
你可以暂时：
- 支付成功后只回前端成功状态
- 或用临时 KV / D1 / 外部存储记录购买结果

### 我更建议
如果要认真做支付，至少补一个轻量存储层：
- **Cloudflare D1**：适合订单记录、用户额度
- **Cloudflare KV**：适合轻量状态/缓存

### 推荐优先级
- 用户 / 订单 / 额度：**D1**
- 临时缓存 / webhook 幂等键：**KV**

---

## 9. 支付系统最少要存什么

至少要能记录：
- 用户 ID
- PayPal order ID
- 支付状态
- 支付金额
- 币种
- 购买的套餐
- 发放了多少额度
- 创建时间

否则后面会出现：
- 用户说自己付了钱
- 你却没法核对

---

## 10. PayPal 侧你需要准备什么

你需要一个 PayPal Developer 应用，拿到：
- `PAYPAL_CLIENT_ID`
- `PAYPAL_CLIENT_SECRET`

环境分为：
- Sandbox（测试）
- Live（正式）

建议先做 Sandbox 联调。

---

## 11. 项目环境变量（后续）

建议预留：

```bash
PAYPAL_CLIENT_ID=xxx
PAYPAL_CLIENT_SECRET=xxx
PAYPAL_ENV=sandbox
APP_BASE_URL=https://image-background-remover-16e.pages.dev
```

如果后续接 webhook，还会需要：

```bash
PAYPAL_WEBHOOK_ID=xxx
```

---

## 12. 推荐实施顺序

### Phase 1：研究与准备
- 确定卖什么套餐
- 确定是否必须登录后购买
- 创建 PayPal Developer App
- 拿到 sandbox 凭证

### Phase 2：接一次性支付
- create-order
- capture-order
- 前端购买按钮
- 支付成功页/提示

### Phase 3：补轻量存储
- D1 建表
- 保存订单
- 保存用户额度

### Phase 4：补 webhook 与幂等
- webhook 验签
- 防重复发额度
- 对账能力

---

## 13. 我对你这个项目的建议结论

### 最推荐路线
> **Google 登录 + PayPal 一次性支付 + D1 记录订单与额度**

原因：
- 对 MVP 足够实用
- 技术复杂度可控
- 后面能自然扩展成会员系统

### 不建议路线
> 现在立刻做 PayPal 订阅 + 无存储

因为会导致：
- 状态管理混乱
- 对账困难
- 退款/争议难处理

---

## 14. 下一步建议

如果继续推进，建议按这个顺序：

1. 先把 Google 登录联调完成
2. 我再给你补一版 **PayPal 技术实现文档**（接口、字段、D1 表结构）
3. 再开始真接代码

---

## 15. 一句话结论

> 对你现在这个项目，最适合的是：**先做 PayPal 一次性支付，不要一开始就做订阅；并且最好配一个 D1 来存订单和额度。**
