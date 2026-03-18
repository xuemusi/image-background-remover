const REMOVE_BG_API_URL = "https://api.remove.bg/v1.0/removebg";
const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const SESSION_COOKIE = "ibgr_session";
const OAUTH_STATE_COOKIE = "ibgr_oauth_state";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;
const OAUTH_STATE_TTL_SECONDS = 60 * 10;

const PLANS = {
  starter_10: { code: "starter_10", name: "Starter 10", amountCents: 499, currency: "USD", credits: 10 },
  pro_50: { code: "pro_50", name: "Pro 50", amountCents: 1299, currency: "USD", credits: 50 },
  business_200: { code: "business_200", name: "Business 200", amountCents: 2999, currency: "USD", credits: 200 },
};

const memoryUsersBySub = new Map();
const memoryCreditsByUserId = new Map();
const memoryOrdersByUserId = new Map();

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

function parseCookies(request) {
  const cookieHeader = request.headers.get("cookie") || "";
  const cookies = {};
  cookieHeader.split(";").forEach((part) => {
    const [name, ...rest] = part.trim().split("=");
    if (!name || rest.length === 0) return;
    cookies[name] = decodeURIComponent(rest.join("="));
  });
  return cookies;
}

function cookie(name, value, options = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`];
  if (options.maxAge !== undefined) parts.push(`Max-Age=${options.maxAge}`);
  if (options.httpOnly) parts.push("HttpOnly");
  if (options.secure) parts.push("Secure");
  if (options.sameSite) parts.push(`SameSite=${options.sameSite}`);
  parts.push(`Path=${options.path || "/"}`);
  return parts.join("; ");
}

function base64UrlEncode(bytes) {
  let binary = "";
  const array = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  for (let i = 0; i < array.byteLength; i++) binary += String.fromCharCode(array[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecode(base64Url) {
  const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((base64Url.length + 3) % 4);
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function importHmacKey(secret) {
  const encoded = new TextEncoder().encode(secret);
  return crypto.subtle.importKey("raw", encoded, { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

async function signJwt(payload, secret) {
  const header = { alg: "HS256", typ: "JWT" };
  const encodedHeader = base64UrlEncode(new TextEncoder().encode(JSON.stringify(header)));
  const encodedPayload = base64UrlEncode(new TextEncoder().encode(JSON.stringify(payload)));
  const unsignedToken = `${encodedHeader}.${encodedPayload}`;

  const key = await importHmacKey(secret);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(unsignedToken));
  return `${unsignedToken}.${base64UrlEncode(signature)}`;
}

async function verifyJwt(token, secret) {
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  const unsigned = `${encodedHeader}.${encodedPayload}`;

  const key = await importHmacKey(secret);
  const valid = await crypto.subtle.verify(
    "HMAC",
    key,
    base64UrlDecode(encodedSignature),
    new TextEncoder().encode(unsigned),
  );

  if (!valid) return null;

  const payloadBytes = base64UrlDecode(encodedPayload);
  const payload = JSON.parse(new TextDecoder().decode(payloadBytes));
  if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;

  return payload;
}

function randomState() {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return base64UrlEncode(bytes);
}

function randomId(prefix) {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return `${prefix}_${base64UrlEncode(bytes)}`;
}

function validateImage(file) {
  if (!file || typeof file === "string") {
    throw new Error("Missing image file.");
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    const err = new Error("Only JPG, PNG, and WebP images are supported.");
    err.status = 400;
    throw err;
  }
  if (file.size > MAX_FILE_SIZE) {
    const err = new Error("Image too large. Please upload a file up to 10MB.");
    err.status = 413;
    throw err;
  }
}

function getD1(env) {
  return env.DB || null;
}

function ensurePaypalConfig(env) {
  const missing = [];
  if (!env.PAYPAL_CLIENT_ID) missing.push("PAYPAL_CLIENT_ID");
  if (!env.PAYPAL_CLIENT_SECRET) missing.push("PAYPAL_CLIENT_SECRET");
  return missing;
}

function getPaypalBaseUrl(env) {
  return env.PAYPAL_ENV === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";
}

function formatAmount(cents) {
  return (cents / 100).toFixed(2);
}

async function getPaypalAccessToken(env) {
  const missing = ensurePaypalConfig(env);
  if (missing.length > 0) {
    return {
      error: `PayPal is not configured. Missing: ${missing.join(", ")}`,
      status: 500,
      code: "PAYPAL_NOT_CONFIGURED",
    };
  }

  const basic = btoa(`${env.PAYPAL_CLIENT_ID}:${env.PAYPAL_CLIENT_SECRET}`);
  const tokenRes = await fetch(`${getPaypalBaseUrl(env)}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      authorization: `Basic ${basic}`,
      "content-type": "application/x-www-form-urlencoded",
      accept: "application/json",
    },
    body: "grant_type=client_credentials",
  });

  const data = await tokenRes.json().catch(() => ({}));
  if (!tokenRes.ok || !data?.access_token) {
    return {
      error: data?.error_description || data?.error || "Failed to fetch PayPal access token",
      status: tokenRes.status || 502,
      code: "PAYPAL_ACCESS_TOKEN_FAILED",
    };
  }

  return { accessToken: data.access_token };
}

