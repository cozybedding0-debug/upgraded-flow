import { useState, useEffect, useMemo, FormEvent } from "react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { getProducts } from "@/lib/productsStore";
import {
  readLocalOrders,
  saveLocalOrders,
  deleteLocalOrders,
  deductLocalStock,
} from "@/lib/ordersStore";
import {
  formatCurrency,
  formatDate,
  formatDateShort,
  todayISO,
  getDateRange,
  exportToCSV,
  exportToPDF,
} from "@/lib/utils";
import type {
  Product,
  DailyOrder,
  Category,
  CustomerOrderGroup,
  OrderStatus,
  DateRangePreset,
} from "@/types";
import ConfirmDialog from "@/components/ConfirmDialog";
import {
  Save,
  Trash2,
  Download,
  FileText,
  ShoppingCart,
  TrendingUp,
  Package,
  Search,
  Plus,
  User,
  ChevronDown,
  ChevronUp,
  Truck,
  CheckCircle2,
  Clock,
  Calendar,
} from "lucide-react";

interface OrderItemRow {
  id: string;
  category: Category;
  product_id: string;
  variant_id: string;
  product_name: string;
  size: string;
  color: string;
  unit_price: number;
  quantity: number;
  total_price: number;
  notes: string;
}

let rowCounter = 0;
function createEmptyRow(): OrderItemRow {
  rowCounter++;
  return {
    id: `row-${rowCounter}`,
    category: "",
    product_id: "",
    variant_id: "",
    product_name: "",
    size: "",
    color: "",
    unit_price: 0,
    quantity: 1,
    total_price: 0,
    notes: "",
  };
}

const CHANNELS = ["TikTok Shop UK", "Direct", "Cash on Delivery", "Amazon", "eBay", "Website"];
const STATUSES: OrderStatus[] = ["Pending", "Completed", "Shipped"];

const STATUS_STYLES: Record<OrderStatus, string> = {
  Pending: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400",
  Completed: "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400",
  Shipped: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400",
};

const STATUS_ICONS: Record<OrderStatus, typeof Clock> = {
  Pending: Clock,
  Completed: CheckCircle2,
  Shipped: Truck,
};

function normalizeProduct(value: unknown): Product | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Product;
  if (!row.id || !row.product_name) return null;
  return {
    ...row,
    variants: Array.isArray(row.variants) ? row.variants : [],
  };
}

