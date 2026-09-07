import { useState } from "react";
import type {
  ReviewDashboardData,
  AggregatedCategoryCard,
  AggregatedSizeRow,
  Product,
} from "@/types";
import {
  CheckCircle2,
  AlertCircle,
  PackageCheck,
  Edit2,
  Trash2,
  Plus,
  ArrowRight,
  Layers,
  FileText,
  Clock,
  RotateCcw,
  Sparkles,
  ExternalLink,
  ChevronRight,
  ShoppingBag,
  Sliders,
} from "lucide-react";

interface ReviewDashboardProps {
  reviewData: ReviewDashboardData | null;
  onUpdateReviewData: (data: ReviewDashboardData | null) => void;
  onCommitStock: () => Promise<void>;
  isCommitting: boolean;
  products: Product[];
  onNavigateToUpload: () => void;
  onNavigateToOrders?: () => void;
  onNavigateToProducts?: () => void;
  onLoadSampleData: () => void;
}

export default function ReviewDashboard({
  reviewData,
  onUpdateReviewData,
  onCommitStock,
  isCommitting,
  products,
  onNavigateToUpload,
  onNavigateToOrders,
  onNavigateToProducts,
  onLoadSampleData,
}: ReviewDashboardProps) {
  // Editing a size row's quantity
  const [editingRow, setEditingRow] = useState<{
    categoryName: string;
    rowId: string;
    size: string;
    currentQty: number;
  } | null>(null);
  const [editQtyInput, setEditQtyInput] = useState<number>(1);

  // Adding a new size row to a category
  const [addingToCategory, setAddingToCategory] = useState<string | null>(null);
  const [newSizeName, setNewSizeName] = useState("Double");
  const [newSizeQty, setNewSizeQty] = useState<number>(1);

  // Success state after committing stock
  const [commitSuccessData, setCommitSuccessData] = useState<{
    totalUnits: number;
    categoriesCount: number;
    committedAt: string;
  } | null>(null);

  // Delete size row
  const handleDeleteRow = (categoryName: string, rowId: string) => {
    if (!reviewData) return;
    const updatedCategories = reviewData.categories
      .map((cat) => {
        if (cat.category_name !== categoryName) return cat;
        const filteredSizes = cat.sizes.filter((s) => s.id !== rowId);
        const newCatTotal = filteredSizes.reduce((acc, s) => acc + s.quantity, 0);
        return {
          ...cat,
          sizes: filteredSizes,
          total_quantity: newCatTotal,
        };
      })
      .filter((cat) => cat.sizes.length > 0);

    const newTotalUnits = updatedCategories.reduce((acc, c) => acc + c.total_quantity, 0);

    onUpdateReviewData({
      ...reviewData,
      categories: updatedCategories,
      total_units: newTotalUnits,
    });
  };

  // Edit quantity save
  const handleSaveEditQty = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewData || !editingRow) return;

    const val = Math.max(1, editQtyInput);
    const updatedCategories = reviewData.categories.map((cat) => {
      if (cat.category_name !== editingRow.categoryName) return cat;
      const updatedSizes = cat.sizes.map((s) => {
        if (s.id === editingRow.rowId) {
          return { ...s, quantity: val };
        }
        return s;
      });
      const newCatTotal = updatedSizes.reduce((acc, s) => acc + s.quantity, 0);
      return {
        ...cat,
        sizes: updatedSizes,
        total_quantity: newCatTotal,
      };
    });

    const newTotalUnits = updatedCategories.reduce((acc, c) => acc + c.total_quantity, 0);

    onUpdateReviewData({
      ...reviewData,
      categories: updatedCategories,
      total_units: newTotalUnits,
    });

    setEditingRow(null);
  };

  // Add new size row to category
  const handleSaveNewSize = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewData || !addingToCategory) return;

    const qty = Math.max(1, newSizeQty);
    const updatedCategories = reviewData.categories.map((cat) => {
      if (cat.category_name !== addingToCategory) return cat;
      const existingIdx = cat.sizes.findIndex(
        (s) => s.size.toLowerCase() === newSizeName.trim().toLowerCase(),
      );

      let nextSizes: AggregatedSizeRow[];
      if (existingIdx !== -1) {
        // Increment existing size
        nextSizes = cat.sizes.map((s, idx) =>
          idx === existingIdx ? { ...s, quantity: s.quantity + qty } : s,
        );
      } else {
        // Add new size row
        const newRow: AggregatedSizeRow = {
          id: `row-${cat.category_name}-${newSizeName.trim()}-${Date.now()}`.replace(
            /[^a-zA-Z0-9_-]/g,
            "_",
          ),
          size: newSizeName.trim(),
          quantity: qty,
        };
        nextSizes = [...cat.sizes, newRow];
      }

      const newCatTotal = nextSizes.reduce((acc, s) => acc + s.quantity, 0);
      return {
        ...cat,
        sizes: nextSizes,
        total_quantity: newCatTotal,
      };
    });

    const newTotalUnits = updatedCategories.reduce((acc, c) => acc + c.total_quantity, 0);

    onUpdateReviewData({
      ...reviewData,
      categories: updatedCategories,
      total_units: newTotalUnits,
    });

    setAddingToCategory(null);
    setNewSizeQty(1);
  };

  // Quick increment/decrement
  const handleAdjustQuantity = (categoryName: string, rowId: string, delta: number) => {
    if (!reviewData) return;
    const updatedCategories = reviewData.categories
      .map((cat) => {
        if (cat.category_name !== categoryName) return cat;
        const updatedSizes = cat.sizes
          .map((s) => {
            if (s.id === rowId) {
              const next = s.quantity + delta;
              return next > 0 ? { ...s, quantity: next } : null;
            }
            return s;
          })
          .filter(Boolean) as AggregatedSizeRow[];

        const newCatTotal = updatedSizes.reduce((acc, s) => acc + s.quantity, 0);
        return {
          ...cat,
          sizes: updatedSizes,
          total_quantity: newCatTotal,
        };
      })
      .filter((cat) => cat.sizes.length > 0);

    const newTotalUnits = updatedCategories.reduce((acc, c) => acc + c.total_quantity, 0);

    onUpdateReviewData({
      ...reviewData,
      categories: updatedCategories,
      total_units: newTotalUnits,
    });
  };

  // Wrap commit call to capture success state
  const handleTriggerCommit = async () => {
    if (!reviewData || reviewData.categories.length === 0) return;
    const units = reviewData.total_units;
    const catCount = reviewData.categories.length;
    await onCommitStock();
    setCommitSuccessData({
      totalUnits: units,
      categoriesCount: catCount,
      committedAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    });
  };

  // Standard bed sizes for dropdown
  const COMMON_SIZES = [
    "Super King",
    "King",
    "Double",
    "Small Double (4ft)",
    "Single",
    "Pair (Pack of 2)",
    "Pack of 4",
    "Standard",
    "Unassigned / Standard",
  ];

  if (commitSuccessData) {
    return (
      <div
        className="bg-card border border-border rounded-xl p-8 shadow-sm text-center max-w-2xl mx-auto space-y-6 my-6"
        id="card-commit-success"
      >
        <div className="h-16 w-16 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto ring-8 ring-emerald-500/10">
          <CheckCircle2 className="h-9 w-9" />
        </div>

        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-foreground">Stock Successfully Committed!</h2>
          <p className="text-sm text-muted-foreground">
            Deducted{" "}
            <strong className="text-foreground">{commitSuccessData.totalUnits} units</strong> across{" "}
            <strong className="text-foreground">
              {commitSuccessData.categoriesCount} product categories
            </strong>{" "}
            from active inventory at {commitSuccessData.committedAt}.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 py-3 bg-muted/40 rounded-lg max-w-md mx-auto text-left px-5 text-xs">
          <div>
            <span className="text-muted-foreground block">Inventory Status:</span>
            <span className="font-semibold text-foreground flex items-center gap-1 mt-0.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Stock Synchronized
            </span>
          </div>
          <div>
            <span className="text-muted-foreground block">Daily Orders Recorded:</span>
            <span className="font-semibold text-foreground mt-0.5 block">
              {commitSuccessData.totalUnits} Items Logged
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          {onNavigateToOrders && (
            <button
              id="btn-goto-orders"
              type="button"
              onClick={onNavigateToOrders}
              className="px-4 py-2 text-xs font-semibold bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors shadow-sm flex items-center gap-1.5"
            >
              <PackageCheck className="h-4 w-4" />
              View Recorded Orders
            </button>
          )}

          {onNavigateToProducts && (
            <button
              id="btn-goto-products"
              type="button"
              onClick={onNavigateToProducts}
              className="px-4 py-2 text-xs font-semibold bg-muted hover:bg-muted/80 text-foreground rounded-lg transition-colors border border-border flex items-center gap-1.5"
            >
              <ShoppingBag className="h-4 w-4" />
              View Product Inventory
            </button>
          )}

          <button
            id="btn-parse-another-pdf"
            type="button"
            onClick={() => {
              setCommitSuccessData(null);
              onNavigateToUpload();
            }}
            className="px-4 py-2 text-xs font-semibold bg-muted hover:bg-muted/80 text-foreground rounded-lg transition-colors border border-border"
          >
            Upload Another PDF
          </button>
        </div>
      </div>
    );
  }

  if (!reviewData || reviewData.categories.length === 0) {
    return (
      <div
        className="bg-card border border-border rounded-xl p-12 text-center shadow-sm max-w-2xl mx-auto space-y-6 my-6"
        id="card-review-empty"
      >
        <div className="h-14 w-14 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mx-auto">
          <FileText className="h-7 w-7" />
        </div>

        <div className="space-y-1.5">
          <h2 className="text-xl font-bold text-foreground">No Daily Picking List Loaded</h2>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Upload a TikTok Shop PDF picking list to aggregate quantities by category and size, or
            load sample Cozy Bedding data to preview the dashboard.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            id="btn-empty-upload-pdf"
            type="button"
            onClick={onNavigateToUpload}
            className="px-4 py-2 text-xs font-semibold bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors shadow-sm flex items-center gap-1.5"
          >
            <FileText className="h-4 w-4" />
            Upload PDF Picking List
          </button>
          <button
            id="btn-empty-load-sample"
            type="button"
            onClick={onLoadSampleData}
            className="px-4 py-2 text-xs font-semibold bg-muted hover:bg-muted/80 text-foreground rounded-lg transition-colors border border-border flex items-center gap-1.5"
          >
            <Sparkles className="h-4 w-4 text-amber-500" />
            Load Sample TikTok Picking List
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" id="review-dashboard-module">
      {/* Top Header & Sticky-ready Action Banner */}
      <div className="bg-card border border-border rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <h2 className="text-xl font-bold tracking-tight text-foreground">
                Daily Picking List Review Dashboard
              </h2>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span className="font-mono text-foreground font-semibold flex items-center gap-1">
                <FileText className="h-3.5 w-3.5 text-primary" />
                {reviewData.filename}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                Uploaded{" "}
                {new Date(reviewData.uploaded_at).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
              <span>•</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold bg-emerald-500/10 px-2 py-0.5 rounded">
                100% Free Local Extraction
              </span>
            </div>
          </div>

          {/* Primary Action Button (Feature 3 CTA) */}
          <div className="flex items-center gap-3">
            <button
              id="btn-upload-new-pdf"
              type="button"
              onClick={onNavigateToUpload}
              className="px-3 py-2 text-xs font-semibold bg-muted hover:bg-muted/80 text-foreground rounded-lg transition-colors border border-border"
            >
              Upload New PDF
            </button>

            <button
              id="btn-confirm-commit-stock"
              type="button"
              disabled={isCommitting || reviewData.total_units === 0}
              onClick={handleTriggerCommit}
              className="px-5 py-2.5 text-sm font-bold bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-all shadow-md flex items-center gap-2 tracking-wide"
            >
              {isCommitting ? (
                <>
                  <div className="h-4 w-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                  Deducting Inventory...
                </>
              ) : (
                <>
                  <PackageCheck className="h-5 w-5" />
                  CONFIRM & COMMIT STOCK ({reviewData.total_units} Units)
                </>
              )}
            </button>
          </div>
        </div>

        {/* High-Level Summary Metrics Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-border">
          <div className="bg-muted/40 p-3 rounded-lg border border-border/60">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
              Total Units to Pick
            </span>
            <span className="text-2xl font-extrabold text-foreground font-mono">
              {reviewData.total_units}
            </span>
          </div>

          <div className="bg-muted/40 p-3 rounded-lg border border-border/60">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
              Product Categories
            </span>
            <span className="text-2xl font-extrabold text-foreground font-mono">
              {reviewData.categories.length}
            </span>
          </div>

          <div className="bg-muted/40 p-3 rounded-lg border border-border/60">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
              Raw Picking Rows
            </span>
            <span className="text-2xl font-extrabold text-foreground font-mono">
              {reviewData.total_lines}
            </span>
          </div>

          <div className="bg-muted/40 p-3 rounded-lg border border-border/60">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
              Category Isolation
            </span>
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mt-1 block">
              Strictly Segregated
            </span>
          </div>
        </div>
      </div>

      {/* ================= CATEGORY CARDS GRID ================= */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6" id="grid-aggregated-categories">
        {reviewData.categories.map((card) => (
          <div
            key={card.category_name}
            className="bg-card border border-border rounded-xl overflow-hidden shadow-sm flex flex-col justify-between"
            id={`card-category-${card.category_name.toLowerCase().replace(/[^a-z0-9]/g, "-")}`}
          >
            {/* Card Header */}
            <div>
              <div className="p-4 bg-muted/40 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
                    {card.category_name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-foreground">{card.category_name}</h3>
                    <span className="text-[11px] text-muted-foreground">
                      {card.sizes.length} size variations
                    </span>
                  </div>
                </div>

                <span className="px-2.5 py-1 rounded-full text-xs font-extrabold bg-primary text-primary-foreground font-mono shadow-sm">
                  {card.total_quantity} units
                </span>
              </div>

              {/* Size Rows Table */}
              <div className="p-4">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground font-semibold">
                      <th className="pb-2">Normalized Size</th>
                      <th className="pb-2 text-center">Quantity</th>
                      <th className="pb-2 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {card.sizes.map((row) => (
                      <tr key={row.id} className="hover:bg-muted/20 transition-colors group">
                        <td className="py-2.5 font-medium text-foreground">
                          <span className="inline-flex items-center gap-1.5 font-semibold">
                            {row.size === "Unassigned / Standard" ? (
                              <span className="text-amber-600 dark:text-amber-400">{row.size}</span>
                            ) : (
                              row.size
                            )}
                          </span>
                        </td>

                        <td className="py-2.5 text-center">
                          <div className="inline-flex items-center gap-1.5 bg-muted/60 px-2 py-0.5 rounded-lg border border-border">
                            <button
                              type="button"
                              onClick={() => handleAdjustQuantity(card.category_name, row.id, -1)}
                              className="h-4 w-4 text-muted-foreground hover:text-foreground flex items-center justify-center font-bold"
                              title="Decrease quantity"
                            >
                              -
                            </button>
                            <span className="font-mono font-bold text-foreground text-xs min-w-[20px] text-center">
                              {row.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleAdjustQuantity(card.category_name, row.id, 1)}
                              className="h-4 w-4 text-muted-foreground hover:text-foreground flex items-center justify-center font-bold"
                              title="Increase quantity"
                            >
                              +
                            </button>
                          </div>
                        </td>

                        <td className="py-2.5 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingRow({
                                  categoryName: card.category_name,
                                  rowId: row.id,
                                  size: row.size,
                                  currentQty: row.quantity,
                                });
                                setEditQtyInput(row.quantity);
                              }}
                              className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors"
                              title="Edit quantity"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteRow(card.category_name, row.id)}
                              className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded transition-colors"
                              title="Delete size row"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Card Footer: Add Size Button */}
            <div className="p-3 bg-muted/20 border-t border-border flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  setAddingToCategory(card.category_name);
                  setNewSizeName("Double");
                  setNewSizeQty(1);
                }}
                className="text-xs font-semibold text-primary hover:text-primary/80 flex items-center gap-1 transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Missing Size
              </button>
              <span className="text-[11px] text-muted-foreground font-mono">
                Category Total: {card.total_quantity}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* ================= EDIT ROW QUANTITY MODAL ================= */}
      {editingRow && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-sm p-6 space-y-4 animate-in fade-in zoom-in-95">
            <h3 className="text-base font-bold text-foreground">Edit Quantity</h3>
            <p className="text-xs text-muted-foreground">
              Adjusting quantity for{" "}
              <strong className="text-foreground">{editingRow.categoryName}</strong> -{" "}
              <span className="font-semibold text-primary">{editingRow.size}</span>
            </p>

            <form onSubmit={handleSaveEditQty} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Total Units</label>
                <input
                  type="number"
                  min={1}
                  max={9999}
                  required
                  value={editQtyInput}
                  onChange={(e) => setEditQtyInput(parseInt(e.target.value, 10) || 1)}
                  className="w-full text-center font-mono font-bold text-lg p-2.5 bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setEditingRow(null)}
                  className="px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors shadow-sm"
                >
                  Save Quantity
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= ADD NEW SIZE MODAL ================= */}
      {addingToCategory && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-md p-6 space-y-4 animate-in fade-in zoom-in-95">
            <h3 className="text-base font-bold text-foreground">Add Size to {addingToCategory}</h3>
            <p className="text-xs text-muted-foreground">
              Insert a size row that was missing from the PDF picking list.
            </p>

            <form onSubmit={handleSaveNewSize} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Size Name</label>
                <div className="space-y-2">
                  <select
                    value={newSizeName}
                    onChange={(e) => setNewSizeName(e.target.value)}
                    className="w-full text-xs p-2.5 bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    {COMMON_SIZES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    placeholder="Or enter custom size (e.g. 4ft6, 6ft, Standard Pillow)"
                    value={newSizeName}
                    onChange={(e) => setNewSizeName(e.target.value)}
                    className="w-full text-xs p-2.5 bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Quantity</label>
                <input
                  type="number"
                  min={1}
                  max={9999}
                  required
                  value={newSizeQty}
                  onChange={(e) => setNewSizeQty(parseInt(e.target.value, 10) || 1)}
                  className="w-full text-xs font-mono font-bold p-2.5 bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setAddingToCategory(null)}
                  className="px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors shadow-sm"
                >
                  Add Size Row
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