async function createPaypalOrderRemote(order, env, clientRequestId) {
  const token = await getPaypalAccessToken(env);
  if (token.error) return token;

  const body = {
    intent: "CAPTURE",
    purchase_units: [
      {
        reference_id: order.id,
        custom_id: order.id,
        description: `${order.planName} credits pack`,
        amount: {
          currency_code: order.currency,
          value: formatAmount(order.amountCents),
        },
      },
    ],
    application_context: {
      brand_name: env.NEXT_PUBLIC_APP_NAME || "Image Background Remover",
      user_action: "PAY_NOW",
      return_url: `${(env.APP_BASE_URL || "").replace(/\/$/, "") || "https://example.com"}/dashboard?paypal=return`,
      cancel_url: `${(env.APP_BASE_URL || "").replace(/\/$/, "") || "https://example.com"}/dashboard?paypal=cancel`,
    },
  };

  const paypalRes = await fetch(`${getPaypalBaseUrl(env)}/v2/checkout/orders`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token.accessToken}`,
      "content-type": "application/json",
      accept: "application/json",
      ...(clientRequestId ? { "PayPal-Request-Id": clientRequestId } : {}),
    },
    body: JSON.stringify(body),
  });

  const data = await paypalRes.json().catch(() => ({}));
  if (!paypalRes.ok || !data?.id) {
    return {
      error: data?.message || data?.name || "Failed to create PayPal order",
      status: paypalRes.status || 502,
      code: "PAYPAL_CREATE_ORDER_FAILED",
      details: data,
    };
  }

  const approveLink = (data.links || []).find((item) => item?.rel === "approve")?.href || null;
  return { providerOrderId: data.id, approveUrl: approveLink, raw: data };
}

async function capturePaypalOrderRemote(providerOrderId, env, requestId) {
  const token = await getPaypalAccessToken(env);
  if (token.error) return token;

  const paypalRes = await fetch(`${getPaypalBaseUrl(env)}/v2/checkout/orders/${providerOrderId}/capture`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token.accessToken}`,
      "content-type": "application/json",
      accept: "application/json",
      ...(requestId ? { "PayPal-Request-Id": requestId } : {}),
    },
    body: "{}",
  });

  const data = await paypalRes.json().catch(() => ({}));
  const status = data?.status;
  if (!paypalRes.ok || (status !== "COMPLETED" && status !== "APPROVED")) {
    return {
      error: data?.message || data?.name || "Failed to capture PayPal order",
      status: paypalRes.status || 502,
      code: "PAYPAL_CAPTURE_ORDER_FAILED",
      details: data,
    };
  }

  return { captured: data };
}

