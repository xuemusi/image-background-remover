"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { copy, type Locale } from "../lib/i18n";

type MeResponse = {
  authenticated: boolean;
  user?: {
    id?: string;
    name?: string;
    email?: string;
    picture?: string;
    createdAt?: string;
    lastLoginAt?: string;
  };
  credits?: {
    balance: number;
    lifetimeCredited: number;
    lifetimeUsed: number;
  };
  storage?: "d1" | "memory";
};

type Order = {
  id: string;
  providerOrderId?: string | null;
  planCode: string;
  planName: string;
  amountCents: number;
  currency: string;
  status: string;
  creditsGranted?: number;
  createdAt: string;
};

type Plan = {
  code: string;
  name: string;
  price: number;
  currency: string;
  credits: number;
};

const STORAGE_KEY = "image-bg-remover-locale";

const FALLBACK_PLANS: Plan[] = [
  { code: "starter_10", name: "Starter 10", price: 4.99, currency: "USD", credits: 10 },
  { code: "pro_50", name: "Pro 50", price: 12.99, currency: "USD", credits: 50 },
  { code: "business_200", name: "Business 200", price: 29.99, currency: "USD", credits: 200 },
];

const dashboardCopy = {
  en: {
    pageTitle: "Account Dashboard",
    loading: "Loading dashboard...",
    pleaseSignIn: "Please sign in first to access your account center.",
    backHome: "Back to Home",
    home: "Home",
    storageMode: "Storage mode",
    storageD1: "Cloudflare D1",
    storageMemory: "In-memory fallback",
    profile: "Profile",
    created: "Created",
    lastLogin: "Last login",
    credits: "Credits",
    balance: "Balance",
    purchased: "Purchased",
    used: "Used",
    creditsHint: "PayPal sandbox flow is active. After successful capture, credits will be added automatically.",
    buyCredits: "Buy Credits",
    buyCreditsHint: "Sandbox pricing packs for flow validation.",
    buyWithPaypal: "Buy with PayPal",
    creating: "Creating...",
    recentOrders: "Recent Orders",
    noOrders: "No orders yet.",
    paypalOrderId: "PayPal Order ID",
    plan: "Plan",
    amount: "Amount",
    status: "Status",
    createdAt: "Created",
    paymentFinalizing: "Finalizing PayPal payment...",
    paymentSuccess: (credits: number) => `Payment successful. ${credits} credits added.`,
    captureFailed: "Failed to capture PayPal order.",
    createFailed: "Failed to create PayPal order.",
    missingApproveUrl: (id: string) => `Order ${id} created. Missing approveUrl, please check PayPal setup.`,
    buyAnchor: "Buy Credits",
  },
  zh: {
    pageTitle: "个人中心",
    loading: "正在加载个人中心...",
    pleaseSignIn: "请先登录后再访问个人中心。",
    backHome: "返回首页",
    home: "首页",
    storageMode: "存储模式",
    storageD1: "Cloudflare D1",
    storageMemory: "内存回退模式",
    profile: "账号信息",
    created: "创建时间",
    lastLogin: "最近登录",
    credits: "额度",
    balance: "当前余额",
    purchased: "累计获得",
    used: "累计使用",
    creditsHint: "当前已接入 PayPal sandbox 流程，支付 capture 成功后会自动加额度。",
    buyCredits: "购买额度",
    buyCreditsHint: "当前是 sandbox 测试套餐，用于跑通支付流程。",
    buyWithPaypal: "使用 PayPal 购买",
    creating: "正在创建订单...",
    recentOrders: "最近订单",
    noOrders: "暂时还没有订单。",
    paypalOrderId: "PayPal 订单号",
    plan: "套餐",
    amount: "金额",
    status: "状态",
    createdAt: "创建时间",
    paymentFinalizing: "正在确认 PayPal 支付结果...",
    paymentSuccess: (credits: number) => `支付成功，已为你增加 ${credits} 个 credits。`,
    captureFailed: "确认 PayPal 订单失败。",
    createFailed: "创建 PayPal 订单失败。",
    missingApproveUrl: (id: string) => `订单 ${id} 已创建，但没有拿到 approveUrl，请检查 PayPal 配置。`,
    buyAnchor: "购买额度",
  },
} as const;

