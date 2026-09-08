import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import type { Product } from "@/types";

const STORAGE_KEY = "nukeflow_products";
const listeners = new Set<(products: Product[]) => void>();
let cache: Product[] | null = null;
let fetching: Promise<Product[]> | null = null;

export const DEFAULT_PRODUCTS: Product[] = [
  {
    id: "prod-topper-01",
    product_name: "Luxury Hotel Quality 10cm Extra Thick Mattress Topper",
    category: "Mattress Topper",
    variation_type: "Size & Color",
    has_variants: true,
    size: "",
    unit_price: 39.99,
    stock_quantity: 210,
    sku: "TOP-10CM",
    created_at: new Date(Date.now() - 30 * 86400000).toISOString(),
    updated_at: new Date().toISOString(),
    variants: [
      {
        id: "var-top-sng",
        product_id: "prod-topper-01",
        variation_value: "Single (3ft)",
        color: "White",
        sku: "TOP-SNG-10",
        unit_price: 29.99,
        stock_quantity: 45,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: "var-top-4ft",
        product_id: "prod-topper-01",
        variation_value: "Small Double (4ft)",
        color: "White",
        sku: "TOP-4FT-10",
        unit_price: 34.99,
        stock_quantity: 30,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: "var-top-dbl",
        product_id: "prod-topper-01",
        variation_value: "Double (4ft6)",
        color: "White",
        sku: "TOP-DBL-10",
        unit_price: 39.99,
        stock_quantity: 60,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: "var-top-kng",
        product_id: "prod-topper-01",
        variation_value: "King (5ft)",
        color: "White",
        sku: "TOP-KNG-10",
        unit_price: 44.99,
        stock_quantity: 50,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: "var-top-sk",
        product_id: "prod-topper-01",
        variation_value: "Super King (6ft)",
        color: "White",
        sku: "TOP-SK-10",
        unit_price: 49.99,
        stock_quantity: 25,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ],
  },
  {
    id: "prod-sheet-02",
    product_name: "100% Egyptian Cotton 400TC Deep Fitted Bed Sheet",
    category: "Fitted Sheet",
    variation_type: "Size & Color",
    has_variants: true,
    size: "",
    unit_price: 18.99,
    stock_quantity: 310,
    sku: "SHT-400TC",
    created_at: new Date(Date.now() - 25 * 86400000).toISOString(),
    updated_at: new Date().toISOString(),
    variants: [
      {
        id: "var-sht-sng",
        product_id: "prod-sheet-02",
        variation_value: "Single",
        color: "Plain White",
        sku: "SHT-SNG-WHT",
        unit_price: 14.99,
        stock_quantity: 70,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: "var-sht-4ft",
        product_id: "prod-sheet-02",
        variation_value: "Small Double (4ft)",
        color: "Plain White",
        sku: "SHT-4FT-WHT",
        unit_price: 16.99,
        stock_quantity: 55,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: "var-sht-dbl",
        product_id: "prod-sheet-02",
        variation_value: "Double",
        color: "Slate Grey",
        sku: "SHT-DBL-GRY",
        unit_price: 18.99,
        stock_quantity: 80,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: "var-sht-kng",
        product_id: "prod-sheet-02",
        variation_value: "King",
        color: "Charcoal",
        sku: "SHT-KNG-CHR",
        unit_price: 21.99,
        stock_quantity: 65,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: "var-sht-sk",
        product_id: "prod-sheet-02",
        variation_value: "Super King",
        color: "Navy Blue",
        sku: "SHT-SK-NVY",
        unit_price: 24.99,
        stock_quantity: 40,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ],
  },
  {
    id: "prod-duvet-03",
    product_name: "Hotel Stripe Duvet Cover Quilt Bedding Set",
    category: "Duvet Cover",
    variation_type: "Size & Color",
    has_variants: true,
    size: "",
    unit_price: 26.99,
    stock_quantity: 170,
    sku: "DUV-STRIPE",
    created_at: new Date(Date.now() - 20 * 86400000).toISOString(),
    updated_at: new Date().toISOString(),
    variants: [
      {
        id: "var-duv-sng",
        product_id: "prod-duvet-03",
        variation_value: "Single 3ft",
        color: "White",
        sku: "DUV-SNG-WHT",
        unit_price: 19.99,
        stock_quantity: 40,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: "var-duv-dbl",
        product_id: "prod-duvet-03",
        variation_value: "Double (4ft6)",
        color: "White",
        sku: "DUV-DBL-WHT",
        unit_price: 26.99,
        stock_quantity: 50,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: "var-duv-kng",
        product_id: "prod-duvet-03",
        variation_value: "King (5ft)",
        color: "Silver Grey",
        sku: "DUV-KNG-GRY",
        unit_price: 31.99,
        stock_quantity: 45,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: "var-duv-sk",
        product_id: "prod-duvet-03",
        variation_value: "Super King (6ft)",
        color: "White",
        sku: "DUV-SK-WHT",
        unit_price: 36.99,
        stock_quantity: 35,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ],
  },
  {
    id: "prod-tog-04",
    product_name: "All Seasons Warm Anti-Allergy 13.5 Tog Winter Duvet",
    category: "Duvet",
    variation_type: "Size & Color",
    has_variants: true,
    size: "",
    unit_price: 28.99,
    stock_quantity: 130,
    sku: "TOG-135",
    created_at: new Date(Date.now() - 15 * 86400000).toISOString(),
    updated_at: new Date().toISOString(),
    variants: [
      {
        id: "var-tog-sng",
        product_id: "prod-tog-04",
        variation_value: "Single",
        color: "White",
        sku: "TOG-135-SNG",
        unit_price: 22.99,
        stock_quantity: 30,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: "var-tog-dbl",
        product_id: "prod-tog-04",
        variation_value: "Double",
        color: "White",
        sku: "TOG-135-DBL",
        unit_price: 28.99,
        stock_quantity: 45,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: "var-tog-kng",
        product_id: "prod-tog-04",
        variation_value: "King Size",
        color: "White",
        sku: "TOG-135-KNG",
        unit_price: 34.99,
        stock_quantity: 35,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: "var-tog-sk",
        product_id: "prod-tog-04",
        variation_value: "Super King",
        color: "White",
        sku: "TOG-135-SK",
        unit_price: 39.99,
        stock_quantity: 20,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ],
  },
  {
    id: "prod-pillow-05",
    product_name: "Bounce Back Hotel Quality Sleeping Pillows Pair",
    category: "Pillow",
    variation_type: "Pack Size",
    has_variants: true,
    size: "",
    unit_price: 15.99,
    stock_quantity: 160,
    sku: "PLW-HOTEL",
    created_at: new Date(Date.now() - 10 * 86400000).toISOString(),
    updated_at: new Date().toISOString(),
    variants: [
      {
        id: "var-plw-pair",
        product_id: "prod-pillow-05",
        variation_value: "Pair (Pack of 2)",
        color: "White",
        sku: "PLW-PAIR-WHT",
        unit_price: 15.99,
        stock_quantity: 100,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: "var-plw-4pk",
        product_id: "prod-pillow-05",
        variation_value: "Pack of 4",
        color: "White",
        sku: "PLW-4PK-WHT",
        unit_price: 28.99,
        stock_quantity: 60,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ],
  },
  {
    id: "prod-prot-06",
    product_name: "Waterproof Quilted Breathable Mattress Protector",
    category: "Mattress Protector",
    variation_type: "Size",
    has_variants: true,
    size: "",
    unit_price: 14.99,
    stock_quantity: 215,
    sku: "PRT-WATERPROOF",
    created_at: new Date(Date.now() - 8 * 86400000).toISOString(),
    updated_at: new Date().toISOString(),
    variants: [
      {
        id: "var-prt-sng",
        product_id: "prod-prot-06",
        variation_value: "Single",
        color: "White",
        sku: "PRT-SNG-WHT",
        unit_price: 11.99,
        stock_quantity: 50,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: "var-prt-dbl",
        product_id: "prod-prot-06",
        variation_value: "Double",
        color: "White",
        sku: "PRT-DBL-WHT",
        unit_price: 14.99,
        stock_quantity: 75,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: "var-prt-kng",
        product_id: "prod-prot-06",
        variation_value: "King",
        color: "White",
        sku: "PRT-KNG-WHT",
        unit_price: 17.99,
        stock_quantity: 60,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: "var-prt-sk",
        product_id: "prod-prot-06",
        variation_value: "Super King",
        color: "White",
        sku: "PRT-SK-WHT",
        unit_price: 19.99,
        stock_quantity: 30,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ],
  },
];

function readLocal(): Product[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Product[];
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
    writeLocal(DEFAULT_PRODUCTS);
    return DEFAULT_PRODUCTS;
  } catch {
    return DEFAULT_PRODUCTS;
  }
}

function writeLocal(products: Product[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(products));
  } catch {
    // ignore quota errors
  }
}

function normalizeProduct(value: unknown): Product | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Product & { product_variants?: Product["variants"] };
  if (!row.id || !row.product_name) return null;
  return {
    ...row,
    variants: Array.isArray(row.variants)
      ? row.variants
      : Array.isArray(row.product_variants)
        ? row.product_variants
        : [],
  };
}

function notify() {
  if (cache) {
    const snapshot = cache;
    listeners.forEach((fn) => fn(snapshot));
  }
}

export function subscribeProducts(fn: (products: Product[]) => void): () => void {
  listeners.add(fn);
  if (cache === null) cache = readLocal();
  fn(cache);
  return () => listeners.delete(fn);
}

export function getProducts(): Product[] {
  return cache ?? readLocal();
}

export async function fetchProducts(): Promise<Product[]> {
  const localProducts = readLocal();
  cache = localProducts;
  notify();
  if (fetching) return fetching;

  const request = (async () => {
    if (!isSupabaseConfigured) {
      return localProducts;
    }

    try {
      const { data, error } = await supabase
        .from("products")
        .select("*, variants:product_variants(*)")
        .order("product_name");
      if (error) throw error;

      const remoteProducts = (data ?? [])
        .map(normalizeProduct)
        .filter((product): product is Product => product !== null);
      const remoteIds = new Set(remoteProducts.map((product) => product.id));
      const localOnlyProducts = localProducts.filter(
        (product) => product.id.startsWith("product-") && !remoteIds.has(product.id),
      );
      cache = [...remoteProducts, ...localOnlyProducts].sort((a, b) =>
        a.product_name.localeCompare(b.product_name),
      );
      writeLocal(cache);
    } catch {
      cache = localProducts;
    }
    notify();
    return cache;
  })();
  fetching = request;
  void request.finally(() => {
    if (fetching === request) fetching = null;
  });
  return request;
}

export function setProducts(products: Product[]) {
  cache = products;
  writeLocal(cache);
  notify();
}

export function invalidateProducts() {
  fetchProducts();
}

/** Save (insert or replace) a product locally — used when the backend is unreachable. */
export function saveProductLocal(product: Product) {
  const current = cache ?? readLocal();
  const idx = current.findIndex((p) => p.id === product.id);
  const next =
    idx >= 0 ? current.map((p) => (p.id === product.id ? product : p)) : [...current, product];
  setProducts(next.sort((a, b) => a.product_name.localeCompare(b.product_name)));
}

/** Replace an optimistic local product with the row returned by the backend. */
export function replaceProductLocal(localId: string, product: Product) {
  const current = cache ?? readLocal();
  const next = current.filter((item) => item.id !== localId && item.id !== product.id);
  setProducts([...next, product].sort((a, b) => a.product_name.localeCompare(b.product_name)));
}

/** Remove a product locally — used when the backend is unreachable. */
export function deleteProductLocal(id: string) {
  const current = cache ?? readLocal();
  setProducts(current.filter((p) => p.id !== id));
}