async function upsertUserFromGoogle(profile, env) {
  const db = getD1(env);
  const now = new Date().toISOString();

  if (!db) {
    const existing = memoryUsersBySub.get(profile.sub);
    const user = {
      id: existing?.id || randomId("usr"),
      sub: profile.sub,
      email: profile.email || "",
      name: profile.name || "Google User",
      picture: profile.picture || null,
      lastLoginAt: now,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };
    memoryUsersBySub.set(profile.sub, user);

    if (!memoryCreditsByUserId.has(user.id)) {
      memoryCreditsByUserId.set(user.id, {
        userId: user.id,
        balance: 0,
        lifetimeCredited: 0,
        lifetimeUsed: 0,
        updatedAt: now,
      });
    }

    return { user, credits: memoryCreditsByUserId.get(user.id) };
  }

  const userId = randomId("usr");
  await db
    .prepare(`
      INSERT INTO users (id, google_sub, email, name, avatar_url, created_at, updated_at, last_login_at)
      VALUES (?1, ?2, ?3, ?4, ?5, datetime('now'), datetime('now'), datetime('now'))
      ON CONFLICT(google_sub) DO UPDATE SET
        email = excluded.email,
        name = excluded.name,
        avatar_url = excluded.avatar_url,
        updated_at = datetime('now'),
        last_login_at = datetime('now')
    `)
    .bind(userId, profile.sub, profile.email || "", profile.name || "Google User", profile.picture || null)
    .run();

  const user = await db
    .prepare(`
      SELECT
        id,
        google_sub as sub,
        email,
        name,
        avatar_url as picture,
        created_at as createdAt,
        updated_at as updatedAt,
        last_login_at as lastLoginAt
      FROM users
      WHERE google_sub = ?1
    `)
    .bind(profile.sub)
    .first();

  await db
    .prepare(`
      INSERT INTO user_credits (user_id, balance, lifetime_credited, lifetime_used, updated_at)
      VALUES (?1, 0, 0, 0, datetime('now'))
      ON CONFLICT(user_id) DO NOTHING
    `)
    .bind(user.id)
    .run();

  const credits = await db
    .prepare(`
      SELECT
        user_id as userId,
        balance,
        lifetime_credited as lifetimeCredited,
        lifetime_used as lifetimeUsed,
        updated_at as updatedAt
      FROM user_credits
      WHERE user_id = ?1
    `)
    .bind(user.id)
    .first();

  return { user, credits };
}

async function getUserAndCreditsBySession(payload, env) {
  const db = getD1(env);

  if (!db) {
    const user = memoryUsersBySub.get(payload.sub);
    if (!user) {
      return {
        user: {
          id: payload.uid || null,
          sub: payload.sub,
          email: payload.email,
          name: payload.name,
          picture: payload.picture,
        },
        credits: {
          userId: payload.uid || null,
          balance: 0,
          lifetimeCredited: 0,
          lifetimeUsed: 0,
        },
      };
    }

    const credits = memoryCreditsByUserId.get(user.id) || {
      userId: user.id,
      balance: 0,
      lifetimeCredited: 0,
      lifetimeUsed: 0,
    };

    return { user, credits };
  }

  const user = await db
    .prepare(`
      SELECT
        id,
        google_sub as sub,
        email,
        name,
        avatar_url as picture,
        created_at as createdAt,
        updated_at as updatedAt,
        last_login_at as lastLoginAt
      FROM users
      WHERE google_sub = ?1
    `)
    .bind(payload.sub)
    .first();

  if (!user) {
    return {
      user: {
        id: payload.uid || null,
        sub: payload.sub,
        email: payload.email,
        name: payload.name,
        picture: payload.picture,
      },
      credits: {
        userId: payload.uid || null,
        balance: 0,
        lifetimeCredited: 0,
        lifetimeUsed: 0,
      },
    };
  }

  const credits = await db
    .prepare(`
      SELECT
        user_id as userId,
        balance,
        lifetime_credited as lifetimeCredited,
        lifetime_used as lifetimeUsed,
        updated_at as updatedAt
      FROM user_credits
      WHERE user_id = ?1
    `)
    .bind(user.id)
    .first();

  return {
    user,
    credits: credits || {
      userId: user.id,
      balance: 0,
      lifetimeCredited: 0,
      lifetimeUsed: 0,
    },
  };
}

