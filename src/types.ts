export type UserRole = "admin" | "manager";

// Category ko dynamic string bana diya hai taake naye categories add ho sakein
export type Category = string;
export const CATEGORIES: string[] = [];

// Static CATEGORIES array removed

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  created_at: string;
}

export interface ProductVariant {
  id: string;
  product_id: string;
  variation_value: string; // Size
  color?: string | undefined; // NEW: Color field added
  sku: string;
  unit_price: number;
  stock_quantity: number;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: string;
  category: Category;
  product_name: string;
  size: string;
  unit_price: number;
  stock_quantity: number;
  sku: string;
  has_variants: boolean;
  variation_type: string;
  variants?: ProductVariant[] | undefined;
  created_at: string;
  updated_at: string;
}

export type OrderStatus = "Pending" | "Completed" | "Shipped";

export interface DailyOrder {
  id: string;
  user_id?: string | null | undefined;
  product_id: string | null;
  variant_id: string | null;
  product_name: string;
  category: Category;
  size: string;
  color?: string | undefined; // NEW: Color field added for daily orders
  unit_price: number;
  quantity: number;
  total_price: number;
  order_date: string;
  channel: string;
  notes: string;
  logged_by: string | null;
  created_at: string;
  customer_name: string;
  customer_order_id: string | null;
  status: OrderStatus;
}

export interface CustomerOrderGroup {
  customer_order_id: string;
  customer_name: string;
  order_date: string;
  status: OrderStatus;
  channel: string;
  notes: string;
  items: DailyOrder[];
  grand_total: number;
  total_units: number;
}

export type DateRangePreset = "today" | "yesterday" | "this_week" | "this_month" | "custom";

export interface ProductKeywordRule {
  id: string;
  keyword: string; // e.g., "Mattress Topper", "Duvet Cover", "Fitted Sheet", "Tog"
  aliases: string[]; // e.g., ["Topper", "Overfilled Topper"]
  regex_pattern?: string | undefined; // Optional custom regex pattern matching against Product Titles
  target_product_id?: string | undefined;
  notes?: string | undefined;
  created_at: string;
  updated_at: string;
}

export interface SizeKeywordRule {
  id: string;
  canonical_size: string; // e.g., "Single", "Double", "King", "Super King", "4ft", "3ft"
  synonyms: string[]; // Variation keywords e.g., ["3ft", "single", "twin", "90x190"]
  sku_patterns?: string[] | undefined; // SKU text codes e.g., ["SNG", "3FT", "TOP-SNG"]
  regex_pattern?: string | undefined; // Optional custom regex pattern matching against Variation / SKU
  notes?: string | undefined;
  created_at: string;
  updated_at: string;
}

export interface KeywordMapping {
  id: string;
  product_keyword: string;
  size_keyword: string;
  product_id: string;
  product_name: string;
  variant_id?: string | undefined;
  variant_name?: string | undefined;
  sku?: string | undefined;
  notes?: string | undefined;
  created_at: string;
  updated_at: string;
}

export interface DraftPickingItem {
  id: string;
  order_id?: string | undefined;
  raw_title: string;
  raw_title_clean?: string | undefined; // Isolated Product Name / Title column text
  raw_variation?: string | undefined; // Isolated Variation / Color-Size column text
  detected_product_name: string; // Extracted strictly from Title column
  detected_size: string; // Extracted strictly from Variation / Seller SKU column
  quantity: number; // Extracted strictly from Qty column
  unit_price: number;
  sku?: string | undefined;
  status: "matched" | "unmatched" | "manual";
  product_id?: string | undefined;
  product_name?: string | undefined;
  variant_id?: string | undefined;
  variant_name?: string | undefined;
  category?: string | undefined;
  available_stock?: number | undefined;
  notes?: string | undefined;
  selected?: boolean | undefined;
}

export interface AggregatedPickingItem {
  id: string;
  size: string;
  canonical_size: string;
  color?: string | undefined;
  total_quantity: number;
  raw_count: number;
  source_order_ids: string[];
  raw_titles: string[];
  sku?: string | undefined;
  status: "matched" | "unmatched" | "manual";
  product_id?: string | undefined;
  product_name?: string | undefined;
  variant_id?: string | undefined;
  variant_name?: string | undefined;
  category?: string | undefined;
  unit_price?: number | undefined;
  available_stock?: number | undefined;
  notes?: string | undefined;
  selected?: boolean | undefined;
}

export interface ProductGroupSummary {
  id: string;
  group_name: string;
  product_keyword: string;
  category?: string | undefined;
  total_quantity: number;
  total_sizes: number;
  matched_count: number;
  unmatched_count: number;
  sizes: AggregatedPickingItem[];
}

export interface PickingListBatch {
  id: string;
  filename: string;
  uploaded_at: string;
  total_items: number;
  matched_items: number;
  unmatched_items: number;
  total_quantity: number;
  status: "draft" | "submitted" | "cancelled";
  items: DraftPickingItem[];
}
