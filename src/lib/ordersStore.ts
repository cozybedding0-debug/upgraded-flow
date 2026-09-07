import type { DailyOrder, Product } from "@/types";
import { getProducts, setProducts } from "@/lib/productsStore";

const ORDERS_KEY = "nukeflow_orders";

export function readLocalOrders(): DailyOrder[] {
  try {
    const raw = localStorage.getItem(ORDERS_KEY);
    return raw ? (JSON.parse(raw) as DailyOrder[]) : [];
  } catch {
    return [];
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