async function listOrdersByUserId(userId, env) {
  const db = getD1(env);

  if (!db) {
    const orders = memoryOrdersByUserId.get(userId) || [];
    return orders.slice(0, 20);
  }

  const result = await db
    .prepare(`
      SELECT
        id,
        provider_order_id as providerOrderId,
        plan_code as planCode,
        plan_name as planName,
        amount_cents as amountCents,
        currency,
        status,
        credits_granted as creditsGranted,
        credit_granted_at as creditGrantedAt,
        created_at as createdAt,
        updated_at as updatedAt
      FROM orders
      WHERE user_id = ?1
      ORDER BY created_at DESC
      LIMIT 20
    `)
    .bind(userId)
    .all();

  return result?.results || [];
}

async function createDraftOrderForUser(userId, input, env) {
  const db = getD1(env);
  const now = new Date().toISOString();
  const selected = PLANS[input.planCode];

  if (!selected) {
    return { error: "Invalid plan code", status: 400 };
  }

  const order = {
    id: randomId("ord"),
    userId,
    provider: "paypal",
    providerOrderId: null,
    planCode: selected.code,
    planName: selected.name,
    amountCents: selected.amountCents,
    currency: selected.currency,
    status: "created",
    creditsGranted: 0,
    creditGrantedAt: null,
    createdAt: now,
    updatedAt: now,
  };

  if (!db) {
    const list = memoryOrdersByUserId.get(userId) || [];
    list.unshift(order);
    memoryOrdersByUserId.set(userId, list);
    return { order };
  }

  await db
    .prepare(`
      INSERT INTO orders (
        id, user_id, provider, provider_order_id, plan_code, plan_name,
        amount_cents, currency, status, credits_granted, credit_granted_at,
        created_at, updated_at
      ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, datetime('now'), datetime('now'))
    `)
    .bind(
      order.id,
      order.userId,
      order.provider,
      order.providerOrderId,
      order.planCode,
      order.planName,
      order.amountCents,
      order.currency,
      order.status,
      order.creditsGranted,
      order.creditGrantedAt,
    )
    .run();

  return { order };
}

async function updateOrderProvider(orderId, providerOrderId, status, env) {
  const db = getD1(env);
  if (!db) return;

  await db
    .prepare(`
      UPDATE orders
      SET provider_order_id = ?2, status = ?3, updated_at = datetime('now')
      WHERE id = ?1
    `)
    .bind(orderId, providerOrderId, status)
    .run();
}

async function findOrderForUser({ userId, localOrderId, providerOrderId }, env) {
  const db = getD1(env);

  if (!db) {
    const list = memoryOrdersByUserId.get(userId) || [];
    return list.find((item) => (localOrderId ? item.id === localOrderId : item.providerOrderId === providerOrderId)) || null;
  }

  if (localOrderId) {
    return db
      .prepare(`
        SELECT
          id,
          user_id as userId,
          provider,
          provider_order_id as providerOrderId,
          plan_code as planCode,
          plan_name as planName,
          amount_cents as amountCents,
          currency,
          status,
          credits_granted as creditsGranted,
          credit_granted_at as creditGrantedAt,
          created_at as createdAt,
          updated_at as updatedAt
        FROM orders
        WHERE id = ?1 AND user_id = ?2
      `)
      .bind(localOrderId, userId)
      .first();
  }

  return db
    .prepare(`
      SELECT
        id,
        user_id as userId,
        provider,
        provider_order_id as providerOrderId,
        plan_code as planCode,
        plan_name as planName,
        amount_cents as amountCents,
        currency,
        status,
        credits_granted as creditsGranted,
        credit_granted_at as creditGrantedAt,
        created_at as createdAt,
        updated_at as updatedAt
      FROM orders
      WHERE provider_order_id = ?1 AND user_id = ?2
    `)
    .bind(providerOrderId, userId)
    .first();
}