export default function Orders() {
  const { isAdmin, profile } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [dbCategories, setDbCategories] = useState<{ name: string }[]>([]);
  const [orders, setOrders] = useState<DailyOrder[]>([]);
  const [loading, setLoading] = useState(true);

  const [customerName, setCustomerName] = useState("");
  const [isAddingNewCust, setIsAddingNewCust] = useState(false);
  const [newCustName, setNewCustName] = useState("");

  const [entryDate, setEntryDate] = useState(todayISO());
  const [channel, setChannel] = useState("");
  const [rows, setRows] = useState<OrderItemRow[]>([createEmptyRow()]);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [search, setSearch] = useState("");
  const [rangePreset, setRangePreset] = useState<DateRangePreset>("today");
  const [customStart, setCustomStart] = useState(todayISO());
  const [customEnd, setCustomEnd] = useState(todayISO());
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [deleteTarget, setDeleteTarget] = useState<{
    group: CustomerOrderGroup;
    item?: DailyOrder;
  } | null>(null);

  useEffect(() => {
    void fetchPageData();
  }, [profile?.id]);

  async function fetchPageData() {
    if (!profile?.id) {
      setProducts(getProducts());
      setOrders(readLocalOrders());
      setDbCategories([
        { name: "Mattress Topper" },
        { name: "Duvet Cover" },
        { name: "Fitted Sheet" },
        { name: "Flat Sheet" },
        { name: "Duvet" },
        { name: "Pillow" },
        { name: "Pillowcase" },
        { name: "Mattress Protector" },
      ]);
      setLoading(false);
      return;
    }

    setLoading(true);
    if (!isSupabaseConfigured) {
      setProducts(getProducts());
      setOrders(readLocalOrders());
      setDbCategories([
        { name: "Mattress Topper" },
        { name: "Duvet Cover" },
        { name: "Fitted Sheet" },
        { name: "Flat Sheet" },
        { name: "Duvet" },
        { name: "Pillow" },
        { name: "Pillowcase" },
        { name: "Mattress Protector" },
      ]);
      setLoading(false);
      return;
    }

    try {
      const [productsRes, variantsRes, ordersRes, categoriesRes] = await Promise.all([
        supabase.from("products").select("*").eq("user_id", profile.id).order("product_name"),
        supabase.from("product_variants").select("*").eq("user_id", profile.id),
        supabase
          .from("orders")
          .select("*")
          .eq("user_id", profile.id)
          .order("created_at", { ascending: false }),
        supabase.from("categories").select("name").order("name"),
      ]);

      if (productsRes.error) throw productsRes.error;
      if (ordersRes.error) throw ordersRes.error;
      if (categoriesRes.data && categoriesRes.data.length > 0) {
        setDbCategories(categoriesRes.data);
      } else {
        setDbCategories([
          { name: "Mattress Topper" },
          { name: "Duvet Cover" },
          { name: "Fitted Sheet" },
          { name: "Flat Sheet" },
          { name: "Duvet" },
          { name: "Pillow" },
          { name: "Pillowcase" },
          { name: "Mattress Protector" },
        ]);
      }

      const allVariants = variantsRes.data ?? [];
      const mergedProducts = (productsRes.data ?? []).map((p) => ({
        ...p,
        variants: allVariants.filter((v) => v.product_id === p.id),
      }));

      const normalizedProds = mergedProducts
        .map(normalizeProduct)
        .filter((product): product is Product => product !== null);

      setProducts(normalizedProds.length > 0 ? normalizedProds : getProducts());
      const fetchedOrders = (ordersRes.data as DailyOrder[]) || [];
      setOrders(fetchedOrders.length > 0 ? fetchedOrders : readLocalOrders());
    } catch {
      setProducts(getProducts());
      setOrders(readLocalOrders());
      setDbCategories([
        { name: "Mattress Topper" },
        { name: "Duvet Cover" },
        { name: "Fitted Sheet" },
        { name: "Flat Sheet" },
        { name: "Duvet" },
        { name: "Pillow" },
        { name: "Pillowcase" },
        { name: "Mattress Protector" },
      ]);
    } finally {
      setLoading(false);
    }
  }

  const uniqueCustomers = useMemo(() => {
    const custSet = new Set<string>();
    orders.forEach((o) => {
      if (o.customer_name) custSet.add(o.customer_name);
    });
    return Array.from(custSet).sort();
  }, [orders]);

  const customerGroups = useMemo<CustomerOrderGroup[]>(() => {
    const groups = new Map<string, CustomerOrderGroup>();
    for (const o of orders) {
      const key = o.customer_order_id || o.id;
      if (!groups.has(key)) {
        groups.set(key, {
          customer_order_id: key,
          customer_name: o.customer_name || "Walk-in",
          order_date: o.order_date,
          status: o.status || "Completed",
          channel: o.channel || "",
          notes: o.notes || "",
          items: [],
          grand_total: 0,
          total_units: 0,
        });
      }
      const g = groups.get(key)!;
      g.items.push(o);
      g.grand_total += Number(o.total_price || 0);
      g.total_units += Number(o.quantity || 0);
    }
    return Array.from(groups.values());
  }, [orders]);

  const dateRange = useMemo(() => {
    if (rangePreset === "custom") {
      return { start: customStart, end: customEnd };
    }
    return getDateRange(rangePreset);
  }, [rangePreset, customStart, customEnd]);

  const rangeLabel = useMemo(() => {
    if (rangePreset === "custom") {
      if (!customStart || !customEnd) return "Custom Range";
      if (customStart === customEnd) return formatDate(customStart);
      return `${formatDateShort(customStart)} – ${formatDateShort(customEnd)}`;
    }
    const labels: Record<DateRangePreset, string> = {
      today: "Today",
      yesterday: "Yesterday",
      this_week: "This Week",
      this_month: "This Month",
      custom: "",
    };
    return labels[rangePreset];
  }, [rangePreset, customStart, customEnd]);

  const filteredGroups = useMemo(() => {
    const today = new Date().toISOString().split("T")[0];
    return customerGroups.filter((g) => {
      const matchesDate =
        rangePreset === "today"
          ? g.order_date === today
          : g.order_date >= dateRange.start && g.order_date <= dateRange.end;
      const matchesSearch =
        g.customer_name.toLowerCase().includes(search.toLowerCase()) ||
        g.items.some((i) => i.product_name.toLowerCase().includes(search.toLowerCase()));
      return matchesDate && matchesSearch;
    });
  }, [customerGroups, dateRange, rangePreset, search]);

  const dayRevenue = useMemo(
    () => filteredGroups.reduce((sum, g) => sum + g.grand_total, 0),
    [filteredGroups],
  );
  const dayUnits = useMemo(
    () => filteredGroups.reduce((sum, g) => sum + g.total_units, 0),
    [filteredGroups],
  );

  const formGrandTotal = useMemo(() => rows.reduce((sum, r) => sum + r.total_price, 0), [rows]);

  function getProductStock(p: Product): number {
    if (p.has_variants && p.variants?.length) {
      return p.variants.reduce((sum, v) => sum + (v.stock_quantity || 0), 0);
    }
    return p.stock_quantity || 0;
  }

  function productsForCategory(cat: Category): Product[] {
    return products.filter((p) => p.category?.trim().toLowerCase() === cat.trim().toLowerCase());
  }

  function updateRow(id: string, field: keyof OrderItemRow, value: string | number) {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        const updated = { ...r, [field]: value };

        if (field === "category") {
          updated.product_id = "";
          updated.variant_id = "";
          updated.product_name = "";
          updated.size = "";
          updated.color = "";
          updated.unit_price = 0;
          updated.total_price = 0;
        }

        if (field === "product_id") {
          const catProducts = productsForCategory(updated.category);
          const product = catProducts.find((p) => p.id === value);
          if (product) {
            updated.product_name = product.product_name;
            updated.variant_id = "";
            updated.size = "";
            updated.color = "";
            updated.unit_price = 0;
            updated.total_price = 0;
            if (!product.has_variants) {
              updated.size = product.size || "";
              updated.unit_price = Number(product.unit_price) || 0;
              updated.total_price = updated.unit_price * updated.quantity;
            }
          }
        }

        if (field === "variant_id") {
          const catProducts = productsForCategory(updated.category);
          const product = catProducts.find((p) => p.id === updated.product_id);
          if (product && product.variants && value) {
            const variant = product.variants.find((v) => v.id === value);
            if (variant) {
              updated.size = variant.variation_value;
              updated.color = variant.color || "";
              updated.unit_price = Number(variant.unit_price) || 0;
              updated.total_price = updated.unit_price * updated.quantity;
            }
          }
        }

        if (field === "quantity") {
          updated.quantity = Math.max(1, parseInt(String(value)) || 1);
          updated.total_price = updated.unit_price * updated.quantity;
        }

        return updated;
      }),
    );
  }

  function addRow() {
    setRows((prev) => [...prev, createEmptyRow()]);
  }

  function removeRow(id: string) {
    setRows((prev) => (prev.length > 1 ? prev.filter((r) => r.id !== id) : prev));
  }

  function toggleGroup(id: string) {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaveMsg(null);

    let finalCustomer = customerName;
    if (isAddingNewCust) {
      finalCustomer = newCustName.trim();
    }

    if (!finalCustomer) {
      setSaveMsg({ type: "error", text: "Customer name is required." });
      setSaving(false);
      return;
    }

    const validRows = rows.filter((r) => r.product_id && Number(r.quantity) > 0);

    if (validRows.length === 0) {
      setSaveMsg({ type: "error", text: "Please add at least one product to the order." });
      setSaving(false);
      return;
    }

    for (const r of validRows) {
      const catProducts = productsForCategory(r.category);
      const product = catProducts.find((p) => p.id === r.product_id);
      if (product && product.has_variants && !r.variant_id) {
        setSaveMsg({
          type: "error",
          text: `Please select a size/color variant for "${r.product_name}".`,
        });
        setSaving(false);
        return;
      }
    }

    if (!profile?.id) {
      setSaveMsg({ type: "error", text: "You must be signed in to save orders." });
      setSaving(false);
      return;
    }

    const userId = String(profile.id);
    const orderDateStr = entryDate || new Date().toISOString().split("T")[0];
    const customerOrderId = String(Date.now());
    const savedName = finalCustomer;

    const now = new Date().toISOString();
    const localOrders: DailyOrder[] = validRows.map((r, idx) => ({
      id: `order-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
      user_id: userId,
      product_id: r.product_id ? String(r.product_id) : null,
      variant_id: r.variant_id ? String(r.variant_id) : null,
      product_name: String(r.product_name || "Product"),
      category: String(r.category || "General"),
      size: String(r.size || ""),
      color: String(r.color || ""),
      unit_price: parseFloat(String(r.unit_price)) || 0,
      quantity: parseInt(String(r.quantity)) || 1,
      total_price: parseFloat(String(r.total_price)) || 0,
      order_date: orderDateStr,
      channel: String(channel || "Direct"),
      notes: String(r.notes || ""),
      logged_by: userId,
      created_at: now,
      customer_name: savedName,
      customer_order_id: customerOrderId,
      status: "Completed" as OrderStatus,
    }));

    if (!isSupabaseConfigured) {
      saveLocalOrders(localOrders);
      deductLocalStock(localOrders);
      setOrders(readLocalOrders());
      setProducts(getProducts());
      setSaveMsg({
        type: "success",
        text: `Order saved successfully! "${savedName}" — ${validRows.length} item(s).`,
      });
      setCustomerName("");
      setIsAddingNewCust(false);
      setNewCustName("");
      setChannel("");
      setRows([createEmptyRow()]);
      setEntryDate(new Date().toISOString().split("T")[0] ?? "");
      setSaving(false);
      return;
    }

    try {
      const insertData = localOrders.map((o) => ({
        user_id: o.user_id,
        product_id: o.product_id,
        variant_id: o.variant_id,
        product_name: o.product_name,
        category: o.category,
        size: o.size,
        color: o.color,
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

      const { error } = await supabase.from("orders").insert(insertData).select("*");
      if (error) throw error;

      setSaveMsg({
        type: "success",
        text: `Order saved successfully! "${savedName}" — ${validRows.length} item(s).`,
      });
      setCustomerName("");
      setIsAddingNewCust(false);
      setNewCustName("");
      setChannel("");
      setRows([createEmptyRow()]);
      setEntryDate(new Date().toISOString().split("T")[0] ?? "");
      await fetchPageData();
    } catch {
      // Fallback to local storage if Supabase is offline
      saveLocalOrders(localOrders);
      deductLocalStock(localOrders);
      setOrders(readLocalOrders());
      setProducts(getProducts());
      setSaveMsg({
        type: "success",
        text: `Order saved successfully! "${savedName}" — ${validRows.length} item(s).`,
      });
      setCustomerName("");
      setIsAddingNewCust(false);
      setNewCustName("");
      setChannel("");
      setRows([createEmptyRow()]);
      setEntryDate(new Date().toISOString().split("T")[0] ?? "");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteOrder() {
    if (!deleteTarget || !profile?.id) return;
    const ids = deleteTarget.item
      ? [deleteTarget.item.id]
      : deleteTarget.group.items.map((i) => i.id);

    deleteLocalOrders(ids);
    setOrders((prev) => prev.filter((o) => !ids.includes(o.id)));

    if (isSupabaseConfigured) {
      try {
        await supabase.from("orders").delete().eq("user_id", profile.id).in("id", ids);
      } catch {
        // Ignored, already deleted locally
      }
    }
    setDeleteTarget(null);
  }

  function handleExportCSV() {
    const headers = [
      "Customer",
      "Date",
      "Product",
      "Category",
      "Size",
      "Color",
      "Unit Price",
      "Qty",
      "Subtotal",
      "Channel",
      "Status",
    ];
    const rowsData: (string | number)[][] = [];
    filteredGroups.forEach((g) => {
      g.items.forEach((o) => {
        rowsData.push([
          g.customer_name,
          formatDate(g.order_date),
          o.product_name,
          o.category,
          o.size,
          o.color || "",
          Number(o.unit_price).toFixed(2),
          o.quantity,
          Number(o.total_price).toFixed(2),
          o.channel || "",
          g.status,
        ]);
      });
    });
    exportToCSV(`orders-${dateRange.start}_to_${dateRange.end}.csv`, headers, rowsData);
  }

  function handleExportPDF() {
    const headers = [
      "Customer",
      "Product",
      "Category",
      "Size",
      "Color",
      "Unit Price",
      "Qty",
      "Subtotal",
    ];
    const rowsData: (string | number)[][] = [];
    filteredGroups.forEach((g) => {
      g.items.forEach((o) => {
        rowsData.push([
          g.customer_name,
          o.product_name,
          o.category,
          o.size,
          o.color || "",
          formatCurrency(Number(o.unit_price)),
          o.quantity,
          formatCurrency(Number(o.total_price)),
        ]);
      });
    });
    exportToPDF(`Order Log — ${rangeLabel}`, headers, rowsData);
  }

  if (loading && orders.length === 0 && products.length === 0) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-slate-400 flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
          Loading orders...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="glass-card p-5">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <ShoppingCart size={20} className="text-brand-600" />
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
              New Customer Order
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-500">Order Date:</label>
            <input
              type="date"
              value={entryDate}
              onChange={(e) => setEntryDate(e.target.value)}
              className="input-field py-1.5 w-auto text-sm"
            />
          </div>
        </div>

        {products.length === 0 ? (
          <div className="text-center py-8 text-sm text-slate-400">
            No products available. Add products first from the Products page.
          </div>
        ) : (
          <form onSubmit={handleSave}>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
              <div className="sm:col-span-1">
                <label className="text-xs font-medium text-slate-500 uppercase block mb-1">
                  Customer Name
                </label>
                <div className="relative">
                  <User
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 z-10"
                    size={16}
                  />
                  <select
                    value={isAddingNewCust ? "NEW" : customerName}
                    onChange={(e) => {
                      if (e.target.value === "NEW") {
                        setIsAddingNewCust(true);
                        setCustomerName("");
                      } else {
                        setIsAddingNewCust(false);
                        setCustomerName(e.target.value);
                      }
                    }}
                    className="input-field pl-9 py-2 text-sm mb-2"
                    required={!isAddingNewCust}
                  >
                    <option value="" disabled>
                      Select customer...
                    </option>
                    {uniqueCustomers.map((cust) => (
                      <option key={cust} value={cust}>
                        {cust}
                      </option>
                    ))}
                    <option value="NEW" className="font-bold text-brand-600">
                      + Add New Customer
                    </option>
                  </select>

                  {isAddingNewCust && (
                    <input
                      type="text"
                      value={newCustName}
                      onChange={(e) => setNewCustName(e.target.value)}
                      placeholder="Type new customer name..."
                      className="input-field py-2 text-sm animate-scale-in"
                      required
                    />
                  )}
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 uppercase block mb-1">
                  Channel
                </label>
                <select
                  value={channel}
                  onChange={(e) => setChannel(e.target.value)}
                  className="input-field py-2 text-sm"
                >
                  <option value="">—</option>
                  {CHANNELS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-end">
                <div className="w-full rounded-xl bg-brand-50 dark:bg-brand-900/20 border border-brand-200 dark:border-brand-800 px-4 py-2">
                  <span className="text-xs font-medium text-brand-600 dark:text-brand-400 uppercase">
                    Grand Total
                  </span>
                  <div className="text-lg font-bold text-brand-700 dark:text-brand-300">
                    {formatCurrency(formGrandTotal)}
                  </div>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto -mx-5 px-5">
              <table className="w-full text-sm min-w-[850px]">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700">
                    <th className="text-left py-2 px-2 text-xs font-medium text-slate-500 uppercase w-8">
                      #
                    </th>
                    <th className="text-left py-2 px-2 text-xs font-medium text-slate-500 uppercase w-36">
                      Category
                    </th>
                    <th className="text-left py-2 px-2 text-xs font-medium text-slate-500 uppercase">
                      Product
                    </th>
                    <th className="text-left py-2 px-2 text-xs font-medium text-slate-500 uppercase w-36">
                      Size & Color
                    </th>
                    <th className="text-right py-2 px-2 text-xs font-medium text-slate-500 uppercase w-24">
                      Unit Price
                    </th>
                    <th className="text-right py-2 px-2 text-xs font-medium text-slate-500 uppercase w-20">
                      Qty
                    </th>
                    <th className="text-right py-2 px-2 text-xs font-medium text-slate-500 uppercase w-28">
                      Subtotal
                    </th>
                    <th className="w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, idx) => {
                    const catProducts = productsForCategory(row.category);
                    const selectedProduct = catProducts.find((p) => p.id === row.product_id);
                    const hasVariants = !!(
                      selectedProduct?.has_variants && selectedProduct?.variants?.length
                    );

                    return (
                      <tr
                        key={row.id}
                        className="border-b border-slate-100 dark:border-slate-800 last:border-0"
                      >
                        <td className="py-2 px-2 text-slate-400 text-xs">{idx + 1}</td>
                        <td className="py-2 px-2">
                          <select
                            value={row.category}
                            onChange={(e) =>
                              updateRow(row.id, "category", e.target.value as Category)
                            }
                            className="input-field py-1.5 text-xs"
                            required
                          >
                            <option value="">Select category...</option>
                            {dbCategories.map((c) => (
                              <option key={c.name} value={c.name}>
                                {c.name}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="py-2 px-2">
                          <select
                            value={row.product_id}
                            onChange={(e) => updateRow(row.id, "product_id", e.target.value)}
                            className="input-field py-1.5 text-xs"
                            required
                          >
                            <option value="">Select product...</option>
                            {catProducts.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.product_name} ({getProductStock(p)} in stock)
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="py-2 px-2">
                          {hasVariants ? (
                            <select
                              value={row.variant_id}
                              onChange={(e) => updateRow(row.id, "variant_id", e.target.value)}
                              className="input-field py-1.5 text-xs"
                              required
                            >
                              <option value="">Select Size / Color...</option>
                              {selectedProduct!.variants!.map((v) => (
                                <option key={v.id} value={v.id}>
                                  {v.variation_value} {v.color ? `— ${v.color}` : ""} (
                                  {v.stock_quantity} left)
                                </option>
                              ))}
                            </select>
                          ) : (
                            <input
                              type="text"
                              value={row.size}
                              onChange={(e) => updateRow(row.id, "size", e.target.value)}
                              className="input-field py-1.5 text-xs"
                              placeholder="—"
                            />
                          )}
                        </td>
                        <td className="py-2 px-2 text-right">
                          <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                            {row.unit_price > 0 ? formatCurrency(row.unit_price) : "—"}
                          </span>
                        </td>
                        <td className="py-2 px-2">
                          <input
                            type="number"
                            min="1"
                            value={row.quantity}
                            onChange={(e) => updateRow(row.id, "quantity", e.target.value)}
                            className="input-field py-1.5 text-xs text-right w-16"
                          />
                        </td>
                        <td className="py-2 px-2 text-right">
                          <span className="text-sm font-semibold text-brand-600 dark:text-brand-400">
                            {formatCurrency(row.total_price)}
                          </span>
                        </td>
                        <td className="py-2 px-2 text-center">
                          {rows.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeRow(row.id)}
                              className="p-1 rounded-lg text-slate-300 hover:text-red-500 transition-colors"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between mt-4 flex-wrap gap-3">
              <button type="button" onClick={addRow} className="btn-secondary">
                <Plus size={16} />
                Add Another Item
              </button>
              <div className="flex items-center gap-3">
                <span className="text-sm text-slate-500 dark:text-slate-400">
                  Grand Total:{" "}
                  <span className="font-semibold text-slate-800 dark:text-slate-100">
                    {formatCurrency(formGrandTotal)}
                  </span>
                </span>
                <button type="submit" disabled={saving} className="btn-primary">
                  <Save size={18} />
                  {saving ? "Saving..." : "Save Customer Order"}
                </button>
              </div>
            </div>

            {saveMsg && (
              <div
                className={`mt-4 text-sm rounded-xl px-4 py-3 ${
                  saveMsg.type === "success"
                    ? "text-accent-700 dark:text-accent-400 bg-accent-50 dark:bg-accent-900/20 border border-accent-200 dark:border-accent-800"
                    : "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800"
                }`}
              >
                {saveMsg.text}
              </div>
            )}
          </form>
        )}
      </div>

      <div className="glass-card overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="relative flex-1 max-w-xs">
                <Search
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  size={18}
                />
                <input
                  type="text"
                  placeholder="Search by customer or product..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="input-field pl-10 py-2"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleExportCSV}
                className="btn-secondary"
                disabled={filteredGroups.length === 0}
              >
                <Download size={16} />
                CSV
              </button>
              <button
                onClick={handleExportPDF}
                className="btn-secondary"
                disabled={filteredGroups.length === 0}
              >
                <FileText size={16} />
                PDF
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap mt-3">
            <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-sm font-medium mr-1">
              <Calendar size={16} />
              Date:
            </div>
            {(["today", "yesterday", "this_week", "this_month", "custom"] as DateRangePreset[]).map(
              (preset) => (
                <button
                  key={preset}
                  onClick={() => setRangePreset(preset)}
                  className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all capitalize ${
                    rangePreset === preset ? "tab-active" : "tab-inactive"
                  }`}
                >
                  {preset.replace("_", " ")}
                </button>
              ),
            )}
            {rangePreset === "custom" && (
              <div className="flex items-center gap-2 ml-2">
                <input
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="input-field py-1.5 text-xs w-auto"
                />
                <span className="text-slate-400 text-sm">to</span>
                <input
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="input-field py-1.5 text-xs w-auto"
                />
              </div>
            )}
          </div>

          <div className="flex items-center gap-6 mt-3">
            <div className="flex items-center gap-2">
              <TrendingUp size={16} className="text-brand-500" />
              <span className="text-sm text-slate-500 dark:text-slate-400">
                Revenue:{" "}
                <span className="font-semibold text-slate-800 dark:text-slate-100">
                  {formatCurrency(dayRevenue)}
                </span>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Package size={16} className="text-accent-500" />
              <span className="text-sm text-slate-500 dark:text-slate-400">
                Units:{" "}
                <span className="font-semibold text-slate-800 dark:text-slate-100">{dayUnits}</span>
              </span>
            </div>
            <span className="text-sm text-slate-400">
              {filteredGroups.length} customer order(s) — {rangeLabel}
            </span>
          </div>
        </div>

        {filteredGroups.length === 0 ? (
          <div className="p-12 text-center">
            <ShoppingCart className="mx-auto text-slate-300 dark:text-slate-600 mb-3" size={40} />
            <p className="text-slate-500 dark:text-slate-400 text-sm">
              No orders found for this date. Add a customer order above to get started.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {filteredGroups.map((group) => {
              const isExpanded = expandedGroups.has(group.customer_order_id);
              const StatusIcon = STATUS_ICONS[group.status] || CheckCircle2;

              return (
                <div
                  key={group.customer_order_id}
                  className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors"
                >
                  <div
                    className="flex items-center gap-3 px-4 py-3.5 cursor-pointer"
                    onClick={() => toggleGroup(group.customer_order_id)}
                  >
                    <button className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 flex-shrink-0">
                      {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </button>
                    <div className="flex-shrink-0 w-9 h-9 rounded-full bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center text-brand-600 dark:text-brand-400 font-semibold text-sm">
                      {group.customer_name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-slate-800 dark:text-slate-100 truncate">
                          {group.customer_name}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[group.status] || STATUS_STYLES.Completed}`}
                        >
                          <StatusIcon size={11} />
                          {group.status}
                        </span>
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        {formatDate(group.order_date)} · {group.items.length} item(s) ·{" "}
                        {group.total_units} unit(s)
                        {group.channel && <> · {group.channel}</>}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="font-bold text-brand-600 dark:text-brand-400">
                        {formatCurrency(group.grand_total)}
                      </div>
                    </div>
                    {isAdmin && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteTarget({ group });
                        }}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex-shrink-0"
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>

                  {isExpanded && (
                    <div className="px-4 pb-4 pl-16">
                      <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
                              <th className="text-left py-2 px-3 text-xs font-medium text-slate-500 uppercase">
                                Product
                              </th>
                              <th className="text-left py-2 px-3 text-xs font-medium text-slate-500 uppercase">
                                Category
                              </th>
                              <th className="text-left py-2 px-3 text-xs font-medium text-slate-500 uppercase">
                                Size
                              </th>
                              <th className="text-left py-2 px-3 text-xs font-medium text-slate-500 uppercase">
                                Color
                              </th>
                              <th className="text-right py-2 px-3 text-xs font-medium text-slate-500 uppercase">
                                Unit Price
                              </th>
                              <th className="text-right py-2 px-3 text-xs font-medium text-slate-500 uppercase">
                                Qty
                              </th>
                              <th className="text-right py-2 px-3 text-xs font-medium text-slate-500 uppercase">
                                Subtotal
                              </th>
                              {isAdmin && <th className="w-10"></th>}
                            </tr>
                          </thead>
                          <tbody>
                            {group.items.map((item) => (
                              <tr
                                key={item.id}
                                className="border-b border-slate-100 dark:border-slate-800 last:border-0"
                              >
                                <td className="py-2 px-3 font-medium text-slate-700 dark:text-slate-200">
                                  {item.product_name}
                                  {item.notes && (
                                    <span className="block text-xs text-slate-400 mt-0.5">
                                      {item.notes}
                                    </span>
                                  )}
                                </td>
                                <td className="py-2 px-3 text-slate-500 dark:text-slate-400">
                                  {item.category}
                                </td>
                                <td className="py-2 px-3 text-slate-500 dark:text-slate-400">
                                  {item.size || "—"}
                                </td>
                                <td className="py-2 px-3 text-slate-500 dark:text-slate-400">
                                  {item.color || "—"}
                                </td>
                                <td className="py-2 px-3 text-right text-slate-600 dark:text-slate-300">
                                  {formatCurrency(Number(item.unit_price))}
                                </td>
                                <td className="py-2 px-3 text-right text-slate-600 dark:text-slate-300">
                                  {item.quantity}
                                </td>
                                <td className="py-2 px-3 text-right font-semibold text-brand-600 dark:text-brand-400">
                                  {formatCurrency(Number(item.total_price))}
                                </td>
                                {isAdmin && (
                                  <td className="py-2 px-3 text-center">
                                    {group.items.length > 1 && (
                                      <button
                                        onClick={() => setDeleteTarget({ group, item })}
                                        className="p-1 rounded-lg text-slate-300 hover:text-red-500 transition-colors"
                                      >
                                        <Trash2 size={13} />
                                      </button>
                                    )}
                                  </td>
                                )}
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr className="border-t-2 border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
                              <td
                                colSpan={6}
                                className="py-2 px-3 text-right text-xs font-medium text-slate-500 uppercase"
                              >
                                Grand Total
                              </td>
                              <td className="py-2 px-3 text-right font-bold text-brand-600 dark:text-brand-400">
                                {formatCurrency(group.grand_total)}
                              </td>
                              {isAdmin && <td></td>}
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        title={deleteTarget?.item ? "Delete Item" : "Delete Customer Order"}
        message={
          deleteTarget?.item
            ? `Delete "${deleteTarget.item.product_name}" from ${deleteTarget.group.customer_name}'s order?`
            : `Delete the entire order for "${deleteTarget?.group.customer_name}"? All ${deleteTarget?.group.items.length} item(s) will be removed.`
        }
        confirmLabel="Delete"
        onConfirm={handleDeleteOrder}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
