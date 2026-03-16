import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Image Background Remover | Remove backgrounds instantly",
  description:
    "Upload a JPG, PNG, or WebP image and remove the background instantly. Built for fast MVP deployment on Cloudflare with remove.bg.",
  keywords: [
    "image background remover",
    "remove background",
    "transparent background",
    "remove.bg api"
  ]
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
