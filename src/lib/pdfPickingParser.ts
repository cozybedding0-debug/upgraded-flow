import * as pdfjsLib from "pdfjs-dist";
import type {
  Product,
  DraftPickingItem,
  AggregatedPickingItem,
  ProductGroupSummary,
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

export interface PageClassification {
  pageNumber: number;
  isPackingSlip: boolean;
  isShippingLabel: boolean;
  hasSkuKeyword: boolean;
  hasQtyKeyword: boolean;
  hasProductNameKeyword: boolean;
  hasPackingHeaderKeyword: boolean;
  matchedKeywords: string[];
  snippet: string;
}

export interface FilteredPagesResult {
  isCombinedDocument: boolean;
  totalPages: number;
  processedPages: number[];
  filteredPages: number[];
  pageClassifications: PageClassification[];
  filteredText: string;
}

export interface PdfExtractionResult {
  text: string;
  totalPages: number;
  processedPageNumbers: number[];
  filteredPageNumbers: number[];
  isCombinedDocument: boolean;
  pageClassifications: PageClassification[];
}

/**
 * Classifies a single page text to determine whether it contains Packing List data
 * or is a Shipping Label, using keywords: SKU, Item Quantity, Qty, Product Name.
 */
export function classifyPageText(pageText: string, pageNumber: number = 1): PageClassification {
  const matchedKeywords: string[] = [];

  // 1. SKU keywords (User requested)
  // Matches "SKU", "Seller SKU", "Buyer SKU", "Merchant SKU", "Item SKU"
  const hasSkuKeyword = /\b(sku|seller\s+sku|buyer\s+sku|merchant\s+sku|item\s+sku)\b/i.test(
    pageText,
  );
  if (hasSkuKeyword) {
    const match = pageText.match(/\b(seller\s+sku|buyer\s+sku|merchant\s+sku|item\s+sku|sku)\b/i);
    matchedKeywords.push(match ? match[0].toUpperCase() : "SKU");
  }

  // 2. Item Quantity / Qty keywords (User requested)
  // Matches "Item Quantity", "Qty", "Qty.", "Quantity", "Item Qty", "Items Quantity"
  const hasItemQty = /\b(item\s+quantity|item\s+qty|items\s+quantity|items\s+qty)\b/i.test(
    pageText,
  );
  const hasQty = /\b(qty\.?|quantity)\b/i.test(pageText);
  const hasQtyKeyword = hasItemQty || hasQty;
  if (hasItemQty) {
    matchedKeywords.push("Item Quantity");
  } else if (hasQty) {
    const match = pageText.match(/\b(qty\.?|quantity)\b/i);
    matchedKeywords.push(match ? match[0] : "Qty");
  }

  // 3. Product Name keywords (User requested)
  // Matches "Product Name", "Product Title", "Item Name", "Item Description", "Product / Variation"
  const hasProductName =
    /\b(product\s+name|product\s+title|item\s+name|product\s*\/\s*variation|product\s*name\s*&|item\s+description|product\s+description)\b/i.test(
      pageText,
    );
  const hasProductNameKeyword = hasProductName;
  if (hasProductNameKeyword) {
    const match = pageText.match(
      /\b(product\s+name|product\s+title|item\s+name|product\s*\/\s*variation|item\s+description)\b/i,
    );
    matchedKeywords.push(match ? match[0] : "Product Name");
  }

  // 4. Supporting Packing Slip / Picking List title keywords
  const hasPackingHeaderKeyword =
    /\b(packing\s+slip|picking\s+list|pack\s+list|pick\s+list|packing\s+list|order\s+items|items\s+in\s+package)\b/i.test(
      pageText,
    );
  if (hasPackingHeaderKeyword) {
    const match = pageText.match(
      /\b(packing\s+slip|picking\s+list|pack\s+list|pick\s+list|packing\s+list)\b/i,
    );
    matchedKeywords.push(match ? match[0] : "Packing Slip");
  }

  // 5. Shipping Label indicators (address, carrier, barcodes, tracking)
  const isShippingLabel =
    /\b(deliver\s+to|delivery\s+address|ship\s+to|recipient|return\s+address|if\s+undelivered\s+return|postage\s+paid|royal\s+mail|evri|dpd|yodel|tracked\s+48|tracked\s+24|tracking\s+number|tracking\s+id|consignment\s*#?|air\s+waybill|weight\s*[:(]kg[)]|postal\s+code|postcode)\b/i.test(
      pageText,
    );

  // Packing list scoring based on keyword presence
  let score = 0;
  if (hasSkuKeyword) score += 2;
  if (hasQtyKeyword) score += 2;
  if (hasProductNameKeyword) score += 2;
  if (hasPackingHeaderKeyword) score += 2;

  // A page qualifies as containing Packing List data if:
  // - It has at least 2 key signals (e.g. SKU + Qty, Product Name + Qty, Product Name + SKU)
  // - OR it has Packing Slip title + at least 1 keyword
  // - OR it has at least 1 keyword and is NOT a pure shipping label
  const isPackingSlip =
    score >= 4 || (hasPackingHeaderKeyword && score >= 2) || (score >= 2 && !isShippingLabel);

  return {
    pageNumber,
    isPackingSlip,
    isShippingLabel,
    hasSkuKeyword,
    hasQtyKeyword,
    hasProductNameKeyword,
    hasPackingHeaderKeyword,
    matchedKeywords,
    snippet: pageText.slice(0, 160).replace(/\s+/g, " ").trim(),
  };
}

/**
 * Evaluates an array of pages. If the document contains combined Shipping Labels
 * and Packing Slips, filters and processes ONLY the pages containing Packing List data.
 */
export function filterPagesForPackingSlip(
  pages: { pageNumber: number; text: string }[],
): FilteredPagesResult {
  const classifications = pages.map((p) => classifyPageText(p.text, p.pageNumber));

  const packingPages = classifications.filter((c) => c.isPackingSlip);
  const shippingPages = classifications.filter((c) => !c.isPackingSlip && c.isShippingLabel);

  // Is this a combined document with shipping labels and packing slips?
  const isCombined = packingPages.length > 0 && packingPages.length < pages.length;

  let pagesToProcess: typeof pages = [];

  if (isCombined) {
    // Filter and process ONLY the pages containing Packing List data
    pagesToProcess = pages.filter((p) =>
      packingPages.some((pack) => pack.pageNumber === p.pageNumber),
    );
  } else if (packingPages.length > 0) {
    // Pure packing list document - keep all pages
    pagesToProcess = pages;
  } else if (shippingPages.length > 0 && packingPages.length === 0) {
    // The PDF contains only shipping labels, no packing slips
    pagesToProcess = [];
  } else {
    // Fallback for edge cases
    pagesToProcess = pages;
  }

  const processedNumbers = pagesToProcess.map((p) => p.pageNumber);
  const filteredNumbers = pages
    .filter((p) => !processedNumbers.includes(p.pageNumber))
    .map((p) => p.pageNumber);

  return {
    isCombinedDocument: isCombined,
    totalPages: pages.length,
    processedPages: processedNumbers,
    filteredPages: filteredNumbers,
    pageClassifications: classifications,
    filteredText: pagesToProcess.map((p) => p.text).join("\n--- PAGE BREAK ---\n"),
  };
}

/**
 * Extracts text from a PDF file. If the uploaded PDF contains combined
 * Shipping Labels and Packing Slips, filters and processes ONLY the pages
 * containing Packing List data (using keywords: SKU, Item Quantity, Qty, Product Name).
 */
export async function extractTextFromPdf(file: File | ArrayBuffer): Promise<PdfExtractionResult> {
  const arrayBuffer = file instanceof File ? await file.arrayBuffer() : file;
  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(arrayBuffer),
    useSystemFonts: true,
  });

  const pdf = await loadingTask.promise;
  const pageEntries: { pageNumber: number; text: string }[] = [];

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

    pageEntries.push({ pageNumber: pageNum, text: pageStr });
  }

  // Filter pages for packing list data
  const filterResult = filterPagesForPackingSlip(pageEntries);

  // If entire document consists of shipping labels without any packing list pages
  if (filterResult.processedPages.length === 0 && pdf.numPages > 0) {
    throw new Error(
      `No Packing Slip pages detected in this PDF (${pdf.numPages} page(s) analyzed). The file appears to contain only Shipping Labels (carrier barcodes, delivery addresses) and lacks packing list data with keywords: SKU, Item Quantity, Qty, Product Name.`,
    );
  }

  return {
    text: filterResult.filteredText,
    totalPages: filterResult.totalPages,
    processedPageNumbers: filterResult.processedPages,
    filteredPageNumbers: filterResult.filteredPages,
    isCombinedDocument: filterResult.isCombinedDocument,
    pageClassifications: filterResult.pageClassifications,
  };
}

