const REMOVE_BG_API_URL = "https://api.remove.bg/v1.0/removebg";
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_FILE_SIZE = 10 * 1024 * 1024;

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
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

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/remove-background" && request.method === "POST") {
      return handleRemoveBackground(request, env);
    }
    return env.ASSETS.fetch(request);
  },
};