async function grantCreditsIdempotent(order, env) {
  const db = getD1(env);

  if (!db) {
    const list = memoryOrdersByUserId.get(order.userId) || [];
    const target = list.find((item) => item.id === order.id);

    if (!target) return { error: "Order not found", status: 404 };
    if (target.creditGrantedAt) {
      return { granted: false, credits: memoryCreditsByUserId.get(order.userId) };
    }

    const plan = PLANS[target.planCode];
    const now = new Date().toISOString();
    const credits = memoryCreditsByUserId.get(order.userId) || {
      userId: order.userId,
      balance: 0,
      lifetimeCredited: 0,
      lifetimeUsed: 0,
    };

    target.status = "credit_granted";
    target.creditsGranted = plan?.credits || 0;
    target.creditGrantedAt = now;
    target.updatedAt = now;

    credits.balance += target.creditsGranted;
    credits.lifetimeCredited += target.creditsGranted;
    credits.updatedAt = now;
    memoryCreditsByUserId.set(order.userId, credits);

    return { granted: true, credits };
  }

  const plan = PLANS[order.planCode];
  const creditsToGrant = plan?.credits || 0;

  await db
    .prepare(`
      INSERT INTO user_credits (user_id, balance, lifetime_credited, lifetime_used, updated_at)
      VALUES (?1, 0, 0, 0, datetime('now'))
      ON CONFLICT(user_id) DO NOTHING
    `)
    .bind(order.userId)
    .run();

  const mark = await db
    .prepare(`
      UPDATE orders
      SET
        status = 'credit_granted',
        credits_granted = ?2,
        credit_granted_at = datetime('now'),
        updated_at = datetime('now')
      WHERE id = ?1 AND credit_granted_at IS NULL
    `)
    .bind(order.id, creditsToGrant)
    .run();

  const changes = Number(mark?.meta?.changes || 0);
  if (changes > 0) {
    await db
      .prepare(`
        UPDATE user_credits
        SET
          balance = balance + ?2,
          lifetime_credited = lifetime_credited + ?2,
          updated_at = datetime('now')
        WHERE user_id = ?1
      `)
      .bind(order.userId, creditsToGrant)
      .run();

    const credits = await db
      .prepare(`
        SELECT
          user_id as userId,
          balance,
          lifetime_credited as lifetimeCredited,
          lifetime_used as lifetimeUsed,
          updated_at as updatedAt
        FROM user_credits
        WHERE user_id = ?1
      `)
      .bind(order.userId)
      .first();

    return { granted: true, credits };
  }

  const credits = await db
    .prepare(`
      SELECT
        user_id as userId,
        balance,
        lifetime_credited as lifetimeCredited,
        lifetime_used as lifetimeUsed,
        updated_at as updatedAt
      FROM user_credits
      WHERE user_id = ?1
    `)
    .bind(order.userId)
    .first();

  return { granted: false, credits };
}

async function getSessionPayload(request, env) {
  if (!env.AUTH_SESSION_SECRET) return null;
  const cookies = parseCookies(request);
  const token = cookies[SESSION_COOKIE];
  if (!token) return null;
  return verifyJwt(token, env.AUTH_SESSION_SECRET);
}

