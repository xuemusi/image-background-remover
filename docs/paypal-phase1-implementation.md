# PayPal Phase-1 实施说明（Sandbox-ready）

更新时间：2026-03-19

## 本次实现范围

基于 `docs/paypal-technical-design.md`，已落地以下骨架能力：

1. Worker 侧新增 PayPal 服务端流程
   - `POST /api/paypal/create-order`
   - `POST /api/paypal/capture-order`
   - `GET /api/plans`
2. 本地订单与 D1 `orders` 对齐
   - create-order 先写本地订单（`created`）
   - 调 PayPal 创建远端订单后，回写 `provider_order_id`，状态更新为 `approval_pending`
3. capture 后与 `user_credits` 对齐
   - 先 capture，再发额度
   - 通过 `credit_granted_at IS NULL` 条件更新实现幂等占位
   - 已发放过的订单重复调用不会重复加余额
4. 前端新增 buy 入口（Dashboard）
   - 套餐展示
   - Buy with PayPal 按钮
   - 从 PayPal 回跳后自动按 `token` 执行 capture
5. 缺凭证时返回清晰报错
   - `PAYPAL_CLIENT_ID/PAYPAL_CLIENT_SECRET` 缺失时返回 `PAYPAL_NOT_CONFIGURED`

## 接口简要

### `POST /api/paypal/create-order`

入参：

```json
{ "planCode": "pro_50" }
```

出参（成功）：

```json
{
  "ok": true,
  "order": {
    "localOrderId": "ord_xxx",
    "providerOrderId": "PAYPAL_ORDER_ID",
    "planCode": "pro_50",
    "amount": "12.99",
    "currency": "USD",
    "approveUrl": "https://www.sandbox.paypal.com/..."
  }
}
```

### `POST /api/paypal/capture-order`

入参（二选一）：

```json
{ "localOrderId": "ord_xxx" }
```

```json
{ "providerOrderId": "PAYPAL_ORDER_ID" }
```

成功后返回订单状态与最新 credits。

## 幂等与占位策略（Phase-1）

- create-order：
  - 支持读取 `idempotencyKey` / `x-idempotency-key`
  - 透传为 `PayPal-Request-Id`（远端幂等）
  - 本地强幂等键持久化暂留到 Phase-2
- capture-order：
  - 发额度时使用条件更新：`WHERE id = ? AND credit_granted_at IS NULL`
  - `changes=0` 表示并发或重复请求已发过额度，直接回当前余额

## 仍待二期补齐

1. webhook 与验签（`PAYPAL_WEBHOOK_ID`）
2. 本地 create-order 强幂等键落库（可新增列/索引）
3. payment_events 表与事件留痕
4. 金额二次校验（对比 PayPal capture 明细）
