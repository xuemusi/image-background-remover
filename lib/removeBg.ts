const REMOVE_BG_API_URL = "https://api.remove.bg/v1.0/removebg";

export const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
export const MAX_FILE_SIZE = 10 * 1024 * 1024;

export class RemoveBgError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "RemoveBgError";
    this.status = status;
  }
}

export function validateImage(file: File) {
  if (!ALLOWED_TYPES.has(file.type)) {
    throw new RemoveBgError("Only JPG, PNG, and WebP images are supported.", 400);
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new RemoveBgError("Image too large. Please upload a file up to 10MB.", 413);
  }
}

export async function removeBackground(file: File, apiKey: string) {
  validateImage(file);

  if (!apiKey) {
    throw new RemoveBgError("REMOVE_BG_API_KEY is not configured on the server.", 500);
  }

  const formData = new FormData();
  formData.append("image_file", file, file.name || "upload-image");
  formData.append("size", "auto");
  formData.append("format", "png");

  const response = await fetch(REMOVE_BG_API_URL, {
    method: "POST",
    headers: {
      "X-Api-Key": apiKey
    },
    body: formData
  });

  if (!response.ok) {
    const contentType = response.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      const data = (await response.json()) as { errors?: Array<{ title?: string }> };
      const message = data.errors?.[0]?.title || "remove.bg request failed.";
      throw new RemoveBgError(message, response.status);
    }

    const fallback = await response.text();
    throw new RemoveBgError(fallback || "remove.bg request failed.", response.status);
  }

  const arrayBuffer = await response.arrayBuffer();
  return new Uint8Array(arrayBuffer);
}
