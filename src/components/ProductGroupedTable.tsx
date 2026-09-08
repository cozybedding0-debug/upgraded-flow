import { useState } from "react";
import type { Product, ProductGroupSummary, AggregatedPickingItem } from "@/types";
import { normalizeCanonicalSize } from "@/lib/pdfPickingParser";
import {
  ChevronDown,
  Plus,
  Trash2,
  Edit2,
  Check,
  AlertCircle,
  Sparkles,
  Layers,
  ShoppingBag,
  CheckCircle2,
  X,
} from "lucide-react";

interface ProductGroupedTableProps {
  groups: ProductGroupSummary[];
  products: Product[];
  selectedSizeIds: Set<string>;
  onToggleSelectSize: (sizeId: string) => void;
  onToggleSelectGroup: (groupId: string) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onUpdateSizeQty: (groupId: string, sizeId: string, newQty: number) => void;
  onUpdateSizeDetails: (
    groupId: string,
    sizeId: string,
    newSize: string,
    newQty: number,
    productId?: string,
    variantId?: string,
  ) => void;
  onDeleteSize: (groupId: string, sizeId: string) => void;
  onAddSize: (groupId: string, sizeName: string, quantity: number) => void;
  onAddProductGroup: (groupName: string) => void;
  onSavePermanentRule?: (
    productKeyword: string,
    sizeKeyword: string,
    productId: string,
    variantId?: string,
  ) => void;
  onCommitToInventory: () => void;
  totalSelectedUnits: number;
  totalSelectedSizes: number;
}

const COMMON_BED_SIZES = [
  "4FT / Small Double",
  "Single",
  "Double",
  "King",
  "Super King",
  "Pair (Pack of 2)",
  "Pack of 4",
  "Standard",
];

const DISPLAY_SIZE_ORDER: Record<string, number> = {
  "4ft / small double": 1,
  "small double (4ft)": 1,
  "small double": 1,
  "4ft": 1,
  "4ft / small db": 1,
  single: 2,
  double: 3,
  king: 4,
  "super king": 5,
  "pair (pack of 2)": 6,
  "pack of 4": 7,
};

function formatDisplaySize(canonical: string): string {
  const low = (canonical || "").toLowerCase().trim();
  if (
    low === "small double" ||
    low === "small double (4ft)" ||
    low === "4ft" ||
    low === "4ft / small db" ||
    low === "4ft / small double"
  ) {
    return "4FT / Small Double";
  }
  return canonical;
}