async function handleRemoveBackground(request, env) {
  try {
    const incoming = await request.formData();
    const image = incoming.get("image");
    validateImage(image);

    if (!env.REMOVE_BG_API_KEY) {
      return json({ error: "REMOVE_BG_API_KEY is not configured on the server." }, 500);
    }

    const body = new FormData();
    body.append("image_file", image, image.name || "upload-image");
    body.append("size", "auto");
    body.append("format", "png");

    const response = await fetch(REMOVE_BG_API_URL, {
      method: "POST",
      headers: {
        "X-Api-Key": env.REMOVE_BG_API_KEY,
      },
      body,
    });

    if (!response.ok) {
      const contentType = response.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        const data = await response.json();
        return json({ error: data?.errors?.[0]?.title || "remove.bg request failed." }, response.status);
      }
      return json({ error: (await response.text()) || "remove.bg request failed." }, response.status);
    }

    const filename = (image.name || "image").replace(/\.[^.]+$/, "") + "-removed-background.png";
    return new Response(response.body, {
      status: 200,
      headers: {
        "content-type": "image/png",
        "content-disposition": `attachment; filename=\"${filename}\"`,
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    return json({ error: error?.message || "Processing failed. Please try again later." }, error?.status || 500);
  }
}

function ensureAuthConfig(env) {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET || !env.AUTH_SESSION_SECRET) {
    return "Google OAuth is not configured. Missing GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / AUTH_SESSION_SECRET.";
  }
  return null;
}

function getBaseUrl(request, env) {
  return env.APP_BASE_URL || new URL(request.url).origin;
}

async function handleGoogleStart(request, env) {
  const missing = ensureAuthConfig(env);
  if (missing) return json({ error: missing }, 500);

  const url = new URL(request.url);
  const locale = url.searchParams.get("locale") === "zh" ? "zh" : "en";
  const state = randomState();

  const redirectUri = `${getBaseUrl(request, env)}/api/auth/google/callback`;
  const authUrl = new URL(GOOGLE_AUTH_URL);
  authUrl.searchParams.set("client_id", env.GOOGLE_CLIENT_ID);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", "openid email profile");
  authUrl.searchParams.set("state", `${state}:${locale}`);
  authUrl.searchParams.set("prompt", "select_account");

  return new Response(null, {
    status: 302,
    headers: {
      location: authUrl.toString(),
      "set-cookie": cookie(OAUTH_STATE_COOKIE, state, {
        path: "/",
        httpOnly: true,
        secure: true,
        sameSite: "Lax",
        maxAge: OAUTH_STATE_TTL_SECONDS,
      }),
    },
  });
}

async function handleGoogleCallback(request, env) {
  const missing = ensureAuthConfig(env);
  if (missing) return json({ error: missing }, 500);

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const stateRaw = url.searchParams.get("state") || "";
  const [state, locale] = stateRaw.split(":");
  const safeLocale = locale === "zh" ? "zh" : "en";

  if (!code || !state) {
    return new Response(null, { status: 302, headers: { location: `/?auth=error&locale=${safeLocale}` } });
  }

  const cookies = parseCookies(request);
  if (!cookies[OAUTH_STATE_COOKIE] || cookies[OAUTH_STATE_COOKIE] !== state) {
    return new Response(null, { status: 302, headers: { location: `/?auth=error&locale=${safeLocale}` } });
  }

  const redirectUri = `${getBaseUrl(request, env)}/api/auth/google/callback`;
  const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!tokenResponse.ok) {
    return new Response(null, { status: 302, headers: { location: `/?auth=error&locale=${safeLocale}` } });
  }

  const tokenData = await tokenResponse.json();
  const accessToken = tokenData?.access_token;
  if (!accessToken) {
    return new Response(null, { status: 302, headers: { location: `/?auth=error&locale=${safeLocale}` } });
  }

  const userInfoResponse = await fetch(GOOGLE_USERINFO_URL, {
    headers: { authorization: `Bearer ${accessToken}` },
  });

  if (!userInfoResponse.ok) {
    return new Response(null, { status: 302, headers: { location: `/?auth=error&locale=${safeLocale}` } });
  }

  const profile = await userInfoResponse.json();
  const upserted = await upsertUserFromGoogle(profile, env);

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    uid: upserted.user?.id || null,
    sub: profile.sub,
    name: profile.name,
    email: profile.email,
    picture: profile.picture,
    iat: now,
    exp: now + SESSION_TTL_SECONDS,
  };

  const jwt = await signJwt(payload, env.AUTH_SESSION_SECRET);

  const headers = new Headers({
    location: `/dashboard?auth=success&locale=${safeLocale}`,
  });
  headers.append(
    "set-cookie",
    cookie(SESSION_COOKIE, jwt, {
      path: "/",
      httpOnly: true,
      secure: true,
      sameSite: "Lax",
      maxAge: SESSION_TTL_SECONDS,
    }),
  );
  headers.append(
    "set-cookie",
    cookie(OAUTH_STATE_COOKIE, "", {
      path: "/",
      httpOnly: true,
      secure: true,
      sameSite: "Lax",
      maxAge: 0,
    }),
  );

  return new Response(null, {
    status: 302,
    headers,
  });
}

