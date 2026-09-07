import * as pdfjsLib from "pdfjs-dist";
import type {
  Product,
  DraftPickingItem,
  ProductKeywordRule,
  SizeKeywordRule,
  KeywordMapping,
} from "@/types";
import {
  getProductKeywordRules,
  getSizeKeywordRules,
  getKeywordMappings,
} from "@/lib/tiktokMappingStore";

// Configure pdfjs worker
if (typeof window !== "undefined") {
  try {
    // Use unpkg/cdnjs worker fallback for reliable cross-browser execution in sandboxes
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version || "4.10.38"}/pdf.worker.min.mjs`;
  } catch {
    // worker fallback
  }
}

/**
 * Extracts all raw text from a PDF file buffer or File object
 */
export async function extractTextFromPdf(file: File | ArrayBuffer): Promise<string> {
  const arrayBuffer = file instanceof File ? await file.arrayBuffer() : file;
  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(arrayBuffer),
    isEvalSupported: false,
    useSystemFonts: true,
  });

  const pdf = await loadingTask.promise;
  const pageTexts: string[] = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();

    // Group text items with line break heuristics
    let lastY: number | null = null;
    let pageStr = "";

    for (const item of content.items) {
      if ("str" in item) {
        const textItem = item as { str: string; transform: number[] };
        const currentY = textItem.transform[5];

        if (lastY !== null && Math.abs((currentY ?? 0) - lastY) > 8) {
          pageStr += "\n";
        } else if (pageStr.length > 0 && !pageStr.endsWith(" ") && !pageStr.endsWith("\n")) {
          pageStr += " ";
        }

        pageStr += textItem.str;
        lastY = currentY ?? null;
      }
    }

    pageTexts.push(pageStr);
  }

  return pageTexts.join("\n--- PAGE BREAK ---\n");
}

export interface ParseResult {
  items: DraftPickingItem[];
  rawText: string;
  totalParsed: number;
  matchedCount: number;
  unmatchedCount: number;
}

/**
 * Searches text for TikTok order ID patterns
 */
function findOrderId(text: string): string | undefined {
  // TikTok Shop order IDs are typically 15-20 numeric digits (e.g. 5789238491029384)
  const numericMatch = text.match(/\b(57\d{13,17})\b/);
  if (numericMatch && numericMatch[1]) return numericMatch[1];

  const prefixMatch = text.match(
    /(?:Order\s*(?:ID|#|No\.?)|Package\s*(?:ID|#)|Order\s*Number)\s*[:#-]?\s*([A-Za-z0-9_-]{8,30})/i,
  );
  if (prefixMatch && prefixMatch[1]) return prefixMatch[1].trim();

  return undefined;
}

/**
 * Searches text for quantity tokens
 */
function findQuantity(text: string): number {
  // Look for "Qty: 2", "Quantity: 2", "x2", "2 PCS", or table column " 2   SKU-CODE"
  const qtyPatterns = [
    /(?:Qty|Quantity|Pieces|Count)\s*[:=x]?\s*(\d+)\b/i,
    /\b[xX]\s*(\d+)\b/,
    /\b(\d+)\s*(?:pcs|pc|pk|units?|items?)\b/i,
    /\b(?:Qty|Quantity)\s*(\d+)\b/i,
    /\s+(\d{1,3})\s+[A-Z0-9_-]{3,20}(?:\s*\||\s*$)/,
    /\s+(\d{1,3})\s*$/,
  ];

  for (const pattern of qtyPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const q = parseInt(match[1], 10);
      if (q > 0 && q < 5000) return q;
    }
  }

  return 1; // standard default
}

/**
 * Searches text for SKU codes
 */
function findSku(text: string): string | undefined {
  const explicitMatch = text.match(/(?:SKU|Item Code|Barcode)\s*[:#-]?\s*([A-Za-z0-9_-]{3,25})/i);
  if (explicitMatch && explicitMatch[1]) return explicitMatch[1].trim();

  // Look for typical SKU patterns like TOP-DBL-10, SHT-4FT-WHT, DUV-SK-WHT
  const skuPattern = /\b([A-Z]{2,6}-[A-Z0-9]{2,6}-[A-Z0-9]{2,8}|[A-Z]{3,}-[A-Z0-9]{2,8})\b/;
  const match = text.match(skuPattern);
  if (match && match[1]) return match[1].trim();

  return undefined;
}

/**
 * Detects the best matching product keyword rule
 */
function detectProductKeyword(
  text: string,
  rules: ProductKeywordRule[],
): { keyword: string; matchedRule?: ProductKeywordRule } {
  const lower = text.toLowerCase();

  // Sort rules so longer, more specific phrases match first (e.g. "Mattress Topper" before "Topper")
  const sortedRules = [...rules].sort((a, b) => b.keyword.length - a.keyword.length);

  for (const rule of sortedRules) {
    // Check main keyword
    const keyLower = rule.keyword.toLowerCase();
    if (lower.includes(keyLower)) {
      return { keyword: rule.keyword, matchedRule: rule };
    }

    // Check aliases
    for (const alias of rule.aliases) {
      if (alias.trim() && lower.includes(alias.toLowerCase().trim())) {
        return { keyword: rule.keyword, matchedRule: rule };
      }
    }
  }

  // Fallback keyword detection for common bedding keywords if not explicitly in rules
  const commonFallbacks = [
    "Mattress Topper",
    "Duvet Cover",
    "Fitted Sheet",
    "Flat Sheet",
    "Duvet",
    "Pillowcase",
    "Pillow",
    "Protector",
    "Bedding",
  ];

  for (const fb of commonFallbacks) {
    if (lower.includes(fb.toLowerCase())) {
      return { keyword: fb };
    }
  }

  // Extract first 4-5 words as fallback product title
  const words = text.split(/\s+/).filter(Boolean);
  const guessed = words.slice(0, 4).join(" ");
  return { keyword: guessed || "Unknown Product" };
}

/**
 * Detects the best matching size keyword rule
 */
function detectSizeKeyword(
  text: string,
  rules: SizeKeywordRule[],
): { size: string; matchedRule?: SizeKeywordRule } {
  const lower = ` ${text.toLowerCase()} `;

  // Sort so more specific sizes match first (e.g. "Super King" before "King", "Small Double" or "4ft" before "Double")
  const sortedRules = [...rules].sort((a, b) => {
    if (a.canonical_size.includes("Super") && !b.canonical_size.includes("Super")) return -1;
    if (b.canonical_size.includes("Super") && !a.canonical_size.includes("Super")) return 1;
    if (a.canonical_size.includes("Small") && !b.canonical_size.includes("Small")) return -1;
    if (b.canonical_size.includes("Small") && !a.canonical_size.includes("Small")) return 1;
    return b.canonical_size.length - a.canonical_size.length;
  });

  for (const rule of sortedRules) {
    // Check canonical size
    const canonLower = rule.canonical_size.toLowerCase();
    if (lower.includes(` ${canonLower} `) || lower.includes(canonLower)) {
      return { size: rule.canonical_size, matchedRule: rule };
    }

    // Check synonyms
    for (const syn of rule.synonyms) {
      const synLower = syn.toLowerCase().trim();
      if (!synLower) continue;

      // Exact word boundary match for short codes like "3ft", "4ft", "5ft", "6ft", "4ft6"
      if (/^\dft\d?$/i.test(synLower) || synLower.length <= 4) {
        const regex = new RegExp(`(?:\\b|[^a-z0-9])${synLower}(?:\\b|[^a-z0-9])`, "i");
        if (regex.test(text)) {
          return { size: rule.canonical_size, matchedRule: rule };
        }
      } else if (lower.includes(synLower)) {
        return { size: rule.canonical_size, matchedRule: rule };
      }
    }
  }

  // Fallback regex search for UK bed sizes
  if (/\b(?:super\s*king|6ft|6'0)\b/i.test(text)) return { size: "Super King" };
  if (/\b(?:small\s*double|4ft|4'0|three\s*quarter)\b/i.test(text)) return { size: "Small Double" };
  if (/\b(?:king(?:\s*size)?|5ft|5'0)\b/i.test(text)) return { size: "King" };
  if (/\b(?:double|4ft6|4'6|full)\b/i.test(text)) return { size: "Double" };
  if (/\b(?:single|3ft|3'0|twin)\b/i.test(text)) return { size: "Single" };

  return { size: "Standard" };
}

/**
 * Searches inventory to find a matching product and variant for detected keywords
 */
function findInventoryMatch(
  detectedProduct: string,
  detectedSize: string,
  mappings: KeywordMapping[],
  products: Product[],
): {
  productId?: string;
  variantId?: string;
  productName?: string;
  variantName?: string;
  unitPrice?: number;
  sku?: string;
  availableStock?: number;
  category?: string;
  isMatched: boolean;
} {
  const pLower = detectedProduct.toLowerCase();
  const sLower = detectedSize.toLowerCase();

  // 1. Direct Keyword Mapping Lookup (HIGHEST PRIORITY)
  const directMap = mappings.find(
    (m) => m.product_keyword.toLowerCase() === pLower && m.size_keyword.toLowerCase() === sLower,
  );

  if (directMap) {
    const product = products.find((p) => p.id === directMap.product_id);
    if (product) {
      if (directMap.variant_id && product.variants?.length) {
        const variant = product.variants.find((v) => v.id === directMap.variant_id);
        if (variant) {
          return {
            productId: product.id,
            variantId: variant.id,
            productName: product.product_name,
            variantName: `${variant.variation_value}${variant.color ? ` - ${variant.color}` : ""}`,
            unitPrice: variant.unit_price || product.unit_price,
            sku: variant.sku || directMap.sku || product.sku,
            availableStock: variant.stock_quantity,
            category: product.category,
            isMatched: true,
          };
        }
      }

      return {
        productId: product.id,
        variantId: undefined,
        productName: product.product_name,
        variantName: product.size || detectedSize,
        unitPrice: product.unit_price,
        sku: directMap.sku || product.sku,
        availableStock: product.stock_quantity,
        category: product.category,
        isMatched: true,
      };
    }
  }

  // 2. Fuzzy Product & Variant Matching against existing inventory
  for (const product of products) {
    const prodNameLower = product.product_name.toLowerCase();
    const prodCatLower = (product.category || "").toLowerCase();

    const nameMatches =
      prodNameLower.includes(pLower) ||
      pLower.includes(prodNameLower) ||
      prodCatLower.includes(pLower) ||
      pLower.includes(prodCatLower);

    if (nameMatches) {
      // Check if product has variants matching detected size
      if (product.has_variants && product.variants && product.variants.length > 0) {
        const matchingVariant = product.variants.find((v) => {
          const vLower = v.variation_value.toLowerCase();
          return (
            vLower === sLower ||
            vLower.includes(sLower) ||
            sLower.includes(vLower) ||
            (sLower.includes("small double") &&
              (vLower.includes("4ft") || vLower.includes("small double"))) ||
            (sLower.includes("single") && (vLower.includes("3ft") || vLower.includes("single"))) ||
            (sLower.includes("double") &&
              !sLower.includes("small") &&
              (vLower.includes("4ft6") || vLower.includes("double"))) ||
            (sLower.includes("king") &&
              !sLower.includes("super") &&
              (vLower.includes("5ft") || vLower.includes("king"))) ||
            (sLower.includes("super king") &&
              (vLower.includes("6ft") || vLower.includes("super king")))
          );
        });

        if (matchingVariant) {
          return {
            productId: product.id,
            variantId: matchingVariant.id,
            productName: product.product_name,
            variantName: `${matchingVariant.variation_value}${matchingVariant.color ? ` - ${matchingVariant.color}` : ""}`,
            unitPrice: matchingVariant.unit_price || product.unit_price,
            sku: matchingVariant.sku || product.sku,
            availableStock: matchingVariant.stock_quantity,
            category: product.category,
            isMatched: true,
          };
        }
      } else {
        // Single product match
        return {
          productId: product.id,
          variantId: undefined,
          productName: product.product_name,
          variantName: product.size || detectedSize,
          unitPrice: product.unit_price,
          sku: product.sku,
          availableStock: product.stock_quantity,
          category: product.category,
          isMatched: true,
        };
      }
    }
  }

  return { isMatched: false };
}

/**
 * Core parsing engine: takes raw text lines or full document text,
 * applies dynamic keyword rules, maps items to inventory, and builds draft picking items.
 */
export function parsePickingListText(rawText: string, products: Product[]): ParseResult {
  const pRules = getProductKeywordRules();
  const sRules = getSizeKeywordRules();
  const mappings = getKeywordMappings();

  // Normalize lines and split into candidate item chunks
  const cleanLines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith("--- PAGE BREAK ---"));

  const candidateItems: {
    raw: string;
    orderId?: string;
  }[] = [];

  let currentOrderId: string | undefined = undefined;
  let buffer: string[] = [];

  const flushBuffer = () => {
    if (buffer.length === 0) return;
    const raw = buffer.join(" | ");
    const orderId = findOrderId(raw) || currentOrderId;
    candidateItems.push({ raw, orderId });
    buffer = [];
  };

  for (let i = 0; i < cleanLines.length; i++) {
    const line = cleanLines[i]!;

    // Skip headers, footers, and divider metadata
    if (
      /^(Picking List|Packing Slip|TikTok Shop|Seller Center|Print Date|Total Packages|Total Items|Total Units|Page \d+|Item No\.|Barcode|Merchant ID|Order Details|Recipient|Shipping|Warehouse|Carrier|Batch ID|Picked By|Checked By|No\.\s+Order)/i.test(
        line,
      ) ||
      /^[-=_]{3,}$/.test(line)
    ) {
      continue;
    }

    // Check if line contains an Order ID
    const foundOrder = findOrderId(line);
    if (foundOrder) {
      currentOrderId = foundOrder;
    }

    const isExplicitNewRow =
      /^\s*\d{1,4}\s+(?:57\d{13,17}|[A-Za-z0-9_-]{8,})/.test(line) ||
      /^(?:Order\s*(?:ID|#|No\.?)|Package\s*(?:ID|#))\s*[:#-]?/i.test(line);

    const isSubLine =
      /^(?:Variation|Colour|Color|Size|SKU|Qty|Quantity|Notes?|Spec|Details?)\s*[:=]/i.test(line);

    const hasBeddingKeyword = pRules.some(
      (r) =>
        line.toLowerCase().includes(r.keyword.toLowerCase()) ||
        r.aliases.some((a) => a && line.toLowerCase().includes(a.toLowerCase())),
    );

    if (isExplicitNewRow) {
      flushBuffer();
      buffer.push(line);
    } else if (isSubLine) {
      buffer.push(line);
    } else if (hasBeddingKeyword) {
      flushBuffer();
      buffer.push(line);
    } else if (buffer.length > 0 && buffer.length < 5) {
      buffer.push(line);
    } else if (line.length > 15 && /[a-zA-Z]/.test(line)) {
      flushBuffer();
      candidateItems.push({
        raw: line,
        orderId: currentOrderId,
      });
    }
  }

  // Flush remaining buffer
  flushBuffer();

  // If candidate items is empty (e.g. plain list of titles), treat non-empty lines as items
  const finalCandidates =
    candidateItems.length > 0
      ? candidateItems
      : cleanLines
          .filter((l) => l.length > 10 && !/^(page|print|tiktok|date)/i.test(l))
          .map((l) => ({ raw: l }));

  const items: DraftPickingItem[] = [];

  for (let idx = 0; idx < finalCandidates.length; idx++) {
    const candidate = finalCandidates[idx]!;
    const text = candidate.raw;

    const detectedP = detectProductKeyword(text, pRules);
    const detectedS = detectSizeKeyword(text, sRules);
    const qty = findQuantity(text);
    const orderId = candidate.orderId || findOrderId(text);
    const rawSku = findSku(text);

    // Look up inventory match
    const match = findInventoryMatch(detectedP.keyword, detectedS.size, mappings, products);

    const draftItem: DraftPickingItem = {
      id: `draft-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
      order_id: orderId,
      raw_title: text,
      detected_product_name: match.productName || detectedP.keyword,
      detected_size: match.variantName || detectedS.size,
      quantity: qty,
      unit_price: match.unitPrice || 0,
      sku: match.sku || rawSku,
      status: match.isMatched ? "matched" : "unmatched",
      product_id: match.productId,
      product_name: match.productName,
      variant_id: match.variantId,
      variant_name: match.variantName,
      available_stock: match.availableStock,
      category: match.category,
      selected: true,
    };

    items.push(draftItem);
  }

  const matchedCount = items.filter((i) => i.status === "matched").length;
  const unmatchedCount = items.filter((i) => i.status === "unmatched").length;

  return {
    items,
    rawText,
    totalParsed: items.length,
    matchedCount,
    unmatchedCount,
  };
}

