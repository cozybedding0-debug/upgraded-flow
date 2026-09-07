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
  color?: string; // NEW: Color field added
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
  variants?: ProductVariant[];
  created_at: string;
  updated_at: string;
}

export type OrderStatus = "Pending" | "Completed" | "Shipped";

export interface DailyOrder {
  id: string;
  product_id: string | null;
  variant_id: string | null;
  product_name: string;
  category: Category;
  size: string;
  color?: string; // NEW: Color field added for daily orders
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
  target_product_id?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface SizeKeywordRule {
  id: string;
  canonical_size: string; // e.g., "Single", "Double", "King", "Super King", "4ft", "3ft"
  synonyms: string[]; // e.g., ["3ft", "single", "twin", "90x190"]
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface KeywordMapping {
  id: string;
  product_keyword: string;
  size_keyword: string;
  product_id: string;
  product_name: string;
  variant_id?: string;
  variant_name?: string;
  sku?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface DraftPickingItem {
  id: string;
  order_id?: string;
  raw_title: string;
  detected_product_name: string;
  detected_size: string;
  quantity: number;
  unit_price: number;
  sku?: string;
  status: "matched" | "unmatched" | "manual";
  product_id?: string;
  product_name?: string;
  variant_id?: string;
  variant_name?: string;
  category?: string;
  available_stock?: number;
  notes?: string;
  selected?: boolean;
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

export interface CategoryKeywordRule {
  id: string;
  category_name: string;
  pattern: string; // Regex or text pattern, e.g. "Mattress.*Topper|MattressTopper"
  created_at: string;
  updated_at: string;
}

export interface TargetSizeRule {
  id: string;
  normalized_size: string; // e.g. "Single", "Small Double (4ft)", "Double", "King", "Super King"
  variations: string[]; // e.g. ["Small Double", "Sm Dbl", "4ft", "4 ft"]
  priority: number; // 1 to 5 (1 = highest priority)
  created_at: string;
  updated_at: string;
}

export interface AggregatedSizeRow {
  id: string;
  size: string;
  quantity: number;
  raw_samples?: string[];
}

export interface AggregatedCategoryCard {
  category_name: string;
  total_quantity: number;
  sizes: AggregatedSizeRow[];
}

export interface ReviewDashboardData {
  filename: string;
  uploaded_at: string;
  categories: AggregatedCategoryCard[];
  total_units: number;
  total_lines: number;
  raw_items_count: number;
}