async function handleSession(request, env) {
  if (!env.AUTH_SESSION_SECRET) {
    return json({ authenticated: false, error: "AUTH_SESSION_SECRET is not configured." }, 200);
  }

  const payload = await getSessionPayload(request, env);
  if (!payload) return json({ authenticated: false }, 200);

  return json({
    authenticated: true,
    user: {
      uid: payload.uid || null,
      sub: payload.sub,
      name: payload.name,
      email: payload.email,
      picture: payload.picture,
    },
  });
}

async function handleMe(request, env) {
  const payload = await getSessionPayload(request, env);
  if (!payload) return json({ authenticated: false }, 401);

  const data = await getUserAndCreditsBySession(payload, env);

  return json({
    authenticated: true,
    user: data.user,
    credits: data.credits,
    storage: getD1(env) ? "d1" : "memory",
  });
}

async function handleOrdersList(request, env) {
  const payload = await getSessionPayload(request, env);
  if (!payload) return json({ authenticated: false }, 401);

  const data = await getUserAndCreditsBySession(payload, env);
  const userId = data.user?.id || payload.uid;
  if (!userId) return json({ authenticated: false }, 401);

  const orders = await listOrdersByUserId(userId, env);
  return json({ authenticated: true, orders });
}

async function handleCreateOrder(request, env) {
  const payload = await getSessionPayload(request, env);
  if (!payload) return json({ authenticated: false }, 401);

  const data = await getUserAndCreditsBySession(payload, env);
  const userId = data.user?.id || payload.uid;
  if (!userId) return json({ authenticated: false }, 401);

  let body = {};
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "Invalid JSON body" }, 400);
  }

  const created = await createDraftOrderForUser(userId, body, env);
  if (created.error) {
    return json({ ok: false, error: created.error }, created.status || 400);
  }

  return json({
    ok: true,
    order: created.order,
    message: "Draft order created. PayPal capture not integrated yet.",
  });
}

async function handlePaypalCreateOrder(request, env) {
  const payload = await getSessionPayload(request, env);
  if (!payload) return json({ authenticated: false }, 401);

  const data = await getUserAndCreditsBySession(payload, env);
  const userId = data.user?.id || payload.uid;
  if (!userId) return json({ authenticated: false }, 401);

  let body = {};
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "Invalid JSON body" }, 400);
  }

  const plan = PLANS[body.planCode];
  if (!plan) {
    return json({ ok: false, error: "Invalid plan code" }, 400);
  }

  const created = await createDraftOrderForUser(userId, { planCode: body.planCode }, env);
  if (created.error) {
    return json({ ok: false, error: created.error }, created.status || 400);
  }

  // Idempotency placeholder: forward client key to PayPal request-id.
  // In phase-2 we can persist it in DB for stronger dedupe across retries.
  const clientRequestId = body.idempotencyKey || request.headers.get("x-idempotency-key") || randomId("ppreq");
  const remote = await createPaypalOrderRemote(created.order, env, clientRequestId);
  if (remote.error) {
    return json(
      {
        ok: false,
        code: remote.code,
        error: remote.error,
        order: created.order,
      },
      remote.status || 502,
    );
  }

  if (getD1(env)) {
    await updateOrderProvider(created.order.id, remote.providerOrderId, "approval_pending", env);
  } else {
    const list = memoryOrdersByUserId.get(userId) || [];
    const target = list.find((item) => item.id === created.order.id);
    if (target) {
      target.providerOrderId = remote.providerOrderId;
      target.status = "approval_pending";
      target.updatedAt = new Date().toISOString();
    }
  }

  return json({
    ok: true,
    order: {
      localOrderId: created.order.id,
      providerOrderId: remote.providerOrderId,
      planCode: plan.code,
      amount: formatAmount(plan.amountCents),
      currency: plan.currency,
      approveUrl: remote.approveUrl,
    },
  });
}

