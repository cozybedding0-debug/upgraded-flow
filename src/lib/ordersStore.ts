import type { DailyOrder, Product } from "@/types";
import { getProducts, setProducts } from "@/lib/productsStore";

const ORDERS_KEY = "nukeflow_orders";

export function getDefaultOrders(): DailyOrder[] {
  const today = new Date().toISOString().split("T")[0]!;
  const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0]!;
  const twoDaysAgo = new Date(Date.now() - 2 * 86400000).toISOString().split("T")[0]!;
  const threeDaysAgo = new Date(Date.now() - 3 * 86400000).toISOString().split("T")[0]!;

  return [
    {
      id: "ord-seed-01",
      customer_order_id: "TT-578901",
      customer_name: "TikTok Shop #578901",
      product_id: "prod-topper-01",
      variant_id: "var-top-dbl",
      product_name: "Luxury Hotel Quality 10cm Extra Thick Mattress Topper",
      category: "Mattress Topper",
      size: "Double (4ft6)",
      color: "White",
      unit_price: 39.99,
      quantity: 2,
      total_price: 79.98,
      order_date: today,
      channel: "TikTok Shop",
      notes: "TikTok Picking List batch import",
      logged_by: "demo-admin",
      status: "Completed",
      created_at: new Date(Date.now() - 2 * 3600000).toISOString(),
    },
    {
      id: "ord-seed-02",
      customer_order_id: "TT-578902",
      customer_name: "TikTok Shop #578902",
      product_id: "prod-sheet-02",
      variant_id: "var-sht-kng",
      product_name: "100% Egyptian Cotton 400TC Deep Fitted Bed Sheet",
      category: "Fitted Sheet",
      size: "King",
      color: "Charcoal",
      unit_price: 21.99,
      quantity: 1,
      total_price: 21.99,
      order_date: today,
      channel: "TikTok Shop",
      notes: "Express delivery request",
      logged_by: "demo-admin",
      status: "Completed",
      created_at: new Date(Date.now() - 3 * 3600000).toISOString(),
    },
    {
      id: "ord-seed-03",
      customer_order_id: "AMZ-88219",
      customer_name: "Sarah Jenkins",
      product_id: "prod-duvet-03",
      variant_id: "var-duv-kng",
      product_name: "Hotel Stripe Duvet Cover Quilt Bedding Set",
      category: "Duvet Cover",
      size: "King (5ft)",
      color: "Silver Grey",
      unit_price: 31.99,
      quantity: 1,
      total_price: 31.99,
      order_date: today,
      channel: "Amazon",
      notes: "Amazon Prime dispatch",
      logged_by: "demo-admin",
      status: "Completed",
      created_at: new Date(Date.now() - 5 * 3600000).toISOString(),
    },
    {
      id: "ord-seed-04",
      customer_order_id: "AMZ-88219",
      customer_name: "Sarah Jenkins",
      product_id: "prod-pillow-05",
      variant_id: "var-plw-pair",
      product_name: "Bounce Back Hotel Quality Sleeping Pillows Pair",
      category: "Pillow",
      size: "Pair (Pack of 2)",
      color: "White",
      unit_price: 15.99,
      quantity: 2,
      total_price: 31.98,
      order_date: today,
      channel: "Amazon",
      notes: "Ordered with duvet set",
      logged_by: "demo-admin",
      status: "Completed",
      created_at: new Date(Date.now() - 5 * 3600000).toISOString(),
    },
    {
      id: "ord-seed-05",
      customer_order_id: "DIR-3301",
      customer_name: "Liam Walker",
      product_id: "prod-tog-04",
      variant_id: "var-tog-dbl",
      product_name: "All Seasons Warm Anti-Allergy 13.5 Tog Winter Duvet",
      category: "Duvet",
      size: "Double",
      color: "White",
      unit_price: 28.99,
      quantity: 1,
      total_price: 28.99,
      order_date: today,
      channel: "Direct",
      notes: "Phone order, customer collected",
      logged_by: "demo-admin",
      status: "Completed",
      created_at: new Date(Date.now() - 6 * 3600000).toISOString(),
    },
    {
      id: "ord-seed-06",
      customer_order_id: "WEB-10492",
      customer_name: "Emma Thompson",
      product_id: "prod-topper-01",
      variant_id: "var-top-kng",
      product_name: "Luxury Hotel Quality 10cm Extra Thick Mattress Topper",
      category: "Mattress Topper",
      size: "King (5ft)",
      color: "White",
      unit_price: 44.99,
      quantity: 1,
      total_price: 44.99,
      order_date: yesterday,
      channel: "Website",
      notes: "Dispatched via DPD Tracked",
      logged_by: "demo-admin",
      status: "Shipped",
      created_at: new Date(Date.now() - 26 * 3600000).toISOString(),
    },
    {
      id: "ord-seed-07",
      customer_order_id: "TT-578810",
      customer_name: "TikTok Shop #578810",
      product_id: "prod-prot-06",
      variant_id: "var-prt-dbl",
      product_name: "Waterproof Quilted Breathable Mattress Protector",
      category: "Mattress Protector",
      size: "Double",
      color: "White",
      unit_price: 14.99,
      quantity: 3,
      total_price: 44.97,
      order_date: yesterday,
      channel: "TikTok Shop",
      notes: "TikTok Live flash promo order",
      logged_by: "demo-admin",
      status: "Completed",
      created_at: new Date(Date.now() - 28 * 3600000).toISOString(),
    },
    {
      id: "ord-seed-08",
      customer_order_id: "WHS-0092",
      customer_name: "Cozy Guest House B&B",
      product_id: "prod-topper-01",
      variant_id: "var-top-sng",
      product_name: "Luxury Hotel Quality 10cm Extra Thick Mattress Topper",
      category: "Mattress Topper",
      size: "Single (3ft)",
      color: "White",
      unit_price: 29.99,
      quantity: 4,
      total_price: 119.96,
      order_date: twoDaysAgo,
      channel: "Direct",
      notes: "Hospitality wholesale tier",
      logged_by: "demo-admin",
      status: "Completed",
      created_at: new Date(Date.now() - 50 * 3600000).toISOString(),
    },
    {
      id: "ord-seed-09",
      customer_order_id: "AMZ-88104",
      customer_name: "Oliver Harris",
      product_id: "prod-sheet-02",
      variant_id: "var-sht-dbl",
      product_name: "100% Egyptian Cotton 400TC Deep Fitted Bed Sheet",
      category: "Fitted Sheet",
      size: "Double",
      color: "Slate Grey",
      unit_price: 18.99,
      quantity: 2,
      total_price: 37.98,
      order_date: threeDaysAgo,
      channel: "Amazon",
      notes: "Gift packaging included",
      logged_by: "demo-admin",
      status: "Completed",
      created_at: new Date(Date.now() - 74 * 3600000).toISOString(),
    },
  ];
}

export function readLocalOrders(): DailyOrder[] {
  try {
    const raw = localStorage.getItem(ORDERS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as DailyOrder[];
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
    const defaults = getDefaultOrders();
    writeLocalOrders(defaults);
    return defaults;
  } catch {
    return getDefaultOrders();
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
