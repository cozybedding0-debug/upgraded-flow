import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import type {
  Product,
  ProductKeywordRule,
  SizeKeywordRule,
  KeywordMapping,
  PickingListBatch,
  DraftPickingItem,
} from "@/types";

const PRODUCT_RULES_KEY = "nukeflow_tiktok_product_rules";
const SIZE_RULES_KEY = "nukeflow_tiktok_size_rules";
const MAPPINGS_KEY = "nukeflow_tiktok_mappings";
const BATCHES_KEY = "nukeflow_tiktok_batches";

// Default pre-seeded rules based on Cozy Bedding / NukeFlow inventory
export const DEFAULT_PRODUCT_RULES: ProductKeywordRule[] = [
  {
    id: "prule-1",
    keyword: "Mattress Topper",
    aliases: [
      "Topper",
      "Bed Topper",
      "10cm Topper",
      "7.5cm Topper",
      "Memory Foam Topper",
      "Extra Thick Topper",
    ],
    notes: "Matches hotel quality and extra thick mattress toppers",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "prule-2",
    keyword: "Duvet Cover",
    aliases: ["Duvet Set", "Quilt Cover", "Bedding Set", "Cover Set", "Quilt Set"],
    notes: "Matches duvet covers and quilt bedding sets",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "prule-3",
    keyword: "Fitted Sheet",
    aliases: [
      "Bottom Sheet",
      "Deep Fitted Sheet",
      "Bed Sheet",
      "Elastic Sheet",
      "Fitted Mattress Sheet",
    ],
    notes: "Matches deep and standard fitted bed sheets",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "prule-4",
    keyword: "Flat Sheet",
    aliases: ["Top Sheet", "Plain Flat Sheet"],
    notes: "Matches traditional flat sheets",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "prule-5",
    keyword: "Duvet",
    aliases: [
      "Quilt",
      "Winter Duvet",
      "Summer Duvet",
      "10.5 Tog",
      "13.5 Tog",
      "15 Tog",
      "4.5 Tog",
      "Tog",
    ],
    notes: "Matches duvets and tog rated quilts",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "prule-6",
    keyword: "Pillow",
    aliases: [
      "Pillows",
      "Bounce Back Pillow",
      "Hotel Pillow",
      "Memory Foam Pillow",
      "Stripe Pillow",
    ],
    notes: "Matches individual and multi-pack sleeping pillows",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "prule-7",
    keyword: "Pillowcase",
    aliases: [
      "Pillow Case",
      "Pillowcases",
      "Pillow Covers",
      "Housewife Pillowcase",
      "Oxford Pillowcase",
    ],
    notes: "Matches pillowcases and pillow protectors",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "prule-8",
    keyword: "Mattress Protector",
    aliases: ["Bed Protector", "Waterproof Protector", "Quilted Protector", "Mattress Cover"],
    notes: "Matches quilted and waterproof mattress protectors",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

export const DEFAULT_SIZE_RULES: SizeKeywordRule[] = [
  {
    id: "srule-1",
    canonical_size: "Single",
    synonyms: ["3ft", "single", "twin", "90x190", "90 x 190", "3'0", "3'0\"", "single 3ft"],
    notes: "Standard UK single (90 x 190 cm / 3ft)",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "srule-2",
    canonical_size: "Small Double",
    synonyms: [
      "4ft",
      "small double",
      "three quarter",
      "120x190",
      "120 x 190",
      "4'0",
      "4'0\"",
      "queen small",
      "4ft small double",
    ],
    notes: "UK Small Double / Three-Quarter (120 x 190 cm / 4ft)",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "srule-3",
    canonical_size: "Double",
    synonyms: [
      "4ft6",
      "4ft 6",
      "double",
      "full",
      "135x190",
      "135 x 190",
      "4'6",
      "4'6\"",
      "double 4ft6",
      "std double",
    ],
    notes: "Standard UK Double (135 x 190 cm / 4ft 6in)",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "srule-4",
    canonical_size: "King",
    synonyms: ["5ft", "king", "king size", "150x200", "150 x 200", "5'0", "5'0\"", "king 5ft"],
    notes: "Standard UK King Size (150 x 200 cm / 5ft)",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "srule-5",
    canonical_size: "Super King",
    synonyms: [
      "6ft",
      "super king",
      "superking",
      "180x200",
      "180 x 200",
      "6'0",
      "6'0\"",
      "super king 6ft",
    ],
    notes: "UK Super King Size (180 x 200 cm / 6ft)",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "srule-6",
    canonical_size: "Pair (Pack of 2)",
    synonyms: ["pair", "2 pack", "pack of 2", "2 pcs", "2-pack", "twin pack"],
    notes: "Applicable to pillows, pillowcases, accessories",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "srule-7",
    canonical_size: "Pack of 4",
    synonyms: ["4 pack", "pack of 4", "4 pcs", "4-pack"],
    notes: "Applicable to pillow multi-packs",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

// In-memory caches
let productRulesCache: ProductKeywordRule[] | null = null;
let sizeRulesCache: SizeKeywordRule[] | null = null;
let mappingsCache: KeywordMapping[] | null = null;
let batchesCache: PickingListBatch[] | null = null;

function readStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeStorage<T>(key: string, value: T) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // quota safety
  }
}

// ================= PRODUCT KEYWORD RULES =================

export function getProductKeywordRules(): ProductKeywordRule[] {
  if (productRulesCache === null) {
    productRulesCache = readStorage(PRODUCT_RULES_KEY, DEFAULT_PRODUCT_RULES);
  }
  return productRulesCache;
}

export function saveProductKeywordRule(
  rule: Partial<ProductKeywordRule> & { keyword: string },
): ProductKeywordRule {
  const current = getProductKeywordRules();
  const now = new Date().toISOString();
  let updatedRule: ProductKeywordRule;

  if (rule.id) {
    updatedRule = {
      id: rule.id,
      keyword: rule.keyword.trim(),
      aliases: rule.aliases || [],
      target_product_id: rule.target_product_id,
      notes: rule.notes || "",
      created_at: rule.created_at || now,
      updated_at: now,
    };
    const next = current.map((r) => (r.id === rule.id ? updatedRule : r));
    productRulesCache = next;
    writeStorage(PRODUCT_RULES_KEY, next);
  } else {
    updatedRule = {
      id: `prule-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      keyword: rule.keyword.trim(),
      aliases: rule.aliases || [],
      target_product_id: rule.target_product_id,
      notes: rule.notes || "",
      created_at: now,
      updated_at: now,
    };
    const next = [updatedRule, ...current];
    productRulesCache = next;
    writeStorage(PRODUCT_RULES_KEY, next);
  }

  // Attempt async sync to Supabase if table exists
  if (isSupabaseConfigured) {
    void supabase
      .from("tiktok_product_keyword_rules")
      .upsert(updatedRule)
      .then(({ error }) => {
        if (error)
          console.info("Supabase sync info (tiktok_product_keyword_rules):", error.message);
      });
  }

  return updatedRule;
}

export function deleteProductKeywordRule(id: string) {
  const current = getProductKeywordRules();
  const next = current.filter((r) => r.id !== id);
  productRulesCache = next;
  writeStorage(PRODUCT_RULES_KEY, next);

  if (isSupabaseConfigured) {
    void supabase
      .from("tiktok_product_keyword_rules")
      .delete()
      .eq("id", id)
      .then(() => {});
  }
}

// ================= SIZE KEYWORD RULES =================

export function getSizeKeywordRules(): SizeKeywordRule[] {
  if (sizeRulesCache === null) {
    sizeRulesCache = readStorage(SIZE_RULES_KEY, DEFAULT_SIZE_RULES);
  }
  return sizeRulesCache;
}

export function saveSizeKeywordRule(
  rule: Partial<SizeKeywordRule> & { canonical_size: string },
): SizeKeywordRule {
  const current = getSizeKeywordRules();
  const now = new Date().toISOString();
  let updatedRule: SizeKeywordRule;

  if (rule.id) {
    updatedRule = {
      id: rule.id,
      canonical_size: rule.canonical_size.trim(),
      synonyms: rule.synonyms || [],
      notes: rule.notes || "",
      created_at: rule.created_at || now,
      updated_at: now,
    };
    const next = current.map((r) => (r.id === rule.id ? updatedRule : r));
    sizeRulesCache = next;
    writeStorage(SIZE_RULES_KEY, next);
  } else {
    updatedRule = {
      id: `srule-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      canonical_size: rule.canonical_size.trim(),
      synonyms: rule.synonyms || [],
      notes: rule.notes || "",
      created_at: now,
      updated_at: now,
    };
    const next = [updatedRule, ...current];
    sizeRulesCache = next;
    writeStorage(SIZE_RULES_KEY, next);
  }

  if (isSupabaseConfigured) {
    void supabase
      .from("tiktok_size_keyword_rules")
      .upsert(updatedRule)
      .then(({ error }) => {
        if (error) console.info("Supabase sync info (tiktok_size_keyword_rules):", error.message);
      });
  }

  return updatedRule;
}

export function deleteSizeKeywordRule(id: string) {
  const current = getSizeKeywordRules();
  const next = current.filter((r) => r.id !== id);
  sizeRulesCache = next;
  writeStorage(SIZE_RULES_KEY, next);

  if (isSupabaseConfigured) {
    void supabase
      .from("tiktok_size_keyword_rules")
      .delete()
      .eq("id", id)
      .then(() => {});
  }
}

// ================= KEYWORD MAPPINGS (Product Keyword + Size -> SKU / Product & Variant) =================

export function getKeywordMappings(): KeywordMapping[] {
  if (mappingsCache === null) {
    mappingsCache = readStorage(MAPPINGS_KEY, []);
  }
  return mappingsCache;
}

export function saveKeywordMapping(
  mapping: Partial<KeywordMapping> & {
    product_keyword: string;
    size_keyword: string;
    product_id: string;
    product_name: string;
  },
): KeywordMapping {
  const current = getKeywordMappings();
  const now = new Date().toISOString();
  let updatedMapping: KeywordMapping;

  if (mapping.id) {
    updatedMapping = {
      id: mapping.id,
      product_keyword: mapping.product_keyword.trim(),
      size_keyword: mapping.size_keyword.trim(),
      product_id: mapping.product_id,
      product_name: mapping.product_name,
      variant_id: mapping.variant_id,
      variant_name: mapping.variant_name,
      sku: mapping.sku || "",
      notes: mapping.notes || "",
      created_at: mapping.created_at || now,
      updated_at: now,
    };
    const next = current.map((m) => (m.id === mapping.id ? updatedMapping : m));
    mappingsCache = next;
    writeStorage(MAPPINGS_KEY, next);
  } else {
    // Check if mapping for this product_keyword + size_keyword already exists
    const existingIndex = current.findIndex(
      (m) =>
        m.product_keyword.toLowerCase() === mapping.product_keyword.toLowerCase() &&
        m.size_keyword.toLowerCase() === mapping.size_keyword.toLowerCase(),
    );

    updatedMapping = {
      id:
        existingIndex >= 0
          ? current[existingIndex]!.id
          : `map-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      product_keyword: mapping.product_keyword.trim(),
      size_keyword: mapping.size_keyword.trim(),
      product_id: mapping.product_id,
      product_name: mapping.product_name,
      variant_id: mapping.variant_id,
      variant_name: mapping.variant_name,
      sku: mapping.sku || "",
      notes: mapping.notes || "",
      created_at: existingIndex >= 0 ? current[existingIndex]!.created_at : now,
      updated_at: now,
    };

    let next: KeywordMapping[];
    if (existingIndex >= 0) {
      next = current.map((m, i) => (i === existingIndex ? updatedMapping : m));
    } else {
      next = [updatedMapping, ...current];
    }
    mappingsCache = next;
    writeStorage(MAPPINGS_KEY, next);
  }

  if (isSupabaseConfigured) {
    void supabase
      .from("tiktok_keyword_mappings")
      .upsert(updatedMapping)
      .then(({ error }) => {
        if (error) console.info("Supabase sync info (tiktok_keyword_mappings):", error.message);
      });
  }

  return updatedMapping;
}

export function deleteKeywordMapping(id: string) {
  const current = getKeywordMappings();
  const next = current.filter((m) => m.id !== id);
  mappingsCache = next;
  writeStorage(MAPPINGS_KEY, next);

  if (isSupabaseConfigured) {
    void supabase
      .from("tiktok_keyword_mappings")
      .delete()
      .eq("id", id)
      .then(() => {});
  }
}

/**
 * Automatically scans available products and variants, and constructs
 * matching mappings for all discovered (Product Keyword + Size) pairs.
 */
export function autoGenerateMappingsFromProducts(products: Product[]): {
  createdCount: number;
  totalMappings: number;
} {
  const pRules = getProductKeywordRules();
  const sRules = getSizeKeywordRules();
  const existingMappings = getKeywordMappings();
  const newMappings: KeywordMapping[] = [...existingMappings];
  let createdCount = 0;

  for (const product of products) {
    // Find if product name matches any product keyword rule
    let matchedPRule = pRules.find((pr) =>
      product.product_name.toLowerCase().includes(pr.keyword.toLowerCase()),
    );
    if (!matchedPRule) {
      // Check aliases
      matchedPRule = pRules.find((pr) =>
        pr.aliases.some((alias) =>
          product.product_name.toLowerCase().includes(alias.toLowerCase()),
        ),
      );
    }
    // Also check category
    if (!matchedPRule && product.category) {
      matchedPRule = pRules.find(
        (pr) =>
          product.category.toLowerCase().includes(pr.keyword.toLowerCase()) ||
          pr.keyword.toLowerCase().includes(product.category.toLowerCase()),
      );
    }

    const pKeyword = matchedPRule ? matchedPRule.keyword : product.product_name;

    if (product.has_variants && product.variants && product.variants.length > 0) {
      for (const variant of product.variants) {
        const vSizeVal = variant.variation_value.trim();
        // Find matching size rule
        const matchedSRule = sRules.find(
          (sr) =>
            sr.canonical_size.toLowerCase() === vSizeVal.toLowerCase() ||
            sr.synonyms.some((syn) => vSizeVal.toLowerCase().includes(syn.toLowerCase())),
        );

        const sKeyword = matchedSRule ? matchedSRule.canonical_size : vSizeVal;

        // Check if already mapped
        const exists = newMappings.some(
          (m) =>
            m.product_keyword.toLowerCase() === pKeyword.toLowerCase() &&
            m.size_keyword.toLowerCase() === sKeyword.toLowerCase(),
        );

        if (!exists && sKeyword) {
          const mappingItem: KeywordMapping = {
            id: `map-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            product_keyword: pKeyword,
            size_keyword: sKeyword,
            product_id: product.id,
            product_name: product.product_name,
            variant_id: variant.id,
            variant_name: `${variant.variation_value}${variant.color ? ` - ${variant.color}` : ""}`,
            sku: variant.sku || product.sku || "",
            notes: "Auto-generated from inventory item",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          newMappings.push(mappingItem);
          createdCount++;
        }
      }
    } else {
      // Single product without variants
      const pSizeVal = product.size ? product.size.trim() : "Standard";
      const matchedSRule = sRules.find(
        (sr) =>
          sr.canonical_size.toLowerCase() === pSizeVal.toLowerCase() ||
          sr.synonyms.some((syn) => pSizeVal.toLowerCase().includes(syn.toLowerCase())),
      );
      const sKeyword = matchedSRule ? matchedSRule.canonical_size : pSizeVal;

      const exists = newMappings.some(
        (m) =>
          m.product_keyword.toLowerCase() === pKeyword.toLowerCase() &&
          m.size_keyword.toLowerCase() === sKeyword.toLowerCase(),
      );

      if (!exists) {
        const mappingItem: KeywordMapping = {
          id: `map-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          product_keyword: pKeyword,
          size_keyword: sKeyword,
          product_id: product.id,
          product_name: product.product_name,
          sku: product.sku || "",
          notes: "Auto-generated from inventory item",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        newMappings.push(mappingItem);
        createdCount++;
      }
    }
  }

  mappingsCache = newMappings;
  writeStorage(MAPPINGS_KEY, newMappings);
  return { createdCount, totalMappings: newMappings.length };
}

// ================= PARSED BATCHES HISTORY =================

export function getPickingBatches(): PickingListBatch[] {
  if (batchesCache === null) {
    batchesCache = readStorage(BATCHES_KEY, []);
  }
  return batchesCache;
}

export function savePickingBatch(batch: PickingListBatch): PickingListBatch {
  const current = getPickingBatches();
  const next = [batch, ...current.filter((b) => b.id !== batch.id)];
  batchesCache = next;
  writeStorage(BATCHES_KEY, next);
  return batch;
}

export function deletePickingBatch(id: string) {
  const current = getPickingBatches();
  const next = current.filter((b) => b.id !== id);
  batchesCache = next;
  writeStorage(BATCHES_KEY, next);
}

// ================= SQL SCHEMA GENERATOR =================

export function getSupabaseSqlSchema(): string {
  return `-- ==========================================
-- Supabase Schema for TikTok Shop PDF Parser
-- ==========================================

CREATE TABLE IF NOT EXISTS public.tiktok_product_keyword_rules (
  id TEXT PRIMARY KEY,
  keyword TEXT NOT NULL,
  aliases TEXT[] DEFAULT '{}',
  target_product_id TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.tiktok_size_keyword_rules (
  id TEXT PRIMARY KEY,
  canonical_size TEXT NOT NULL,
  synonyms TEXT[] DEFAULT '{}',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.tiktok_keyword_mappings (
  id TEXT PRIMARY KEY,
  product_keyword TEXT NOT NULL,
  size_keyword TEXT NOT NULL,
  product_id TEXT NOT NULL,
  product_name TEXT NOT NULL,
  variant_id TEXT,
  variant_name TEXT,
  sku TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.tiktok_picking_batches (
  id TEXT PRIMARY KEY,
  filename TEXT NOT NULL,
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  total_items INT DEFAULT 0,
  matched_items INT DEFAULT 0,
  unmatched_items INT DEFAULT 0,
  total_quantity INT DEFAULT 0,
  status TEXT DEFAULT 'draft',
  items JSONB DEFAULT '[]'::jsonb
);

-- Enable RLS & Allow authenticated access
ALTER TABLE public.tiktok_product_keyword_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tiktok_size_keyword_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tiktok_keyword_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tiktok_picking_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to authenticated users" ON public.tiktok_product_keyword_rules FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to authenticated users" ON public.tiktok_size_keyword_rules FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to authenticated users" ON public.tiktok_keyword_mappings FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to authenticated users" ON public.tiktok_picking_batches FOR ALL TO authenticated USING (true) WITH CHECK (true);
`;
}
