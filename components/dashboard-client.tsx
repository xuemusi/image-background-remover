"use client";

import { useEffect, useState } from "react";
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
  planCode: string;
  planName: string;
  amountCents: number;
  currency: string;
  status: string;
  createdAt: string;
};

export function DashboardClient() {
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        const meRes = await fetch("/api/me", { credentials: "include" });
        if (!meRes.ok) {
          setMe({ authenticated: false });
          return;
        }

        const meData = (await meRes.json()) as MeResponse;
        setMe(meData);

        if (meData.authenticated) {
          const orderRes = await fetch("/api/me/orders", { credentials: "include" });
          if (orderRes.ok) {
            const data = await orderRes.json();
            setOrders(data.orders || []);
          }
        }
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

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
            <p className="mt-4 text-xs text-slate-400">PayPal integration is next. This panel is ready for live credits after purchase.</p>
          </article>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Recent Orders</h2>
            <button
              type="button"
              onClick={async () => {
                const res = await fetch("/api/orders", {
                  method: "POST",
                  credentials: "include",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify({ planCode: "starter_10" }),
                });
                if (res.ok) window.location.reload();
              }}
              className="rounded-full border border-slate-600 px-3 py-1 text-xs text-white"
            >
              Create Test Draft Order
            </button>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="text-xs text-slate-400">
                <tr>
                  <th className="pb-2">Order ID</th>
                  <th className="pb-2">Plan</th>
                  <th className="pb-2">Amount</th>
                  <th className="pb-2">Status</th>
                  <th className="pb-2">Created</th>
                </tr>
              </thead>
              <tbody>
                {orders.length === 0 ? (
                  <tr>
                    <td className="py-3 text-slate-400" colSpan={5}>
                      No orders yet.
                    </td>
                  </tr>
                ) : (
                  orders.map((order) => (
                    <tr key={order.id} className="border-t border-slate-800">
                      <td className="py-3 text-xs text-slate-300">{order.id}</td>
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
