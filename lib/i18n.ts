export type Locale = "en" | "zh";

export type UploaderCopy = {
  fileBadge: string;
  title: string;
  description: string;
  chooseImage: string;
  readFaq: string;
  processing: string;
  original: string;
  originalAlt: string;
  originalPlaceholder: string;
  removed: string;
  downloadPng: string;
  processedAlt: string;
  resultPlaceholder: string;
  onlyFormatsError: string;
  imageTooLargeError: (size: string, maxMb: number) => string;
  processingFailedError: string;
  unexpectedError: string;
};

export type HomeCopy = {
  localeLabel: string;
  switchTo: string;
  signInWithGoogle: string;
  signingIn: string;
  signOut: string;
  dashboard: string;
  buyCredits: string;
  signedInAs: string;
  notSignedIn: string;
  heroBadge: string;
  heroTitle: string;
  heroDescription: string;
  howItWorks: string;
  steps: string[];
  features: Array<{ title: string; text: string }>;
  faqTitle: string;
  faqIntro: string;
  faqs: Array<{ question: string; answer: string }>;
  footer: string;
  uploader: UploaderCopy;
};

export const copy: Record<Locale, HomeCopy> = {
  en: {
    localeLabel: "EN",
    switchTo: "中文",
    signInWithGoogle: "Sign in with Google",
    signingIn: "Redirecting to Google…",
    signOut: "Sign out",
    dashboard: "Dashboard",
    buyCredits: "Buy Credits",
    signedInAs: "Signed in as",
    notSignedIn: "Not signed in",
    heroBadge: "Cloudflare-ready MVP · Next.js + Tailwind CSS",
    heroTitle: "Image Background Remover",
    heroDescription:
      "Remove background from images instantly. This MVP focuses on the fastest possible flow: upload, process, preview, and download a transparent PNG.",
    howItWorks: "How it works",
    steps: [
      "Upload a product shot, portrait, or avatar.",
      "The server forwards it to remove.bg securely using a server-side API key.",
      "Preview the transparent PNG and download it instantly."
    ],
    features: [
      {
        title: "Fast MVP",
        text: "Designed for Cloudflare deployment with a minimal moving-parts stack."
      },
      {
        title: "No persistent storage",
        text: "Images stay in request memory only. No history, no user accounts, no database."
      },
      {
        title: "SEO-ready homepage",
        text: "Static marketing copy, FAQ, metadata, and room for future landing pages."
      }
    ],
    faqTitle: "FAQ",
    faqIntro: "Short answers for the first release. Expand this into a richer SEO section later.",
    faqs: [
      {
        question: "What image formats are supported?",
        answer: "JPG, PNG, and WebP are supported in this MVP. Keep files within 10MB."
      },
      {
        question: "Do you store my images?",
        answer:
          "No. Images are only forwarded in-memory during the request lifecycle and are not persisted by this app."
      },
      {
        question: "Is this free?",
        answer:
          "This MVP is built for validation. Usage cost depends on remove.bg API pricing, so limits may be added later."
      }
    ],
    footer:
      "Built for MVP validation. Privacy-first by design: no account, no storage, server-side API key only.",
    uploader: {
      fileBadge: "JPG / PNG / WebP · up to 10MB",
      title: "Upload an image and remove the background in one step",
      description: "Your image is processed in-memory during the request only. No account, no storage, no history.",
      chooseImage: "Choose image",
      readFaq: "Read FAQ",
      processing: "Processing with remove.bg…",
      original: "Original",
      originalAlt: "Original preview",
      originalPlaceholder: "Upload an image to preview the original.",
      removed: "Background removed",
      downloadPng: "Download PNG",
      processedAlt: "Processed preview",
      resultPlaceholder: "The transparent PNG result will show here after processing.",
      onlyFormatsError: "Only JPG, PNG, and WebP files are supported.",
      imageTooLargeError: (size, maxMb) => `Image too large (${size}). Please upload up to ${maxMb}MB.`,
      processingFailedError: "Processing failed. Please try again.",
      unexpectedError: "Unexpected error."
    }
  },
  zh: {
    localeLabel: "中文",
    switchTo: "EN",
    signInWithGoogle: "使用 Google 登录",
    signingIn: "正在跳转到 Google…",
    signOut: "退出登录",
    dashboard: "个人中心",
    buyCredits: "购买额度",
    signedInAs: "当前登录",
    notSignedIn: "未登录",
    heroBadge: "Cloudflare 可部署 MVP · Next.js + Tailwind CSS",
    heroTitle: "图片背景移除",
    heroDescription: "一键移除图片背景。这个 MVP 聚焦最快流程：上传、处理、预览并下载透明 PNG。",
    howItWorks: "工作流程",
    steps: [
      "上传商品图、人像或头像。",
      "服务端通过安全的 API Key 将图片转发到 remove.bg 处理。",
      "立即预览透明 PNG 并下载。"
    ],
    features: [
      {
        title: "快速 MVP",
        text: "面向 Cloudflare 部署设计，技术栈精简，便于快速上线验证。"
      },
      {
        title: "无持久化存储",
        text: "图片仅在请求内存中处理，不保留历史、无需账号、无需数据库。"
      },
      {
        title: "SEO 友好首页",
        text: "已包含静态营销文案、FAQ、元信息，并预留后续落地页扩展空间。"
      }
    ],
    faqTitle: "常见问题",
    faqIntro: "首版的简短回答，后续可以扩展为更完整的 SEO 内容模块。",
    faqs: [
      {
        question: "支持哪些图片格式？",
        answer: "当前 MVP 支持 JPG、PNG、WebP，文件大小建议不超过 10MB。"
      },
      {
        question: "会保存我的图片吗？",
        answer: "不会。图片仅在请求生命周期内以内存方式转发处理，应用本身不做持久化存储。"
      },
      {
        question: "这个服务免费吗？",
        answer: "当前 MVP 用于验证，实际成本取决于 remove.bg 的 API 计费，后续可能增加使用限制。"
      }
    ],
    footer: "本项目用于 MVP 验证。默认隐私优先：无需账号、无存储、仅服务端使用 API Key。",
    uploader: {
      fileBadge: "JPG / PNG / WebP · 最大 10MB",
      title: "上传图片，一步移除背景",
      description: "图片仅在请求期间以内存方式处理。无需账号、无存储、无历史记录。",
      chooseImage: "选择图片",
      readFaq: "查看 FAQ",
      processing: "正在通过 remove.bg 处理…",
      original: "原图",
      originalAlt: "原图预览",
      originalPlaceholder: "上传图片后可在这里预览原图。",
      removed: "去背结果",
      downloadPng: "下载 PNG",
      processedAlt: "处理结果预览",
      resultPlaceholder: "处理完成后，透明 PNG 结果会显示在这里。",
      onlyFormatsError: "仅支持 JPG、PNG、WebP 文件。",
      imageTooLargeError: (size, maxMb) => `图片过大（${size}），请上传不超过 ${maxMb}MB 的图片。`,
      processingFailedError: "处理失败，请重试。",
      unexpectedError: "发生异常错误。"
    }
  }
};