export function DashboardClient() {
  const [locale, setLocale] = useState<Locale>("en");
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [plans, setPlans] = useState<Plan[]>(FALLBACK_PLANS);
  const [paymentBusyPlan, setPaymentBusyPlan] = useState<string | null>(null);
  const [paymentMessage, setPaymentMessage] = useState<string>("");
  const [paymentError, setPaymentError] = useState<string>("");

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === "en" || saved === "zh") {
      setLocale(saved);
    }
  }, []);

  const loadAll = async () => {
    const meRes = await fetch("/api/me", { credentials: "include" });
    if (!meRes.ok) {
      setMe({ authenticated: false });
      return;
    }

    const meData = (await meRes.json()) as MeResponse;
    setMe(meData);

    if (!meData.authenticated) return;

    const [orderRes, planRes] = await Promise.all([
      fetch("/api/me/orders", { credentials: "include" }),
      fetch("/api/plans", { credentials: "include" }),
    ]);

    if (orderRes.ok) {
      const data = await orderRes.json();
      setOrders(data.orders || []);
    }

    if (planRes.ok) {
      const data = await planRes.json();
      if (Array.isArray(data?.plans) && data.plans.length > 0) {
        setPlans(data.plans);
      }
    }
  };

  useEffect(() => {
    const load = async () => {
      try {
        await loadAll();
      } finally {
        setLoading(false);
      }
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const text = dashboardCopy[locale];
  const homeText = copy[locale];

  useEffect(() => {
    if (loading || typeof window === "undefined") return;

    const token = new URLSearchParams(window.location.search).get("token");
    if (!token) return;

    const capture = async () => {
      try {
        setPaymentMessage(text.paymentFinalizing);
        setPaymentError("");
        const res = await fetch("/api/paypal/capture-order", {
          method: "POST",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ providerOrderId: token }),
        });
        const data = await res.json();
        if (!res.ok || !data?.ok) {
          setPaymentError(data?.error || text.captureFailed);
          setPaymentMessage("");
          return;
        }

        setPaymentMessage(text.paymentSuccess(data?.order?.creditsGranted || 0));
        await loadAll();

        const cleanUrl = `${window.location.pathname}${window.location.hash || ""}`;
        window.history.replaceState({}, "", cleanUrl);
      } catch {
        setPaymentError(text.captureFailed);
      }
    };

    capture();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, locale]);

  const sortedPlans = useMemo(() => [...plans].sort((a, b) => a.price - b.price), [plans]);

  const handleBuy = async (planCode: string) => {
    setPaymentBusyPlan(planCode);
    setPaymentError("");
    setPaymentMessage("");

    try {
      const res = await fetch("/api/paypal/create-order", {
        method: "POST",
        credentials: "include",
        headers: {
          "content-type": "application/json",
          "x-idempotency-key": `buy-${planCode}-${Date.now()}`,
        },
        body: JSON.stringify({ planCode }),
      });

      const data = await res.json();
      if (!res.ok || !data?.ok) {
        setPaymentError(data?.error || text.createFailed);
        return;
      }

      if (data?.order?.approveUrl) {
        window.location.href = data.order.approveUrl;
        return;
      }

      setPaymentMessage(text.missingApproveUrl(data?.order?.localOrderId || "-"));
    } catch {
      setPaymentError(text.createFailed);
    } finally {
      setPaymentBusyPlan(null);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.18),_transparent_30%),linear-gradient(180deg,_#020617_0%,_#020617_100%)] text-slate-200">
        <div className="mx-auto max-w-6xl px-6 py-10 sm:px-10 lg:px-12">
          <p className="text-sm text-slate-400">{text.loading}</p>
        </div>
      </main>
    );
  }

  if (!me?.authenticated) {
    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.18),_transparent_30%),linear-gradient(180deg,_#020617_0%,_#020617_100%)] text-slate-200">
        <div className="mx-auto max-w-6xl px-6 py-10 sm:px-10 lg:px-12">
          <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-8 shadow-soft backdrop-blur sm:p-10">
            <h1 className="text-2xl font-semibold text-white">{text.pageTitle}</h1>
            <p className="mt-3 text-sm text-slate-300">{text.pleaseSignIn}</p>
            <Link href="/" className="mt-5 inline-block rounded-full border border-slate-600 px-4 py-2 text-sm text-white">
              {text.backHome}
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const user = me.user || {};
  const credits = me.credits || { balance: 0, lifetimeCredited: 0, lifetimeUsed: 0 };

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.18),_transparent_30%),linear-gradient(180deg,_#020617_0%,_#020617_100%)] text-slate-200">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-8 sm:px-10 lg:px-12">
        <header className="flex flex-col gap-4 rounded-3xl border border-slate-800 bg-slate-900/60 p-6 shadow-soft backdrop-blur sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-white">{text.pageTitle}</h1>
            <p className="mt-1 text-xs text-slate-400">
              {text.storageMode}: {me.storage === "d1" ? text.storageD1 : text.storageMemory}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                const next = locale === "en" ? "zh" : "en";
                window.localStorage.setItem(STORAGE_KEY, next);
                setLocale(next);
              }}
              className="rounded-full border border-slate-600 px-4 py-2 text-sm text-white"
            >
              {homeText.localeLabel} → {homeText.switchTo}
            </button>
            <Link href="/" className="rounded-full border border-slate-600 px-4 py-2 text-sm text-white">
              {text.home}
            </Link>
          </div>
        </header>

        <section className="grid gap-6 lg:grid-cols-2">
          <article className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6 shadow-soft backdrop-blur">
            <h2 className="text-lg font-semibold text-white">{text.profile}</h2>
            <div className="mt-4 flex items-center gap-4">
              {user.picture ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={user.picture} alt={user.name || "avatar"} className="h-12 w-12 rounded-full border border-slate-700" />
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded-full border border-slate-700 text-xs">U</div>
              )}
              <div>
                <p className="text-sm text-white">{user.name || "Google User"}</p>
                <p className="text-xs text-slate-400">{user.email || "-"}</p>
              </div>
            </div>
            <div className="mt-4 space-y-1 text-xs text-slate-400">
              <p>{text.created}: {user.createdAt || "-"}</p>
              <p>{text.lastLogin}: {user.lastLoginAt || "-"}</p>
            </div>
          </article>

          <article className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6 shadow-soft backdrop-blur">
            <h2 className="text-lg font-semibold text-white">{text.credits}</h2>
            <div className="mt-4 grid grid-cols-3 gap-3">
              <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                <p className="text-xs text-slate-400">{text.balance}</p>
                <p className="mt-1 text-xl font-semibold text-white">{credits.balance}</p>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                <p className="text-xs text-slate-400">{text.purchased}</p>
                <p className="mt-1 text-xl font-semibold text-white">{credits.lifetimeCredited}</p>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                <p className="text-xs text-slate-400">{text.used}</p>
                <p className="mt-1 text-xl font-semibold text-white">{credits.lifetimeUsed}</p>
              </div>
            </div>
            <p className="mt-4 text-xs text-slate-400">{text.creditsHint}</p>
          </article>
        </section>

        <section id="buy" className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6 shadow-soft backdrop-blur">
          <h2 className="text-lg font-semibold text-white">{text.buyCredits}</h2>
          <p className="mt-1 text-xs text-slate-400">{text.buyCreditsHint}</p>

          <div className="mt-4 grid gap-4 md:grid-cols-3">
            {sortedPlans.map((plan) => (
              <article key={plan.code} className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                <p className="text-sm font-semibold text-white">{plan.name}</p>
                <p className="mt-1 text-xs text-slate-400">{plan.credits} credits</p>
                <p className="mt-2 text-lg text-white">{plan.price.toFixed(2)} {plan.currency}</p>
                <button
                  type="button"
                  disabled={paymentBusyPlan === plan.code}
                  onClick={() => handleBuy(plan.code)}
                  className="mt-3 w-full rounded-full border border-emerald-500/50 px-3 py-2 text-xs text-emerald-200 transition hover:border-emerald-300 disabled:opacity-60"
                >
                  {paymentBusyPlan === plan.code ? text.creating : text.buyWithPaypal}
                </button>
              </article>
            ))}
          </div>

          {paymentMessage ? <p className="mt-4 text-sm text-emerald-300">{paymentMessage}</p> : null}
          {paymentError ? <p className="mt-4 text-sm text-rose-300">{paymentError}</p> : null}
        </section>

        <section className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6 shadow-soft backdrop-blur">
          <h2 className="text-lg font-semibold text-white">{text.recentOrders}</h2>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="text-xs text-slate-400">
                <tr>
                  <th className="pb-2">Order ID</th>
                  <th className="pb-2">{text.paypalOrderId}</th>
                  <th className="pb-2">{text.plan}</th>
                  <th className="pb-2">{text.amount}</th>
                  <th className="pb-2">{text.status}</th>
                  <th className="pb-2">{text.createdAt}</th>
                </tr>
              </thead>
              <tbody>
                {orders.length === 0 ? (
                  <tr>
                    <td className="py-3 text-slate-400" colSpan={6}>
                      {text.noOrders}
                    </td>
                  </tr>
                ) : (
                  orders.map((order) => (
                    <tr key={order.id} className="border-t border-slate-800">
                      <td className="py-3 text-xs text-slate-300">{order.id}</td>
                      <td className="py-3 text-xs text-slate-400">{order.providerOrderId || "-"}</td>
                      <td className="py-3 text-slate-200">{order.planName || order.planCode}</td>
                      <td className="py-3 text-slate-200">{(order.amountCents / 100).toFixed(2)} {order.currency}</td>
                      <td className="py-3 text-slate-200">{order.status}</td>
                      <td className="py-3 text-slate-400">{order.createdAt || "-"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
