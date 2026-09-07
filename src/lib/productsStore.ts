import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import type { Product } from "@/types";

const STORAGE_KEY = "nukeflow_products";
const listeners = new Set<(products: Product[]) => void>();
let cache: Product[] | null = null;
let fetching: Promise<Product[]> | null = null;

export const DEFAULT_PRODUCTS: Product[] = [
  {
    id: "prod-topper",
    category: "Mattress Topper",
    product_name: "Extra Thick Hotel Quality Mattress Topper",
    size: "",
    unit_price: 24.99,
    stock_quantity: 85,
    sku: "TOP-HOTEL",
    has_variants: true,
    variation_type: "Size & Color",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    variants: [
      {
        id: "var-top-single",
        product_id: "prod-topper",
        variation_value: "Single",
        color: "White",
        sku: "TOP-SNG-WHT",
        unit_price: 18.99,
        stock_quantity: 20,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: "var-top-sdouble",
        product_id: "prod-topper",
        variation_value: "Small Double",
        color: "White",
        sku: "TOP-SDB-WHT",
        unit_price: 21.99,
        stock_quantity: 15,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: "var-top-double",
        product_id: "prod-topper",
        variation_value: "Double",
        color: "White",
        sku: "TOP-DBL-WHT",
        unit_price: 24.99,
        stock_quantity: 25,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: "var-top-king",
        product_id: "prod-topper",
        variation_value: "King",
        color: "White",
        sku: "TOP-KNG-WHT",
        unit_price: 28.99,
        stock_quantity: 15,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: "var-top-sking",
        product_id: "prod-topper",
        variation_value: "Super King",
        color: "White",
        sku: "TOP-SKNG-WHT",
        unit_price: 32.99,
        stock_quantity: 10,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ],
  },
  {
    id: "prod-duvet",
    category: "Duvet Cover",
    product_name: "Luxury Microfibre Duvet Cover Set",
    size: "",
    unit_price: 16.99,
    stock_quantity: 65,
    sku: "DUV-SET",
    has_variants: true,
    variation_type: "Size & Color",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    variants: [
      {
        id: "var-duv-single",
        product_id: "prod-duvet",
        variation_value: "Single",
        color: "Grey",
        sku: "DUV-SNG-GRY",
        unit_price: 14.99,
        stock_quantity: 20,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: "var-duv-double",
        product_id: "prod-duvet",
        variation_value: "Double",
        color: "Grey",
        sku: "DUV-DBL-GRY",
        unit_price: 18.99,
        stock_quantity: 25,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: "var-duv-king",
        product_id: "prod-duvet",
        variation_value: "King",
        color: "Charcoal",
        sku: "DUV-KNG-CHR",
        unit_price: 22.99,
        stock_quantity: 20,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ],
  },
  {
    id: "prod-fitted",
    category: "Fitted Sheet",
    product_name: "Deep Elasticated Fitted Bed Sheet",
    size: "",
    unit_price: 11.99,
    stock_quantity: 70,
    sku: "FIT-SHT",
    has_variants: true,
    variation_type: "Size & Color",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    variants: [
      {
        id: "var-fit-single",
        product_id: "prod-fitted",
        variation_value: "Single",
        color: "White",
        sku: "FIT-SNG-WHT",
        unit_price: 9.99,
        stock_quantity: 25,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: "var-fit-double",
        product_id: "prod-fitted",
        variation_value: "Double",
        color: "White",
        sku: "FIT-DBL-WHT",
        unit_price: 12.99,
        stock_quantity: 30,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: "var-fit-king",
        product_id: "prod-fitted",
        variation_value: "King",
        color: "White",
        sku: "FIT-KNG-WHT",
        unit_price: 14.99,
        stock_quantity: 15,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ],
  },
  {
    id: "prod-pillows",
    category: "Pillow",
    product_name: "Hotel Bounce Back Pillows (Pack of 2)",
    size: "Pair (Pack of 2)",
    unit_price: 12.99,
    stock_quantity: 45,
    sku: "PLW-HOTEL-2PK",
    has_variants: false,
    variation_type: "",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

function readLocal(): Product[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      writeLocal(DEFAULT_PRODUCTS);
      return DEFAULT_PRODUCTS;
    }
    const parsed = JSON.parse(raw) as Product[];
    return parsed.length > 0 ? parsed : DEFAULT_PRODUCTS;
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
