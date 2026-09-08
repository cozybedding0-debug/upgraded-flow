import { useState, useEffect, useMemo, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { fetchProducts, getProducts } from "@/lib/productsStore";
import { saveLocalOrders, deductLocalStock } from "@/lib/ordersStore";
import ConfirmDialog from "@/components/ConfirmDialog";
import {
  getProductKeywordRules,
  getSizeKeywordRules,
  getKeywordMappings,
  saveProductKeywordRule,
  deleteProductKeywordRule,
  saveSizeKeywordRule,
  deleteSizeKeywordRule,
  saveKeywordMapping,
  deleteKeywordMapping,
  autoGenerateMappingsFromProducts,
  getPickingBatches,
  savePickingBatch,
  getSupabaseSqlSchema,
} from "@/lib/tiktokMappingStore";
import {
  extractTextFromPdf,
  parsePickingListText,
  testStrictFieldParsing,
  SAMPLE_TIKTOK_PICKING_LIST_TEXT,
  SAMPLE_COMBINED_LABEL_AND_PACKING_SLIP_TEXT,
  type FilteredPagesResult,
  type PageClassification,
} from "@/lib/pdfPickingParser";
import ProductGroupedTable from "@/components/ProductGroupedTable";
import type {
  Product,
  ProductKeywordRule,
  SizeKeywordRule,
  KeywordMapping,
  DraftPickingItem,
  PickingListBatch,
  DailyOrder,
  OrderStatus,
  ProductGroupSummary,
  AggregatedPickingItem,
} from "@/types";
import {
  Upload,
  FileText,
  Settings,
  CheckCircle2,
  AlertCircle,
  Plus,
  Trash2,
  Edit2,
  Sparkles,
  ArrowRight,
  Database,
  Copy,
  Check,
  Search,
  RefreshCw,
  Clock,
  ExternalLink,
  ChevronDown,
  Layers,
  ShoppingBag,
  Sliders,
  History,
  Info,
  Filter,
} from "lucide-react";

type ActiveTab = "upload" | "settings" | "history";

export default function TikTokParser({ onNavigateToOrders }: { onNavigateToOrders?: () => void }) {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState<ActiveTab>("upload");
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);

  // Parsing & Draft state
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [draftItems, setDraftItems] = useState<DraftPickingItem[]>([]);
  const [productGroups, setProductGroups] = useState<ProductGroupSummary[]>([]);
  const [selectedSizeIds, setSelectedSizeIds] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<"grouped" | "raw">("grouped");
  const [pageFilterInfo, setPageFilterInfo] = useState<FilteredPagesResult | null>(null);
  const [showPageBreakdown, setShowPageBreakdown] = useState<boolean>(false);
  const [batchName, setBatchName] = useState<string>("TikTok-Picking-List.pdf");
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  const [searchFilter, setSearchFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "matched" | "unmatched">("all");
  const [orderDate, setOrderDate] = useState<string>(new Date().toISOString().split("T")[0] || "");
  const [channelName, setChannelName] = useState<string>("TikTok Shop");

  // Approval / Submission modal & state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Manual Raw Text / Paste drawer
  const [showPasteModal, setShowPasteModal] = useState(false);
  const [pastedText, setPastedText] = useState("");

  // Settings state
  const [productRules, setProductRules] = useState<ProductKeywordRule[]>([]);
  const [sizeRules, setSizeRules] = useState<SizeKeywordRule[]>([]);
  const [mappings, setMappings] = useState<KeywordMapping[]>([]);
  const [batches, setBatches] = useState<PickingListBatch[]>([]);

  // Settings Form Modals
  const [editingPRule, setEditingPRule] = useState<ProductKeywordRule | null>(null);
  const [editingSRule, setEditingSRule] = useState<SizeKeywordRule | null>(null);
  const [editingMapping, setEditingMapping] = useState<KeywordMapping | null>(null);
  const [isNewPRule, setIsNewPRule] = useState(false);
  const [isNewSRule, setIsNewSRule] = useState(false);
  const [isNewMapping, setIsNewMapping] = useState(false);

  // Live Test Sandbox in Settings
  const [testMode, setTestMode] = useState<"fields" | "line">("fields");
  const [testTitle, setTestTitle] = useState(
    "Luxury 10cm Extra Thick Mattress Topper Single Double King Super King",
  );
  const [testVariation, setTestVariation] = useState("4ft Small Double / White");
  const [testSku, setTestSku] = useState("TOP-SMD-WHT");
  const [testQty, setTestQty] = useState(2);
  const [testInput, setTestInput] = useState(
    "Luxury Hotel Quality 10cm Extra Thick Mattress Topper - 4ft Small Double (120x190cm) Qty: 2",
  );
  const [copiedSql, setCopiedSql] = useState(false);

  // In-app custom confirmation dialog state
  const [confirmState, setConfirmState] = useState<{
    open: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    onConfirm: () => void;
  } | null>(null);
  const [mappingError, setMappingError] = useState<string | null>(null);

  // File input ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load products and rules
  const refreshAllData = async () => {
    setLoadingProducts(true);
    try {
      const prods = await fetchProducts();
      setProducts(prods);
      setProductRules(getProductKeywordRules());
      setSizeRules(getSizeKeywordRules());
      setMappings(getKeywordMappings());
      setBatches(getPickingBatches());
    } finally {
      setLoadingProducts(false);
    }
  };

  useEffect(() => {
    refreshAllData();
  }, []);

  // Update selected IDs when draft items change
  useEffect(() => {
    setSelectedItemIds(new Set(draftItems.map((i) => i.id)));
  }, [draftItems]);

  // Handle PDF file upload
  const handleFileUpload = async (file: File) => {
    if (!file) return;
    setIsExtracting(true);
    setExtractError(null);
    setSubmitSuccess(null);
    setBatchName(file.name);

    try {
      const extractionResult = await extractTextFromPdf(file);
      const text = extractionResult.text;
      if (!text || text.trim().length === 0) {
        throw new Error(
          "Could not extract text from the PDF. The file may be scanned or password protected.",
        );
      }

      // Record page classification / filtering results
      if (extractionResult.pageClassifications && extractionResult.pageClassifications.length > 0) {
        setPageFilterInfo({
          isCombinedDocument: extractionResult.isCombinedDocument,
          totalPages: extractionResult.totalPages,
          processedPages: extractionResult.processedPageNumbers,
          filteredPages: extractionResult.filteredPageNumbers,
          pageClassifications: extractionResult.pageClassifications,
          filteredText: extractionResult.text,
        });
      } else {
        setPageFilterInfo(null);
      }

      const currentProducts = products.length > 0 ? products : getProducts();
      const parseResult = parsePickingListText(text, currentProducts);

      if (parseResult.items.length === 0) {
        throw new Error(
          "No line items could be detected in the PDF. Try adjusting your keyword rules or use the manual paste option.",
        );
      }

      setDraftItems(parseResult.items);
      setSelectedItemIds(new Set(parseResult.items.map((i) => i.id)));
      setProductGroups(parseResult.productGroups);
      setSelectedSizeIds(
        new Set(parseResult.productGroups.flatMap((g) => g.sizes.map((s) => s.id))),
      );
      setActiveTab("upload");
    } catch (err: unknown) {
      console.error("PDF Parsing Error:", err);
      setExtractError(err instanceof Error ? err.message : "Failed to parse PDF file.");
    } finally {
      setIsExtracting(false);
    }
  };

  // Quick load sample picking list for instant testing
  const handleLoadSample = () => {
    setExtractError(null);
    setSubmitSuccess(null);
    setBatchName("TikTok-Sample-PickingList-Evri48.pdf");
    const currentProducts = products.length > 0 ? products : getProducts();
    const parseResult = parsePickingListText(SAMPLE_TIKTOK_PICKING_LIST_TEXT, currentProducts);
    setDraftItems(parseResult.items);
    setSelectedItemIds(new Set(parseResult.items.map((i) => i.id)));
    setProductGroups(parseResult.productGroups);
    setSelectedSizeIds(new Set(parseResult.productGroups.flatMap((g) => g.sizes.map((s) => s.id))));
    setPageFilterInfo(parseResult.pageFilterResult || null);
  };

  // Quick load sample combined PDF (Shipping Labels + Packing Slips) to demonstrate smart page filtering
  const handleLoadCombinedSample = () => {
    setExtractError(null);
    setSubmitSuccess(null);
    setBatchName("TikTok-Combined-Labels-And-PackingSlips.pdf");
    const currentProducts = products.length > 0 ? products : getProducts();
    const parseResult = parsePickingListText(
      SAMPLE_COMBINED_LABEL_AND_PACKING_SLIP_TEXT,
      currentProducts,
    );
    setDraftItems(parseResult.items);
    setSelectedItemIds(new Set(parseResult.items.map((i) => i.id)));
    setProductGroups(parseResult.productGroups);
    setSelectedSizeIds(new Set(parseResult.productGroups.flatMap((g) => g.sizes.map((s) => s.id))));
    setPageFilterInfo(parseResult.pageFilterResult || null);
    setShowPageBreakdown(true);
  };

  // Handle manual text paste
  const handleParsePastedText = () => {
    if (!pastedText.trim()) return;
    setExtractError(null);
    setSubmitSuccess(null);
    setBatchName("TikTok-Pasted-List.txt");
    const currentProducts = products.length > 0 ? products : getProducts();
    const parseResult = parsePickingListText(pastedText, currentProducts);
    setDraftItems(parseResult.items);
    setSelectedItemIds(new Set(parseResult.items.map((i) => i.id)));
    setProductGroups(parseResult.productGroups);
    setSelectedSizeIds(new Set(parseResult.productGroups.flatMap((g) => g.sizes.map((s) => s.id))));
    setShowPasteModal(false);
    setPastedText("");
  };

  // Re-run parsing / matching on current draft items with latest keyword mappings
  const handleReapplyRules = () => {
    if (draftItems.length === 0) return;
    const currentProducts = products.length > 0 ? products : getProducts();
    const rawText = draftItems.map((i) => i.raw_title).join("\n");
    const parseResult = parsePickingListText(rawText, currentProducts);
    setDraftItems(parseResult.items);
    setSelectedItemIds(new Set(parseResult.items.map((i) => i.id)));
    setProductGroups(parseResult.productGroups);
    setSelectedSizeIds(new Set(parseResult.productGroups.flatMap((g) => g.sizes.map((s) => s.id))));
  };

  // Quick map an item from dropdown in draft review table
  const handleUpdateDraftItemMatch = (itemId: string, productId: string, variantId?: string) => {
    const product = products.find((p) => p.id === productId);
    if (!product) return;

    setDraftItems((prev) =>
      prev.map((item) => {
        if (item.id !== itemId) return item;

        if (variantId && product.variants?.length) {
          const variant = product.variants.find((v) => v.id === variantId);
          return {
            ...item,
            status: "manual",
            product_id: product.id,
            product_name: product.product_name,
            variant_id: variant ? variant.id : undefined,
            variant_name: variant
              ? `${variant.variation_value}${variant.color ? ` - ${variant.color}` : ""}`
              : undefined,
            unit_price: variant?.unit_price || product.unit_price,
            sku: variant?.sku || product.sku,
            available_stock: variant?.stock_quantity,
            category: product.category,
          };
        }

        return {
          ...item,
          status: "manual",
          product_id: product.id,
          product_name: product.product_name,
          variant_id: undefined,
          variant_name: product.size || item.detected_size,
          unit_price: product.unit_price,
          sku: product.sku,
          available_stock: product.stock_quantity,
          category: product.category,
        };
      }),
    );
  };

  // Quick save mapping from row into persistent keyword dictionary
  const handleSaveRowAsRule = (item: DraftPickingItem) => {
    if (!item.product_id || !item.product_name) return;

    saveKeywordMapping({
      product_keyword: item.detected_product_name,
      size_keyword: item.detected_size,
      product_id: item.product_id,
      product_name: item.product_name,
      variant_id: item.variant_id,
      variant_name: item.variant_name,
      sku: item.sku || "",
      notes: `Created from TikTok picking list row: ${item.order_id || item.raw_title.slice(0, 30)}`,
    });

    setMappings(getKeywordMappings());
    // Flash status to matched
    setDraftItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, status: "matched" } : i)));
  };

  // Auto-generate mappings from current inventory
  const handleAutoGenerate = () => {
    const res = autoGenerateMappingsFromProducts(products);
    setMappings(getKeywordMappings());
    handleReapplyRules();
    setSuccessMsg(
      `Scanned ${products.length} inventory products: generated ${res.createdCount} new keyword mappings! Total mappings: ${res.totalMappings}`,
    );
    setTimeout(() => setSuccessMsg(null), 5000);
  };

  // Clear all draft items with in-app confirmation
  const handleClearDraft = () => {
    if (draftItems.length === 0 && productGroups.length === 0) return;
    setConfirmState({
      open: true,
      title: "Clear Draft Items",
      message: `Are you sure you want to discard all parsed draft items and categories? Any unsaved modifications will be lost.`,
      confirmLabel: "Clear All",
      onConfirm: () => {
        setDraftItems([]);
        setSelectedItemIds(new Set());
        setProductGroups([]);
        setSelectedSizeIds(new Set());
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
        setExtractError(null);
        setSuccessMsg("Draft items cleared successfully.");
        setTimeout(() => setSuccessMsg(null), 3000);
        setConfirmState(null);
      },
    });
  };

  // Toggle item selection in raw draft table
  const toggleSelectItem = (id: string) => {
    setSelectedItemIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedItemIds.size === filteredItems.length) {
      setSelectedItemIds(new Set());
    } else {
      setSelectedItemIds(new Set(filteredItems.map((i) => i.id)));
    }
  };

  // Grouped Product handlers
  const handleToggleSelectSize = (sizeId: string) => {
    setSelectedSizeIds((prev) => {
      const next = new Set(prev);
      if (next.has(sizeId)) next.delete(sizeId);
      else next.add(sizeId);
      return next;
    });
  };

  const handleToggleSelectGroup = (groupId: string) => {
    const group = productGroups.find((g) => g.id === groupId);
    if (!group) return;
    const groupSizeIds = group.sizes.map((s) => s.id);
    const allInGroupSelected =
      groupSizeIds.length > 0 && groupSizeIds.every((id) => selectedSizeIds.has(id));

    setSelectedSizeIds((prev) => {
      const next = new Set(prev);
      if (allInGroupSelected) {
        groupSizeIds.forEach((id) => next.delete(id));
      } else {
        groupSizeIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const handleSelectAllSizes = () => {
    setSelectedSizeIds(new Set(productGroups.flatMap((g) => g.sizes.map((s) => s.id))));
  };

  const handleDeselectAllSizes = () => {
    setSelectedSizeIds(new Set());
  };

  const handleUpdateSizeQty = (groupId: string, sizeId: string, newQty: number) => {
    const q = Math.max(1, newQty);
    setProductGroups((prev) =>
      prev.map((g) => {
        if (g.id !== groupId) return g;
        const updatedSizes = g.sizes.map((s) =>
          s.id === sizeId ? { ...s, total_quantity: q } : s,
        );
        const totalQty = updatedSizes.reduce((sum, s) => sum + s.total_quantity, 0);
        return { ...g, sizes: updatedSizes, total_quantity: totalQty };
      }),
    );
  };

  const handleUpdateSizeDetails = (
    groupId: string,
    sizeId: string,
    newSize: string,
    newQty: number,
    productId?: string,
    variantId?: string,
  ) => {
    const product = products.find((p) => p.id === productId);
    const variant = product?.variants?.find((v) => v.id === variantId);

    setProductGroups((prev) =>
      prev.map((g) => {
        if (g.id !== groupId) return g;
        const updatedSizes = g.sizes.map((s) => {
          if (s.id !== sizeId) return s;
          return {
            ...s,
            size: newSize,
            canonical_size: newSize,
            total_quantity: Math.max(1, newQty),
            product_id: productId || s.product_id,
            product_name: product?.product_name || s.product_name,
            variant_id: variantId || s.variant_id,
            variant_name: variant
              ? `${variant.variation_value}${variant.color ? ` - ${variant.color}` : ""}`
              : product
                ? newSize
                : s.variant_name,
            status: (productId ? "matched" : s.status) as "matched" | "unmatched" | "manual",
            unit_price: variant?.unit_price || product?.unit_price || s.unit_price,
            sku: variant?.sku || product?.sku || s.sku,
            available_stock:
              variant?.stock_quantity ?? product?.stock_quantity ?? s.available_stock,
            category: product?.category || s.category,
          };
        });
        const totalQty = updatedSizes.reduce((sum, s) => sum + s.total_quantity, 0);
        return {
          ...g,
          sizes: updatedSizes,
          total_quantity: totalQty,
          matched_count: updatedSizes.filter((s) => s.status === "matched").length,
          unmatched_count: updatedSizes.filter((s) => s.status === "unmatched").length,
        };
      }),
    );
  };

  const handleDeleteSize = (groupId: string, sizeId: string) => {
    setProductGroups((prev) =>
      prev
        .map((g) => {
          if (g.id !== groupId) return g;
          const updatedSizes = g.sizes.filter((s) => s.id !== sizeId);
          const totalQty = updatedSizes.reduce((sum, s) => sum + s.total_quantity, 0);
          return {
            ...g,
            sizes: updatedSizes,
            total_sizes: updatedSizes.length,
            total_quantity: totalQty,
            matched_count: updatedSizes.filter((s) => s.status === "matched").length,
            unmatched_count: updatedSizes.filter((s) => s.status === "unmatched").length,
          };
        })
        .filter((g) => g.sizes.length > 0),
    );
    setSelectedSizeIds((prev) => {
      const next = new Set(prev);
      next.delete(sizeId);
      return next;
    });
  };

  const handleAddSizeToGroup = (groupId: string, sizeName: string, quantity: number) => {
    setProductGroups((prev) =>
      prev.map((g) => {
        if (g.id !== groupId) return g;
        const cleanSize = (sizeName || "").trim();
        if (!cleanSize) return g;
        const existing = g.sizes.find(
          (s) => s.canonical_size.toLowerCase() === cleanSize.toLowerCase(),
        );
        if (existing) {
          return {
            ...g,
            sizes: g.sizes.map((s) =>
              s.id === existing.id ? { ...s, total_quantity: s.total_quantity + quantity } : s,
            ),
            total_quantity: g.total_quantity + quantity,
          };
        }

        const newId = `agg-${groupId}-${cleanSize.replace(/[^a-z0-9]/gi, "-")}-${Date.now()}`;
        const newSizeItem: AggregatedPickingItem = {
          id: newId,
          size: cleanSize,
          canonical_size: cleanSize,
          total_quantity: quantity,
          raw_count: 1,
          source_order_ids: [],
          raw_titles: [`Manual ${g.group_name} ${cleanSize}`],
          status: "unmatched",
          category: g.category,
          unit_price: 0,
          selected: true,
        };

        setSelectedSizeIds((p) => new Set(p).add(newId));
        const updatedSizes = [...g.sizes, newSizeItem];
        return {
          ...g,
          sizes: updatedSizes,
          total_sizes: updatedSizes.length,
          total_quantity: g.total_quantity + quantity,
          unmatched_count: g.unmatched_count + 1,
        };
      }),
    );
  };

  const handleAddProductGroup = (categoryName: string) => {
    const clean = (categoryName || "").trim();
    if (!clean) return;
    const newGroup: ProductGroupSummary = {
      id: `group-${clean.toLowerCase().replace(/[^a-z0-9]/g, "-")}-${Date.now()}`,
      group_name: clean.toUpperCase(),
      product_keyword: clean,
      category: "Bedding",
      total_quantity: 0,
      total_sizes: 0,
      matched_count: 0,
      unmatched_count: 0,
      sizes: [],
    };
    setProductGroups((prev) => [newGroup, ...prev]);
  };

  const handleSavePermanentRule = (
    productKeyword: string,
    sizeKeyword: string,
    productId: string,
    variantId?: string,
  ) => {
    const product = products.find((p) => p.id === productId);
    const variant = product?.variants?.find((v) => v.id === variantId);

    saveKeywordMapping({
      product_keyword: productKeyword,
      size_keyword: sizeKeyword,
      product_id: productId,
      product_name: product?.product_name || productKeyword,
      variant_id: variantId,
      variant_name: variant
        ? `${variant.variation_value}${variant.color ? ` - ${variant.color}` : ""}`
        : undefined,
      sku: variant?.sku || product?.sku || "",
      notes: `Mapped from Review Table: ${productKeyword} - ${sizeKeyword}`,
    });

    setMappings(getKeywordMappings());
    setSuccessMsg(
      `Saved permanent rule: "${productKeyword}" + "${sizeKeyword}" mapped to ${product?.product_name}!`,
    );
    setTimeout(() => setSuccessMsg(null), 4000);
  };

  // Delete raw draft item
  const handleDeleteDraftItem = (id: string) => {
    setDraftItems((prev) => prev.filter((i) => i.id !== id));
  };

  // Add new empty draft item
  const handleAddManualItem = () => {
    const newItem: DraftPickingItem = {
      id: `draft-${Date.now()}-manual`,
      raw_title: "Manual Entry",
      detected_product_name: "Mattress Topper",
      detected_size: "Double",
      quantity: 1,
      unit_price: 0,
      status: "unmatched",
      selected: true,
    };
    setDraftItems((prev) => [newItem, ...prev]);
  };

  // Bulk Approve & Submit Entries to Inventory
  const handleApproveAndSubmit = async () => {
    const itemsToSubmit: DraftPickingItem[] =
      viewMode === "grouped" && productGroups.length > 0
        ? productGroups.flatMap((group) =>
            group.sizes
              .filter((size) => selectedSizeIds.has(size.id))
              .map((size, idx) => ({
                id: size.id,
                order_id:
                  size.source_order_ids[0] || `PKL-${Date.now().toString().slice(-6)}-${idx + 1}`,
                raw_title: size.raw_titles[0] || `${group.group_name} (${size.canonical_size})`,
                detected_product_name: group.product_keyword,
                detected_size: size.canonical_size,
                quantity: size.total_quantity,
                unit_price: size.unit_price || 0,
                sku: size.sku,
                status: size.status,
                product_id: size.product_id,
                product_name: size.product_name || group.product_keyword,
                variant_id: size.variant_id,
                variant_name: size.variant_name || size.canonical_size,
                available_stock: size.available_stock,
                category: size.category || group.category || "Bedding",
                selected: true,
              })),
          )
        : draftItems.filter((i) => selectedItemIds.has(i.id));

    if (itemsToSubmit.length === 0) return;

    setIsSubmitting(true);
    setExtractError(null);

    const userId = profile?.id ? String(profile.id) : "user-local";
    const now = new Date().toISOString();
    const batchId = `pkl-${Date.now()}`;

    // 1. Prepare Daily Orders insert data
    const newOrders: DailyOrder[] = itemsToSubmit.map((item, idx) => ({
      id: `order-tiktok-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
      user_id: userId,
      product_id: item.product_id || null,
      variant_id: item.variant_id || null,
      product_name: item.product_name || item.detected_product_name,
      category: item.category || "Bedding",
      size: item.variant_name || item.detected_size,
      unit_price: item.unit_price || 0,
      quantity: item.quantity,
      total_price: (item.unit_price || 0) * item.quantity,
      order_date: orderDate,
      channel: channelName,
      notes: `TikTok Picking List Import [${batchName}] | Order: ${item.order_id || "N/A"}`,
      logged_by: userId,
      customer_name: item.order_id ? `TikTok Order #${item.order_id}` : "TikTok Shop Customer",
      customer_order_id: item.order_id || String(Date.now() + idx),
      status: "Completed" as OrderStatus,
      created_at: now,
    }));

    // 2. Prepare stock deduction items
    const deductionItems = itemsToSubmit
      .filter((i) => i.product_id)
      .map((i) => ({
        product_id: i.product_id || null,
        variant_id: i.variant_id || null,
        quantity: i.quantity,
      }));

    try {
      // Deduct local stock immediately
      deductLocalStock(deductionItems);
      // Save local orders
      saveLocalOrders(newOrders);

      // If Supabase is configured and connected, push remote records
      if (isSupabaseConfigured && profile?.id) {
        const supabaseInsertData = newOrders.map((o) => ({
          user_id: o.user_id,
          product_id: o.product_id,
          variant_id: o.variant_id,
          product_name: o.product_name,
          category: o.category,
          size: o.size,
          unit_price: o.unit_price,
          quantity: o.quantity,
          total_price: o.total_price,
          order_date: o.order_date,
          channel: o.channel,
          notes: o.notes,
          logged_by: o.logged_by,
          customer_name: o.customer_name,
          customer_order_id: o.customer_order_id,
          status: o.status,
        }));

        const { error: orderError } = await supabase.from("orders").insert(supabaseInsertData);
        if (orderError) console.warn("Supabase orders insert note:", orderError.message);

        // Deduct variant stock in Supabase
        for (const item of deductionItems) {
          if (item.variant_id) {
            const { data: vData } = await supabase
              .from("product_variants")
              .select("stock_quantity")
              .eq("id", item.variant_id)
              .single();
            if (vData) {
              const newStock = Math.max(0, (vData.stock_quantity || 0) - item.quantity);
              await supabase
                .from("product_variants")
                .update({ stock_quantity: newStock, updated_at: now })
                .eq("id", item.variant_id);
            }
          } else if (item.product_id) {
            const { data: pData } = await supabase
              .from("products")
              .select("stock_quantity")
              .eq("id", item.product_id)
              .single();
            if (pData) {
              const newStock = Math.max(0, (pData.stock_quantity || 0) - item.quantity);
              await supabase
                .from("products")
                .update({ stock_quantity: newStock, updated_at: now })
                .eq("id", item.product_id);
            }
          }
        }
      }

      // 3. Save batch record in history
      const totalUnits = itemsToSubmit.reduce((sum, i) => sum + i.quantity, 0);
      const batchRecord: PickingListBatch = {
        id: batchId,
        filename: batchName,
        uploaded_at: now,
        total_items: itemsToSubmit.length,
        matched_items: itemsToSubmit.filter((i) => i.product_id).length,
        unmatched_items: itemsToSubmit.filter((i) => !i.product_id).length,
        total_quantity: totalUnits,
        status: "submitted",
        items: itemsToSubmit,
      };
      savePickingBatch(batchRecord);
      setBatches(getPickingBatches());

      // 4. Refresh product list to show new inventory levels
      await fetchProducts();

      // Clear draft & set success
      setDraftItems([]);
      setShowApproveModal(false);
      setSubmitSuccess(
        `Successfully logged ${itemsToSubmit.length} order items (${totalUnits} total units) to ${channelName} and updated stock levels in inventory!`,
      );
    } catch (err: unknown) {
      console.error("Submission error:", err);
      setExtractError(err instanceof Error ? err.message : "Failed to submit entries.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filtered draft items
  const filteredItems = useMemo(() => {
    return draftItems.filter((item) => {
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "matched" && (item.status === "matched" || item.status === "manual")) ||
        (statusFilter === "unmatched" && item.status === "unmatched");

      const q = searchFilter.toLowerCase();
      const matchesSearch =
        !q ||
        item.detected_product_name.toLowerCase().includes(q) ||
        item.detected_size.toLowerCase().includes(q) ||
        (item.product_name && item.product_name.toLowerCase().includes(q)) ||
        (item.variant_name && item.variant_name.toLowerCase().includes(q)) ||
        (item.order_id && item.order_id.toLowerCase().includes(q)) ||
        (item.sku && item.sku.toLowerCase().includes(q)) ||
        item.raw_title.toLowerCase().includes(q);

      return matchesStatus && matchesSearch;
    });
  }, [draftItems, statusFilter, searchFilter]);

  // Draft metrics
  const metrics = useMemo(() => {
    const total = draftItems.length;
    const matched = draftItems.filter(
      (i) => i.status === "matched" || i.status === "manual",
    ).length;
    const unmatched = draftItems.filter((i) => i.status === "unmatched").length;
    const totalUnits = draftItems.reduce((sum, i) => sum + i.quantity, 0);
    const selectedUnits = draftItems
      .filter((i) => selectedItemIds.has(i.id))
      .reduce((sum, i) => sum + i.quantity, 0);

    return { total, matched, unmatched, totalUnits, selectedUnits };
  }, [draftItems, selectedItemIds]);

  const totalGroupedUnits = useMemo(() => {
    return productGroups.reduce(
      (sum, g) =>
        sum +
        g.sizes
          .filter((s) => selectedSizeIds.has(s.id))
          .reduce((acc, s) => acc + s.total_quantity, 0),
      0,
    );
  }, [productGroups, selectedSizeIds]);

  const totalGroupedSizes = useMemo(() => {
    return productGroups.reduce(
      (sum, g) => sum + g.sizes.filter((s) => selectedSizeIds.has(s.id)).length,
      0,
    );
  }, [productGroups, selectedSizeIds]);

  // Live test result in Settings Sandbox
  const testSandboxResult = useMemo(() => {
    if (!testInput.trim()) return null;
    return parsePickingListText(testInput, products);
  }, [testInput, products]);

  const testFieldResult = useMemo(() => {
    return testStrictFieldParsing(testTitle, testVariation, testSku, testQty, products);
  }, [testTitle, testVariation, testSku, testQty, products]);

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-pink-500/10 text-pink-600 dark:text-pink-400 flex items-center justify-center font-bold">
              TT
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                TikTok Shop Picking List Parser
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300">
                  Automated
                </span>
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Extract orders from PDF picking lists, match dynamic keywords, verify draft items,
                and deduct inventory
              </p>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
          <button
            onClick={() => setActiveTab("upload")}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg transition-all ${
              activeTab === "upload"
                ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <Upload size={15} />
            Upload & Review
            {draftItems.length > 0 && (
              <span className="w-5 h-5 rounded-full bg-brand-600 text-white text-[10px] flex items-center justify-center">
                {draftItems.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("settings")}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg transition-all ${
              activeTab === "settings"
                ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <Settings size={15} />
            Keyword Rules & SKU Mapping
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-300">
              {productRules.length + sizeRules.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("history")}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg transition-all ${
              activeTab === "history"
                ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <History size={15} />
            Upload Logs
            {batches.length > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-300">
                {batches.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Alert banner for success */}
      {submitSuccess && (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 flex items-start justify-between gap-3 animate-in fade-in">
          <div className="flex items-start gap-2.5">
            <CheckCircle2
              size={18}
              className="mt-0.5 text-emerald-600 dark:text-emerald-400 shrink-0"
            />
            <div className="text-sm">
              <p className="font-semibold">Inventory Updated Successfully</p>
              <p className="text-xs text-emerald-700 dark:text-emerald-400/90 mt-0.5">
                {submitSuccess}
              </p>
            </div>
          </div>
          {onNavigateToOrders && (
            <button
              onClick={onNavigateToOrders}
              className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 hover:underline flex items-center gap-1 shrink-0"
            >
              View Daily Orders <ArrowRight size={13} />
            </button>
          )}
        </div>
      )}

      {/* Alert banner for info / actions */}
      {successMsg && (
        <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-300 flex items-start justify-between gap-3 animate-in fade-in">
          <div className="flex items-start gap-2.5">
            <CheckCircle2 size={18} className="mt-0.5 text-blue-600 dark:text-blue-400 shrink-0" />
            <div className="text-sm">
              <p className="font-semibold">{successMsg}</p>
            </div>
          </div>
          <button
            onClick={() => setSuccessMsg(null)}
            className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Alert banner for errors */}
      {extractError && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 flex items-start gap-2.5">
          <AlertCircle size={18} className="mt-0.5 text-rose-600 dark:text-rose-400 shrink-0" />
          <div className="text-sm">
            <p className="font-semibold">Extraction Warning</p>
            <p className="text-xs mt-0.5 text-rose-700 dark:text-rose-400/90">{extractError}</p>
          </div>
        </div>
      )}

      {/* ================= TAB 1: UPLOAD & DRAFT REVIEW ================= */}
      {activeTab === "upload" && (
        <div className="space-y-6">
          {/* Upload Dropzone */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              {/* Drop area */}
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (e.dataTransfer.files?.[0]) {
                    handleFileUpload(e.dataTransfer.files[0]);
                  }
                }}
                className="w-full md:w-2/3 border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-brand-500 dark:hover:border-brand-500 rounded-2xl p-6 sm:p-8 text-center cursor-pointer transition-all bg-slate-50/60 dark:bg-slate-800/30 hover:bg-brand-50/20 dark:hover:bg-brand-900/10 group"
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".pdf"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files?.[0]) {
                      handleFileUpload(e.target.files[0]);
                    }
                  }}
                />

                <div className="flex flex-col items-center gap-2.5">
                  <div className="w-12 h-12 rounded-2xl bg-brand-100 dark:bg-brand-900/40 text-brand-600 dark:text-brand-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                    {isExtracting ? (
                      <RefreshCw size={24} className="animate-spin text-brand-600" />
                    ) : (
                      <Upload size={24} />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                      {isExtracting
                        ? "Parsing TikTok Shop PDF..."
                        : "Click to browse or drop TikTok Picking List PDF"}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Supports TikTok Shop Picking Lists, Packing Slips & Combined Documents (.pdf)
                    </p>
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200/60 dark:border-blue-800/40 mt-1.5">
                      <Filter size={12} className="text-blue-600 dark:text-blue-400" />
                      <span>
                        Smart Page Filter: Isolates Packing Slips via SKU, Item Quantity, Qty,
                        Product Name
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Quick Actions & Alternative input */}
              <div className="w-full md:w-1/3 flex flex-col gap-2.5 border-t md:border-t-0 md:border-l border-slate-200 dark:border-slate-800 pt-4 md:pt-0 md:pl-6">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Quick Actions
                </p>

                <button
                  onClick={handleLoadSample}
                  disabled={isExtracting}
                  className="w-full flex items-center justify-between px-3.5 py-2.5 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors shadow-xs"
                >
                  <span className="flex items-center gap-2">
                    <Sparkles size={15} className="text-amber-500" />
                    Load Sample Picking List
                  </span>
                  <span className="text-[10px] text-slate-400">10 items</span>
                </button>

                <button
                  onClick={handleLoadCombinedSample}
                  disabled={isExtracting}
                  className="w-full flex items-center justify-between px-3.5 py-2.5 text-xs font-semibold rounded-xl border border-blue-200 dark:border-blue-800/80 bg-blue-50/50 dark:bg-blue-950/30 hover:bg-blue-100/60 dark:hover:bg-blue-900/40 text-blue-800 dark:text-blue-300 transition-colors shadow-xs group"
                >
                  <span className="flex items-center gap-2">
                    <Filter
                      size={15}
                      className="text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform"
                    />
                    Test Combined PDF (Labels + Slips)
                  </span>
                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-blue-200/60 dark:bg-blue-800/60 text-blue-700 dark:text-blue-300">
                    Filtered
                  </span>
                </button>

                <button
                  onClick={() => setShowPasteModal(true)}
                  className="w-full flex items-center justify-between px-3.5 py-2.5 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors shadow-xs"
                >
                  <span className="flex items-center gap-2">
                    <FileText size={15} className="text-brand-500" />
                    Paste Raw Text Directly
                  </span>
                  <span className="text-[10px] text-slate-400">Manual</span>
                </button>

                <button
                  onClick={handleAutoGenerate}
                  className="w-full flex items-center justify-between px-3.5 py-2.5 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors shadow-xs"
                >
                  <span className="flex items-center gap-2">
                    <Layers size={15} className="text-indigo-500" />
                    Auto-Link Current Inventory
                  </span>
                  <span className="text-[10px] text-slate-400">{products.length} prods</span>
                </button>
              </div>
            </div>
          </div>

          {/* Combined Document Filter Notice */}
          {pageFilterInfo && pageFilterInfo.filteredPages.length > 0 && (
            <div className="bg-gradient-to-r from-blue-50/90 via-indigo-50/60 to-blue-50/90 dark:from-blue-950/40 dark:via-indigo-950/30 dark:to-blue-950/40 border border-blue-200/80 dark:border-blue-800/60 rounded-2xl p-4 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 mt-0.5">
                    <Filter size={18} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-blue-950 dark:text-blue-200">
                        Combined PDF Filter Active
                      </span>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300">
                        <CheckCircle2 size={12} /> {pageFilterInfo.processedPages.length} of{" "}
                        {pageFilterInfo.totalPages} pages processed
                      </span>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300">
                        {pageFilterInfo.filteredPages.length} Shipping Labels filtered out
                      </span>
                    </div>
                    <p className="text-xs text-blue-900/80 dark:text-blue-300/80 mt-1">
                      Only pages containing Packing List data (keywords: <strong>SKU</strong>,{" "}
                      <strong>Item Quantity</strong>, <strong>Qty</strong>,{" "}
                      <strong>Product Name</strong>) were processed. Shipping label pages (Pages{" "}
                      {pageFilterInfo.filteredPages.join(", ")}) were automatically excluded.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowPageBreakdown(!showPageBreakdown)}
                  className="self-start sm:self-center flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-slate-700 text-blue-700 dark:text-blue-300 border border-blue-200/80 dark:border-blue-700/60 transition-colors shrink-0 shadow-xs"
                >
                  <Info size={13} />
                  {showPageBreakdown ? "Hide Page Details" : "View Page Details"}
                  <ChevronDown
                    size={14}
                    className={`transition-transform duration-200 ${showPageBreakdown ? "rotate-180" : ""}`}
                  />
                </button>
              </div>

              {/* Expandable Page Breakdown Grid */}
              {showPageBreakdown && (
                <div className="mt-3.5 pt-3 border-t border-blue-200/70 dark:border-blue-800/50">
                  <p className="text-[11px] font-bold text-blue-900 dark:text-blue-300 uppercase tracking-wider mb-2.5">
                    Page-by-Page Detection Analysis:
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                    {pageFilterInfo.pageClassifications.map((p) => (
                      <div
                        key={p.pageNumber}
                        className={`p-3 rounded-xl border text-xs transition-all ${
                          p.isPackingSlip
                            ? "bg-white dark:bg-slate-900 border-emerald-300 dark:border-emerald-800/70 text-slate-800 dark:text-slate-200 shadow-xs"
                            : "bg-slate-100/70 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700/60 text-slate-500 dark:text-slate-400"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1 mb-1.5">
                          <span className="font-bold text-xs">Page {p.pageNumber}</span>
                          {p.isPackingSlip ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50">
                              Packing Slip (Processed)
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                              Shipping Label (Filtered)
                            </span>
                          )}
                        </div>
                        <div className="space-y-1.5 mt-2">
                          <div>
                            <span className="text-[10px] font-semibold text-slate-400 block mb-0.5">
                              Detected Signals:
                            </span>
                            {p.matchedKeywords.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {p.matchedKeywords.map((kw, i) => (
                                  <span
                                    key={i}
                                    className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-blue-50 dark:bg-blue-950/70 text-blue-600 dark:text-blue-300 border border-blue-200/60 dark:border-blue-800/50"
                                  >
                                    {kw}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-[10px] italic text-slate-400">
                                Carrier / Address only
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-slate-400 dark:text-slate-500 line-clamp-2 italic bg-slate-50 dark:bg-slate-800/60 p-1.5 rounded-lg border border-slate-100 dark:border-slate-800">
                            "{p.snippet}"
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Active Picking List Control & View Mode Switcher */}
          {(draftItems.length > 0 || productGroups.length > 0) && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 shadow-xs">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 pl-1">
                  View Mode:
                </span>
                <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setViewMode("grouped")}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      viewMode === "grouped"
                        ? "bg-white dark:bg-slate-700 text-brand-600 dark:text-brand-300 shadow-xs"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                    }`}
                  >
                    <Layers size={14} /> Grouped by Category ({productGroups.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode("raw")}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      viewMode === "raw"
                        ? "bg-white dark:bg-slate-700 text-brand-600 dark:text-brand-300 shadow-xs"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                    }`}
                  >
                    <FileText size={14} /> Raw Parsed Lines ({draftItems.length})
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleReapplyRules}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all"
                  title="Re-run product & size keywords on all extracted items"
                >
                  <RefreshCw size={13} /> Refresh Rules
                </button>
                <button
                  type="button"
                  onClick={handleClearDraft}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-all"
                >
                  <Trash2 size={13} /> Clear Draft
                </button>
                <button
                  type="button"
                  onClick={() => setShowApproveModal(true)}
                  disabled={
                    viewMode === "grouped" ? selectedSizeIds.size === 0 : selectedItemIds.size === 0
                  }
                  className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs disabled:opacity-50 transition-all"
                >
                  <Check size={14} /> Commit to Inventory (
                  {viewMode === "grouped" ? totalGroupedUnits : metrics.selectedUnits} units)
                </button>
              </div>
            </div>
          )}

          {/* Metrics Summary Bar */}
          {(draftItems.length > 0 || productGroups.length > 0) && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {viewMode === "grouped" ? (
                <>
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs">
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                      Product Groups
                    </p>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                      {productGroups.length}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Isolated product categories</p>
                  </div>

                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs">
                    <p className="text-xs text-blue-600 dark:text-blue-400 font-medium flex items-center gap-1.5">
                      <Layers size={14} /> Distinct Sizes
                    </p>
                    <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">
                      {productGroups.reduce((sum, g) => sum + g.sizes.length, 0)}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Strictly 1 row per size</p>
                  </div>

                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs">
                    <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1.5">
                      <CheckCircle2 size={14} /> Linked to SKU
                    </p>
                    <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                      {productGroups.reduce((sum, g) => sum + g.matched_count, 0)}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Ready for stock deduction</p>
                  </div>

                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs">
                    <p className="text-xs text-brand-600 dark:text-brand-400 font-medium flex items-center gap-1.5">
                      <ShoppingBag size={14} /> Total Units
                    </p>
                    <p className="text-2xl font-bold text-brand-600 dark:text-brand-400 mt-1">
                      {totalGroupedUnits}{" "}
                      <span className="text-xs font-normal text-slate-400">
                        / {productGroups.reduce((sum, g) => sum + g.total_quantity, 0)}
                      </span>
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">SUM across sizes</p>
                  </div>
                </>
              ) : (
                <>
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs">
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                      Extracted Items
                    </p>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                      {metrics.total}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">from {batchName}</p>
                  </div>

                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs">
                    <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1.5">
                      <CheckCircle2 size={14} /> Fully Matched
                    </p>
                    <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                      {metrics.matched}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Ready for deduction</p>
                  </div>

                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs">
                    <p className="text-xs text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1.5">
                      <AlertCircle size={14} /> Unmatched
                    </p>
                    <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">
                      {metrics.unmatched}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Needs manual link</p>
                  </div>

                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs">
                    <p className="text-xs text-brand-600 dark:text-brand-400 font-medium flex items-center gap-1.5">
                      <ShoppingBag size={14} /> Total Units
                    </p>
                    <p className="text-2xl font-bold text-brand-600 dark:text-brand-400 mt-1">
                      {metrics.selectedUnits}{" "}
                      <span className="text-xs font-normal text-slate-400">
                        / {metrics.totalUnits}
                      </span>
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Selected to deduct</p>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Grouped Mode View */}
          {viewMode === "grouped" && productGroups.length > 0 && (
            <ProductGroupedTable
              groups={productGroups}
              products={products}
              selectedSizeIds={selectedSizeIds}
              onToggleSelectSize={handleToggleSelectSize}
              onToggleSelectGroup={handleToggleSelectGroup}
              onSelectAll={handleSelectAllSizes}
              onDeselectAll={handleDeselectAllSizes}
              onUpdateSizeQty={handleUpdateSizeQty}
              onUpdateSizeDetails={handleUpdateSizeDetails}
              onDeleteSize={handleDeleteSize}
              onAddSize={handleAddSizeToGroup}
              onAddProductGroup={handleAddProductGroup}
              onSavePermanentRule={handleSavePermanentRule}
              onCommitToInventory={() => setShowApproveModal(true)}
              totalSelectedUnits={totalGroupedUnits}
              totalSelectedSizes={totalGroupedSizes}
            />
          )}

          {/* Raw Draft Review & Verification Table */}
          {viewMode === "raw" && draftItems.length > 0 && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
              {/* Table Toolbar */}
              <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-800/30">
                <div className="flex items-center gap-2.5 flex-1">
                  {/* Search */}
                  <div className="relative flex-1 max-w-sm">
                    <Search
                      size={15}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                    />
                    <input
                      type="text"
                      placeholder="Search title, size, SKU, order ID..."
                      value={searchFilter}
                      onChange={(e) => setSearchFilter(e.target.value)}
                      className="w-full pl-9 pr-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-brand-500"
                    />
                  </div>

                  {/* Status filter pills */}
                  <div className="flex items-center gap-1 bg-slate-200/70 dark:bg-slate-700/60 p-1 rounded-lg text-xs">
                    <button
                      onClick={() => setStatusFilter("all")}
                      className={`px-2.5 py-1 rounded-md font-medium text-[11px] transition-all ${
                        statusFilter === "all"
                          ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs"
                          : "text-slate-600 dark:text-slate-400"
                      }`}
                    >
                      All ({draftItems.length})
                    </button>
                    <button
                      onClick={() => setStatusFilter("matched")}
                      className={`px-2.5 py-1 rounded-md font-medium text-[11px] transition-all ${
                        statusFilter === "matched"
                          ? "bg-white dark:bg-slate-800 text-emerald-700 dark:text-emerald-400 shadow-xs"
                          : "text-slate-600 dark:text-slate-400"
                      }`}
                    >
                      Matched ({metrics.matched})
                    </button>
                    <button
                      onClick={() => setStatusFilter("unmatched")}
                      className={`px-2.5 py-1 rounded-md font-medium text-[11px] transition-all ${
                        statusFilter === "unmatched"
                          ? "bg-white dark:bg-slate-800 text-amber-700 dark:text-amber-400 shadow-xs"
                          : "text-slate-600 dark:text-slate-400"
                      }`}
                    >
                      Unmatched ({metrics.unmatched})
                    </button>
                  </div>
                </div>

                {/* Primary Action Buttons */}
                <div className="flex items-center gap-2 self-end md:self-auto">
                  <button
                    onClick={handleAddManualItem}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
                  >
                    <Plus size={14} /> Add Row
                  </button>

                  <button
                    onClick={handleReapplyRules}
                    title="Re-run matching with updated keyword rules"
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
                  >
                    <RefreshCw size={14} /> Re-apply Rules
                  </button>

                  <button
                    type="button"
                    onClick={handleClearDraft}
                    title="Clear all parsed draft items"
                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors cursor-pointer"
                  >
                    <Trash2 size={14} /> Clear
                  </button>

                  <button
                    onClick={() => setShowApproveModal(true)}
                    disabled={selectedItemIds.size === 0}
                    className="flex items-center gap-2 px-4 py-1.5 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-all disabled:opacity-50 disabled:pointer-events-none"
                  >
                    <CheckCircle2 size={15} />
                    Approve & Submit Entries ({selectedItemIds.size})
                  </button>
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100/75 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="p-3 w-10 text-center">
                        <input
                          type="checkbox"
                          checked={
                            filteredItems.length > 0 &&
                            selectedItemIds.size === filteredItems.length
                          }
                          onChange={toggleSelectAll}
                          className="rounded text-brand-600 focus:ring-brand-500"
                        />
                      </th>
                      <th className="p-3 w-28">Status</th>
                      <th className="p-3">Detected Product & Size</th>
                      <th className="p-3">Matched Inventory Item & Variant</th>
                      <th className="p-3 w-20 text-center">Qty</th>
                      <th className="p-3 w-24">Order ID / SKU</th>
                      <th className="p-3 max-w-xs">Original Title / Raw Line</th>
                      <th className="p-3 w-20 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {filteredItems.map((item) => {
                      const isSelected = selectedItemIds.has(item.id);
                      return (
                        <tr
                          key={item.id}
                          className={`hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors ${
                            !isSelected ? "opacity-50 bg-slate-50/40 dark:bg-slate-900/20" : ""
                          }`}
                        >
                          {/* Checkbox */}
                          <td className="p-3 text-center">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelectItem(item.id)}
                              className="rounded text-brand-600 focus:ring-brand-500"
                            />
                          </td>

                          {/* Status Badge */}
                          <td className="p-3">
                            {item.status === "matched" ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-medium text-[11px] bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                                <Check size={11} /> Matched
                              </span>
                            ) : item.status === "manual" ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-medium text-[11px] bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
                                Override
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-medium text-[11px] bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                                <AlertCircle size={11} /> Unmatched
                              </span>
                            )}
                          </td>

                          {/* Detected Product & Size */}
                          <td className="p-3">
                            <div className="font-semibold text-slate-900 dark:text-white">
                              {item.detected_product_name}
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5">
                              <span className="font-medium text-slate-700 dark:text-slate-300">
                                Size:
                              </span>{" "}
                              {item.detected_size}
                            </div>
                          </td>

                          {/* Inventory Product & Variant Link Selector */}
                          <td className="p-3">
                            <div className="space-y-1 min-w-[220px]">
                              {/* Product selector */}
                              <select
                                value={item.product_id || ""}
                                onChange={(e) =>
                                  handleUpdateDraftItemMatch(item.id, e.target.value)
                                }
                                className={`w-full px-2 py-1 text-xs rounded border bg-white dark:bg-slate-800 font-medium ${
                                  item.product_id
                                    ? "border-emerald-300 dark:border-emerald-700 text-slate-900 dark:text-white"
                                    : "border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-300"
                                }`}
                              >
                                <option value="">-- Select Inventory Product --</option>
                                {products.map((p) => (
                                  <option key={p.id} value={p.id}>
                                    {p.product_name} ({p.category})
                                  </option>
                                ))}
                              </select>

                              {/* Variant selector if product has variants */}
                              {item.product_id && (
                                <div className="flex items-center gap-2">
                                  {(() => {
                                    const prod = products.find((p) => p.id === item.product_id);
                                    if (!prod || !prod.has_variants || !prod.variants?.length) {
                                      return (
                                        <span className="text-[11px] text-slate-500">
                                          Single item ({prod?.stock_quantity ?? 0} in stock)
                                        </span>
                                      );
                                    }
                                    return (
                                      <select
                                        value={item.variant_id || ""}
                                        onChange={(e) =>
                                          handleUpdateDraftItemMatch(
                                            item.id,
                                            item.product_id!,
                                            e.target.value,
                                          )
                                        }
                                        className="w-full px-2 py-1 text-[11px] rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                                      >
                                        <option value="">-- Select Variant --</option>
                                        {prod.variants.map((v) => (
                                          <option key={v.id} value={v.id}>
                                            {v.variation_value}
                                            {v.color ? ` (${v.color})` : ""} — {v.stock_quantity}{" "}
                                            left
                                          </option>
                                        ))}
                                      </select>
                                    );
                                  })()}
                                </div>
                              )}

                              {/* Quick Save as Permanent Rule Button for manual/unmatched */}
                              {item.product_id && item.status !== "matched" && (
                                <button
                                  type="button"
                                  onClick={() => handleSaveRowAsRule(item)}
                                  className="text-[10px] font-semibold text-brand-600 dark:text-brand-400 hover:underline flex items-center gap-1 pt-0.5"
                                >
                                  <Sparkles size={11} /> Save as permanent keyword rule
                                </button>
                              )}
                            </div>
                          </td>

                          {/* Extracted Quantity (Editable) */}
                          <td className="p-3 text-center">
                            <div className="inline-flex items-center border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                              <button
                                type="button"
                                onClick={() =>
                                  setDraftItems((prev) =>
                                    prev.map((i) =>
                                      i.id === item.id
                                        ? { ...i, quantity: Math.max(1, i.quantity - 1) }
                                        : i,
                                    ),
                                  )
                                }
                                className="px-1.5 py-0.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                              >
                                -
                              </button>
                              <input
                                type="number"
                                min={1}
                                value={item.quantity}
                                onChange={(e) => {
                                  const val = parseInt(e.target.value) || 1;
                                  setDraftItems((prev) =>
                                    prev.map((i) =>
                                      i.id === item.id ? { ...i, quantity: val } : i,
                                    ),
                                  );
                                }}
                                className="w-10 text-center text-xs font-bold bg-transparent border-0 focus:outline-hidden p-0"
                              />
                              <button
                                type="button"
                                onClick={() =>
                                  setDraftItems((prev) =>
                                    prev.map((i) =>
                                      i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i,
                                    ),
                                  )
                                }
                                className="px-1.5 py-0.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                              >
                                +
                              </button>
                            </div>
                          </td>

                          {/* Order ID / SKU */}
                          <td className="p-3">
                            <div className="font-mono text-[11px] text-slate-700 dark:text-slate-300">
                              {item.order_id || "—"}
                            </div>
                            {item.sku && (
                              <div className="font-mono text-[10px] text-slate-400 truncate max-w-[120px]">
                                SKU: {item.sku}
                              </div>
                            )}
                          </td>

                          {/* Segregated Raw Fields for Reference */}
                          <td className="p-3 max-w-xs">
                            <div className="space-y-1">
                              <div>
                                <span className="inline-block text-[9px] uppercase tracking-wider font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-900/30 px-1 py-0.2 rounded border border-indigo-200/50 dark:border-indigo-800/50">
                                  Title Scope
                                </span>
                                <div
                                  className="text-[11px] text-slate-700 dark:text-slate-300 font-medium line-clamp-1 mt-0.5"
                                  title={item.raw_title_clean || item.raw_title}
                                >
                                  {item.raw_title_clean || item.raw_title}
                                </div>
                              </div>
                              {(item.raw_variation || item.sku) && (
                                <div className="pt-1 border-t border-slate-100 dark:border-slate-800">
                                  <span className="inline-block text-[9px] uppercase tracking-wider font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/30 px-1 py-0.2 rounded border border-amber-200/50 dark:border-amber-800/50">
                                    Variation / SKU Scope
                                  </span>
                                  <div
                                    className="text-[11px] text-slate-500 dark:text-slate-400 font-mono line-clamp-1 mt-0.5"
                                    title={item.raw_variation || item.sku}
                                  >
                                    {item.raw_variation || `SKU: ${item.sku}`}
                                  </div>
                                </div>
                              )}
                            </div>
                          </td>

                          {/* Actions */}
                          <td className="p-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => handleDeleteDraftItem(item.id)}
                                title="Remove item"
                                className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Table Footer */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
                <div>
                  Showing {filteredItems.length} of {draftItems.length} parsed items
                </div>
                <div className="flex items-center gap-3">
                  <span>
                    Selected units: <strong>{metrics.selectedUnits}</strong>
                  </span>
                  <button
                    onClick={() => setShowApproveModal(true)}
                    disabled={selectedItemIds.size === 0}
                    className="px-3.5 py-1.5 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                  >
                    Submit {selectedItemIds.size} Confirmed Items
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Empty state when no draft items */}
          {draftItems.length === 0 && productGroups.length === 0 && !isExtracting && (
            <div className="border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center text-slate-400">
              <FileText size={36} className="mx-auto mb-3 opacity-30 text-slate-400" />
              <p className="font-semibold text-slate-700 dark:text-slate-300">
                No active picking list draft
              </p>
              <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                Upload a TikTok Shop PDF picking list above, or click &quot;Load Sample Picking
                List&quot; to preview automated extraction and stock deduction.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ================= TAB 2: KEYWORD RULES & SKU MAPPING ================= */}
      {activeTab === "settings" && (
        <div className="space-y-6">
          {/* Information Callout */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300 flex items-start gap-3">
            <Info size={16} className="mt-0.5 text-brand-600 shrink-0" />
            <div>
              <p className="font-bold text-slate-900 dark:text-white">
                How Dynamic Keyword Mapping Works
              </p>
              <p className="mt-0.5 leading-relaxed">
                TikTok Shop product titles can vary wildly (e.g., &quot;Luxury Hotel Quality
                Mattress Topper 10cm&quot;, &quot;Extra Thick Bed Topper&quot;). The engine breaks
                incoming titles down by searching your <strong>Product Category Rules</strong> and{" "}
                <strong>Target Size Rules</strong>, and then looks up the corresponding inventory
                item in the <strong>SKU / Inventory Item Linking Table</strong>. All rules are
                stored in the database and can be edited anytime without touching code!
              </p>
            </div>
          </div>

          {/* Section 1: Product Category Rules */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                  1. Product Category Rules
                  <span className="text-xs font-normal text-slate-500">
                    ({productRules.length} rules)
                  </span>
                </h3>
                <p className="text-xs text-slate-400">
                  Root phrases identifying the base bedding product (e.g. &quot;Mattress
                  Topper&quot;, &quot;Duvet Cover&quot;, &quot;Fitted Sheet&quot;)
                </p>
              </div>
              <button
                onClick={() => {
                  setIsNewPRule(true);
                  setEditingPRule({
                    id: "",
                    keyword: "",
                    aliases: [],
                    notes: "",
                    created_at: "",
                    updated_at: "",
                  });
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-brand-600 text-white hover:bg-brand-700 shadow-xs"
              >
                <Plus size={14} /> Add Product Keyword
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {productRules.map((rule) => (
                <div
                  key={rule.id}
                  className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <p className="font-bold text-xs text-slate-900 dark:text-white">
                        {rule.keyword}
                      </p>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => {
                            setIsNewPRule(false);
                            setEditingPRule(rule);
                          }}
                          className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          onClick={() => {
                            setConfirmState({
                              open: true,
                              title: "Delete Category Rule",
                              message: `Are you sure you want to delete the rule for "${rule.keyword}"?`,
                              confirmLabel: "Delete",
                              onConfirm: () => {
                                deleteProductKeywordRule(rule.id);
                                setProductRules(getProductKeywordRules());
                                setConfirmState(null);
                              },
                            });
                          }}
                          className="p-1 rounded text-slate-400 hover:text-rose-600"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                    {rule.aliases?.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {rule.aliases.map((alias, aIdx) => (
                          <span
                            key={aIdx}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200/70 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-mono"
                          >
                            {alias}
                          </span>
                        ))}
                      </div>
                    )}
                    {rule.regex_pattern && (
                      <div
                        className="mt-2 text-[10px] px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 font-mono truncate border border-indigo-200/50 dark:border-indigo-800/50"
                        title={`Regex (Title Scope): ${rule.regex_pattern}`}
                      >
                        Regex: {rule.regex_pattern}
                      </div>
                    )}
                  </div>
                  {rule.notes && (
                    <p className="text-[10px] text-slate-400 mt-2 italic truncate">{rule.notes}</p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Section 2: Target Size Keywords */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                  2. Target Size Keywords
                  <span className="text-xs font-normal text-slate-500">
                    ({sizeRules.length} rules)
                  </span>
                </h3>
                <p className="text-xs text-slate-400">
                  Bedding sizes and dimension synonyms (e.g. &quot;Single&quot; / &quot;3ft&quot;,
                  &quot;Double&quot; / &quot;4ft6&quot;, &quot;Small Double&quot; / &quot;4ft&quot;)
                </p>
              </div>
              <button
                onClick={() => {
                  setIsNewSRule(true);
                  setEditingSRule({
                    id: "",
                    canonical_size: "",
                    synonyms: [],
                    notes: "",
                    created_at: "",
                    updated_at: "",
                  });
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-brand-600 text-white hover:bg-brand-700 shadow-xs"
              >
                <Plus size={14} /> Add Size Rule
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {sizeRules.map((rule) => (
                <div
                  key={rule.id}
                  className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <p className="font-bold text-xs text-slate-900 dark:text-white">
                        {rule.canonical_size}
                      </p>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => {
                            setIsNewSRule(false);
                            setEditingSRule(rule);
                          }}
                          className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          onClick={() => {
                            setConfirmState({
                              open: true,
                              title: "Delete Size Rule",
                              message: `Are you sure you want to delete size rule "${rule.canonical_size}"?`,
                              confirmLabel: "Delete",
                              onConfirm: () => {
                                deleteSizeKeywordRule(rule.id);
                                setSizeRules(getSizeKeywordRules());
                                setConfirmState(null);
                              },
                            });
                          }}
                          className="p-1 rounded text-slate-400 hover:text-rose-600"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                    {rule.synonyms?.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {rule.synonyms.map((syn, sIdx) => (
                          <span
                            key={sIdx}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200/70 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-mono"
                          >
                            {syn}
                          </span>
                        ))}
                      </div>
                    )}
                    {rule.sku_patterns && rule.sku_patterns.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1 mt-2">
                        <span className="text-[9px] uppercase font-bold text-amber-700 dark:text-amber-300 bg-amber-100/70 dark:bg-amber-900/40 px-1 py-0.2 rounded">
                          SKU:
                        </span>
                        {rule.sku_patterns.map((skuPat, pIdx) => (
                          <span
                            key={pIdx}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200/60 dark:border-amber-800/40 font-mono"
                          >
                            {skuPat}
                          </span>
                        ))}
                      </div>
                    )}
                    {rule.regex_pattern && (
                      <div
                        className="mt-1.5 text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 font-mono truncate border border-emerald-200/50 dark:border-emerald-800/50"
                        title={`Regex (Variation/SKU Scope): ${rule.regex_pattern}`}
                      >
                        Regex: {rule.regex_pattern}
                      </div>
                    )}
                  </div>
                  {rule.notes && (
                    <p className="text-[10px] text-slate-400 mt-2 italic truncate">{rule.notes}</p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Section 3: SKU / Inventory Item Linking Table */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                  3. SKU / Inventory Item Linking Dictionary
                  <span className="text-xs font-normal text-slate-500">
                    ({mappings.length} active mappings)
                  </span>
                </h3>
                <p className="text-xs text-slate-400">
                  Maps each (Product Keyword + Size Keyword) combination to an exact product and
                  variant in the database.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleAutoGenerate}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 shadow-xs"
                >
                  <Sparkles size={14} className="text-amber-500" /> Auto-Generate from Inventory
                </button>
                <button
                  onClick={() => {
                    setIsNewMapping(true);
                    setEditingMapping({
                      id: "",
                      product_keyword: productRules[0]?.keyword || "Mattress Topper",
                      size_keyword: sizeRules[0]?.canonical_size || "Double",
                      product_id: products[0]?.id || "",
                      product_name: products[0]?.product_name || "",
                      variant_id: products[0]?.variants?.[0]?.id,
                      variant_name: products[0]?.variants?.[0]?.variation_value,
                      sku: products[0]?.sku || "",
                      notes: "",
                      created_at: "",
                      updated_at: "",
                    });
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-brand-600 text-white hover:bg-brand-700 shadow-xs"
                >
                  <Plus size={14} /> Add New Mapping
                </button>
              </div>
            </div>

            {mappings.length > 0 ? (
              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="p-3">Product Keyword</th>
                      <th className="p-3">Size Keyword</th>
                      <th className="p-3">Linked Product</th>
                      <th className="p-3">Linked Variant / SKU</th>
                      <th className="p-3 w-20 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {mappings.map((m) => (
                      <tr key={m.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                        <td className="p-3 font-semibold text-slate-900 dark:text-white">
                          {m.product_keyword}
                        </td>
                        <td className="p-3 font-medium text-slate-700 dark:text-slate-300">
                          {m.size_keyword}
                        </td>
                        <td className="p-3 text-slate-800 dark:text-slate-200">{m.product_name}</td>
                        <td className="p-3 font-mono text-[11px] text-slate-500">
                          {m.variant_name || "Standard"}{" "}
                          {m.sku && <span className="text-slate-400">({m.sku})</span>}
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => {
                                setIsNewMapping(false);
                                setEditingMapping(m);
                              }}
                              className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                            >
                              <Edit2 size={13} />
                            </button>
                            <button
                              onClick={() => {
                                setConfirmState({
                                  open: true,
                                  title: "Remove Keyword Mapping",
                                  message: `Are you sure you want to remove the mapping for "${m.product_keyword}" - "${m.size_keyword}"?`,
                                  confirmLabel: "Remove",
                                  onConfirm: () => {
                                    deleteKeywordMapping(m.id);
                                    setMappings(getKeywordMappings());
                                    setConfirmState(null);
                                  },
                                });
                              }}
                              className="p-1 rounded text-slate-400 hover:text-rose-600"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-8 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-xl text-slate-400">
                <Sliders size={24} className="mx-auto mb-2 opacity-40" />
                <p className="font-semibold text-xs text-slate-700 dark:text-slate-300">
                  No keyword-to-SKU mappings created yet
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Click &quot;Auto-Generate from Inventory&quot; to automatically map all your
                  current products and sizes!
                </p>
              </div>
            )}
          </div>

          {/* Section 4: Interactive Live Test Sandbox */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                  <Sparkles size={16} className="text-amber-500" />
                  4. Interactive Parsing Sandbox & Field Boundary Inspector
                </h3>
                <p className="text-xs text-slate-400">
                  Verify strict field segregation: Product Category extracted from Title, Size
                  extracted from Variation/SKU, and Quantity from Qty.
                </p>
              </div>

              {/* Mode Toggle */}
              <div className="flex items-center gap-1 p-0.5 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs font-semibold self-start">
                <button
                  type="button"
                  onClick={() => setTestMode("fields")}
                  className={`px-3 py-1 rounded-md transition-all ${
                    testMode === "fields"
                      ? "bg-white dark:bg-slate-700 text-brand-600 dark:text-brand-400 shadow-xs"
                      : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  Strict Columns Test
                </button>
                <button
                  type="button"
                  onClick={() => setTestMode("line")}
                  className={`px-3 py-1 rounded-md transition-all ${
                    testMode === "line"
                      ? "bg-white dark:bg-slate-700 text-brand-600 dark:text-brand-400 shadow-xs"
                      : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  Raw Line Test
                </button>
              </div>
            </div>

            {testMode === "fields" ? (
              <div className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 text-xs">
                  {/* Title Column Input */}
                  <div className="md:col-span-6 space-y-1">
                    <label className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-indigo-500" />
                      Product Title Column (Category Scope Only)
                    </label>
                    <input
                      type="text"
                      value={testTitle}
                      onChange={(e) => setTestTitle(e.target.value)}
                      placeholder="e.g. Luxury 10cm Extra Thick Mattress Topper Single Double King Super King"
                      className="w-full px-3 py-2 text-xs rounded-xl border border-indigo-200 dark:border-indigo-800/60 bg-indigo-50/30 dark:bg-indigo-950/20 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                    />
                    <p className="text-[10px] text-slate-400">
                      SEO sizes in this title (e.g. Single, Double, King) are strictly ignored.
                    </p>
                  </div>

                  {/* Variation Column Input */}
                  <div className="md:col-span-3 space-y-1">
                    <label className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-amber-500" />
                      Variation Column (Size Scope)
                    </label>
                    <input
                      type="text"
                      value={testVariation}
                      onChange={(e) => setTestVariation(e.target.value)}
                      placeholder="e.g. 4ft Small Double / White"
                      className="w-full px-3 py-2 text-xs rounded-xl border border-amber-200 dark:border-amber-800/60 bg-amber-50/30 dark:bg-amber-950/20 text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500"
                    />
                    <p className="text-[10px] text-slate-400">Primary source for target size.</p>
                  </div>

                  {/* Seller SKU Input */}
                  <div className="md:col-span-2 space-y-1">
                    <label className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      Seller SKU
                    </label>
                    <input
                      type="text"
                      value={testSku}
                      onChange={(e) => setTestSku(e.target.value)}
                      placeholder="e.g. TOP-SMD-WHT"
                      className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/30 dark:bg-emerald-950/20 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
                    />
                    <p className="text-[10px] text-slate-400">SKU pattern fallback.</p>
                  </div>

                  {/* Quantity Input */}
                  <div className="md:col-span-1 space-y-1">
                    <label className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-brand-500" />
                      Qty
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={testQty}
                      onChange={(e) => setTestQty(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-full px-2 py-2 text-xs font-bold text-center rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    />
                  </div>
                </div>

                {/* Strict Test Result Card */}
                {testFieldResult && (
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                      {/* Detected Category from Title */}
                      <div className="p-2.5 rounded-lg bg-indigo-50/70 dark:bg-indigo-900/30 border border-indigo-200/60 dark:border-indigo-800/40">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-300 block">
                          Category (From Title Only)
                        </span>
                        <span className="font-bold text-slate-900 dark:text-white text-sm">
                          {testFieldResult.detected_product_name}
                        </span>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                          ✓ Size keywords in title were ignored
                        </div>
                      </div>

                      {/* Detected Size from Variation / SKU */}
                      <div className="p-2.5 rounded-lg bg-amber-50/70 dark:bg-amber-900/30 border border-amber-200/60 dark:border-amber-800/40">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300 block">
                          Size (From Variation / SKU)
                        </span>
                        <span className="font-bold text-slate-900 dark:text-white text-sm">
                          {testFieldResult.detected_size}
                        </span>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                          ✓ Extracted strictly from Variation / SKU
                        </div>
                      </div>

                      {/* Quantity */}
                      <div className="p-2.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                          Quantity (Qty Column)
                        </span>
                        <span className="font-bold text-brand-600 dark:text-brand-400 text-sm">
                          {testFieldResult.quantity} units
                        </span>
                      </div>

                      {/* Matched Inventory Item */}
                      <div className="p-2.5 rounded-lg bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                          Inventory Match
                        </span>
                        <span
                          className={`font-semibold text-xs inline-flex items-center gap-1 mt-0.5 ${
                            testFieldResult.product_id
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-amber-600 dark:text-amber-400"
                          }`}
                        >
                          {testFieldResult.product_id ? (
                            <>
                              <Check size={13} /> {testFieldResult.product_name} (
                              {testFieldResult.variant_name || "Standard"})
                            </>
                          ) : (
                            <>
                              <AlertCircle size={13} /> Unmatched (No mapping found)
                            </>
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={testInput}
                    onChange={(e) => setTestInput(e.target.value)}
                    placeholder="e.g. Luxury 10cm Extra Thick Bed Mattress Topper 4ft Small Double (Qty: 2)"
                    className="flex-1 px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-brand-500"
                  />
                </div>

                {testSandboxResult && testSandboxResult.items.length > 0 && (
                  <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 block">Detected Product:</span>
                      <span className="font-bold text-slate-900 dark:text-white">
                        {testSandboxResult.items[0]?.detected_product_name}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">Detected Size:</span>
                      <span className="font-bold text-slate-900 dark:text-white">
                        {testSandboxResult.items[0]?.detected_size}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">Quantity:</span>
                      <span className="font-bold text-brand-600 dark:text-brand-400">
                        {testSandboxResult.items[0]?.quantity}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">Inventory Match:</span>
                      <span
                        className={`font-semibold inline-flex items-center gap-1 ${
                          testSandboxResult.items[0]?.product_id
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-amber-600 dark:text-amber-400"
                        }`}
                      >
                        {testSandboxResult.items[0]?.product_id ? (
                          <>
                            <Check size={13} /> {testSandboxResult.items[0]?.product_name} (
                            {testSandboxResult.items[0]?.variant_name || "Std"})
                          </>
                        ) : (
                          <>
                            <AlertCircle size={13} /> Unmatched
                          </>
                        )}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Section 5: Database / Supabase Schema Helper */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                  <Database size={15} className="text-emerald-500" />
                  Supabase PostgreSQL Schema
                </h3>
                <p className="text-xs text-slate-400">
                  SQL schema for creating persistent database tables for keyword rules and picking
                  logs
                </p>
              </div>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(getSupabaseSqlSchema());
                  setCopiedSql(true);
                  setTimeout(() => setCopiedSql(false), 2000);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 shadow-xs"
              >
                {copiedSql ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                {copiedSql ? "Copied SQL!" : "Copy SQL Schema"}
              </button>
            </div>
            <pre className="p-3 bg-slate-950 text-slate-300 font-mono text-[10px] rounded-xl overflow-x-auto max-h-40 border border-slate-800">
              {getSupabaseSqlSchema()}
            </pre>
          </div>
        </div>
      )}

      {/* ================= TAB 3: UPLOAD LOGS / BATCHES ================= */}
      {activeTab === "history" && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                Picking List Upload & Import History
              </h3>
              <p className="text-xs text-slate-400">
                Log of TikTok picking lists processed and committed to inventory
              </p>
            </div>
          </div>

          {batches.length > 0 ? (
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="p-3">File / Batch</th>
                    <th className="p-3">Processed Date</th>
                    <th className="p-3 text-center">Items</th>
                    <th className="p-3 text-center">Units Deducted</th>
                    <th className="p-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {batches.map((batch) => (
                    <tr key={batch.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                      <td className="p-3 font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                        <FileText size={15} className="text-brand-500" />
                        {batch.filename}
                      </td>
                      <td className="p-3 text-slate-500 font-mono text-[11px]">
                        {new Date(batch.uploaded_at).toLocaleString()}
                      </td>
                      <td className="p-3 text-center font-bold text-slate-700 dark:text-slate-300">
                        {batch.total_items}
                      </td>
                      <td className="p-3 text-center font-bold text-brand-600 dark:text-brand-400">
                        {batch.total_quantity}
                      </td>
                      <td className="p-3">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                          <Check size={11} /> {batch.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-12 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-xl text-slate-400">
              <Clock size={32} className="mx-auto mb-2 opacity-40" />
              <p className="font-semibold text-xs text-slate-700 dark:text-slate-300">
                No upload logs recorded yet
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Processed batches will be recorded here automatically when confirmed.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ================= MODAL: APPROVE & SUBMIT ENTRIES ================= */}
      {showApproveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 flex items-center justify-center">
                  <CheckCircle2 size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900 dark:text-white">
                    Approve & Commit to Inventory
                  </h3>
                  <p className="text-xs text-slate-400">Confirm sales log and stock deduction</p>
                </div>
              </div>
              <button
                onClick={() => setShowApproveModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700/60 space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-500">
                    {viewMode === "grouped" ? "Selected Sizes to Deduct:" : "Selected Items:"}
                  </span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {viewMode === "grouped" ? selectedSizeIds.size : selectedItemIds.size}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Total Units to Deduct:</span>
                  <span className="font-bold text-brand-600 dark:text-brand-400">
                    {viewMode === "grouped" ? totalGroupedUnits : metrics.selectedUnits} units
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Source File / Batch:</span>
                  <span className="font-mono text-slate-700 dark:text-slate-300 truncate max-w-[240px]">
                    {batchName}
                  </span>
                </div>
              </div>

              {/* Order Date & Sales Channel options */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Order Date
                  </label>
                  <input
                    type="date"
                    value={orderDate}
                    onChange={(e) => setOrderDate(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Sales Channel
                  </label>
                  <input
                    type="text"
                    value={channelName}
                    onChange={(e) => setChannelName(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                </div>
              </div>

              <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-[11px]">
                Stock quantities for all linked products and variants will be immediately deducted
                from inventory, and corresponding orders will be recorded under &quot;Daily
                Orders&quot;.
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowApproveModal(false)}
                disabled={isSubmitting}
                className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApproveAndSubmit}
                disabled={
                  isSubmitting ||
                  (viewMode === "grouped" ? selectedSizeIds.size === 0 : selectedItemIds.size === 0)
                }
                className="flex items-center gap-2 px-5 py-2 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm disabled:opacity-50"
              >
                {isSubmitting ? (
                  <RefreshCw size={14} className="animate-spin" />
                ) : (
                  <Check size={14} />
                )}
                {isSubmitting ? "Deducting Stock..." : "Confirm & Deduct Stock"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: PASTE RAW TEXT ================= */}
      {showPasteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-xl w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                <FileText size={18} className="text-brand-500" />
                Paste Picking List Text Directly
              </h3>
              <button
                onClick={() => setShowPasteModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <textarea
              rows={8}
              value={pastedText}
              onChange={(e) => setPastedText(e.target.value)}
              placeholder="Paste line items or raw text copied from TikTok Shop Seller Center picking list..."
              className="w-full p-3 text-xs font-mono rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-brand-500"
            />

            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setShowPasteModal(false)}
                className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleParsePastedText}
                disabled={!pastedText.trim()}
                className="px-4 py-2 text-xs font-bold rounded-xl bg-brand-600 hover:bg-brand-700 text-white shadow-xs disabled:opacity-50"
              >
                Parse Text
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: EDIT / ADD PRODUCT KEYWORD RULE ================= */}
      {editingPRule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <h3 className="font-bold text-base text-slate-900 dark:text-white">
              {isNewPRule ? "Add Product Keyword Rule" : `Edit "${editingPRule.keyword}"`}
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Primary Product Keyword *
                </label>
                <input
                  type="text"
                  value={editingPRule.keyword || ""}
                  onChange={(e) =>
                    setEditingPRule((prev) => (prev ? { ...prev, keyword: e.target.value } : null))
                  }
                  placeholder="e.g. Mattress Topper, Duvet Cover, Fitted Sheet"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Aliases & Variations (comma-separated)
                </label>
                <input
                  type="text"
                  value={editingPRule.aliases?.join(", ") || ""}
                  onChange={(e) =>
                    setEditingPRule((prev) =>
                      prev
                        ? {
                            ...prev,
                            aliases: e.target.value
                              .split(",")
                              .map((s) => (s || "").trim())
                              .filter(Boolean),
                          }
                        : null,
                    )
                  }
                  placeholder="e.g. Topper, Bed Topper, 10cm Topper"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Custom Regex Pattern (Optional)
                </label>
                <input
                  type="text"
                  value={editingPRule.regex_pattern || ""}
                  onChange={(e) =>
                    setEditingPRule((prev) =>
                      prev ? { ...prev, regex_pattern: e.target.value } : null,
                    )
                  }
                  placeholder="e.g. ^.*(?:Mattress\s*Topper|Bed\s*Topper).*$"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono text-xs"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Scope: Evaluated strictly against the Product Title column.
                </p>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Notes
                </label>
                <input
                  type="text"
                  value={editingPRule.notes || ""}
                  onChange={(e) =>
                    setEditingPRule((prev) => (prev ? { ...prev, notes: e.target.value } : null))
                  }
                  placeholder="e.g. Matches hotel quality and extra thick toppers"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                onClick={() => setEditingPRule(null)}
                className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (!editingPRule?.keyword?.trim()) return;
                  saveProductKeywordRule(editingPRule);
                  setProductRules(getProductKeywordRules());
                  setEditingPRule(null);
                }}
                className="px-4 py-2 text-xs font-bold rounded-xl bg-brand-600 hover:bg-brand-700 text-white shadow-xs"
              >
                Save Rule
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: EDIT / ADD SIZE RULE ================= */}
      {editingSRule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <h3 className="font-bold text-base text-slate-900 dark:text-white">
              {isNewSRule
                ? "Add Target Size Keyword Rule"
                : `Edit "${editingSRule.canonical_size || ""}"`}
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Canonical Size Name *
                </label>
                <input
                  type="text"
                  value={editingSRule.canonical_size || ""}
                  onChange={(e) =>
                    setEditingSRule((prev) =>
                      prev ? { ...prev, canonical_size: e.target.value } : null,
                    )
                  }
                  placeholder="e.g. Single, Double, King, Super King, 4ft"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Synonyms & Tokens (comma-separated)
                </label>
                <input
                  type="text"
                  value={editingSRule.synonyms?.join(", ") || ""}
                  onChange={(e) =>
                    setEditingSRule((prev) =>
                      prev
                        ? {
                            ...prev,
                            synonyms: e.target.value
                              .split(",")
                              .map((s) => (s || "").trim())
                              .filter(Boolean),
                          }
                        : null,
                    )
                  }
                  placeholder="e.g. 4ft, small double, 120x190, three quarter"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Searched in Variation text (e.g. &quot;Color: White, Size: 4ft Small
                  Double&quot;).
                </p>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Seller SKU Codes / Patterns (comma-separated, Optional)
                </label>
                <input
                  type="text"
                  value={editingSRule.sku_patterns?.join(", ") || ""}
                  onChange={(e) =>
                    setEditingSRule((prev) =>
                      prev
                        ? {
                            ...prev,
                            sku_patterns: e.target.value
                              .split(",")
                              .map((s) => (s || "").trim())
                              .filter(Boolean),
                          }
                        : null,
                    )
                  }
                  placeholder="e.g. DBL, 4FT6, TOP-DBL"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono text-xs"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Scope: Evaluated strictly against the Seller SKU column.
                </p>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Custom Regex Pattern (Optional)
                </label>
                <input
                  type="text"
                  value={editingSRule.regex_pattern || ""}
                  onChange={(e) =>
                    setEditingSRule((prev) =>
                      prev ? { ...prev, regex_pattern: e.target.value } : null,
                    )
                  }
                  placeholder="e.g. \b(?:double|4ft6|135x190)\b"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono text-xs"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Scope: Evaluated strictly against the Variation and Seller SKU columns.
                </p>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Notes
                </label>
                <input
                  type="text"
                  value={editingSRule.notes || ""}
                  onChange={(e) =>
                    setEditingSRule((prev) => (prev ? { ...prev, notes: e.target.value } : null))
                  }
                  placeholder="e.g. Standard UK 4ft 6in double size"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                onClick={() => setEditingSRule(null)}
                className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (!editingSRule?.canonical_size?.trim()) return;
                  saveSizeKeywordRule(editingSRule);
                  setSizeRules(getSizeKeywordRules());
                  setEditingSRule(null);
                }}
                className="px-4 py-2 text-xs font-bold rounded-xl bg-brand-600 hover:bg-brand-700 text-white shadow-xs"
              >
                Save Size Rule
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: EDIT / ADD SKU MAPPING ================= */}
      {editingMapping && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <h3 className="font-bold text-base text-slate-900 dark:text-white">
              {isNewMapping ? "Link Product & Size Keyword to SKU" : "Edit SKU Mapping"}
            </h3>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Product Keyword *
                  </label>
                  <input
                    type="text"
                    value={editingMapping.product_keyword || ""}
                    onChange={(e) =>
                      setEditingMapping((prev) =>
                        prev ? { ...prev, product_keyword: e.target.value } : null,
                      )
                    }
                    placeholder="e.g. Mattress Topper"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Size Keyword *
                  </label>
                  <input
                    type="text"
                    value={editingMapping.size_keyword || ""}
                    onChange={(e) =>
                      setEditingMapping((prev) =>
                        prev ? { ...prev, size_keyword: e.target.value } : null,
                      )
                    }
                    placeholder="e.g. Double"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Select Target Inventory Product *
                </label>
                <select
                  value={editingMapping.product_id || ""}
                  onChange={(e) => {
                    const prod = products.find((p) => p.id === e.target.value);
                    setEditingMapping((prev) =>
                      prev
                        ? {
                            ...prev,
                            product_id: e.target.value,
                            product_name: prod ? prod.product_name : "",
                            variant_id: prod?.variants?.[0]?.id,
                            variant_name: prod?.variants?.[0]?.variation_value,
                            sku: prod?.variants?.[0]?.sku || prod?.sku || "",
                          }
                        : null,
                    );
                  }}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                >
                  <option value="">-- Choose Product --</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.product_name} ({p.category})
                    </option>
                  ))}
                </select>
              </div>

              {/* Variant Selector */}
              {(() => {
                const prod = products.find((p) => p.id === editingMapping.product_id);
                if (prod && prod.has_variants && prod.variants?.length) {
                  return (
                    <div>
                      <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Select Variant / Size *
                      </label>
                      <select
                        value={editingMapping.variant_id || ""}
                        onChange={(e) => {
                          const v = prod.variants?.find((varItem) => varItem.id === e.target.value);
                          setEditingMapping((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  variant_id: e.target.value,
                                  variant_name: v
                                    ? `${v.variation_value}${v.color ? ` - ${v.color}` : ""}`
                                    : "",
                                  sku: v?.sku || prev.sku,
                                }
                              : null,
                          );
                        }}
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                      >
                        <option value="">-- Choose Variant --</option>
                        {prod.variants.map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.variation_value}
                            {v.color ? ` (${v.color})` : ""} - SKU: {v.sku || "N/A"}
                          </option>
                        ))}
                      </select>
                    </div>
                  );
                }
                return null;
              })()}

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  SKU (Optional)
                </label>
                <input
                  type="text"
                  value={editingMapping.sku || ""}
                  onChange={(e) =>
                    setEditingMapping((prev) => (prev ? { ...prev, sku: e.target.value } : null))
                  }
                  placeholder="e.g. TOP-DBL-10"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>
            </div>

            {mappingError && (
              <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs">
                {mappingError}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setEditingMapping(null);
                  setMappingError(null);
                }}
                className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (
                    !editingMapping?.product_keyword?.trim() ||
                    !editingMapping?.size_keyword?.trim() ||
                    !editingMapping?.product_id
                  ) {
                    setMappingError(
                      "Please fill in the product keyword, size keyword, and select a target product.",
                    );
                    return;
                  }
                  setMappingError(null);
                  saveKeywordMapping(editingMapping);
                  setMappings(getKeywordMappings());
                  setEditingMapping(null);
                  setSuccessMsg("SKU mapping saved successfully.");
                  setTimeout(() => setSuccessMsg(null), 3000);
                }}
                className="px-4 py-2 text-xs font-bold rounded-xl bg-brand-600 hover:bg-brand-700 text-white shadow-xs"
              >
                Save Mapping
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reusable In-App Confirmation Dialog */}
      {confirmState && (
        <ConfirmDialog
          open={confirmState.open}
          title={confirmState.title}
          message={confirmState.message}
          confirmLabel={confirmState.confirmLabel || "Confirm"}
          cancelLabel={confirmState.cancelLabel || "Cancel"}
          onConfirm={confirmState.onConfirm}
          onCancel={() => setConfirmState(null)}
        />
      )}
    </div>
  );
}
