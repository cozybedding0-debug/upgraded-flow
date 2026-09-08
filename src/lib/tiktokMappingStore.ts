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
      "Overfilled Bed Mattress Topper",
    ],
    regex_pattern: "Mattress.*Topper|MattressTopper",
    notes: "Matches hotel quality, memory foam, and extra thick mattress toppers",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "prule-satin-stripe",
    keyword: "Satin Stripe Duvet Cover",
    aliases: [
      "Hotel Stripe Duvet Cover",
      "Satin Stripe Quilt Set",
      "Stripe Bedding Set",
      "Satin Stripe Duvet",
      "200TC Satin Stripe",
    ],
    regex_pattern: "Satin.*Stripe.*Duvet.*Cover|StripeDuvet",
    notes: "Strictly isolates satin stripe duvet cover sets from plain duvet covers",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "prule-2",
    keyword: "Duvet Cover",
    aliases: ["Duvet Set", "Quilt Cover", "Bedding Set", "Cover Set", "Quilt Set"],
    regex_pattern: "\\b(?:duvet\\s+cover|quilt\\s+cover|duvet\\s+set|quilt\\s+set)\\b",
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
    regex_pattern: "Fitted.*Sheet|DeepFit",
    notes: "Matches deep and standard fitted bed sheets",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "prule-4",
    keyword: "Flat Sheet",
    aliases: ["Top Sheet", "Plain Flat Sheet"],
    regex_pattern: "\\b(?:flat\\s+sheet|top\\s+sheet)\\b",
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
    regex_pattern:
      "\\b(?:winter\\s+duvet|summer\\s+duvet|\\d+(?:\\.\\d+)?\\s*tog|tog\\s+duvet|duvet|quilt)\\b",
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
    regex_pattern:
      "\\b(?:bounce\\s+back\\s+pillow|hotel\\s+pillow|memory\\s+foam\\s+pillow|pillows?)\\b",
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
    regex_pattern: "\\b(?:pillowcases?|pillow\\s+cases?|pillow\\s+covers?)\\b",
    notes: "Matches pillowcases and pillow protectors",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "prule-8",
    keyword: "Mattress Protector",
    aliases: ["Bed Protector", "Waterproof Protector", "Quilted Protector", "Mattress Cover"],
    regex_pattern:
      "\\b(?:mattress\\s+protector|bed\\s+protector|waterproof\\s+protector|quilted\\s+protector)\\b",
    notes: "Matches quilted and waterproof mattress protectors",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

