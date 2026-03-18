# Image Background Remover - PayPal 技术实现细案

更新时间：2026-03-18

## 1. 目标

为当前项目设计一套 **可直接开发的 PayPal 支付实现方案**，目标是：
- 用户登录后可购买额度包
- 使用 PayPal 一次性支付（One-time payment）
- 支付成功后自动给用户发放额度
- 订单、额度可在个人中心查看
- 为后续扩展订阅制保留空间

当前阶段只追求：

> **支付链路跑通 + 订单可记 + 额度可发**

不追求复杂财务系统。

---

## 2. 本期确定方案

## 支付模式
- **PayPal Orders API**
- **一次性支付（One-time payment）**
- **卖额度包，不做订阅**

## 数据存储
- **Cloudflare D1** 作为主数据库

## 用户前提
- 需要先有 Google 登录
- 所有支付都绑定到已登录用户

---

## 3. 业务模型

### 购买对象：额度包（credits packs）

建议第一版先固定 3 个套餐：

```ts
const PLANS = {
  starter_10: {
    code: "starter_10",
    name: "Starter 10",
    price: 4.99,
    currency: "USD",
    credits: 10,
  },
  pro_50: {
    code: "pro_50",
    name: "Pro 50",
    price: 12.99,
    currency: "USD",
    credits: 50,
  },
  business_200: {
    code: "business_200",
    name: "Business 200",
    price: 29.99,
    currency: "USD",
    credits: 200,
  },
};
```

### 为什么卖额度包
因为它最适合 MVP：
- 简单
- 直观
- 不涉及周期续费
- 不涉及订阅取消
- 容易在 dashboard 展示余额

---

## 4. 用户支付全链路

### Step 1：用户登录
用户必须先登录，系统已知：
- user_id
- email
- google_sub

### Step 2：用户选择套餐
前端展示 3 个固定套餐。

### Step 3：前端调用创建订单接口
请求：
- `POST /api/paypal/create-order`

后端逻辑：
1. 校验用户已登录
2. 校验 `plan_code` 合法
3. 在 D1 预创建本地订单（状态 `created`）
4. 调用 PayPal Orders API 创建远程订单
5. 把 PayPal `order_id` 回写到本地订单
6. 返回前端支付所需信息

### Step 4：用户完成 PayPal 支付
用户在 PayPal 页面中支付。

### Step 5：前端/后端执行 capture
请求：
- `POST /api/paypal/capture-order`

后端逻辑：
1. 校验用户已登录
2. 根据本地订单 / PayPal order ID 查订单
3. 如果已发放额度，则直接返回成功（幂等）
4. 调用 PayPal capture API
5. 验证支付状态为成功
6. 更新订单状态为 `captured`
7. 给用户增加 credits
8. 记录额度发放结果
9. 返回成功结果

### Step 6：Dashboard 展示
用户个人中心可看到：
- 当前余额
- 最近订单
- 本次购买增加的额度

---

## 5. 推荐 API 设计

## 5.1 创建 PayPal 订单
### `POST /api/paypal/create-order`

请求体：
```json
{
  "planCode": "pro_50"
}
```

返回体（示例）：
```json
{
  "ok": true,
  "order": {
    "localOrderId": "ord_xxx",
    "providerOrderId": "PAYPAL_ORDER_ID",
    "planCode": "pro_50",
    "amount": "12.99",
    "currency": "USD"
  }
}
```

错误返回（示例）：
```json
{
  "ok": false,
  "error": "Invalid plan code"
}
```

---

## 5.2 Capture 订单
### `POST /api/paypal/capture-order`

请求体：
```json
{
  "localOrderId": "ord_xxx"
}
```

或：
```json
{
  "providerOrderId": "PAYPAL_ORDER_ID"
}
```

返回体（示例）：
```json
{
  "ok": true,
  "order": {
    "id": "ord_xxx",
    "status": "captured",
    "creditsGranted": 50
  },
  "credits": {
    "balance": 62,
    "lifetimeCredited": 100,
    "lifetimeUsed": 38
  }
}
```

---

## 5.3 查询套餐（可选）
### `GET /api/plans`

如果你希望前端不写死套餐，可以由后端返回：
```json
{
  "plans": [
    {
      "code": "starter_10",
      "name": "Starter 10",
      "price": 4.99,
      "currency": "USD",
      "credits": 10
    }
  ]
}
```

MVP 阶段也可以直接前端写死。

---

## 5.4 Webhook（第二阶段）
### `POST /api/paypal/webhook`

第一版可以先不依赖 webhook 跑通流程。  
但正式做支付，建议第二阶段补上，用于：
- 补单
- 异常状态同步
- 支付完成兜底

---

## 6. D1 表结构建议

## 6.1 users
```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  google_sub TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  avatar_url TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_login_at TEXT
);
```

