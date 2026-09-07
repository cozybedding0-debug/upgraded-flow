import { useState, useMemo } from "react";
import type { CategoryKeywordRule, TargetSizeRule } from "@/types";
import {
  getCategoryKeywordRules,
  saveCategoryKeywordRule,
  deleteCategoryKeywordRule,
  resetCategoryKeywordRules,
  getTargetSizeRules,
  saveTargetSizeRule,
  deleteTargetSizeRule,
  resetTargetSizeRules,
} from "@/lib/tiktokMappingStore";
import { testLiveMapping } from "@/lib/pdfPickingParser";
import {
  Tag,
  Ruler,
  FlaskConical,
  Plus,
  Trash2,
  Edit2,
  RotateCcw,
  Check,
  AlertCircle,
  Sparkles,
  ArrowUp,
  ArrowDown,
  Info,
  CheckCircle2,
  Sliders,
} from "lucide-react";

export default function KeywordSettingsTab() {
  const [categoryRules, setCategoryRules] = useState<CategoryKeywordRule[]>(() =>
    getCategoryKeywordRules(),
  );
  const [targetSizeRules, setTargetSizeRules] = useState<TargetSizeRule[]>(() =>
    getTargetSizeRules(),
  );

  // Active sub-tab inside settings
  const [settingsSubTab, setSettingsSubTab] = useState<"categories" | "sizes">("categories");

  // Category Rule Modal / Form
  const [editingCategory, setEditingCategory] = useState<CategoryKeywordRule | null>(null);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [catNameInput, setCatNameInput] = useState("");
  const [catPatternInput, setCatPatternInput] = useState("");
  const [catFormError, setCatFormError] = useState<string | null>(null);

  // Size Rule Modal / Form
  const [editingSize, setEditingSize] = useState<TargetSizeRule | null>(null);
  const [isSizeModalOpen, setIsSizeModalOpen] = useState(false);
  const [sizeNameInput, setSizeNameInput] = useState("");
  const [sizeVarsInput, setSizeVarsInput] = useState("");
  const [sizePriorityInput, setSizePriorityInput] = useState<number>(1);
  const [sizeFormError, setSizeFormError] = useState<string | null>(null);

  // Live Mapping Tester state
  const [testInput, setTestInput] = useState(
    "Luxury Hotel Quality 10cm Extra Thick Mattress Topper | Variation: Grey, Double (4ft6) | Qty: 2",
  );
  const [testResult, setTestResult] = useState<ReturnType<typeof testLiveMapping> | null>(() =>
    testLiveMapping(
      "Luxury Hotel Quality 10cm Extra Thick Mattress Topper | Variation: Grey, Double (4ft6) | Qty: 2",
      categoryRules,
      targetSizeRules,
    ),
  );

  // Refresh rules
  const refreshRules = () => {
    setCategoryRules([...getCategoryKeywordRules()]);
    setTargetSizeRules([...getTargetSizeRules()]);
  };

  // Run live test
  const handleRunTest = (customInput?: string) => {
    const input = customInput !== undefined ? customInput : testInput;
    if (!input.trim()) return;
    const res = testLiveMapping(input, categoryRules, targetSizeRules);
    setTestResult(res);
  };

  // Category CRUD
  const handleOpenNewCategory = () => {
    setEditingCategory(null);
    setCatNameInput("");
    setCatPatternInput("");
    setCatFormError(null);
    setIsCategoryModalOpen(true);
  };

  const handleOpenEditCategory = (rule: CategoryKeywordRule) => {
    setEditingCategory(rule);
    setCatNameInput(rule.category_name);
    setCatPatternInput(rule.pattern);
    setCatFormError(null);
    setIsCategoryModalOpen(true);
  };

  const handleSaveCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!catNameInput.trim()) {
      setCatFormError("Category Name is required");
      return;
    }
    if (!catPatternInput.trim()) {
      setCatFormError("Regex Pattern is required");
      return;
    }

    // Validate Regex syntax
    try {
      new RegExp(catPatternInput.trim(), "i");
    } catch (err: unknown) {
      setCatFormError(`Invalid Regular Expression syntax: ${(err as Error).message}`);
      return;
    }

    saveCategoryKeywordRule({
      id: editingCategory ? editingCategory.id : undefined,
      category_name: catNameInput.trim(),
      pattern: catPatternInput.trim(),
    });

    refreshRules();
    setIsCategoryModalOpen(false);
    handleRunTest();
  };

  const handleDeleteCategory = (id: string) => {
    deleteCategoryKeywordRule(id);
    refreshRules();
    handleRunTest();
  };

  const handleResetCategories = () => {
    if (confirm("Reset Category Mapping rules back to Cozy Bedding defaults?")) {
      resetCategoryKeywordRules();
      refreshRules();
      handleRunTest();
    }
  };

  // Size CRUD
  const handleOpenNewSize = () => {
    setEditingSize(null);
    setSizeNameInput("");
    setSizeVarsInput("");
    setSizePriorityInput(targetSizeRules.length + 1);
    setSizeFormError(null);
    setIsSizeModalOpen(true);
  };

  const handleOpenEditSize = (rule: TargetSizeRule) => {
    setEditingSize(rule);
    setSizeNameInput(rule.normalized_size);
    setSizeVarsInput(rule.variations.join(", "));
    setSizePriorityInput(rule.priority);
    setSizeFormError(null);
    setIsSizeModalOpen(true);
  };

  const handleSaveSize = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sizeNameInput.trim()) {
      setSizeFormError("Normalized Size Name is required (e.g. Super King)");
      return;
    }
    if (!sizeVarsInput.trim()) {
      setSizeFormError("At least one variation or code is required (e.g. Super King, SK, 6ft)");
      return;
    }

    saveTargetSizeRule({
      id: editingSize ? editingSize.id : undefined,
      normalized_size: sizeNameInput.trim(),
      variations: sizeVarsInput,
      priority: Number(sizePriorityInput) || 1,
    });

    refreshRules();
    setIsSizeModalOpen(false);
    handleRunTest();
  };

  const handleDeleteSize = (id: string) => {
    deleteTargetSizeRule(id);
    refreshRules();
    handleRunTest();
  };

  const handleMovePriority = (rule: TargetSizeRule, direction: "up" | "down") => {
    const sorted = [...targetSizeRules].sort((a, b) => a.priority - b.priority);
    const index = sorted.findIndex((r) => r.id === rule.id);
    if (index === -1) return;

    if (direction === "up" && index > 0) {
      const prev = sorted[index - 1]!;
      const tempPriority = prev.priority;
      saveTargetSizeRule({ ...prev, priority: rule.priority });
      saveTargetSizeRule({ ...rule, priority: tempPriority });
    } else if (direction === "down" && index < sorted.length - 1) {
      const next = sorted[index + 1]!;
      const tempPriority = next.priority;
      saveTargetSizeRule({ ...next, priority: rule.priority });
      saveTargetSizeRule({ ...rule, priority: tempPriority });
    }
    refreshRules();
    handleRunTest();
  };

  const handleResetSizes = () => {
    if (confirm("Reset Target Size Mapping rules back to default strict priority order?")) {
      resetTargetSizeRules();
      refreshRules();
      handleRunTest();
    }
  };

  // Quick preset test samples
  const PRESET_TEST_SAMPLES = [
    {
      label: "Grey, Double",
      text: "Luxury Hotel Quality 10cm Mattress Topper | Variation: Grey, Double (4ft6) | Qty: 2",
    },
    {
      label: "Silver, KING",
      text: "Satin Stripe Hotel Duvet Cover | Variation: Silver, KING | Qty: 1",
    },
    {
      label: "Beige, Superking",
      text: "Hotel Quality Bed Topper | Variation: Beige, Superking (6ft) | Qty: 3",
    },
    {
      label: "4FT Small Double",
      text: "400TC Egyptian Cotton Fitted Sheet | Variation: 4ft Small Double | Qty: 1",
    },
    {
      label: "Title Only (No variation)",
      text: "100% Cotton 5ft King Size Duvet Cover Set Luxury White",
    },
    {
      label: "Standard / Fallback",
      text: "Extra Deep Luxury Mattress Topper (No size specified)",
    },
  ];

  return (
    <div className="space-y-6" id="keyword-settings-module">
      {/* Module Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Sliders className="h-5 w-5 text-primary" />
            Dynamic Keyword & Size Configuration
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Configure local Regex pattern matchers, strict size priority rankings, and test
            extraction in real-time.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            id="btn-subtab-categories"
            type="button"
            onClick={() => setSettingsSubTab("categories")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${
              settingsSubTab === "categories"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            <Tag className="h-3.5 w-3.5" />
            1A. Category Rules ({categoryRules.length})
          </button>
          <button
            id="btn-subtab-sizes"
            type="button"
            onClick={() => setSettingsSubTab("sizes")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${
              settingsSubTab === "sizes"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            <Ruler className="h-3.5 w-3.5" />
            1B. Size Rules ({targetSizeRules.length})
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Rule Management Tables (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {settingsSubTab === "categories" ? (
            /* ================= FEATURE 1A: CATEGORY MAPPING ================= */
            <div
              className="bg-card border border-border rounded-xl p-5 shadow-sm space-y-4"
              id="card-category-rules"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-base text-foreground flex items-center gap-2">
                    <Tag className="h-4 w-4 text-primary" />
                    Product Category Mapping Keywords
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Regex expressions to detect and isolate product categories across picking list
                    lines.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    id="btn-reset-categories"
                    type="button"
                    onClick={handleResetCategories}
                    className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors text-xs flex items-center gap-1"
                    title="Reset to Cozy Bedding defaults"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Reset</span>
                  </button>
                  <button
                    id="btn-add-category-rule"
                    type="button"
                    onClick={handleOpenNewCategory}
                    className="px-3 py-1.5 text-xs font-semibold bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors flex items-center gap-1.5 shadow-sm"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add Category
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto border border-border rounded-lg">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-muted/60 border-b border-border text-muted-foreground font-semibold">
                      <th className="py-2.5 px-3">Target Category Name</th>
                      <th className="py-2.5 px-3 font-mono">Regex Match Pattern</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {categoryRules.map((rule) => (
                      <tr key={rule.id} className="hover:bg-muted/30 transition-colors group">
                        <td className="py-3 px-3 font-medium text-foreground">
                          <span className="inline-flex items-center gap-1.5">
                            <span className="h-2 w-2 rounded-full bg-emerald-500" />
                            {rule.category_name}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-mono text-xs text-primary font-medium">
                          <code className="bg-muted px-2 py-0.5 rounded text-[11px] select-all">
                            {rule.pattern}
                          </code>
                        </td>
                        <td className="py-3 px-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => handleOpenEditCategory(rule)}
                              className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors"
                              title="Edit rule"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteCategory(rule.id)}
                              className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded transition-colors"
                              title="Delete rule"
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
          ) : (
            /* ================= FEATURE 1B: TARGET SIZE MAPPING ================= */
            <div
              className="bg-card border border-border rounded-xl p-5 shadow-sm space-y-4"
              id="card-size-rules"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-base text-foreground flex items-center gap-2">
                    <Ruler className="h-4 w-4 text-primary" />
                    Target Size Mapping Keywords (Strict Priority)
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Evaluated in strict rank order (1 is checked first) to prevent smaller tokens
                    from mismatching.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    id="btn-reset-sizes"
                    type="button"
                    onClick={handleResetSizes}
                    className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors text-xs flex items-center gap-1"
                    title="Reset to strict priority defaults"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Reset</span>
                  </button>
                  <button
                    id="btn-add-size-rule"
                    type="button"
                    onClick={handleOpenNewSize}
                    className="px-3 py-1.5 text-xs font-semibold bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors flex items-center gap-1.5 shadow-sm"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add Size
                  </button>
                </div>
              </div>

              {/* Priority Notice */}
              <div className="bg-blue-500/10 border border-blue-500/20 text-blue-700 dark:text-blue-300 rounded-lg p-3 text-xs flex items-start gap-2">
                <Info className="h-4 w-4 shrink-0 mt-0.5 text-blue-600 dark:text-blue-400" />
                <div>
                  <span className="font-semibold">Strict Priority Order Enforced:</span> Super King
                  (Rank 1) is evaluated before King, and Small Double (Rank 2) is evaluated before
                  Double. This prevents "Small Double" from mistakenly triggering as "Double".
                </div>
              </div>

              <div className="overflow-x-auto border border-border rounded-lg">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-muted/60 border-b border-border text-muted-foreground font-semibold">
                      <th className="py-2.5 px-3 w-16">Rank</th>
                      <th className="py-2.5 px-3">Normalized Size Name</th>
                      <th className="py-2.5 px-3">Variation Keywords & Codes</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {targetSizeRules.map((rule, idx) => (
                      <tr key={rule.id} className="hover:bg-muted/30 transition-colors">
                        <td className="py-3 px-3 font-mono font-bold text-primary">
                          <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-primary/10 text-primary text-xs">
                            {rule.priority}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-medium text-foreground">
                          <span className="font-semibold">{rule.normalized_size}</span>
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex flex-wrap gap-1">
                            {rule.variations.map((v, vIdx) => (
                              <span
                                key={vIdx}
                                className="bg-muted text-muted-foreground px-1.5 py-0.5 rounded text-[11px] font-mono border border-border"
                              >
                                {v}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="py-3 px-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              disabled={idx === 0}
                              onClick={() => handleMovePriority(rule, "up")}
                              className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30 rounded transition-colors"
                              title="Move higher priority"
                            >
                              <ArrowUp className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              disabled={idx === targetSizeRules.length - 1}
                              onClick={() => handleMovePriority(rule, "down")}
                              className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30 rounded transition-colors"
                              title="Move lower priority"
                            >
                              <ArrowDown className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenEditSize(rule)}
                              className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors ml-1"
                              title="Edit size rule"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteSize(rule.id)}
                              className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded transition-colors"
                              title="Delete size rule"
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

              {/* Fallback indicator */}
              <div className="p-3 bg-muted/40 rounded-lg border border-dashed border-border flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <span className="font-semibold text-foreground">Fallback Rule:</span>
                  <span>If category matches but no size pattern is detected</span>
                </div>
                <span className="font-semibold px-2 py-0.5 bg-amber-500/15 text-amber-700 dark:text-amber-300 rounded font-mono text-[11px]">
                  Unassigned / Standard
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: FEATURE 1C Live Mapping Preview & Test Sidebar (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div
            className="bg-card border border-border rounded-xl p-5 shadow-sm space-y-4"
            id="card-live-preview-tester"
          >
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <h3 className="font-semibold text-sm text-foreground flex items-center gap-2">
                <FlaskConical className="h-4 w-4 text-primary" />
                Live Mapping Preview & Test Sidebar
              </h3>
              <span className="text-[11px] bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-medium px-2 py-0.5 rounded-full flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Real-Time
              </span>
            </div>

            <p className="text-xs text-muted-foreground">
              Paste any raw product title or variation snippet from a TikTok Shop PDF picking list
              to test how the engine parses and maps it:
            </p>

            <div className="space-y-2">
              <textarea
                id="input-live-tester"
                rows={3}
                value={testInput}
                onChange={(e) => {
                  setTestInput(e.target.value);
                  handleRunTest(e.target.value);
                }}
                placeholder="Paste raw TikTok Shop item line here..."
                className="w-full text-xs font-mono p-3 bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
              />

              <div className="flex items-center justify-between">
                <button
                  id="btn-run-live-test"
                  type="button"
                  onClick={() => handleRunTest()}
                  className="px-3 py-1.5 text-xs font-semibold bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors flex items-center gap-1.5"
                >
                  <FlaskConical className="h-3.5 w-3.5" />
                  Test Mapping
                </button>
                <span className="text-[11px] text-muted-foreground">Auto-updates as you type</span>
              </div>
            </div>

            {/* Quick Test Presets */}
            <div className="space-y-1.5 pt-2">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                Quick Sample Presets:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {PRESET_TEST_SAMPLES.map((sample, sIdx) => (
                  <button
                    key={sIdx}
                    type="button"
                    onClick={() => {
                      setTestInput(sample.text);
                      handleRunTest(sample.text);
                    }}
                    className="text-[11px] px-2 py-1 bg-muted hover:bg-primary/15 hover:text-primary rounded text-muted-foreground transition-colors border border-border"
                  >
                    {sample.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Live Results Card */}
            {testResult && (
              <div
                className="p-4 bg-muted/30 border border-border rounded-lg space-y-3 pt-3"
                id="live-test-result-box"
              >
                <div className="flex items-center justify-between text-xs font-semibold text-foreground border-b border-border/60 pb-2">
                  <span>Engine Extraction Result:</span>
                  <span className="text-[11px] text-muted-foreground font-mono">
                    Qty Extracted: {testResult.extractedQuantity}
                  </span>
                </div>

                <div className="space-y-2.5 text-xs">
                  {/* Category Result */}
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Detected Category:</span>
                    <span
                      className={`font-semibold px-2 py-0.5 rounded text-xs ${
                        testResult.isCategoryFallback
                          ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                          : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                      }`}
                    >
                      {testResult.detectedCategory}
                    </span>
                  </div>

                  {testResult.matchedCategoryPattern && (
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-muted-foreground">Matched Regex:</span>
                      <code className="text-primary font-mono select-all">
                        {testResult.matchedCategoryPattern}
                      </code>
                    </div>
                  )}

                  {/* Size Result */}
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Detected Size:</span>
                    <span
                      className={`font-semibold px-2 py-0.5 rounded text-xs ${
                        testResult.detectedSize === "Unassigned / Standard"
                          ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                          : "bg-blue-500/15 text-blue-700 dark:text-blue-300"
                      }`}
                    >
                      {testResult.detectedSize}
                    </span>
                  </div>

                  {/* Pass Source */}
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-muted-foreground">Extraction Pass:</span>
                    <span className="font-medium text-foreground bg-muted px-1.5 py-0.5 rounded border border-border">
                      {testResult.sizeDetectionPass}
                    </span>
                  </div>

                  {testResult.cleanedVariationString && (
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-muted-foreground">Cleaned String (Pass 1):</span>
                      <code className="text-muted-foreground font-mono truncate max-w-[180px]">
                        "{testResult.cleanedVariationString}"
                      </code>
                    </div>
                  )}

                  {testResult.matchedSizeVariation && (
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-muted-foreground">Matched Keyword:</span>
                      <code className="text-emerald-600 dark:text-emerald-400 font-mono font-bold">
                        {testResult.matchedSizeVariation}
                      </code>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ================= CATEGORY RULE MODAL ================= */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-md p-6 space-y-4 animate-in fade-in zoom-in-95">
            <h3 className="text-base font-bold text-foreground">
              {editingCategory ? "Edit Product Category Rule" : "Add New Category Keyword Rule"}
            </h3>

            {catFormError && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive text-xs rounded-lg flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{catFormError}</span>
              </div>
            )}

            <form onSubmit={handleSaveCategory} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Category Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Mattress Topper"
                  value={catNameInput}
                  onChange={(e) => setCatNameInput(e.target.value)}
                  className="w-full text-xs p-2.5 bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-foreground">Regex Pattern</label>
                  <span className="text-[11px] text-muted-foreground font-mono">
                    Case-insensitive
                  </span>
                </div>
                <input
                  type="text"
                  required
                  placeholder="e.g. Mattress.*Topper|MattressTopper"
                  value={catPatternInput}
                  onChange={(e) => setCatPatternInput(e.target.value)}
                  className="w-full text-xs font-mono p-2.5 bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <p className="text-[11px] text-muted-foreground">
                  Use standard regex syntax. Matches any row in the PDF containing this pattern.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsCategoryModalOpen(false)}
                  className="px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors shadow-sm"
                >
                  {editingCategory ? "Update Rule" : "Save Rule"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= SIZE RULE MODAL ================= */}
      {isSizeModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-md p-6 space-y-4 animate-in fade-in zoom-in-95">
            <h3 className="text-base font-bold text-foreground">
              {editingSize ? "Edit Target Size Rule" : "Add New Target Size Mapping"}
            </h3>

            {sizeFormError && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive text-xs rounded-lg flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{sizeFormError}</span>
              </div>
            )}

            <form onSubmit={handleSaveSize} className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2 space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">
                    Normalized Size Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Super King"
                    value={sizeNameInput}
                    onChange={(e) => setSizeNameInput(e.target.value)}
                    className="w-full text-xs p-2.5 bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Priority Rank</label>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    required
                    value={sizePriorityInput}
                    onChange={(e) => setSizePriorityInput(parseInt(e.target.value, 10) || 1)}
                    className="w-full text-xs p-2.5 bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary text-center font-mono font-bold"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  Variation Keywords & Codes (comma-separated)
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="e.g. Super King, SK, 6ft, Superking, 6'0"
                  value={sizeVarsInput}
                  onChange={(e) => setSizeVarsInput(e.target.value)}
                  className="w-full text-xs font-mono p-2.5 bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <p className="text-[11px] text-muted-foreground">
                  Provide all abbreviations, dimensions, or variations used in TikTok Shop picking
                  lists.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsSizeModalOpen(false)}
                  className="px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors shadow-sm"
                >
                  {editingSize ? "Update Size" : "Save Size"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