export const DEFAULT_SIZE_RULES: SizeKeywordRule[] = [
  {
    id: "srule-superking",
    canonical_size: "Super King",
    synonyms: ["Super King", "SK", "6ft", "Superking", "180x200", "6'0", "6'0\""],
    sku_patterns: ["SK", "SUPERKING", "6FT", "TOP-SK", "DUV-SK", "SUPER-KING"],
    regex_pattern: "\\b(?:super\\s*king|superking|sk|6ft)\\b",
    notes: "Super King size matching (SK, 6ft, Superking)",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "srule-smalldouble",
    canonical_size: "Small Double (4ft)",
    synonyms: ["Small Double", "Sm Dbl", "4ft", "4 ft", "Three Quarter", "120x190", "4'0"],
    sku_patterns: ["4FT", "SM-DBL", "S-DBL", "TOP-4FT", "SHT-4FT"],
    regex_pattern: "\\b(?:small\\s*double|sm\\s*dbl|4\\s*ft|4ft)\\b",
    notes: "Small Double 4ft size matching (4FT, Sm Dbl)",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "srule-double",
    canonical_size: "Double",
    synonyms: ["Double", "Dbl", "4ft6in", "4ft6", "4ft 6", "135x190", "4'6", "full"],
    sku_patterns: ["DBL", "4FT6", "DOUBLE", "TOP-DBL", "DUV-DBL"],
    regex_pattern: "\\b(?:double|dbl|4ft6in|4ft6|4ft\\s*6|full)\\b",
    notes: "Standard UK Double matching (Dbl, 4ft6in)",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "srule-king",
    canonical_size: "King",
    synonyms: ["King", "K", "5ft", "150x200", "5'0", "King Size"],
    sku_patterns: ["KNG", "5FT", "KING", "TOP-KNG", "DUV-KNG"],
    regex_pattern: "\\b(?:king(?:\\s*size)?|5ft)\\b",
    notes: "Standard UK King matching (K, 5ft)",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "srule-single",
    canonical_size: "Single",
    synonyms: ["Single", "Sgl", "3ft", "Twin", "90x190", "3'0"],
    sku_patterns: ["SNG", "SINGLE", "3FT", "TOP-SNG", "DUV-SNG"],
    regex_pattern: "\\b(?:single|sgl|3ft)\\b",
    notes: "Standard UK Single matching (Sgl, 3ft)",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "srule-6",
    canonical_size: "Pair (Pack of 2)",
    synonyms: ["pair", "2 pack", "pack of 2", "2 pcs", "2-pack", "twin pack"],
    sku_patterns: ["PAIR", "2PK", "PLW-PAIR", "2PACK"],
    regex_pattern: "\\b(?:pair|2\\s*pack|pack\\s*of\\s*2|2\\s*pcs|twin\\s*pack)\\b",
    notes: "Applicable to pillows, pillowcases, accessories",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "srule-7",
    canonical_size: "Pack of 4",
    synonyms: ["4 pack", "pack of 4", "4 pcs", "4-pack"],
    sku_patterns: ["4PK", "PLW-4PK", "4PACK"],
    regex_pattern: "\\b(?:4\\s*pack|pack\\s*of\\s*4|4\\s*pcs)\\b",
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
    const stored = readStorage<ProductKeywordRule[]>(PRODUCT_RULES_KEY, []);
    if (!stored || stored.length === 0) {
      productRulesCache = DEFAULT_PRODUCT_RULES;
      writeStorage(PRODUCT_RULES_KEY, DEFAULT_PRODUCT_RULES);
    } else {
      const storedKeys = new Set(stored.map((r) => r.keyword.toLowerCase()));
      const missing = DEFAULT_PRODUCT_RULES.filter((d) => !storedKeys.has(d.keyword.toLowerCase()));
      productRulesCache = missing.length > 0 ? [...stored, ...missing] : stored;
    }
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
      keyword: (rule.keyword || "").trim(),
      aliases: rule.aliases || [],
      regex_pattern: rule.regex_pattern?.trim() || undefined,
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
      keyword: (rule.keyword || "").trim(),
      aliases: rule.aliases || [],
      regex_pattern: rule.regex_pattern?.trim() || undefined,
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

/**
 * Priority rank for strict size keyword matching:
 * 1. Super King / Superking / SK / 6ft
 * 2. Small Double / 4FT / 4 ft / Sm Dbl
 * 3. Double / Dbl / 4ft6in
 * 4. King / K / 5ft
 * 5. Single / Sgl / 3ft
 */
export function getSizePriorityRank(canonical: string): number {
  const low = (canonical || "").toLowerCase().trim();
  if (low.includes("super king") || low.includes("superking") || low === "sk" || low === "6ft") return 1;
  if (low.includes("small double") || low.includes("sm dbl") || low.includes("4ft") || low.includes("4 ft")) return 2;
  if ((low.includes("double") || low.includes("dbl") || low.includes("4ft6")) && !low.includes("small")) return 3;
  if ((low.includes("king") || low === "5ft") && !low.includes("super")) return 4;
  if (low.includes("single") || low.includes("sgl") || low === "3ft") return 5;
  return 10;
}

export function getSizeKeywordRules(): SizeKeywordRule[] {
  if (sizeRulesCache === null) {
    const raw = readStorage<SizeKeywordRule[]>(SIZE_RULES_KEY, []);
    let rules: SizeKeywordRule[];

    if (!raw || raw.length === 0) {
      rules = DEFAULT_SIZE_RULES;
      writeStorage(SIZE_RULES_KEY, DEFAULT_SIZE_RULES);
    } else {
      // Migrate "Small Double" to "Small Double (4ft)" and ensure seed rules exist
      const migrated = raw.map((r) => {
        if (r.canonical_size === "Small Double") {
          return {
            ...r,
            canonical_size: "Small Double (4ft)",
            synonyms: Array.from(new Set([...(r.synonyms || []), "Small Double", "Sm Dbl", "4ft", "4 ft"])),
          };
        }
        return r;
      });

      const existingNames = new Set(migrated.map((r) => r.canonical_size.toLowerCase()));
      const missingDefaults = DEFAULT_SIZE_RULES.filter((d) => !existingNames.has(d.canonical_size.toLowerCase()));
      rules = missingDefaults.length > 0 ? [...migrated, ...missingDefaults] : migrated;
    }

    // Always sort by strict priority order: Super King -> Small Double (4ft) -> Double -> King -> Single
    sizeRulesCache = [...rules].sort((a, b) => {
      const rankA = getSizePriorityRank(a.canonical_size);
      const rankB = getSizePriorityRank(b.canonical_size);
      if (rankA !== rankB) return rankA - rankB;
      return a.canonical_size.localeCompare(b.canonical_size);
    });
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
      canonical_size: (rule.canonical_size || "").trim(),
      synonyms: rule.synonyms || [],
      sku_patterns: rule.sku_patterns || [],
      regex_pattern: rule.regex_pattern?.trim() || undefined,
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
      canonical_size: (rule.canonical_size || "").trim(),
      synonyms: rule.synonyms || [],
      sku_patterns: rule.sku_patterns || [],
      regex_pattern: rule.regex_pattern?.trim() || undefined,
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
      product_keyword: (mapping.product_keyword || "").trim(),
      size_keyword: (mapping.size_keyword || "").trim(),
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
        (m.product_keyword || "").toLowerCase() ===
          (mapping.product_keyword || "").toLowerCase().trim() &&
        (m.size_keyword || "").toLowerCase() === (mapping.size_keyword || "").toLowerCase().trim(),
    );

    updatedMapping = {
      id:
        existingIndex >= 0
          ? current[existingIndex]!.id
          : `map-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      product_keyword: (mapping.product_keyword || "").trim(),
      size_keyword: (mapping.size_keyword || "").trim(),
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
