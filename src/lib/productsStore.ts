import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import type { Product } from "@/types";

const STORAGE_KEY = "nukeflow_products";
const listeners = new Set<(products: Product[]) => void>();
let cache: Product[] | null = null;
let fetching: Promise<Product[]> | null = null;

function readLocal(): Product[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Product[]) : [];
  } catch {
    return [];
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
