"use client";

import { ChangeEvent, DragEvent, useMemo, useRef, useState } from "react";

const ACCEPT = ".jpg,.jpeg,.png,.webp";
const MAX_SIZE_MB = 10;

type Status = "idle" | "uploading" | "success" | "error";

function formatFileSize(bytes: number) {
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

export function Uploader() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string>("");
  const [originalName, setOriginalName] = useState<string>("");
  const [originalUrl, setOriginalUrl] = useState<string>("");
  const [resultUrl, setResultUrl] = useState<string>("");

  const hasResult = useMemo(() => Boolean(originalUrl && resultUrl), [originalUrl, resultUrl]);

  const resetResult = () => {
    setResultUrl("");
    setError("");
    setStatus("idle");
  };

  const validateClientSide = (file: File) => {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      throw new Error("Only JPG, PNG, and WebP files are supported.");
    }

    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      throw new Error(`Image too large (${formatFileSize(file.size)}). Please upload up to ${MAX_SIZE_MB}MB.`);
    }
  };

  const handleFile = async (file: File) => {
    try {
      validateClientSide(file);
      resetResult();
      setOriginalName(file.name);
      setOriginalUrl(URL.createObjectURL(file));
      setStatus("uploading");

      const body = new FormData();
      body.append("image", file);

      const response = await fetch("/api/remove-background", {
        method: "POST",
        body
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error || "Processing failed. Please try again.");
      }

      const blob = await response.blob();
      setResultUrl(URL.createObjectURL(blob));
      setStatus("success");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Unexpected error.");
    }
  };

  const onInputChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      await handleFile(file);
    }
  };

  const onDrop = async (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file) {
      await handleFile(file);
    }
  };

  return (
    <section className="space-y-8">
      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`rounded-3xl border border-dashed p-8 transition ${
          dragging ? "border-brand-400 bg-brand-500/10" : "border-slate-700 bg-slate-900/70"
        }`}
      >
        <input ref={inputRef} type="file" accept={ACCEPT} onChange={onInputChange} className="hidden" />
        <div className="mx-auto flex max-w-2xl flex-col items-center gap-4 text-center">
          <div className="rounded-full border border-brand-400/40 bg-brand-500/10 px-4 py-1 text-sm text-brand-100">
            JPG / PNG / WebP · up to 10MB
          </div>
          <h2 className="text-2xl font-semibold text-white sm:text-3xl">Upload an image and remove the background in one step</h2>
          <p className="max-w-xl text-sm text-slate-300 sm:text-base">
            Your image is processed in-memory during the request only. No account, no storage, no history.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="rounded-full bg-brand-500 px-6 py-3 font-medium text-white transition hover:bg-brand-600"
            >
              Choose image
            </button>
            <a href="#faq" className="rounded-full border border-slate-600 px-6 py-3 font-medium text-slate-200 no-underline transition hover:border-slate-400">
              Read FAQ
            </a>
          </div>
          {status === "uploading" ? <p className="text-sm text-brand-100">Processing with remove.bg…</p> : null}
          {error ? <p className="text-sm text-rose-300">{error}</p> : null}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-5 shadow-soft">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white">Original</h3>
            {originalName ? <span className="text-xs text-slate-400">{originalName}</span> : null}
          </div>
          <div className="flex aspect-square items-center justify-center overflow-hidden rounded-2xl border border-slate-800 bg-slate-950">
            {originalUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={originalUrl} alt="Original preview" className="h-full w-full object-contain" />
            ) : (
              <p className="px-6 text-center text-sm text-slate-500">Upload an image to preview the original.</p>
            )}
          </div>
        </div>

        <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-5 shadow-soft">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white">Background removed</h3>
            {hasResult ? (
              <a
                href={resultUrl}
                download="removed-background.png"
                className="rounded-full bg-white px-4 py-2 text-sm font-medium text-slate-950 no-underline transition hover:bg-slate-200"
              >
                Download PNG
              </a>
            ) : null}
          </div>
          <div
            className="aspect-square overflow-hidden rounded-2xl border border-slate-800 bg-slate-100"
            style={{
              backgroundImage:
                "linear-gradient(45deg, #e5e7eb 25%, transparent 25%), linear-gradient(-45deg, #e5e7eb 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e5e7eb 75%), linear-gradient(-45deg, transparent 75%, #e5e7eb 75%)",
              backgroundSize: "20px 20px",
              backgroundPosition: "0 0, 0 10px, 10px -10px, -10px 0px"
            }}
          >
            <div className="flex h-full items-center justify-center">
              {resultUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={resultUrl} alt="Processed preview" className="h-full w-full object-contain" />
              ) : (
                <p className="px-6 text-center text-sm text-slate-500">
                  The transparent PNG result will show here after processing.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