/**
 * Sample realistic TikTok Shop Picking List PDF text content for instant 1-click preview testing
 */
export const SAMPLE_TIKTOK_PICKING_LIST_TEXT = `TikTok Shop Seller Center - Picking List
Batch ID: PKL-20260907-88912 | Date: 07/09/2026 10:15 AM
Warehouse: Main Fulfillment Center (UK) | Carrier: Evri 48hr Tracked

--------------------------------------------------------------------------------------
No.  Order ID              Product Title & Variations                              Qty   SKU
--------------------------------------------------------------------------------------
1    578901248920192831    Luxury Hotel Quality 10cm Extra Thick Mattress Topper   2     TOP-DBL-10
                           Variation: Double (4ft6) | White Breathable Microfibre
2    578901248920192832    Luxury Hotel Quality 10cm Extra Thick Mattress Topper   1     TOP-KNG-10
                           Variation: King (5ft) | Extra Deep Elastic Straps
3    578901248920192833    Overfilled Bed Mattress Topper 4ft Small Double         1     TOP-4FT-10
                           Variation: 4ft Small Double (120x190cm)
4    578901248920192834    100% Egyptian Cotton 400TC Deep Fitted Bed Sheet        3     SHT-4FT-WHT
                           Variation: 4ft (Small Double) | Colour: Plain White
5    578901248920192835    100% Egyptian Cotton 400TC Deep Fitted Bed Sheet        2     SHT-DBL-GRY
                           Variation: Double | Colour: Slate Grey
6    578901248920192836    Hotel Stripe Duvet Cover Quilt Bedding Set              1     DUV-SK-WHT
                           Variation: Super King (6ft) | 200TC Satin Stripe
7    578901248920192837    Hotel Stripe Duvet Cover Quilt Bedding Set              2     DUV-SNG-WHT
                           Variation: Single 3ft | With Pillowcase
8    578901248920192838    All Seasons Warm Anti-Allergy 13.5 Tog Winter Duvet     1     TOG-135-KNG
                           Variation: King Size (150x200cm) | Hollowfibre Fill
9    578901248920192839    Bounce Back Hotel Quality Sleeping Pillows Pair         2     PLW-PAIR-WHT
                           Variation: Pair (Pack of 2) | Ultra Soft Bounce
10   578901248920192840    Waterproof Quilted Breathable Mattress Protector        1     PRT-KNG-WHT
                           Variation: King (150x200cm) | Deep Elastic Skirt
--------------------------------------------------------------------------------------
Total Items: 10 | Total Units: 16 | Picked By: _______________ Checked By: _______________
`;
