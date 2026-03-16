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
        "content-disposition": `attachment; filename="${filename}"`,
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
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    sub: profile.sub,
    name: profile.name,
    email: profile.email,
    picture: profile.picture,
    iat: now,
    exp: now + SESSION_TTL_SECONDS,
  };

  const jwt = await signJwt(payload, env.AUTH_SESSION_SECRET);

  const headers = new Headers({
    location: `/?auth=success&locale=${safeLocale}`,
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

  const cookies = parseCookies(request);
  const token = cookies[SESSION_COOKIE];
  if (!token) return json({ authenticated: false }, 200);

  const payload = await verifyJwt(token, env.AUTH_SESSION_SECRET);
  if (!payload) return json({ authenticated: false }, 200);

  return json({
    authenticated: true,
    user: {
      sub: payload.sub,
      name: payload.name,
      email: payload.email,
      picture: payload.picture,
    },
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

    return env.ASSETS.fetch(request);
  },
};
