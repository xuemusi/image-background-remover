# User System Phase-1 (Implemented)

## What is implemented

1. **Google login auto-provision**
   - On OAuth callback, system upserts user profile and initializes credits row.

2. **Account endpoints (Worker-based)**
   - `GET /api/me` → returns authenticated user + credits
   - `GET /api/me/orders` → returns recent orders
   - `POST /api/orders` → creates a draft order (PayPal placeholder)

3. **Dashboard skeleton**
   - Route: `/dashboard`
   - Shows profile, credits, and recent orders table.

4. **D1 schema (phase-1)**
   - Migration: `migrations/0001_user_system.sql`
   - Tables: `users`, `user_credits`, `orders`

5. **No-DB fallback for dev/demo**
   - If `DB` binding is missing, Worker runs in-memory fallback.

---

## Required Cloudflare configuration

### Environment variables

- `REMOVE_BG_API_KEY`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `AUTH_SESSION_SECRET`
- `APP_BASE_URL` (recommended)

### D1 binding

In `wrangler.toml`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "image_bg_remover"
database_id = "<your-d1-database-id>"
```

Apply migration (example):

```bash
wrangler d1 execute image_bg_remover --remote --file migrations/0001_user_system.sql
```

---

## Notes

- PayPal **not integrated yet**. Orders endpoint currently creates draft rows only.
- Current design is intentionally MVP-friendly and ready for PayPal create/capture integration next.
