import type { DailyOrder, Product } from "@/types";
import { getProducts, setProducts } from "@/lib/productsStore";

const ORDERS_KEY = "nukeflow_orders";

export const DEFAULT_ORDERS: DailyOrder[] = [
  {
    id: "sample-order-1",
    product_id: "prod-topper",
    variant_id: "var-top-double",
    product_name: "Extra Thick Hotel Quality Mattress Topper",
    category: "Mattress Topper",
    size: "Double",
    color: "White",
    unit_price: 24.99,
    quantity: 2,
    total_price: 49.98,
    order_date: new Date().toISOString().split("T")[0]!,
    channel: "TikTok Shop",
    notes: "Customer requested morning delivery",
    logged_by: "demo-admin",
    created_at: new Date().toISOString(),
    customer_name: "Sarah Jenkins",
    customer_order_id: "TT-9481023",
    status: "Completed",
  },
  {
    id: "sample-order-2",
    product_id: "prod-duvet",
    variant_id: "var-duv-king",
    product_name: "Luxury Microfibre Duvet Cover Set",
    category: "Duvet Cover",
    size: "King",
    color: "Charcoal",
    unit_price: 22.99,
    quantity: 1,
    total_price: 22.99,
    order_date: new Date().toISOString().split("T")[0]!,
    channel: "TikTok Shop",
    notes: "",
    logged_by: "demo-admin",
    created_at: new Date().toISOString(),
    customer_name: "Michael Thompson",
    customer_order_id: "TT-9481024",
    status: "Completed",
  },
  {
    id: "sample-order-3",
    product_id: "prod-pillows",
    variant_id: null,
    product_name: "Hotel Bounce Back Pillows (Pack of 2)",
    category: "Pillow",
    size: "Pair (Pack of 2)",
    color: "",
    unit_price: 12.99,
    quantity: 3,
    total_price: 38.97,
    order_date: new Date().toISOString().split("T")[0]!,
    channel: "Direct",
    notes: "Customer collection from warehouse",
    logged_by: "demo-admin",
    created_at: new Date().toISOString(),
    customer_name: "Emma Watson",
    customer_order_id: "DIR-1049",
    status: "Completed",
  },
];

export function readLocalOrders(): DailyOrder[] {
  try {
    const raw = localStorage.getItem(ORDERS_KEY);
    if (!raw) {
      writeLocalOrders(DEFAULT_ORDERS);
      return DEFAULT_ORDERS;
    }
    const parsed = JSON.parse(raw) as DailyOrder[];
    return parsed.length > 0 ? parsed : DEFAULT_ORDERS;
  } catch {
    return DEFAULT_ORDERS;
  }
}

export function writeLocalOrders(orders: DailyOrder[]) {
  try {
    localStorage.setItem(ORDERS_KEY, JSON.stringify(orders));
  } catch {
    // ignore quota errors
  }
}

/** Persist new order rows locally (newest first). */
export function saveLocalOrders(newOrders: DailyOrder[]): DailyOrder[] {
  const existing = readLocalOrders();
  const ids = new Set(newOrders.map((o) => o.id));
  const merged = [...newOrders, ...existing.filter((o) => !ids.has(o.id))];
  writeLocalOrders(merged);
  return merged;
}

export function deleteLocalOrders(ids: string[]) {
  const remove = new Set(ids);
  writeLocalOrders(readLocalOrders().filter((o) => !remove.has(o.id)));
}

export function updateLocalOrderStatus(ids: string[], status: DailyOrder["status"]) {
  const target = new Set(ids);
  writeLocalOrders(readLocalOrders().map((o) => (target.has(o.id) ? { ...o, status } : o)));
}

/** Merge remote orders with local-only orders so nothing disappears. */
export function mergeOrders(remote: DailyOrder[]): DailyOrder[] {
  const local = readLocalOrders();
  const remoteIds = new Set(remote.map((o) => o.id));
  const localOnly = local.filter((o) => o.id.startsWith("order-") && !remoteIds.has(o.id));
  return [...localOnly, ...remote];
}

/** Deduct ordered quantities from local product stock (variant-aware). */
export function deductLocalStock(
  items: { product_id: string | null; variant_id: string | null; quantity: number }[],
) {
  const products = getProducts();
  if (products.length === 0) return;

  const next: Product[] = products.map((product) => {
    const relevant = items.filter((i) => i.product_id === product.id);
    if (relevant.length === 0) return product;

    let updated: Product = { ...product };

    for (const item of relevant) {
      if (item.variant_id && updated.variants?.length) {
        updated = {
          ...updated,
          variants: updated.variants.map((v) =>
            v.id === item.variant_id
              ? { ...v, stock_quantity: Math.max(0, (v.stock_quantity || 0) - item.quantity) }
              : v,
          ),
        };
      } else {
        updated = {
          ...updated,
          stock_quantity: Math.max(0, (updated.stock_quantity || 0) - item.quantity),
        };
      }
    }

    return updated;
  });

  setProducts(next);
}
