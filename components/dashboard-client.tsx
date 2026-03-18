"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

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

const FALLBACK_PLANS: Plan[] = [
  { code: "starter_10", name: "Starter 10", price: 4.99, currency: "USD", credits: 10 },
  { code: "pro_50", name: "Pro 50", price: 12.99, currency: "USD", credits: 50 },
  { code: "business_200", name: "Business 200", price: 29.99, currency: "USD", credits: 200 },
];

export function DashboardClient() {
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [plans, setPlans] = useState<Plan[]>(FALLBACK_PLANS);
  const [paymentBusyPlan, setPaymentBusyPlan] = useState<string | null>(null);
  const [paymentMessage, setPaymentMessage] = useState<string>("");
  const [paymentError, setPaymentError] = useState<string>("");

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

  useEffect(() => {
    if (loading || typeof window === "undefined") return;

    const token = new URLSearchParams(window.location.search).get("token");
    if (!token) return;

    const capture = async () => {
      try {
        setPaymentMessage("Finalizing PayPal payment...");
        setPaymentError("");
        const res = await fetch("/api/paypal/capture-order", {
          method: "POST",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ providerOrderId: token }),
        });
        const data = await res.json();
        if (!res.ok || !data?.ok) {
          setPaymentError(data?.error || "Failed to capture PayPal order.");
          setPaymentMessage("");
          return;
        }

        setPaymentMessage(`Payment successful. ${data?.order?.creditsGranted || 0} credits added.`);
        await loadAll();

        const cleanUrl = `${window.location.pathname}${window.location.hash || ""}`;
        window.history.replaceState({}, "", cleanUrl);
      } catch {
        setPaymentError("Failed to capture PayPal order.");
      }
    };

    capture();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  const sortedPlans = useMemo(
    () => [...plans].sort((a, b) => a.price - b.price),
    [plans],
  );

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
        setPaymentError(data?.error || "Failed to create PayPal order");
        return;
      }

      if (data?.order?.approveUrl) {
        window.location.href = data.order.approveUrl;
        return;
      }

      setPaymentMessage(`Order ${data?.order?.localOrderId} created. Missing approveUrl (check PayPal account config).`);
    } catch {
      setPaymentError("Failed to create PayPal order.");
    } finally {
      setPaymentBusyPlan(null);
    }
  };

  if (loading) {
    return (
      <main className="mx-auto min-h-screen max-w-5xl px-6 py-10 text-slate-200">
        <p className="text-sm text-slate-400">Loading dashboard...</p>
      </main>
    );
  }

  if (!me?.authenticated) {
    return (
      <main className="mx-auto min-h-screen max-w-5xl px-6 py-10 text-slate-200">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
          <h1 className="text-2xl font-semibold text-white">Dashboard</h1>
          <p className="mt-3 text-sm text-slate-300">Please sign in first to access your account center.</p>
          <Link href="/" className="mt-5 inline-block rounded-full border border-slate-600 px-4 py-2 text-sm text-white">
            Back to Home
          </Link>
        </div>
      </main>
    );
  }

  const user = me.user || {};
  const credits = me.credits || { balance: 0, lifetimeCredited: 0, lifetimeUsed: 0 };

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.18),_transparent_30%),linear-gradient(180deg,_#020617_0%,_#020617_100%)] text-slate-200">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-8 sm:px-10 lg:px-12">
        <header className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
          <div>
            <h1 className="text-2xl font-semibold text-white">Account Dashboard</h1>
            <p className="mt-1 text-xs text-slate-400">Storage mode: {me.storage === "d1" ? "Cloudflare D1" : "In-memory fallback"}</p>
          </div>
          <Link href="/" className="rounded-full border border-slate-600 px-4 py-2 text-sm text-white">
            Home
          </Link>
        </header>

        <section className="grid gap-6 lg:grid-cols-2">
          <article className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
            <h2 className="text-lg font-semibold text-white">Profile</h2>
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
              <p>Created: {user.createdAt || "-"}</p>
              <p>Last login: {user.lastLoginAt || "-"}</p>
            </div>
          </article>

          <article className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
            <h2 className="text-lg font-semibold text-white">Credits</h2>
            <div className="mt-4 grid grid-cols-3 gap-3">
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                <p className="text-xs text-slate-400">Balance</p>
                <p className="mt-1 text-xl font-semibold text-white">{credits.balance}</p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                <p className="text-xs text-slate-400">Purchased</p>
                <p className="mt-1 text-xl font-semibold text-white">{credits.lifetimeCredited}</p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                <p className="text-xs text-slate-400">Used</p>
                <p className="mt-1 text-xl font-semibold text-white">{credits.lifetimeUsed}</p>
              </div>
            </div>
            <p className="mt-4 text-xs text-slate-400">PayPal Phase-1 sandbox skeleton is active. Create order → approve on PayPal → return and auto-capture.</p>
          </article>
        </section>

        <section id="buy" className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
          <h2 className="text-lg font-semibold text-white">Buy Credits (PayPal Sandbox)</h2>
          <p className="mt-1 text-xs text-slate-400">If credentials are missing, API returns clear setup errors.</p>

          <div className="mt-4 grid gap-4 md:grid-cols-3">
            {sortedPlans.map((plan) => (
              <article key={plan.code} className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                <p className="text-sm font-semibold text-white">{plan.name}</p>
                <p className="mt-1 text-xs text-slate-400">{plan.credits} credits</p>
                <p className="mt-2 text-lg text-white">{plan.price.toFixed(2)} {plan.currency}</p>
                <button
                  type="button"
                  disabled={paymentBusyPlan === plan.code}
                  onClick={() => handleBuy(plan.code)}
                  className="mt-3 w-full rounded-full border border-slate-600 px-3 py-2 text-xs text-white disabled:opacity-60"
                >
                  {paymentBusyPlan === plan.code ? "Creating..." : "Buy with PayPal"}
                </button>
              </article>
            ))}
          </div>

          {paymentMessage ? <p className="mt-4 text-sm text-emerald-300">{paymentMessage}</p> : null}
          {paymentError ? <p className="mt-4 text-sm text-rose-300">{paymentError}</p> : null}
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
          <h2 className="text-lg font-semibold text-white">Recent Orders</h2>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="text-xs text-slate-400">
                <tr>
                  <th className="pb-2">Order ID</th>
                  <th className="pb-2">PayPal Order ID</th>
                  <th className="pb-2">Plan</th>
                  <th className="pb-2">Amount</th>
                  <th className="pb-2">Status</th>
                  <th className="pb-2">Created</th>
                </tr>
              </thead>
              <tbody>
                {orders.length === 0 ? (
                  <tr>
                    <td className="py-3 text-slate-400" colSpan={6}>
                      No orders yet.
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