## 6.2 user_credits
```sql
CREATE TABLE user_credits (
  user_id TEXT PRIMARY KEY,
  balance INTEGER NOT NULL DEFAULT 0,
  lifetime_credited INTEGER NOT NULL DEFAULT 0,
  lifetime_used INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

## 6.3 orders
```sql
CREATE TABLE orders (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  provider_order_id TEXT UNIQUE,
  plan_code TEXT NOT NULL,
  plan_name TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL,
  status TEXT NOT NULL,
  credits_granted INTEGER NOT NULL DEFAULT 0,
  credit_granted_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

## 6.4 payment_events（建议有）
```sql
CREATE TABLE payment_events (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (order_id) REFERENCES orders(id)
);
```

## 6.5 background_removal_jobs（配合额度消耗）
```sql
CREATE TABLE background_removal_jobs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  source_filename TEXT,
  status TEXT NOT NULL,
  credits_used INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

---

## 7. 订单状态设计

推荐订单状态：
- `created`：本地订单已创建
- `approval_pending`：等待用户完成 PayPal 支付
- `approved`：PayPal 侧通过但尚未 capture（可选）
- `captured`：已成功收款
- `credit_granted`：已发放额度
- `failed`：支付失败
- `cancelled`：用户取消支付
- `refunded`：已退款（后续）

### MVP 可简化成
- `created`
- `captured`
- `failed`
- `cancelled`

但建议数据库层先留出可扩展空间。

---

## 8. 额度发放逻辑

这是支付逻辑里最关键的部分。

### 原则
> **只有在支付 capture 成功后，才发额度。**

### 逻辑
以 `pro_50` 为例：
- order capture 成功
- `credits_granted = 50`
- `user_credits.balance += 50`
- `user_credits.lifetime_credited += 50`

### 幂等要求
必须防止重复发放。

推荐方式：
- 如果订单 `credit_granted_at` 不为空
- 或 `status` 已经是 `credit_granted`
- 则重复请求不再二次加余额

---

## 9. 防重复发额度设计（非常重要）

### 场景
- 用户重复点击支付完成
- 前端重复调用 capture
- 网络重试
- PayPal webhook 重复推送

### 处理原则
对同一个 `provider_order_id`：
- 只能成功发放一次额度

### 推荐实现
#### 方式 A：订单表字段控制
在 `orders` 表里存：
- `credits_granted`
- `credit_granted_at`

若已存在 `credit_granted_at`，说明发过额度，直接返回当前结果。

#### 方式 B：事务控制
capture 成功后：
1. 开事务
2. 再检查订单是否已发放
3. 未发放才更新订单 + 更新余额
4. 提交事务

---

## 10. Worker 中的实现建议

目前你的 API 主要在：
- `cloudflare/_worker.js`

建议继续把支付 API 放在 Worker 层：
- `POST /api/paypal/create-order`
- `POST /api/paypal/capture-order`
- `POST /api/paypal/webhook`（后续）

### 优点
- 认证、支付、去背 API 都在一个 Worker 层
- 架构一致
- 更适合 Cloudflare Pages Advanced Mode

---

## 11. PayPal API 对接逻辑

### 11.1 获取 Access Token
使用：
- `PAYPAL_CLIENT_ID`
- `PAYPAL_CLIENT_SECRET`

请求 PayPal OAuth token。

### 11.2 创建订单
调用 PayPal Orders API：
- 传金额
- 传货币
- 传商品描述

### 11.3 Capture 订单
用户支付后，调用 capture API。

### 11.4 验证结果
确认：
- capture 成功
- 金额正确
- 订单未重复发放

---

## 12. 环境变量

至少需要：

```bash
PAYPAL_CLIENT_ID=xxx
PAYPAL_CLIENT_SECRET=xxx
PAYPAL_ENV=sandbox
APP_BASE_URL=https://image-background-remover-16e.pages.dev
```

后续如果接 webhook：

```bash
PAYPAL_WEBHOOK_ID=xxx
```

---

## 13. 前端页面建议

## 首页 / Pricing 区块
显示：
- Starter 10
- Pro 50
- Business 200
- Buy with PayPal 按钮

## Dashboard
显示：
- 当前余额
- 最近订单
- 购买入口

## 支付成功反馈
支付成功后显示：
- Payment successful
- 50 credits added to your account

---

## 14. 验收标准（第一版）

### 技术验收
- 用户已登录时能创建 PayPal 订单
- 用户支付成功后能 capture
- 数据库里能写订单
- 用户额度正确增加
- 重复 capture 不会重复发额度

### 页面验收
- 首页能购买
- dashboard 能看到余额
- dashboard 能看到订单记录

---

## 15. 推荐实施顺序

### Phase 1：D1 基础表
- users
- user_credits
- orders
- payment_events

### Phase 2：登录后自动建档
- Google 登录成功后，自动创建 / 更新用户

### Phase 3：Dashboard 骨架
- profile
- credits
- orders

### Phase 4：PayPal create-order / capture-order
- 先跑通 sandbox

### Phase 5：额度消耗逻辑
- 每次去背扣减余额
- 写 jobs 记录

### Phase 6：Webhook（可后补）
- 正式环境增强稳定性

---

## 16. 明确结论

对于当前项目，这套方案最合适：

> **Google 登录 + D1 用户与额度系统 + PayPal 一次性支付 + 额度包模式 + Dashboard 展示余额与订单**

这是一条：
- 复杂度可控
- 适合 MVP
- 能真实跑通流程
- 又能为后续扩展留下空间

---

## 17. 下一步建议

如果继续推进，下一步最合理的是：

1. 先写 **D1 技术文档 / migration 方案**
2. 然后直接实现：
   - D1
   - 登录自动建档
   - dashboard 骨架
3. 再接 PayPal sandbox

---

## 18. 一句话结论

> 支付逻辑不是“接个按钮”那么简单，而是：**订单创建 -> 支付确认 -> 幂等发额度 -> Dashboard 可查**。对于你当前项目，卖额度包 + 一次性支付是最佳方案。
