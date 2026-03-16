# Image Background Remover - Google OAuth 接入方案

更新时间：2026-03-16

## 1. 目标

为当前网站接入 **Google OAuth 登录**，实现：
- 用户点击 Google 登录
- 成功后获取用户基础身份信息（头像、昵称、邮箱）
- 前端能够识别登录状态
- 为后续功能（次数限制、会员、历史记录）预留基础

当前阶段优先做 **轻量登录版**，不急着引入数据库。

---

## 2. 当前项目背景

当前项目已具备：
- Next.js + Tailwind CSS
- Cloudflare Pages 部署
- Pages Advanced Mode `_worker.js`
- `/api/remove-background` 服务端代理 remove.bg
- 无数据库
- 无用户系统
- 单页工具站

因此 Google 登录要尽量：
- 不破坏现有 Pages 部署结构
- 不强依赖数据库
- 先解决“用户身份识别”问题

---

## 3. 推荐方案

## 方案选择

推荐先做：

> **Google OAuth + 轻量 session（cookie）**

即：
- 用户用 Google 登录
- 登录后获得 session
- 前端可读取登录状态
- 暂时不做数据库持久化用户体系

---

## 4. 技术路线建议

### 推荐认证库
- **Auth.js / NextAuth**

原因：
- 与 Next.js 兼容性最好
- Google Provider 成熟
- 后续扩邮箱验证、用户体系更方便

---

## 5. MVP 登录范围

### 本期实现
1. Google 登录按钮
2. Google OAuth 回调
3. session 建立
4. 前端显示登录状态
5. 登录后显示基础信息：
   - 用户头像
   - 用户昵称
   - 用户邮箱
6. 登出功能

### 本期不做
1. 数据库存用户
2. 权限角色系统
3. 账号绑定
4. 历史记录同步
5. 支付/会员体系
6. 多 Provider 登录

---

## 6. 用户流程

### 登录流程
1. 用户点击 “Continue with Google”
2. 跳转 Google 授权页
3. 用户授权
4. 回调到网站
5. 建立 session
6. 首页显示用户信息

### 登出流程
1. 用户点击登出
2. 清除 session
3. 恢复未登录状态

---

## 7. Google 侧需要准备的内容

你需要在 Google Cloud Console 创建 OAuth Client。

### 需要拿到
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`

### 回调地址（生产）
```bash
https://image-background-remover-16e.pages.dev/api/auth/callback/google
```

### 本地回调地址（开发）
```bash
http://localhost:3000/api/auth/callback/google
```

如果本地端口调整，则同步修改。

---

## 8. 项目环境变量

后续项目至少需要这些环境变量：

```bash
GOOGLE_CLIENT_ID=xxx
GOOGLE_CLIENT_SECRET=xxx
NEXTAUTH_SECRET=xxx
NEXTAUTH_URL=https://image-background-remover-16e.pages.dev
```

说明：
- `NEXTAUTH_SECRET`：用于 session 签名
- `NEXTAUTH_URL`：当前线上地址

---

## 9. 页面改造需求

### 首页新增
1. 顶部登录按钮
2. 未登录状态：
   - 显示 “Sign in with Google”
3. 已登录状态：
   - 显示头像
   - 显示邮箱/昵称
   - 显示登出按钮

### 交互要求
- 不影响现有抠图主流程
- 未登录也可以继续用（如果你暂时不想做强制登录）
- 登录只是为后续做用户能力预留

---

## 10. 与当前架构的关系

当前项目不是 Vercel 标准部署，而是：
- Cloudflare Pages
- Advanced Mode `_worker.js`

因此要特别注意：

### 风险点
- Auth.js/NextAuth 在 Cloudflare 上的兼容方式需要确认
- 不能简单套默认 Node 部署思路
- 需要确保登录回调和 session 能在当前部署模式下正常工作

---

## 11. 实施建议

### 第一阶段（推荐现在做）
- 只接 Google 登录
- 只做 session
- 不上数据库

### 第二阶段（后续）
- 登录后次数限制
- 用户使用记录
- 会员体系
- 历史记录

### 第三阶段（更后面）
- 多 Provider
- 用户资料页
- 后台管理

---

## 12. 验收标准

### 功能验收
- 能正常跳转 Google 登录
- 登录成功后回到网站
- 前端能识别已登录状态
- 能显示基础用户信息
- 能正常登出

### 技术验收
- 不破坏现有 remove.bg 功能
- 不影响 Cloudflare 部署
- session 能稳定工作

---

## 13. 我的建议结论

对于当前这个单页工具站，最合适的做法是：

> **先接 Google OAuth 轻量登录，不急着上数据库。**

这样可以：
- 快速完成身份识别
- 为后续次数限制/订阅打基础
- 不把项目一下子做得过重

---

## 14. 下一步建议

1. 先准备 Google Cloud Console 的 Client ID / Secret
2. 再在项目里接 Auth.js / NextAuth
3. 本地联调
4. 再推到 Cloudflare 上验证