export default function ProductGroupedTable({
  groups,
  products,
  selectedSizeIds,
  onToggleSelectSize,
  onToggleSelectGroup,
  onSelectAll,
  onDeselectAll,
  onUpdateSizeQty,
  onUpdateSizeDetails,
  onDeleteSize,
  onAddSize,
  onAddProductGroup,
  onSavePermanentRule,
  onCommitToInventory,
  totalSelectedUnits,
  totalSelectedSizes,
}: ProductGroupedTableProps) {
  const [collapsedGroupIds, setCollapsedGroupIds] = useState<Set<string>>(new Set());

  // Edit Modal State
  const [editingItem, setEditingItem] = useState<{
    groupId: string;
    groupName: string;
    sizeId: string;
    sizeName: string;
    quantity: number;
    productId?: string | undefined;
    variantId?: string | undefined;
  } | null>(null);

  // Add Size Modal State
  const [addingSizeGroup, setAddingSizeGroup] = useState<{
    groupId: string;
    groupName: string;
  } | null>(null);
  const [newSizePreset, setNewSizePreset] = useState("Double");
  const [customSizeName, setCustomSizeName] = useState("");
  const [newSizeQuantity, setNewSizeQuantity] = useState(1);

  // Add Group Modal State
  const [showAddGroupModal, setShowAddGroupModal] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");

  const toggleCollapse = (groupId: string) => {
    setCollapsedGroupIds((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  };

  const handleExpandAll = () => setCollapsedGroupIds(new Set());
  const handleCollapseAll = () => setCollapsedGroupIds(new Set(groups.map((g) => g.id)));

  const allSizesCount = groups.reduce((sum, g) => sum + g.sizes.length, 0);
  const allSelected = allSizesCount > 0 && selectedSizeIds.size === allSizesCount;

  // Open Edit Modal
  const openEditModal = (groupId: string, groupName: string, item: AggregatedPickingItem) => {
    setEditingItem({
      groupId,
      groupName,
      sizeId: item.id,
      sizeName: item.canonical_size || item.size,
      quantity: item.total_quantity,
      productId: item.product_id,
      variantId: item.variant_id,
    });
  };

  // Save Edit Modal
  const handleSaveEdit = () => {
    if (!editingItem) return;
    onUpdateSizeDetails(
      editingItem.groupId,
      editingItem.sizeId,
      editingItem.sizeName,
      editingItem.quantity,
      editingItem.productId,
      editingItem.variantId,
    );
    setEditingItem(null);
  };

  // Submit Add Size
  const handleSubmitAddSize = () => {
    if (!addingSizeGroup) return;
    const finalSizeName =
      newSizePreset === "Custom" && customSizeName.trim() ? customSizeName.trim() : newSizePreset;
    onAddSize(addingSizeGroup.groupId, finalSizeName, Math.max(1, newSizeQuantity));
    setAddingSizeGroup(null);
    setNewSizePreset("Double");
    setCustomSizeName("");
    setNewSizeQuantity(1);
  };

  // Submit Add Group
  const handleSubmitAddGroup = () => {
    if (!newCategoryName.trim()) return;
    onAddProductGroup(newCategoryName.trim());
    setNewCategoryName("");
    setShowAddGroupModal(false);
  };

  return (
    <div className="space-y-5">
      {/* Top Header & Bulk Controls Toolbar */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400 flex items-center justify-center font-bold">
            <Layers size={20} />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              Aggregated Product Groups
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                {groups.length} Isolated Categories
              </span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Quantities summed by size under each distinct product group. Each size appears only
              once.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Collapse/Expand Toggle */}
          <button
            type="button"
            onClick={collapsedGroupIds.size > 0 ? handleExpandAll : handleCollapseAll}
            className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
          >
            {collapsedGroupIds.size > 0 ? "Expand All Cards" : "Collapse All Cards"}
          </button>

          {/* Select All / Deselect All */}
          <button
            type="button"
            onClick={allSelected ? onDeselectAll : onSelectAll}
            className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
          >
            {allSelected ? "Deselect All" : "Select All"}
          </button>

          {/* Add Category Button */}
          <button
            type="button"
            onClick={() => setShowAddGroupModal(true)}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-1.5 transition-colors"
          >
            <Plus size={14} /> Add Category Group
          </button>

          {/* Primary Commit to Inventory Button */}
          <button
            type="button"
            onClick={onCommitToInventory}
            disabled={totalSelectedSizes === 0}
            className="px-4 py-2 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-all disabled:opacity-50 disabled:pointer-events-none flex items-center gap-2"
          >
            <CheckCircle2 size={16} />
            Confirm & Commit to Inventory ({totalSelectedUnits} units across {totalSelectedSizes}{" "}
            sizes)
          </button>
        </div>
      </div>

      {/* Discrete Collapsible Product Cards */}
      <div className="space-y-4">
        {groups.map((group, groupIndex) => {
          const isCollapsed = collapsedGroupIds.has(group.id);
          const groupSizeIds = group.sizes.map((s) => s.id);
          const selectedInGroup = groupSizeIds.filter((id) => selectedSizeIds.has(id)).length;
          const isGroupAllSelected =
            group.sizes.length > 0 && selectedInGroup === group.sizes.length;
          const isGroupPartiallySelected = selectedInGroup > 0 && !isGroupAllSelected;

          return (
            <div
              key={group.id}
              className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden transition-all"
            >
              {/* Card Header: [ GROUP 1: MATTRESS TOPPER ] */}
              <div className="p-4 bg-slate-50/80 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={isGroupAllSelected}
                    ref={(input) => {
                      if (input) input.indeterminate = isGroupPartiallySelected;
                    }}
                    onChange={() => onToggleSelectGroup(group.id)}
                    className="rounded text-brand-600 focus:ring-brand-500 w-4 h-4 cursor-pointer"
                  />
                  <div>
                    <div className="flex items-center gap-2.5">
                      <span className="text-base" role="img" aria-label="Category">
                        🏷️
                      </span>
                      <h3 className="font-bold text-sm tracking-wide text-slate-900 dark:text-white uppercase flex items-center gap-2">
                        CATEGORY: {group.group_name}
                      </h3>
                      <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300 border border-brand-200 dark:border-brand-800">
                        {group.total_quantity} Total Extracted Qty
                      </span>
                      <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                        ({group.sizes.length} {group.sizes.length === 1 ? "size" : "sizes"})
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setAddingSizeGroup({ groupId: group.id, groupName: group.group_name })
                    }
                    className="px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-1 shadow-2xs cursor-pointer"
                  >
                    <Plus size={13} /> Add Size
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleCollapse(group.id)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 dark:hover:bg-slate-700 cursor-pointer transition-transform"
                    title={isCollapsed ? "Expand group" : "Collapse group"}
                  >
                    <ChevronDown
                      size={18}
                      className={`transition-transform duration-200 ${
                        isCollapsed ? "-rotate-90" : "rotate-0"
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Group Table */}
              {!isCollapsed && (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100/60 dark:bg-slate-800/40 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200/70 dark:border-slate-800">
                      <tr>
                        <th className="p-3 w-10 text-center">
                          <span className="sr-only">Select</span>
                        </th>
                        <th className="p-3 w-48 font-bold uppercase tracking-wider text-[11px] text-slate-700 dark:text-slate-200">
                          SIZE
                        </th>
                        <th className="p-3 w-44 text-center font-bold uppercase tracking-wider text-[11px] text-slate-700 dark:text-slate-200">
                          TOTAL EXTRACTED QTY
                        </th>
                        <th className="p-3 font-bold uppercase tracking-wider text-[11px] text-slate-700 dark:text-slate-200">
                          MATCHED INVENTORY
                        </th>
                        <th className="p-3 w-36 font-bold uppercase tracking-wider text-[11px] text-slate-700 dark:text-slate-200">
                          OCCURRENCES
                        </th>
                        <th className="p-3 w-40 text-right font-bold uppercase tracking-wider text-[11px] text-slate-700 dark:text-slate-200">
                          ACTIONS
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                      {group.sizes.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="p-6 text-center text-slate-400 italic text-xs">
                            No sizes detected under this category. Click &quot;Add Size&quot; above
                            to add one manually.
                          </td>
                        </tr>
                      ) : (
                        [...group.sizes]
                          .sort((a, b) => {
                            const keyA = (a.canonical_size || "").toLowerCase().trim();
                            const keyB = (b.canonical_size || "").toLowerCase().trim();
                            const rankA = DISPLAY_SIZE_ORDER[keyA] ?? 10;
                            const rankB = DISPLAY_SIZE_ORDER[keyB] ?? 10;
                            if (rankA !== rankB) return rankA - rankB;
                            return (a.canonical_size || "").localeCompare(b.canonical_size || "");
                          })
                          .map((sizeItem) => {
                          const isSelected = selectedSizeIds.has(sizeItem.id);
                          const matchedProduct = products.find((p) => p.id === sizeItem.product_id);

                          return (
                            <tr
                              key={sizeItem.id}
                              className={`hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors ${
                                !isSelected ? "opacity-50 bg-slate-50/40 dark:bg-slate-900/20" : ""
                              }`}
                            >
                              {/* Checkbox */}
                              <td className="p-3 text-center">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => onToggleSelectSize(sizeItem.id)}
                                  className="rounded text-brand-600 focus:ring-brand-500 cursor-pointer"
                                />
                              </td>

                              {/* Size Column */}
                              <td className="p-3">
                                <div className="font-bold text-slate-900 dark:text-white text-sm">
                                  {formatDisplaySize(sizeItem.canonical_size)}
                                </div>
                                {sizeItem.size !== sizeItem.canonical_size && (
                                  <div className="text-[10px] text-slate-400 font-mono">
                                    Raw: {sizeItem.size}
                                  </div>
                                )}
                              </td>

                              {/* Total Quantity (SUM by Size with direct controls) */}
                              <td className="p-3 text-center">
                                <div className="inline-flex items-center border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden bg-white dark:bg-slate-800 shadow-2xs">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      onUpdateSizeQty(
                                        group.id,
                                        sizeItem.id,
                                        Math.max(1, sizeItem.total_quantity - 1),
                                      )
                                    }
                                    className="px-2 py-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 font-bold transition-colors cursor-pointer"
                                  >
                                    -
                                  </button>
                                  <input
                                    type="number"
                                    min={1}
                                    value={sizeItem.total_quantity}
                                    onChange={(e) => {
                                      const val = parseInt(e.target.value, 10) || 1;
                                      onUpdateSizeQty(group.id, sizeItem.id, val);
                                    }}
                                    className="w-14 text-center text-xs font-bold bg-transparent border-0 focus:outline-hidden p-1 text-slate-900 dark:text-white"
                                  />
                                  <button
                                    type="button"
                                    onClick={() =>
                                      onUpdateSizeQty(
                                        group.id,
                                        sizeItem.id,
                                        sizeItem.total_quantity + 1,
                                      )
                                    }
                                    className="px-2 py-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 font-bold transition-colors cursor-pointer"
                                  >
                                    +
                                  </button>
                                </div>
                              </td>

                              {/* Matched Inventory Item */}
                              <td className="p-3">
                                {sizeItem.product_name || sizeItem.product_id ? (
                                  <div className="space-y-0.5">
                                    <div className="flex items-center gap-1.5">
                                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded font-medium text-[10px] bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                                        <Check size={10} /> Linked
                                      </span>
                                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                                        {sizeItem.product_name}
                                      </span>
                                    </div>
                                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                                      {sizeItem.variant_name
                                        ? `Variant: ${sizeItem.variant_name}`
                                        : `Size: ${sizeItem.canonical_size}`}
                                      {sizeItem.sku && (
                                        <span className="ml-2 font-mono text-[10px] text-slate-400">
                                          SKU: {sizeItem.sku}
                                        </span>
                                      )}
                                      {typeof sizeItem.available_stock === "number" && (
                                        <span className="ml-2 text-[10px] font-medium text-slate-500">
                                          ({sizeItem.available_stock} in stock)
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-2">
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-medium text-[10px] bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                                      <AlertCircle size={11} /> Unlinked
                                    </span>
                                    {/* Inline quick product selector */}
                                    <select
                                      value={sizeItem.product_id || ""}
                                      onChange={(e) => {
                                        const prod = products.find((p) => p.id === e.target.value);
                                        onUpdateSizeDetails(
                                          group.id,
                                          sizeItem.id,
                                          sizeItem.canonical_size,
                                          sizeItem.total_quantity,
                                          e.target.value,
                                          prod?.variants?.[0]?.id,
                                        );
                                      }}
                                      className="px-2 py-1 text-xs rounded border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                                    >
                                      <option value="">-- Match to Inventory --</option>
                                      {products.map((p) => (
                                        <option key={p.id} value={p.id}>
                                          {p.product_name} ({p.category})
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                )}

                                {/* Save permanent rule button if manually mapped */}
                                {sizeItem.product_id && onSavePermanentRule && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      onSavePermanentRule(
                                        group.product_keyword,
                                        sizeItem.canonical_size,
                                        sizeItem.product_id!,
                                        sizeItem.variant_id,
                                      )
                                    }
                                    className="text-[10px] font-semibold text-brand-600 dark:text-brand-400 hover:underline flex items-center gap-1 mt-1 cursor-pointer"
                                  >
                                    <Sparkles size={11} /> Save as permanent keyword rule
                                  </button>
                                )}
                              </td>

                              {/* Sources / Occurrences in PDF */}
                              <td className="p-3">
                                <div className="space-y-1">
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                    {sizeItem.raw_count} occurrence
                                    {sizeItem.raw_count === 1 ? "" : "s"} summed
                                  </span>
                                  {sizeItem.source_order_ids.length > 0 && (
                                    <div
                                      className="text-[10px] text-slate-400 font-mono truncate max-w-xs"
                                      title={sizeItem.source_order_ids.join(", ")}
                                    >
                                      Orders: {sizeItem.source_order_ids.slice(0, 3).join(", ")}
                                      {sizeItem.source_order_ids.length > 3 ? "..." : ""}
                                    </div>
                                  )}
                                </div>
                              </td>

                              {/* Action Buttons: [Edit] [Delete] */}
                              <td className="p-3 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      openEditModal(group.id, group.group_name, sizeItem)
                                    }
                                    className="px-2.5 py-1 text-xs font-semibold rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-brand-50 hover:text-brand-600 dark:hover:bg-brand-900/30 flex items-center gap-1 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
                                  >
                                    <Edit2 size={12} /> Edit
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => onDeleteSize(group.id, sizeItem.id)}
                                    className="px-2.5 py-1 text-xs font-semibold rounded-md bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/40 flex items-center gap-1 border border-rose-200 dark:border-rose-800 transition-colors cursor-pointer"
                                  >
                                    <Trash2 size={12} /> Delete
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* MODAL 1: Edit Size & Quantity Modal */}
      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                <Edit2 size={16} className="text-brand-600" />
                Edit Size & Quantity: {editingItem.groupName}
              </h3>
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              {/* Size Input */}
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Bedding Size / Variant
                </label>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  {COMMON_BED_SIZES.slice(0, 6).map((sz) => (
                    <button
                      key={sz}
                      type="button"
                      onClick={() => setEditingItem({ ...editingItem, sizeName: sz })}
                      className={`px-2.5 py-1.5 rounded-lg border text-xs font-medium text-left transition-all ${
                        editingItem.sizeName === sz
                          ? "border-brand-500 bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 font-bold"
                          : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                      }`}
                    >
                      {sz}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  value={editingItem.sizeName}
                  onChange={(e) => setEditingItem({ ...editingItem, sizeName: e.target.value })}
                  placeholder="Custom Size Name"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-medium"
                />
              </div>

              {/* Total Quantity */}
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Total Aggregated Quantity
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setEditingItem({
                        ...editingItem,
                        quantity: Math.max(1, editingItem.quantity - 1),
                      })
                    }
                    className="w-8 h-8 rounded-lg border border-slate-200 dark:border-slate-700 font-bold text-slate-600 dark:text-slate-300 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min={1}
                    value={editingItem.quantity}
                    onChange={(e) =>
                      setEditingItem({
                        ...editingItem,
                        quantity: Math.max(1, parseInt(e.target.value, 10) || 1),
                      })
                    }
                    className="flex-1 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-center font-bold text-slate-900 dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setEditingItem({
                        ...editingItem,
                        quantity: editingItem.quantity + 1,
                      })
                    }
                    className="w-8 h-8 rounded-lg border border-slate-200 dark:border-slate-700 font-bold text-slate-600 dark:text-slate-300 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Link Inventory Product */}
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Linked Inventory Product
                </label>
                <select
                  value={editingItem.productId || ""}
                  onChange={(e) => {
                    const prod = products.find((p) => p.id === e.target.value);
                    setEditingItem({
                      ...editingItem,
                      productId: e.target.value,
                      variantId: prod?.variants?.[0]?.id,
                    });
                  }}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                >
                  <option value="">-- Select Product --</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.product_name} ({p.category})
                    </option>
                  ))}
                </select>
              </div>

              {/* Variant if available */}
              {editingItem.productId &&
                (() => {
                  const prod = products.find((p) => p.id === editingItem.productId);
                  if (!prod || !prod.has_variants || !prod.variants?.length) return null;
                  return (
                    <div>
                      <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Linked Variant
                      </label>
                      <select
                        value={editingItem.variantId || ""}
                        onChange={(e) =>
                          setEditingItem({ ...editingItem, variantId: e.target.value })
                        }
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                      >
                        <option value="">-- Select Variant --</option>
                        {prod.variants.map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.variation_value}
                            {v.color ? ` (${v.color})` : ""} — {v.stock_quantity} left
                          </option>
                        ))}
                      </select>
                    </div>
                  );
                })()}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                className="px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold shadow-xs"
              >
                Save Overrides
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Add Size to Group Modal */}
      {addingSizeGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-sm shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                <Plus size={16} className="text-brand-600" />
                Add Size to {addingSizeGroup.groupName}
              </h3>
              <button
                type="button"
                onClick={() => setAddingSizeGroup(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Size Name
                </label>
                <select
                  value={newSizePreset}
                  onChange={(e) => setNewSizePreset(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white mb-2"
                >
                  {COMMON_BED_SIZES.map((sz) => (
                    <option key={sz} value={sz}>
                      {sz}
                    </option>
                  ))}
                  <option value="Custom">Custom...</option>
                </select>

                {newSizePreset === "Custom" && (
                  <input
                    type="text"
                    value={customSizeName}
                    onChange={(e) => setCustomSizeName(e.target.value)}
                    placeholder="e.g. Emperor (7ft)"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                )}
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Quantity
                </label>
                <input
                  type="number"
                  min={1}
                  value={newSizeQuantity}
                  onChange={(e) =>
                    setNewSizeQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))
                  }
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-bold"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setAddingSizeGroup(null)}
                className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmitAddSize}
                className="px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold shadow-xs"
              >
                Add Size
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Add Product Category Group Modal */}
      {showAddGroupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-sm shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                <Plus size={16} className="text-brand-600" />
                Add Product Group Card
              </h3>
              <button
                type="button"
                onClick={() => setShowAddGroupModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Product Category / Keyword
                </label>
                <input
                  type="text"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="e.g. Satin Stripe Duvet Cover"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-medium"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Will create a separate card [ GROUP: {newCategoryName.toUpperCase() || "..."} ]
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowAddGroupModal(false)}
                className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmitAddGroup}
                disabled={!newCategoryName.trim()}
                className="px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold shadow-xs disabled:opacity-50"
              >
                Create Group
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