async function handlePaypalCaptureOrder(request, env) {
  const payload = await getSessionPayload(request, env);
  if (!payload) return json({ authenticated: false }, 401);

  const sessionData = await getUserAndCreditsBySession(payload, env);
  const userId = sessionData.user?.id || payload.uid;
  if (!userId) return json({ authenticated: false }, 401);

  let body = {};
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "Invalid JSON body" }, 400);
  }

  const localOrderId = typeof body.localOrderId === "string" ? body.localOrderId : null;
  const providerOrderId = typeof body.providerOrderId === "string" ? body.providerOrderId : null;
  if (!localOrderId && !providerOrderId) {
    return json({ ok: false, error: "localOrderId or providerOrderId is required" }, 400);
  }

  const order = await findOrderForUser({ userId, localOrderId, providerOrderId }, env);
  if (!order) {
    return json({ ok: false, error: "Order not found" }, 404);
  }

  if (!order.providerOrderId && providerOrderId && localOrderId) {
    await updateOrderProvider(localOrderId, providerOrderId, "approval_pending", env);
    order.providerOrderId = providerOrderId;
  }

  if (!order.providerOrderId) {
    return json({ ok: false, error: "Order has no PayPal provider order id yet" }, 409);
  }

  if (order.creditGrantedAt) {
    const latest = await getUserAndCreditsBySession(payload, env);
    return json({
      ok: true,
      idempotent: true,
      order: {
        id: order.id,
        status: "credit_granted",
        creditsGranted: order.creditsGranted,
      },
      credits: latest.credits,
    });
  }

  const capture = await capturePaypalOrderRemote(order.providerOrderId, env, body.idempotencyKey || randomId("ppcap"));
  if (capture.error) {
    return json({ ok: false, code: capture.code, error: capture.error }, capture.status || 502);
  }

  if (getD1(env)) {
    await updateOrderProvider(order.id, order.providerOrderId, "captured", env);
  } else {
    const list = memoryOrdersByUserId.get(userId) || [];
    const target = list.find((item) => item.id === order.id);
    if (target) {
      target.status = "captured";
      target.updatedAt = new Date().toISOString();
    }
  }

  const grant = await grantCreditsIdempotent(order, env);
  if (grant.error) {
    return json({ ok: false, error: grant.error }, grant.status || 500);
  }

  return json({
    ok: true,
    order: {
      id: order.id,
      providerOrderId: order.providerOrderId,
      status: "credit_granted",
      creditsGranted: PLANS[order.planCode]?.credits || order.creditsGranted || 0,
    },
    credits: grant.credits,
  });
}

async function handlePlans() {
  return json({
    plans: Object.values(PLANS).map((item) => ({
      code: item.code,
      name: item.name,
      price: Number(formatAmount(item.amountCents)),
      currency: item.currency,
      credits: item.credits,
    })),
  });
}

async function handleLogout() {
  return new Response(null, {
    status: 204,
    headers: {
      "set-cookie": cookie(SESSION_COOKIE, "", {
        path: "/",
        httpOnly: true,
        secure: true,
        sameSite: "Lax",
        maxAge: 0,
      }),
      "cache-control": "no-store",
    },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/remove-background" && request.method === "POST") {
      return handleRemoveBackground(request, env);
    }

    if (url.pathname === "/api/auth/google/start" && request.method === "GET") {
      return handleGoogleStart(request, env);
    }

    if (url.pathname === "/api/auth/google/callback" && request.method === "GET") {
      return handleGoogleCallback(request, env);
    }

    if (url.pathname === "/api/auth/session" && request.method === "GET") {
      return handleSession(request, env);
    }

    if (url.pathname === "/api/auth/logout" && request.method === "POST") {
      return handleLogout();
    }

    if (url.pathname === "/api/me" && request.method === "GET") {
      return handleMe(request, env);
    }

    if (url.pathname === "/api/me/orders" && request.method === "GET") {
      return handleOrdersList(request, env);
    }

    if (url.pathname === "/api/orders" && request.method === "POST") {
      return handleCreateOrder(request, env);
    }

    if (url.pathname === "/api/plans" && request.method === "GET") {
      return handlePlans();
    }

    if (url.pathname === "/api/paypal/create-order" && request.method === "POST") {
      return handlePaypalCreateOrder(request, env);
    }

    if (url.pathname === "/api/paypal/capture-order" && request.method === "POST") {
      return handlePaypalCaptureOrder(request, env);
    }

    return env.ASSETS.fetch(request);
  },
};
