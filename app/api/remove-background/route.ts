import { NextRequest } from "next/server";
import { RemoveBgError, removeBackground } from "../../../lib/removeBg";

export const runtime = "edge";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const image = formData.get("image");

    if (!image || typeof image === "string") {
      return Response.json({ error: "Missing image file." }, { status: 400 });
    }

    const upload = image as File;
    const output = await removeBackground(upload, process.env.REMOVE_BG_API_KEY || "");
    const downloadName = upload.name?.replace(/\.[^.]+$/, "") || "image";

    return new Response(output, {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Content-Disposition": `attachment; filename="${downloadName}-removed-background.png"`,
        "Cache-Control": "no-store"
      }
    });
  } catch (error) {
    if (error instanceof RemoveBgError) {
      return Response.json({ error: error.message }, { status: error.status });
    }

    console.error("remove-background error", error);
    return Response.json({ error: "Processing failed. Please try again later." }, { status: 500 });
  }
}
