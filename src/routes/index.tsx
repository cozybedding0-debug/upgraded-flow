import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import Login from "@/pages/Login";
import Layout, { type PageId } from "@/components/Layout";
import Dashboard from "@/pages/Dashboard";
import Products from "@/pages/Products";
import Orders from "@/pages/Orders";
import TikTokParser from "@/pages/TikTokParser";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "NukeFlow — Inventory & Order Dashboard" },
      {
        name: "description",
        content: "Track bedding stock, daily orders and revenue in one dashboard for NukeFlow.",
      },
      { property: "og:title", content: "NukeFlow — Inventory & Order Dashboard" },
      {
        property: "og:description",
        content: "Track bedding stock, daily orders and revenue in one dashboard for NukeFlow.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: App,
});

function AppContent() {
  const { profile, loading } = useAuth();
  const [page, setPage] = useState<PageId>("dashboard");

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="flex items-center gap-3 text-slate-400">
          <div className="w-6 h-6 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
          Loading...
        </div>
      </div>
    );
  }

  if (!profile) return <Login />;

  return (
    <Layout current={page} onNavigate={setPage}>
      {page === "dashboard" && <Dashboard />}
      {page === "orders" && <Orders />}
      {page === "products" && <Products />}
      {page === "tiktok" && <TikTokParser onNavigateToOrders={() => setPage("orders")} />}
    </Layout>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
