# Image Background Remover - 用户体系与个人中心设计方案

更新时间：2026-03-18

## 1. 目标

在现有 Google OAuth 登录基础上，为项目补齐：
- 用户体系
- 登录后个人中心
- 后续额度、订单、支付、订阅的承载结构

当前阶段目标不是做很重的 SaaS 后台，而是先为 MVP 建立一套**可扩展但不过度设计**的用户系统。

---

## 2. 当前基础

项目当前已具备：
- Next.js + Tailwind
- Cloudflare Pages + Advanced Mode `_worker.js`
- Google OAuth 轻量登录
- 无数据库（即将建议补 D1）
- 未来计划接 PayPal 支付

因此用户体系应满足：
- 兼容当前 Worker 架构
- 适配轻量登录
- 能承接额度、订单、支付结果
- 先做最小可用个人中心

---

## 3. 设计原则

### 原则 1：先做 MVP 用户体系，不做重后台
先解决：
- 用户是谁
- 有多少额度
- 买过什么
- 个人中心能看到什么

先不做：
- 多角色权限系统
- 复杂资料编辑
- 多组织/团队协作
- Admin CMS

### 原则 2：认证和用户数据分层
- **认证**：继续用 Google OAuth + session cookie
- **用户数据**：放到 D1

### 原则 3：个人中心先服务业务，不做花架子
个人中心不是“资料页”，而是：
- 看额度
- 看订单
- 看使用记录
- 看账号信息

---

## 4. 推荐总体架构

### 认证层
- Google OAuth
- Session Cookie
- Worker 验证当前用户身份

### 数据层
推荐新增：
- **Cloudflare D1**：主数据库
- （可选）KV：缓存/幂等/短状态

### 业务层
- 用户表
- 额度账户表
- 去背任务记录表
- 订单表
- 支付事件表（可选）

### 前端层
新增登录后入口：
- 右上角用户头像/菜单
- `/dashboard` 个人中心

---

## 5. 用户体系应该包含什么

### 用户身份（Users）
记录：
- 用户 ID
- Google `sub`
- 邮箱
- 昵称
- 头像
- 注册时间
- 最近登录时间
- 状态

### 用户额度（Credits / Balance）
记录：
- 当前可用额度
- 已使用额度
- 累计获得额度
- 更新时间

### 使用记录（Jobs / History）
记录：
- 去背任务 ID
- 用户 ID
- 原图文件名（可选）
- 处理状态
- 消耗额度
- 创建时间

### 订单记录（Orders）
记录：
- 订单 ID
- 用户 ID
- 支付渠道（PayPal）
- 套餐类型
- 金额
- 币种
- 支付状态
- 发放额度数
- 创建时间

---

## 6. 推荐 D1 表结构（MVP 版）

## users
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

## user_credits
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

## background_removal_jobs
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