export interface ParseResult {
  items: DraftPickingItem[];
  productGroups: ProductGroupSummary[];
  rawText: string;
  totalParsed: number;
  totalUnits: number;
  matchedCount: number;
  unmatchedCount: number;
  pageFilterResult?: FilteredPagesResult | undefined;
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

  return 1;
}

/**
 * Searches text for SKU codes
 */
function findSku(text: string): string | undefined {
  const explicitMatch = text.match(
    /(?:SKU|Seller\s*SKU|Item Code|Barcode)\s*[:#-]?\s*([A-Za-z0-9_/-]{3,25})/i,
  );
  if (explicitMatch && explicitMatch[1]) return explicitMatch[1].trim();

  const skuPattern = /\b([A-Z]{2,6}-[A-Z0-9]{2,6}-[A-Z0-9]{2,8}|[A-Z]{3,}-[A-Z0-9]{2,8})\b/;
  const match = text.match(skuPattern);
  if (match && match[1]) return match[1].trim();

  return undefined;
}

/**
 * STRICT FIELD SEGREGATION DATA STRUCTURE
 */
export interface ExtractedRowFields {
  rawTitleText: string; // Strictly Product Name / Title column
  rawVariationText: string; // Strictly Variation / Color-Size column or sub-line
  rawSkuText: string; // Strictly Seller SKU column or SKU: tag
  quantity: number; // Strictly Qty / Item Quantity column or tag
  orderId?: string | undefined;
  rawFull: string;
}

/**
 * STRICT FIELD SEGREGATION ENGINE
 * Segregates raw text lines of a row into isolated columns:
 * 1. Title Column -> rawTitleText (for Category Keyword extraction ONLY)
 * 2. Variation / Color-Size Column -> rawVariationText (for Size Keyword extraction ONLY)
 * 3. Seller SKU Column -> rawSkuText (for Size Keyword extraction fallback ONLY)
 * 4. Qty Column -> quantity (for item count ONLY)
 */
export function extractRowFields(
  lines: string[],
  fallbackOrderId?: string,
  fullText?: string,
): ExtractedRowFields {
  const full = fullText || lines.join("\n");
  let orderId = fallbackOrderId || findOrderId(full);
  let rawTitleText = "";
  let rawVariationText = "";
  let rawSkuText = "";
  let quantity = 1;

  // 1. Identify Variation Sub-lines (e.g. "Variation: Grey, King" or "Variation / Color-Size: ...")
  const variationLines: string[] = [];
  const otherLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Check for explicit Variation / Color / Size prefix
    const varPrefixMatch = trimmed.match(
      /^(?:Variation|Color[-/ ]*Size|Colour[-/ ]*Size|Colour|Color|Size|Spec|Details?)\s*[:=]\s*(.*)$/i,
    );
    if (varPrefixMatch && varPrefixMatch[1]) {
      variationLines.push(varPrefixMatch[1].trim());
      continue;
    }

    // Check for pipe-delimited variation e.g. "Product ... | Variation: Grey, King | ..."
    if (/\|\s*(?:Variation|Color[-/ ]*Size|Colour|Color|Size)\s*[:=]/i.test(trimmed)) {
      const parts = trimmed.split("|").map((p) => p.trim());
      for (const p of parts) {
        const pMatch = p.match(
          /^(?:Variation|Color[-/ ]*Size|Colour[-/ ]*Size|Colour|Color|Size|Spec)\s*[:=]\s*(.*)$/i,
        );
        if (pMatch && pMatch[1]) {
          variationLines.push(pMatch[1].trim());
        }
      }
      continue;
    }

    // Check if line contains Seller SKU / Variation:
    const skuVarMatch = trimmed.match(
      /^(?:Seller\s*SKU\s*\/\s*Variation|Variation\s*\/\s*Seller\s*SKU)\s*[:=]\s*(.*)$/i,
    );
    if (skuVarMatch && skuVarMatch[1]) {
      variationLines.push(skuVarMatch[1].trim());
      continue;
    }

    otherLines.push(trimmed);
  }

  // 2. Identify SKU from explicit tags or tokens
  const explicitSkuMatch = full.match(
    /(?:Seller\s*SKU|SKU|Item Code|Barcode)\s*[:#-]?\s*([A-Za-z0-9_/-]{3,30})/i,
  );
  if (explicitSkuMatch && explicitSkuMatch[1]) {
    rawSkuText = explicitSkuMatch[1].trim();
  }

  // 3. Identify Qty from explicit tags
  const explicitQtyMatch = full.match(
    /(?:Qty|Quantity|Item Quantity|Item Qty|Count|Units?)\s*[:=x]?\s*(\d+)\b/i,
  );
  if (explicitQtyMatch && explicitQtyMatch[1]) {
    const parsedQ = parseInt(explicitQtyMatch[1], 10);
    if (parsedQ > 0 && parsedQ < 5000) quantity = parsedQ;
  }

  // 4. Examine primary line (usually otherLines[0])
  const primaryLine = otherLines[0] || lines[0] || "";

  // Check if primary line has explicit "Product Name:" or "Product Title:"
  const titlePrefixMatch = primaryLine.match(
    /(?:Product\s*Name|Product\s*Title|Item\s*Name|Product)\s*[:=]\s*([^|\n]+)/i,
  );
  if (titlePrefixMatch && titlePrefixMatch[1]) {
    rawTitleText = titlePrefixMatch[1].trim();
  } else {
    // Tabular parsing of primary line:
    // Format: "[Index] [OrderId] [Product Title text...] [Qty] [SKU]"
    let cleanLine = primaryLine;

    // Remove leading item index (e.g. "1   " or "2   ")
    cleanLine = cleanLine.replace(/^\s*\d{1,4}\s+/, "");

    // Remove leading Order ID if present (e.g. "578901248920192801   ")
    const leadingOrderMatch = cleanLine.match(/^\s*(57\d{13,17})\s+/);
    if (leadingOrderMatch) {
      if (!orderId) orderId = leadingOrderMatch[1];
      cleanLine = cleanLine.substring(leadingOrderMatch[0].length);
    }

    // Check for trailing tabular Qty and SKU at end of line:
    // e.g. "Luxury Hotel Quality 10cm Extra Thick Mattress Topper   2     TOP-DBL-10"
    const trailingTabularMatch = cleanLine.match(/\s+(\d{1,4})\s+([A-Za-z0-9_/-]{3,30})\s*$/);
    if (trailingTabularMatch && trailingTabularMatch[1] && trailingTabularMatch[2]) {
      if (quantity === 1) {
        const q = parseInt(trailingTabularMatch[1], 10);
        if (q > 0) quantity = q;
      }
      if (!rawSkuText) {
        rawSkuText = trailingTabularMatch[2].trim();
      }
      cleanLine = cleanLine.substring(0, cleanLine.length - trailingTabularMatch[0].length).trim();
    } else {
      // Check for trailing Qty only: e.g. "Title text...   2"
      const trailingQtyMatch = cleanLine.match(/\s+(\d{1,4})\s*$/);
      if (trailingQtyMatch && trailingQtyMatch[1]) {
        if (quantity === 1) {
          const q = parseInt(trailingQtyMatch[1], 10);
          if (q > 0) quantity = q;
        }
        cleanLine = cleanLine.substring(0, cleanLine.length - trailingQtyMatch[0].length).trim();
      }
    }

    // Remove any embedded "Variation: ...", "SKU: ...", "Qty: ..."
    cleanLine = cleanLine
      .replace(/(?:Variation|Color[-/ ]*Size|Colour|Color|Size)\s*[:=].*$/i, "")
      .replace(/(?:Seller\s*SKU|SKU)\s*[:#-]?\s*[A-Za-z0-9_/-]+.*$/i, "")
      .replace(/(?:Qty|Quantity)\s*[:=]?\s*\d+.*$/i, "")
      .trim();

    rawTitleText = cleanLine;
  }

  // If variationLines captured text, join them
  if (variationLines.length > 0) {
    rawVariationText = variationLines.join(" | ");
  } else {
    // Check if secondary lines (otherLines[1...]) contain variation or SKU
    for (let i = 1; i < otherLines.length; i++) {
      const line = otherLines[i]!.trim();
      if (!line) continue;
      if (!rawSkuText && findSku(line)) {
        rawSkuText = findSku(line)!;
      }
      if (!rawVariationText && !/^(?:order|package|batch|picked|date)/i.test(line)) {
        rawVariationText = line;
      }
    }
  }

  // Fallback if not detected
  if (!rawSkuText) {
    const found = findSku(full);
    if (found) rawSkuText = found;
  }

  return {
    rawTitleText: rawTitleText.trim(),
    rawVariationText: rawVariationText.trim(),
    rawSkuText: rawSkuText.trim(),
    quantity: quantity > 0 ? quantity : 1,
    orderId,
    rawFull: full,
  };
}

/**
 * SCOPE 1: TITLE COLUMN SCOPE (CATEGORY KEYWORDS ONLY)
 * Searches the Product Name / Title column ONLY for matching user-defined
 * Product Category Keywords or custom regex.
 * STRICTLY FORBIDDEN: Never extracts sizes (Single, Double, King) from Title.
 */
export function detectProductCategoryFromTitle(
  titleText: string,
  rules: ProductKeywordRule[],
): {
  keyword: string;
  matchedRule?: ProductKeywordRule;
  matchType: "regex" | "exact" | "alias" | "fallback";
} {
  const cleanTitle = (titleText || "").trim();
  const lowerTitle = cleanTitle.toLowerCase();

  if (!cleanTitle) {
    return { keyword: "Bedding Item", matchType: "fallback" };
  }

  const safeRules = Array.isArray(rules)
    ? rules.filter((r) => r && typeof r === "object" && typeof r.keyword === "string")
    : [];
  const effectiveRules = safeRules.length > 0 ? safeRules : getProductKeywordRules();

  // 1. Check custom regex pattern on Title (highest user control)
  for (const rule of effectiveRules) {
    if (rule.regex_pattern && typeof rule.regex_pattern === "string" && rule.regex_pattern.trim()) {
      try {
        const rx = new RegExp(rule.regex_pattern.trim(), "i");
        if (rx.test(cleanTitle)) {
          return { keyword: rule.keyword, matchedRule: rule, matchType: "regex" };
        }
      } catch (err) {
        console.warn(`Invalid regex pattern in product rule ${rule.id}:`, err);
      }
    }
  }

  // 2. Phrase matching with priority to longest, most specific phrases first
  // e.g., "Satin Stripe Duvet Cover" before "Duvet Cover", "Extra Thick Topper" before "Topper"
  const candidates: { phrase: string; rule: ProductKeywordRule; isPrimary: boolean }[] = [];
  for (const rule of effectiveRules) {
    const k = (rule.keyword || "").trim().toLowerCase();
    if (k) candidates.push({ phrase: k, rule, isPrimary: true });
    for (const alias of rule.aliases || []) {
      const a = (alias || "").trim().toLowerCase();
      if (a) candidates.push({ phrase: a, rule, isPrimary: false });
    }
  }

  // Sort longest first
  candidates.sort((a, b) => b.phrase.length - a.phrase.length);

  for (const cand of candidates) {
    // Word boundary for short phrases <= 4 chars, substring for longer
    if (cand.phrase.length <= 4) {
      const rx = new RegExp(`\\b${cand.phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
      if (rx.test(cleanTitle)) {
        return {
          keyword: cand.rule.keyword,
          matchedRule: cand.rule,
          matchType: cand.isPrimary ? "exact" : "alias",
        };
      }
    } else if (lowerTitle.includes(cand.phrase)) {
      return {
        keyword: cand.rule.keyword,
        matchedRule: cand.rule,
        matchType: cand.isPrimary ? "exact" : "alias",
      };
    }
  }

  // 3. Built-in bedding fallbacks
  const commonFallbacks = [
    { phrase: "satin stripe duvet cover", keyword: "Satin Stripe Duvet Cover" },
    { phrase: "satin stripe", keyword: "Satin Stripe Duvet Cover" },
    { phrase: "mattress topper", keyword: "Mattress Topper" },
    { phrase: "extra thick topper", keyword: "Mattress Topper" },
    { phrase: "bed topper", keyword: "Mattress Topper" },
    { phrase: "topper", keyword: "Mattress Topper" },
    { phrase: "duvet cover", keyword: "Duvet Cover" },
    { phrase: "fitted sheet", keyword: "Fitted Sheet" },
    { phrase: "flat sheet", keyword: "Flat Sheet" },
    { phrase: "winter duvet", keyword: "Duvet" },
    { phrase: "tog duvet", keyword: "Duvet" },
    { phrase: "tog", keyword: "Duvet" },
    { phrase: "duvet", keyword: "Duvet" },
    { phrase: "quilt", keyword: "Duvet" },
    { phrase: "pillowcase", keyword: "Pillowcase" },
    { phrase: "pillow", keyword: "Pillow" },
    { phrase: "mattress protector", keyword: "Mattress Protector" },
    { phrase: "protector", keyword: "Mattress Protector" },
  ];

  for (const fb of commonFallbacks) {
    if (lowerTitle.includes(fb.phrase)) {
      return { keyword: fb.keyword, matchType: "fallback" };
    }
  }

  // 4. Default to first 3-4 words of cleanTitle
  const words = cleanTitle.split(/\s+/).filter(Boolean);
  const guessed = words.slice(0, 4).join(" ");
  return { keyword: guessed || "Bedding Item", matchType: "fallback" };
}

/**
 * Backward compatibility alias for detectProductCategoryFromTitle
 */
function detectProductKeyword(
  text: string,
  rules: ProductKeywordRule[],
): { keyword: string; matchedRule?: ProductKeywordRule } {
  return detectProductCategoryFromTitle(text, rules);
}

/**
 * Helper to match size tokens with word boundary protection
 */
function matchesSizeToken(text: string, token: string): boolean {
  if (!text || !token) return false;
  const cleanText = text.toLowerCase();
  const cleanToken = token.toLowerCase().trim();
  if (!cleanToken) return false;

  // Direct exact match
  if (cleanText === cleanToken) return true;

  // Word boundary check (supports units like 4'6", 4ft6, 120x190)
  const escaped = cleanToken.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const rx = new RegExp(`(?:^|[^a-z0-9])${escaped}(?:$|[^a-z0-9])`, "i");
  return rx.test(text);
}

/**
 * Helper to match SKU codes and patterns
 */
function matchesSkuPattern(sku: string, pattern: string): boolean {
  if (!sku || !pattern) return false;
  const s = sku.toUpperCase();
  const p = pattern.toUpperCase().trim();
  if (!p) return false;
  if (s === p) return true;
  // Sub-code surrounded by hyphens, underscores, or digits
  const rx = new RegExp(`(?:^|[-_])${p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:$|[-_0-9])`, "i");
  return rx.test(s) || s.includes(p);
}

/**
 * Normalizes size string into canonical display format
 */
export function normalizeCanonicalSize(rawSize: string): string {
  if (!rawSize) return "Standard";
  const lower = (rawSize || "").toLowerCase().trim();

  if (
    lower.includes("super king") ||
    lower.includes("superking") ||
    /\b(?:6ft|6'0|180x200)\b/.test(lower)
  ) {
    return "Super King";
  }

  if (
    lower.includes("small double") ||
    lower.includes("small db") ||
    lower.includes("sm dbl") ||
    lower.includes("three quarter") ||
    /\b(?:4ft|4\s*ft|4'0|120x190)\b/.test(lower)
  ) {
    return "Small Double (4ft)";
  }

  if (
    (lower.includes("double") && !lower.includes("small")) ||
    /\b(?:4ft6|4'6|full|135x190)\b/.test(lower)
  ) {
    return "Double";
  }

  if (lower.includes("king") && !lower.includes("super")) {
    return "King";
  }

  if (lower.includes("single") || /\b(?:3ft|3'0|twin|90x190)\b/.test(lower)) {
    return "Single";
  }

  if (lower.includes("pair") || lower.includes("2 pack") || lower.includes("pack of 2")) {
    return "Pair (Pack of 2)";
  }

  if (lower.includes("4 pack") || lower.includes("pack of 4")) {
    return "Pack of 4";
  }

  return (rawSize || "").trim() || "Standard";
}

/**
 * SCOPE 2: SELLER SKU / VARIATION COLUMN SCOPE (SIZE KEYWORDS ONLY)
 * Searches the Seller SKU and Variation / Color-Size columns ONLY for extracting
 * target size keywords (e.g. "Grey, King" -> "King", "TOP-DBL-10" -> "Double", "4FT" -> "Small Double").
 * STRICTLY FORBIDDEN: Never extracts sizes from the Product Title column!
 * STRICTLY FORBIDDEN: Never infers category names from variation options.
 */
export function detectSizeFromVariationAndSku(
  variationText: string,
  skuText: string,
  rules: SizeKeywordRule[],
): {
  size: string;
  canonicalSize: string;
  matchedRule?: SizeKeywordRule;
  matchedFrom: "variation" | "sku" | "default";
  matchToken?: string;
} {
  const varClean = (variationText || "").trim();
  const skuClean = (skuText || "").trim();

  const safeRules = Array.isArray(rules)
    ? rules.filter((r) => r && typeof r === "object" && typeof r.canonical_size === "string")
    : [];
  const effectiveRules = safeRules.length > 0 ? safeRules : getSizeKeywordRules();

  // Sort rules prioritizing multi-word / compound sizes
  // e.g. "Super King" before "King", "Small Double" before "Double"
  const sortedRules = [...effectiveRules].sort((a, b) => {
    const aLow = (a.canonical_size || "").toLowerCase();
    const bLow = (b.canonical_size || "").toLowerCase();
    if (aLow.includes("super") && !bLow.includes("super")) return -1;
    if (bLow.includes("super") && !aLow.includes("super")) return 1;
    if (aLow.includes("small") && !bLow.includes("small")) return -1;
    if (bLow.includes("small") && !aLow.includes("small")) return 1;
    return (b.canonical_size || "").length - (a.canonical_size || "").length;
  });

  // ========================================================
  // STAGE 1: SEARCH VARIATION COLUMN TEXT (HIGHEST PRIORITY)
  // Handles values like: "Grey, King", "Double (4ft6)", "Silver, KING", "4FT"
  // ========================================================
  if (varClean.length > 0) {
    // 1a. Check custom regex pattern on variation
    for (const rule of sortedRules) {
      if (rule.regex_pattern && rule.regex_pattern.trim()) {
        try {
          const rx = new RegExp(rule.regex_pattern.trim(), "i");
          if (rx.test(varClean)) {
            return {
              size: rule.canonical_size,
              canonicalSize: rule.canonical_size,
              matchedRule: rule,
              matchedFrom: "variation",
              matchToken: "regex",
            };
          }
        } catch {
          // ignore invalid regex
        }
      }
    }

    // 1b. Check canonical size and synonyms against variation text
    for (const rule of sortedRules) {
      // Check canonical size
      if (matchesSizeToken(varClean, rule.canonical_size)) {
        return {
          size: rule.canonical_size,
          canonicalSize: rule.canonical_size,
          matchedRule: rule,
          matchedFrom: "variation",
          matchToken: rule.canonical_size,
        };
      }

      // Check synonyms
      for (const syn of rule.synonyms || []) {
        if (matchesSizeToken(varClean, syn)) {
          return {
            size: rule.canonical_size,
            canonicalSize: rule.canonical_size,
            matchedRule: rule,
            matchedFrom: "variation",
            matchToken: syn,
          };
        }
      }
    }

    // 1c. Built-in variation token patterns (e.g. "Grey, King", "Silver, KING", "4FT")
    if (/\b(?:super\s*king|superking|6ft|6'0|180x200)\b/i.test(varClean)) {
      return {
        size: "Super King",
        canonicalSize: "Super King",
        matchedFrom: "variation",
        matchToken: "super king",
      };
    }
    if (/\b(?:small\s*double|4ft(?!\s*6)|4'0|three\s*quarter|120x190)\b/i.test(varClean)) {
      return {
        size: "Small Double (4ft)",
        canonicalSize: "Small Double (4ft)",
        matchedFrom: "variation",
        matchToken: "small double",
      };
    }
    if (
      /\b(?:double|4ft6|4'6|full|135x190)\b/i.test(varClean) &&
      !/small\s*double/i.test(varClean)
    ) {
      return {
        size: "Double",
        canonicalSize: "Double",
        matchedFrom: "variation",
        matchToken: "double",
      };
    }
    if (/\b(?:king(?:\s*size)?|5ft|5'0|150x200)\b/i.test(varClean) && !/super/i.test(varClean)) {
      return { size: "King", canonicalSize: "King", matchedFrom: "variation", matchToken: "king" };
    }
    if (/\b(?:single|3ft|3'0|twin|90x190)\b/i.test(varClean)) {
      return {
        size: "Single",
        canonicalSize: "Single",
        matchedFrom: "variation",
        matchToken: "single",
      };
    }
    if (/\b(?:pair|2\s*pack|pack\s*of\s*2|2\s*pcs|twin\s*pack)\b/i.test(varClean)) {
      return {
        size: "Pair (Pack of 2)",
        canonicalSize: "Pair (Pack of 2)",
        matchedFrom: "variation",
        matchToken: "pair",
      };
    }
    if (/\b(?:4\s*pack|pack\s*of\s*4|4\s*pcs)\b/i.test(varClean)) {
      return {
        size: "Pack of 4",
        canonicalSize: "Pack of 4",
        matchedFrom: "variation",
        matchToken: "4 pack",
      };
    }
  }

  // ========================================================
  // STAGE 2: SEARCH SELLER SKU COLUMN TEXT (FALLBACK FOR SIZE)
  // Handles codes like: "TOP-DBL-10", "4FT-TOP", "TOP-KNG-GRY", "DUV-SNG-WHT"
  // ========================================================
  if (skuClean.length > 0) {
    // 2a. Check custom regex pattern on SKU
    for (const rule of sortedRules) {
      if (rule.regex_pattern && rule.regex_pattern.trim()) {
        try {
          const rx = new RegExp(rule.regex_pattern.trim(), "i");
          if (rx.test(skuClean)) {
            return {
              size: rule.canonical_size,
              canonicalSize: rule.canonical_size,
              matchedRule: rule,
              matchedFrom: "sku",
              matchToken: "regex",
            };
          }
        } catch {
          // ignore
        }
      }
    }

    // 2b. Check user-defined sku_patterns in rules
    for (const rule of sortedRules) {
      for (const pat of rule.sku_patterns || []) {
        if (matchesSkuPattern(skuClean, pat)) {
          return {
            size: rule.canonical_size,
            canonicalSize: rule.canonical_size,
            matchedRule: rule,
            matchedFrom: "sku",
            matchToken: pat,
          };
        }
      }
    }

    // 2c. Check synonyms against SKU tokens (length >= 3)
    for (const rule of sortedRules) {
      for (const syn of rule.synonyms || []) {
        const sTrim = (syn || "").trim().toUpperCase();
        if (sTrim.length >= 3 && matchesSkuPattern(skuClean, sTrim)) {
          return {
            size: rule.canonical_size,
            canonicalSize: rule.canonical_size,
            matchedRule: rule,
            matchedFrom: "sku",
            matchToken: syn,
          };
        }
      }
    }

    // 2d. Common SKU sub-codes
    const upperSku = skuClean.toUpperCase();
    if (/(?:^|[-_])(?:SK|SUPERKING|SUPER-KING)(?:$|[-_0-9])/i.test(upperSku)) {
      return {
        size: "Super King",
        canonicalSize: "Super King",
        matchedFrom: "sku",
        matchToken: "SK",
      };
    }
    if (/(?:^|[-_])(?:4FT|S-DBL|SM-DBL)(?:$|[-_0-9])/i.test(upperSku)) {
      return {
        size: "Small Double (4ft)",
        canonicalSize: "Small Double (4ft)",
        matchedFrom: "sku",
        matchToken: "4FT",
      };
    }
    if (/(?:^|[-_])(?:DBL|4FT6|DOUBLE)(?:$|[-_0-9])/i.test(upperSku)) {
      return { size: "Double", canonicalSize: "Double", matchedFrom: "sku", matchToken: "DBL" };
    }
    if (/(?:^|[-_])(?:KNG|5FT|KING)(?:$|[-_0-9])/i.test(upperSku)) {
      return { size: "King", canonicalSize: "King", matchedFrom: "sku", matchToken: "KNG" };
    }
    if (/(?:^|[-_])(?:SNG|3FT|SINGLE)(?:$|[-_0-9])/i.test(upperSku)) {
      return { size: "Single", canonicalSize: "Single", matchedFrom: "sku", matchToken: "SNG" };
    }
    if (/(?:^|[-_])(?:PAIR|2PK|2PACK)(?:$|[-_0-9])/i.test(upperSku)) {
      return {
        size: "Pair (Pack of 2)",
        canonicalSize: "Pair (Pack of 2)",
        matchedFrom: "sku",
        matchToken: "PAIR",
      };
    }
    if (/(?:^|[-_])(?:4PK|4PACK)(?:$|[-_0-9])/i.test(upperSku)) {
      return {
        size: "Pack of 4",
        canonicalSize: "Pack of 4",
        matchedFrom: "sku",
        matchToken: "4PK",
      };
    }
  }

  // ========================================================
  // STAGE 3: DEFAULT (NEITHER VARIATION NOR SKU HAS SIZE)
  // Product Title is STRICTLY EXCLUDED and NEVER inspected!
  // ========================================================
  return {
    size: "Standard",
    canonicalSize: "Standard",
    matchedFrom: "default",
  };
}

/**
 * Backward compatibility alias for detectSizeFromVariationAndSku
 */
function detectSizeKeyword(
  text: string,
  rules: SizeKeywordRule[],
): { size: string; canonicalSize: string; matchedRule?: SizeKeywordRule } {
  // If text has a Variation: or Size: section, isolate that
  const varMatch = text.match(
    /(?:Variation|Color[-/ ]*Size|Colour|Color|Size|Spec|Details?)\s*[:=]\s*([^|\n]+)/i,
  );
  const sku = findSku(text) || "";
  const variationText = varMatch ? varMatch[1]!.trim() : "";
  return detectSizeFromVariationAndSku(variationText, sku, rules);
}

/**
 * Standalone verification utility for testing strict field-level parsing
 */
export function testStrictFieldParsing(
  sampleTitle = "Extra Thick Mattress Topper 10cm Single Double King Super King",
  sampleVariation = "Grey, King",
  sampleSku = "TOP-KNG-GRY",
  sampleQty = 2,
  products: Product[] = [],
  productRules?: ProductKeywordRule[],
  sizeRules?: SizeKeywordRule[],
  mappings?: KeywordMapping[],
) {
  let effectivePRules: ProductKeywordRule[] = [];
  if (
    Array.isArray(productRules) &&
    productRules.length > 0 &&
    typeof (productRules[0] as Partial<ProductKeywordRule>)?.keyword === "string"
  ) {
    effectivePRules = productRules;
  } else {
    effectivePRules = getProductKeywordRules();
  }

  let effectiveSRules: SizeKeywordRule[] = [];
  if (
    Array.isArray(sizeRules) &&
    sizeRules.length > 0 &&
    typeof (sizeRules[0] as Partial<SizeKeywordRule>)?.canonical_size === "string"
  ) {
    effectiveSRules = sizeRules;
  } else {
    effectiveSRules = getSizeKeywordRules();
  }

  const allMappings =
    Array.isArray(mappings) && mappings.length > 0 ? mappings : getKeywordMappings();
  const safeProducts = Array.isArray(products) ? products : [];

  const categoryResult = detectProductCategoryFromTitle(sampleTitle, effectivePRules);
  const sizeResult = detectSizeFromVariationAndSku(sampleVariation, sampleSku, effectiveSRules);
  const match = findInventoryMatch(
    categoryResult.keyword,
    sizeResult.canonicalSize,
    allMappings,
    safeProducts,
  );

  const ignoredFromTitle = ["Single", "Double", "King", "Super King", "Small Double"].filter((s) =>
    (sampleTitle || "").toLowerCase().includes(s.toLowerCase()),
  );

  return {
    rawTitle: sampleTitle,
    rawVariation: sampleVariation,
    rawSku: sampleSku,
    quantity: sampleQty,
    extractedQty: sampleQty,
    detected_product_name: categoryResult.keyword,
    detected_size: sizeResult.canonicalSize,
    product_id: match.productId,
    product_name: match.productName,
    variant_name: match.variantName,
    isMatched: match.isMatched,
    categoryDetected: categoryResult.keyword,
    categoryMatchedRule: categoryResult.matchedRule?.keyword,
    categoryMatchType: categoryResult.matchType,
    sizeDetected: sizeResult.canonicalSize,
    sizeMatchedFrom: sizeResult.matchedFrom,
    sizeMatchedToken: sizeResult.matchToken,
    sizeMatchedRule: sizeResult.matchedRule?.canonical_size,
    ignoredFromTitle,
  };
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
  productId?: string | undefined;
  variantId?: string | undefined;
  productName?: string | undefined;
  variantName?: string | undefined;
  unitPrice?: number | undefined;
  sku?: string | undefined;
  availableStock?: number | undefined;
  category?: string | undefined;
  isMatched: boolean;
} {
  const pLower = (detectedProduct || "").toLowerCase();
  const sLower = (detectedSize || "").toLowerCase();

  // 1. Direct Keyword Mapping Lookup (HIGHEST PRIORITY)
  const directMap = (mappings || []).find(
    (m) =>
      (m?.product_keyword || "").toLowerCase() === pLower &&
      (m?.size_keyword || "").toLowerCase() === sLower,
  );

  if (directMap) {
    const directRecord = directMap as unknown as Record<string, string | undefined>;
    const targetProdId = directMap.product_id || directRecord["inventory_product_id"];
    const targetVarId = directMap.variant_id || directRecord["inventory_variant_id"];
    const product = (products || []).find((p) => p && p.id === targetProdId);
    if (product) {
      if (targetVarId && product.variants?.length) {
        const variant = product.variants.find((v) => v && v.id === targetVarId);
        if (variant) {
          return {
            productId: product.id,
            variantId: variant.id,
            productName: product.product_name,
            variantName: `${variant.variation_value || ""}${variant.color ? ` - ${variant.color}` : ""}`,
            unitPrice: variant.unit_price || product.unit_price,
            sku: variant.sku || product.sku,
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
        sku: product.sku,
        availableStock: product.stock_quantity,
        category: product.category,
        isMatched: true,
      };
    }
  }

  // 2. Exact or Fuzzy Match against existing inventory catalog
  for (const product of products || []) {
    if (!product) continue;
    const pName = (product.product_name || "").toLowerCase();
    const pCat = (product.category || "").toLowerCase();

    const matchesProduct =
      pName.includes(pLower) ||
      pLower.includes(pName) ||
      (pCat && pCat.includes(pLower)) ||
      (pCat && pLower.includes(pCat));

    if (matchesProduct) {
      if (product.has_variants && product.variants?.length) {
        const matchingVariant = product.variants.find((v) => {
          if (!v) return false;
          const vVal = (v.variation_value || "").toLowerCase();
          const canonVal = normalizeCanonicalSize(vVal).toLowerCase();
          const canonTarget = normalizeCanonicalSize(detectedSize).toLowerCase();
          return canonVal === canonTarget || vVal.includes(sLower) || sLower.includes(vVal);
        });

        if (matchingVariant) {
          return {
            productId: product.id,
            variantId: matchingVariant.id,
            productName: product.product_name,
            variantName: `${matchingVariant.variation_value || ""}${matchingVariant.color ? ` - ${matchingVariant.color}` : ""}`,
            unitPrice: matchingVariant.unit_price || product.unit_price,
            sku: matchingVariant.sku || product.sku,
            availableStock: matchingVariant.stock_quantity,
            category: product.category,
            isMatched: true,
          };
        }
      } else {
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
 * Aggregates parsed picking items into strictly isolated Product Groups.
 * Groups identical sizes under each product category and SUMS their quantities so
 * each size appears ONLY ONCE per product group.
 */
export function aggregatePickingItems(
  items: DraftPickingItem[],
  products: Product[] = [],
): ProductGroupSummary[] {
  // Map of groupKey -> { group_name, product_keyword, category, sizeMap }
  const groupsMap = new Map<
    string,
    {
      group_name: string;
      product_keyword: string;
      category?: string | undefined;
      sizeMap: Map<string, AggregatedPickingItem>;
    }
  >();

  for (const item of items) {
    // 1. Identify Product Group: strictly isolated by product category/keyword
    const rawGroup =
      item.detected_product_name || item.product_name || item.category || "Bedding Items";
    const cleanKeyword = rawGroup.trim();
    const groupKey = cleanKeyword.toLowerCase();

    if (!groupsMap.has(groupKey)) {
      groupsMap.set(groupKey, {
        group_name: cleanKeyword.toUpperCase(),
        product_keyword: cleanKeyword,
        category: item.category,
        sizeMap: new Map<string, AggregatedPickingItem>(),
      });
    }

    const group = groupsMap.get(groupKey)!;

    // 2. Canonical Size Normalization
    const canonical = normalizeCanonicalSize(item.detected_size || item.variant_name || "Standard");
    const sizeKey = canonical.toLowerCase();

    if (group.sizeMap.has(sizeKey)) {
      const existing = group.sizeMap.get(sizeKey)!;
      // SUM quantities for identical sizes under this product category
      existing.total_quantity += item.quantity;
      existing.raw_count += 1;

      if (item.order_id && !existing.source_order_ids.includes(item.order_id)) {
        existing.source_order_ids.push(item.order_id);
      }
      if (item.raw_title && !existing.raw_titles.includes(item.raw_title)) {
        existing.raw_titles.push(item.raw_title);
      }

      // If existing was unmatched but current item is matched, upgrade to matched inventory
      if (existing.status !== "matched" && item.status === "matched") {
        existing.status = "matched";
        existing.product_id = item.product_id;
        existing.product_name = item.product_name;
        existing.variant_id = item.variant_id;
        existing.variant_name = item.variant_name;
        existing.sku = item.sku || existing.sku;
        existing.unit_price = item.unit_price || existing.unit_price;
        existing.available_stock = item.available_stock;
      }
    } else {
      const aggItem: AggregatedPickingItem = {
        id: `agg-${groupKey.replace(/[^a-z0-9]/g, "-")}-${sizeKey.replace(/[^a-z0-9]/g, "-")}`,
        size: canonical,
        canonical_size: canonical,
        total_quantity: item.quantity,
        raw_count: 1,
        source_order_ids: item.order_id ? [item.order_id] : [],
        raw_titles: [item.raw_title],
        sku: item.sku,
        status: item.status,
        product_id: item.product_id,
        product_name: item.product_name,
        variant_id: item.variant_id,
        variant_name: item.variant_name,
        category: item.category || group.category,
        unit_price: item.unit_price || 0,
        available_stock: item.available_stock,
        notes: item.notes,
        selected: item.selected !== false,
      };
      group.sizeMap.set(sizeKey, aggItem);
    }
  }

  // Desired UI display order for bed & bedding sizes:
  // 4FT / Small Db, Single, Double, King, Super King, Pairs, Packs, Others
  const sizeRank: Record<string, number> = {
    "4ft / small db": 1,
    "small double": 1,
    single: 2,
    double: 3,
    king: 4,
    "super king": 5,
    "pair (pack of 2)": 6,
    "pack of 4": 7,
  };

  const result: ProductGroupSummary[] = [];

  for (const [groupKey, groupData] of groupsMap.entries()) {
    const sizeList = Array.from(groupData.sizeMap.values()).sort((a, b) => {
      const rankA = sizeRank[a.canonical_size.toLowerCase()] ?? 50;
      const rankB = sizeRank[b.canonical_size.toLowerCase()] ?? 50;
      if (rankA !== rankB) return rankA - rankB;
      return a.size.localeCompare(b.size);
    });

    const totalQty = sizeList.reduce((sum, s) => sum + s.total_quantity, 0);
    const matchedCount = sizeList.filter((s) => s.status === "matched").length;
    const unmatchedCount = sizeList.filter((s) => s.status === "unmatched").length;

    result.push({
      id: `group-${groupKey.replace(/[^a-z0-9]/g, "-")}`,
      group_name: groupData.group_name,
      product_keyword: groupData.product_keyword,
      category: groupData.category,
      total_quantity: totalQty,
      total_sizes: sizeList.length,
      matched_count: matchedCount,
      unmatched_count: unmatchedCount,
      sizes: sizeList,
    });
  }

  // Sort groups by total quantity descending
  return result.sort((a, b) => b.total_quantity - a.total_quantity);
}

/**
 * Core parsing engine: takes raw text lines or full document text,
 * applies dynamic keyword rules, maps items to inventory, and builds
 * draft picking items as well as aggregated product groups.
 */
export function parsePickingListText(rawText: string, products: Product[]): ParseResult {
  const pRules = getProductKeywordRules();
  const sRules = getSizeKeywordRules();
  const mappings = getKeywordMappings();

  let textToParse = rawText;
  let pageFilterResult: FilteredPagesResult | undefined = undefined;

  // If text contains page break markers, run page classifier to filter out shipping labels
  if (rawText.includes("--- PAGE BREAK ---")) {
    const rawPages = rawText
      .split(/\r?\n--- PAGE BREAK ---\r?\n/)
      .map((p) => p.trim())
      .filter((p) => p.length > 0);

    if (rawPages.length > 1) {
      const pageEntries = rawPages.map((p, idx) => ({ pageNumber: idx + 1, text: p }));
      pageFilterResult = filterPagesForPackingSlip(pageEntries);

      if (pageFilterResult.isCombinedDocument && pageFilterResult.filteredText.trim().length > 0) {
        textToParse = pageFilterResult.filteredText;
      }
    }
  }

  const cleanLines = textToParse
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith("--- PAGE BREAK ---"));

  const candidateItems: {
    raw: string;
    lines: string[];
    orderId?: string | undefined;
  }[] = [];

  let currentOrderId: string | undefined = undefined;
  let buffer: string[] = [];

  const flushBuffer = () => {
    if (buffer.length === 0) return;
    const raw = buffer.join("\n");
    const orderId = findOrderId(raw) || currentOrderId;
    candidateItems.push({ raw, lines: [...buffer], orderId });
    buffer = [];
  };

  for (let i = 0; i < cleanLines.length; i++) {
    const line = cleanLines[i]!;

    // Check if line contains an Order ID first to update current context
    const foundOrder = findOrderId(line);
    if (foundOrder) {
      currentOrderId = foundOrder;
    }

    // Skip headers, footers, table column headers, and document metadata
    if (
      /^(Picking List|Packing Slip|TikTok Shop|Seller Center|Print Date|Date\s*:|Total Packages|Total Items|Total Qty|Total Units|Page \d+|Item No\.|Barcode|Merchant ID|Order Details|Recipient|Shipping|Warehouse|Carrier|Batch ID|Picked By|Checked By|No\.\s+Order|Order\s*(?:ID|#|No\.?)\s*[:#-]?\s*\d{10,25}\s*$)/i.test(
        line,
      ) ||
      /^(?:Item No\.|No\.)\s+(?:Order ID\s+)?(?:Product Name|Product Title)/i.test(line) ||
      /^[-=_]{3,}$/.test(line)
    ) {
      continue;
    }

    const isExplicitNewRow =
      /^\s*\d{1,4}\s+(?:57\d{13,17}|[A-Za-z0-9_-]{8,})/.test(line) ||
      /^(?:Order\s*(?:ID|#|No\.?)|Package\s*(?:ID|#))\s*[:#-]?/i.test(line);

    const isSubLine =
      /^(?:Variation|Colour|Color|Size|SKU|Seller\s*SKU|Qty|Quantity|Notes?|Spec|Details?)\s*[:=]/i.test(
        line,
      );

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
        lines: [line],
        orderId: currentOrderId,
      });
    }
  }

  flushBuffer();

  const finalCandidates =
    candidateItems.length > 0
      ? candidateItems
      : cleanLines
          .filter((l) => l.length > 10 && !/^(page|print|tiktok|date)/i.test(l))
          .map((l) => ({ raw: l, lines: [l], orderId: undefined }));

  const items: DraftPickingItem[] = [];

  for (let idx = 0; idx < finalCandidates.length; idx++) {
    const candidate = finalCandidates[idx]!;

    // CRITICAL: Strict Field-Level Extraction Rules
    const fields = extractRowFields(
      candidate.lines && candidate.lines.length > 0 ? candidate.lines : [candidate.raw],
      candidate.orderId,
      candidate.raw,
    );

    // 1. Title Column Scope -> Category Keywords ONLY (strictly disables size extraction from title)
    const detectedP = detectProductCategoryFromTitle(fields.rawTitleText, pRules);

    // 2. Variation & Seller SKU Column Scope -> Size Keywords ONLY (Title column is NEVER inspected for sizes!)
    const detectedS = detectSizeFromVariationAndSku(
      fields.rawVariationText,
      fields.rawSkuText,
      sRules,
    );

    // 3. Quantity Scope -> Extracted exclusively from Qty column
    const qty = fields.quantity;
    const orderId = fields.orderId;
    const rawSku = fields.rawSkuText || undefined;

    // Look up inventory match
    const match = findInventoryMatch(
      detectedP.keyword,
      detectedS.canonicalSize,
      mappings,
      products,
    );

    const draftItem: DraftPickingItem = {
      id: `draft-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
      order_id: orderId,
      raw_title: fields.rawFull,
      raw_title_clean: fields.rawTitleText,
      raw_variation: fields.rawVariationText,
      detected_product_name: match.productName || detectedP.keyword,
      detected_size: detectedS.canonicalSize,
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

  // Aggregate into distinct Product Groups with summed quantities per size
  const productGroups = aggregatePickingItems(items, products);

  const totalUnits = items.reduce((sum, i) => sum + i.quantity, 0);
  const matchedCount = items.filter((i) => i.status === "matched").length;
  const unmatchedCount = items.filter((i) => i.status === "unmatched").length;

  return {
    items,
    productGroups,
    rawText,
    totalParsed: items.length,
    totalUnits,
    matchedCount,
    unmatchedCount,
    pageFilterResult,
  };
}

/**
 * Sample realistic TikTok Shop Picking List PDF text content for instant 1-click preview testing.
 * Strictly includes duplicate occurrences for Mattress Topper (Double Qty: 2, 1, 14 -> Total: 17)
 * and distinct categories (Satin Stripe Duvet Cover, Fitted Sheet) to verify grouping.
 */
export const SAMPLE_TIKTOK_PICKING_LIST_TEXT = `TikTok Shop Seller Center - Picking List
Batch ID: PKL-20260907-88912 | Date: 07/09/2026 10:15 AM
Warehouse: Main Fulfillment Center (UK) | Carrier: Evri 48hr Tracked

--------------------------------------------------------------------------------------
No.  Order ID              Product Title & Variations                              Qty   SKU
--------------------------------------------------------------------------------------
1    578901248920192801    Extra Thick Mattress Topper Single Double King Super King 10cm   2     TOP-DBL-10
                           Variation: Double (4ft6) | White Breathable Microfibre
2    578901248920192802    Overfilled Bed Mattress Topper 4ft Small Double         7     TOP-4FT-10
                           Variation: 4ft Small Double (120x190cm)
3    578901248920192803    Luxury Hotel Quality 10cm Extra Thick Mattress Topper   22    TOP-SNG-10
                           Variation: Single 3ft | Corner Anchor Straps
4    578901248920192804    Luxury Hotel Quality 10cm Extra Thick Mattress Topper   1     TOP-DBL-10
                           Variation: Double (4ft6) | White Breathable Microfibre
5    578901248920192805    Luxury Hotel Quality 10cm Extra Thick Mattress Topper   28    TOP-KNG-10
                           Variation: King (5ft) | Extra Deep Elastic Straps
6    578901248920192806    Luxury Hotel Quality 10cm Extra Thick Mattress Topper   4     TOP-SK-10
                           Variation: Super King (6ft) | 180x200cm
7    578901248920192807    Luxury Hotel Quality 10cm Extra Thick Mattress Topper   14    TOP-DBL-10
                           Variation: Double (4ft6) | White Breathable Microfibre
8    578901248920192808    Hotel Satin Stripe Duvet Cover Quilt Bedding Set        2     DUV-SNG-WHT
                           Variation: Single 3ft | 200TC Satin Stripe
9    578901248920192809    Hotel Satin Stripe Duvet Cover Quilt Bedding Set        3     DUV-DBL-WHT
                           Variation: Double (4ft6) | 200TC Satin Stripe
10   578901248920192810    Hotel Satin Stripe Duvet Cover Quilt Bedding Set        4     DUV-KNG-WHT
                           Variation: King (5ft) | 200TC Satin Stripe
11   578901248920192811    Hotel Satin Stripe Duvet Cover Quilt Bedding Set        2     DUV-SK-WHT
                           Variation: Super King (6ft) | 200TC Satin Stripe
12   578901248920192812    100% Egyptian Cotton 400TC Deep Fitted Bed Sheet        5     SHT-4FT-WHT
                           Variation: 4ft Small Double | Plain White
13   578901248920192813    100% Egyptian Cotton 400TC Deep Fitted Bed Sheet        8     SHT-DBL-GRY
                           Variation: Double (4ft6) | Slate Grey
14   578901248920192814    All Seasons Warm Anti-Allergy 13.5 Tog Winter Duvet     3     TOG-135-KNG
                           Variation: King Size (150x200cm) | Hollowfibre Fill
15   578901248920192815    Bounce Back Hotel Quality Sleeping Pillows Pair         6     PLW-PAIR-WHT
                           Variation: Pair (Pack of 2) | Ultra Soft Bounce
--------------------------------------------------------------------------------------
Total Items: 15 | Total Units: 118 | Picked By: _______________ Checked By: _______________
`;

/**
 * Sample realistic TikTok Shop Combined PDF text containing interleaved Shipping Labels and Packing Slips.
 * Demonstrates page filtering:
 * - Page 1: Evri Shipping Label (Filtered out - no SKU, Item Quantity, Product Name)
 * - Page 2: Packing Slip with SKU, Item Quantity, Product Name (PROCESSED)
 * - Page 3: Royal Mail Shipping Label (Filtered out - no SKU, Item Quantity, Product Name)
 * - Page 4: Packing Slip with SKU, Item Quantity, Product Name (PROCESSED)
 */
export const SAMPLE_COMBINED_LABEL_AND_PACKING_SLIP_TEXT = `--- PAGE BREAK ---
EVRI 48HR TRACKED POSTAGE PAID GB
Tracking Number: H4001928491028301
Deliver To:
Mr. James Miller
14 Maple Gardens, Wilmslow
Cheshire, SK9 2LP, United Kingdom
Consignment: EV-88912-A | Vol. Weight: 1.85kg | Service: Standard Parcel 48
[BARCODE: 578901248920192801]
Sender Return Address: Cozy Bedding Hub, Unit 4 Logistics Park, Manchester M17 1TN
If undelivered please return to sender.
--- PAGE BREAK ---
TikTok Shop Seller Center - Packing Slip
Order ID: 578901248920192801
Date: 07/09/2026 10:15 AM | Carrier: Evri 48hr Tracked
--------------------------------------------------------------------------------------
Item No.  Product Name / Variation                              Item Quantity   SKU
--------------------------------------------------------------------------------------
1         Luxury Hotel Quality 10cm Extra Thick Mattress Topper 2               TOP-DBL-10
          Variation: Double (4ft6) | White Breathable Microfibre
2         Hotel Satin Stripe Duvet Cover Quilt Bedding Set      3               DUV-DBL-WHT
          Variation: Double (4ft6) | 200TC Satin Stripe
--------------------------------------------------------------------------------------
Total Items: 2 | Total Qty: 5
--- PAGE BREAK ---
ROYAL MAIL TRACKED 24 POSTAGE PAID GB
Tracking ID: GB-RM-984019284910
Deliver To:
Mrs. Chloe Watson
48 Primrose Crescent
Edinburgh, EH12 8TY, United Kingdom
Consignment: RM-44910-B | Weight: 2.20kg
[BARCODE: 578901248920192802]
Return Address: Cozy Bedding Fulfillment, Manchester M17 1TN
--- PAGE BREAK ---
TikTok Shop Seller Center - Packing Slip
Order ID: 578901248920192802
Date: 07/09/2026 10:20 AM | Carrier: Royal Mail Tracked 24
--------------------------------------------------------------------------------------
Item No.  Product Name / Variation                              Item Quantity   SKU
--------------------------------------------------------------------------------------
1         Overfilled Bed Mattress Topper 4ft Small Double       5               TOP-4FT-10
          Variation: 4ft Small Double (120x190cm)
2         100% Egyptian Cotton 400TC Deep Fitted Bed Sheet      4               SHT-4FT-WHT
          Variation: 4ft Small Double | Plain White
--------------------------------------------------------------------------------------
Total Items: 2 | Total Qty: 9
`;