## orders
```sql
CREATE TABLE orders (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  provider_order_id TEXT,
  plan_code TEXT NOT NULL,
  amount INTEGER NOT NULL,
  currency TEXT NOT NULL,
  status TEXT NOT NULL,
  credits_granted INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

## payment_events（可选）
```sql
CREATE TABLE payment_events (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (order_id) REFERENCES orders(id)
);
```

---

## 7. 用户生命周期设计

### 第一次登录
1. 用户 Google 登录成功
2. Worker 拿到 Google 身份
3. 查 `users` 是否存在
4. 不存在则创建用户
5. 初始化 `user_credits`
6. 建立 session

### 之后登录
1. 更新用户头像/昵称/邮箱（必要时）
2. 更新 `last_login_at`
3. 返回当前用户信息

### 下单后
1. 创建订单
2. 支付成功
3. 发放额度
4. 更新 `user_credits.balance`
5. 写订单记录

### 用户使用去背功能
1. 检查是否已登录（按产品策略决定是否必须登录）
2. 检查余额是否足够
3. 扣减额度
4. 记录任务

---

## 8. 个人中心应该长什么样

## 路由建议
- `/dashboard`

### 模块 1：账号概览
显示：
- 头像
- 昵称
- 邮箱
- 注册时间
- 最近登录时间

### 模块 2：额度概览
显示：
- 当前余额
- 累计已用
- 累计获得
- 购买入口按钮

### 模块 3：订单记录
显示：
- 套餐名
- 支付金额
- 支付状态
- 下单时间

### 模块 4：使用记录
显示：
- 最近去背任务
- 消耗额度
- 创建时间
- 状态

### 模块 5：账号操作
显示：
- 退出登录
- （后续可加）删除账号

---

## 9. MVP 阶段个人中心页面建议

第一版只做这 4 块就够：

1. **Profile Card**
   - 头像
   - 名称
   - 邮箱

2. **Credits Card**
   - 当前可用次数
   - 去购买按钮

3. **Orders Table**
   - 最近订单

4. **Usage Table**
   - 最近去背记录

这版已经足够支撑“跑流程站”。

---

## 10. API 设计建议

### 鉴权相关
- `GET /api/auth/session`
- `POST /api/auth/logout`

### 用户相关
- `GET /api/me`
  - 返回当前登录用户基础信息
- `GET /api/me/credits`
  - 返回额度数据
- `GET /api/me/orders`
  - 返回订单列表
- `GET /api/me/jobs`
  - 返回使用记录

### 后续支付相关
- `POST /api/paypal/create-order`
- `POST /api/paypal/capture-order`

---

## 11. 页面导航建议

当前首页右上角已经有登录状态区域。
建议后续改成：
- 未登录：Google 登录按钮
- 已登录：
  - 头像
  - 下拉菜单：
    - Dashboard
    - Sign out

或者直接：
- 头像旁边一个 `Dashboard` 按钮

---

## 12. 权限策略建议

### 推荐 MVP 策略
- 不登录也能浏览首页
- 登录后才能进入 `/dashboard`
- 未来可选择：
  - 登录后才可去背
  - 或匿名用户可试用 1~3 次

### Dashboard 保护
若未登录访问 `/dashboard`：
- 直接跳回首页
- 或显示请先登录

---

## 13. 与支付的关系

用户体系是支付的前置条件。
因为支付后必须解决：
- 给谁发额度
- 怎么查订单
- 怎么显示用户余额

所以合理顺序是：
1. Google 登录
2. D1 用户体系
3. Dashboard
4. PayPal 支付

---

## 14. 推荐实施顺序

### Phase 1：D1 用户基础层
- 建 `users`
- 建 `user_credits`
- 登录时自动建档

### Phase 2：个人中心 MVP
- `/dashboard`
- 显示 profile + credits

### Phase 3：使用记录
- 记录每次去背任务
- dashboard 展示 recent jobs

### Phase 4：订单体系
- 建 `orders`
- 为 PayPal 做准备

### Phase 5：购买/支付
- 接 PayPal
- 支付成功发额度

---

## 15. 我的建议结论

对于当前项目，最合适的方案是：

> **Google OAuth + D1 用户数据 + Dashboard 个人中心 + 后续接 PayPal**

不要一开始做太重。
先把下面这套跑通：
- 用户登录
- 用户建档
- 个人中心
- 额度
- 订单占位
- 使用记录

这就已经是一套合格的 MVP 用户系统。

---

## 16. 下一步建议

如果继续推进，建议下一步直接做：

1. **D1 技术实现文档（更细）**
   - SQL migration
   - API 字段
   - 会话到用户映射流程
2. **个人中心信息架构 / 页面原型**
3. **开始实现 D1 + `/dashboard` 骨架**

---

## 17. 一句话结论

> 你现在最需要的不是“复杂用户系统”，而是：**一个能承载用户、额度、订单、使用记录的轻量账户体系，以及一个实用的个人中心页面。**
