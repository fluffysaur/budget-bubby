/**
 * Bulk Add Expense Modal
 * High-speed batch transaction entry with:
 * - Tab 1: Editable Table Grid (Date, Amount, Currency, Category, Description, Shared, Tags)
 * - Tab 2: Smart Paste Text Parser ("12.50 Lunch", "4.20 Coffee", "35.00 Grab #VietnamTrip")
 * - Auto-categorization of items from description/hashtags
 * - Multi-currency FX support
 * - 1-click batch submit calling financeService.bulkAddExpenses
 * - Audio celebration on completion
 */

import { useState, useMemo } from 'react';
import {
  Plus,
  Trash2,
  FileText,
  Table as TableIcon,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
} from 'lucide-react';
import { AnimatedModal, ModalHeader, ModalBody, ModalFooter } from "../ui/AnimatedModal";
import { financeService } from '../../services/financeService';
import {
  SUPPORTED_CURRENCIES,
  convertToSGD,
} from '../../lib/currencyConverter';
import { formatSGD } from '../../lib/currency';
import { getTodayDateString } from '../../lib/dateUtils';
import { mockCategories, mockMembers } from '../../data/mockSeedData';
import type { Expense, Category, HouseholdMember, CreateExpenseInput } from '../../types/finance';

export interface BulkExpenseDraftRow {
  id: string;
  date: string;
  amount: number | '';
  currency: string;
  categoryId: string;
  item: string;
  isShared: boolean;
  tags: string[];
}

export interface BulkAddExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExpensesAdded?: (expenses: Expense[]) => void;
  categories?: Category[];
  members?: HouseholdMember[];
  defaultPayerId?: string;
}

/**
 * Intelligent parser that extracts amount, date, tags, description, and auto-detects category
 */
export function parseBulkExpenseText(
  text: string,
  defaultDate: string,
  categories: Category[] = []
): BulkExpenseDraftRow[] {
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  // Helper to find category by keyword
  const findCategoryByKeyword = (kw: string): Category | undefined => {
    const lower = kw.toLowerCase();
    return categories.find((c) => {
      const cName = c.name.toLowerCase();
      if (lower.includes('food') || lower.includes('lunch') || lower.includes('dinner') || lower.includes('coffee') || lower.includes('grocer') || lower.includes('hawker') || lower.includes('breakfast')) {
        return cName.includes('food');
      }
      if (lower.includes('grab') || lower.includes('gojek') || lower.includes('taxi') || lower.includes('mrt') || lower.includes('bus') || lower.includes('transport') || lower.includes('petrol')) {
        return cName.includes('transport');
      }
      if (lower.includes('shop') || lower.includes('movie') || lower.includes('date') || lower.includes('lifestyle') || lower.includes('gym')) {
        return cName.includes('lifestyle');
      }
      if (lower.includes('clinic') || lower.includes('doctor') || lower.includes('pharmacy') || lower.includes('utility') || lower.includes('bill') || lower.includes('buffer')) {
        return cName.includes('buffer');
      }
      return false;
    });
  };

  const defaultCategory = categories[0]?.id || '';

  return lines.map((line, index) => {
    let working = line;

    // 1. Extract hashtags (#VietnamTrip, #Dinner, etc.)
    const tags: string[] = [];
    const hashRegex = /#([\w\d_-]+)/g;
    let match: RegExpExecArray | null;
    while ((match = hashRegex.exec(working)) !== null) {
      tags.push(match[1]);
    }
    working = working.replace(hashRegex, ' ').trim();

    // 2. Extract date if present (e.g. 2026-10-27 or 2026/10/27)
    let date = defaultDate;
    const dateMatch = working.match(/\b(\d{4}[-/]\d{2}[-/]\d{2})\b/);
    if (dateMatch) {
      date = dateMatch[1].replace(/\//g, '-');
      working = working.replace(dateMatch[0], ' ').trim();
    }

    // 3. Extract currency if specified (e.g. VND, JPY, MYR, USD, S$, $, RM, ₫, ¥)
    let currency = 'SGD';
    for (const c of SUPPORTED_CURRENCIES) {
      const codeRegex = new RegExp(`\\b${c.code}\\b`, 'i');
      if (codeRegex.test(working)) {
        currency = c.code;
        working = working.replace(codeRegex, ' ').trim();
        break;
      }
    }

    // 4. Extract amount (e.g. 12.50, 4.20, $35.00, S$12.50)
    let amount: number = 0;
    const amountMatch = working.match(/(?:S\$|\$|RM|₫|¥|฿|€|£)?\s*(\d+(?:,\d{3})*(?:\.\d{1,2})?|\d+)/i);
    if (amountMatch) {
      const rawNum = amountMatch[1].replace(/,/g, '');
      amount = parseFloat(rawNum) || 0;
      working = working.replace(amountMatch[0], ' ').trim();
    }

    // 5. Clean up remaining description
    let item = working
      .replace(/^[-–—:]+/, '')
      .replace(/[-–—:]+$/, '')
      .trim();

    if (!item) {
      item = tags.length > 0 ? tags.join(' ') : `Expense ${index + 1}`;
    }

    // 6. Auto-detect category from description & tags
    const detectedCat =
      findCategoryByKeyword(item) ||
      findCategoryByKeyword(tags.join(' '));
    const categoryId = detectedCat ? detectedCat.id : defaultCategory;

    return {
      id: `draft-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 6)}`,
      date,
      amount: amount > 0 ? amount : '',
      currency,
      categoryId,
      item,
      isShared: true,
      tags,
    };
  });
}

export function BulkAddExpenseModal({
  isOpen,
  onClose,
  onExpensesAdded,
  categories: propCategories,
  members: propMembers,
  defaultPayerId,
}: BulkAddExpenseModalProps) {
  const categories = propCategories && propCategories.length > 0 ? propCategories : mockCategories;
  const members = propMembers && propMembers.length > 0 ? propMembers : mockMembers;

  const today = getTodayDateString();
  const defaultCategory = categories[0]?.id || '';

  const [activeTab, setActiveTab] = useState<'grid' | 'paste'>('grid');
  const [payerId, setPayerId] = useState<string>(defaultPayerId || members[0]?.id || '');
  const [pasteText, setPasteText] = useState<string>(
    `12.50 Lunch at Maxwell
4.20 Iced White Coffee #Coffee
35.00 Grab to Orchard #Transport
62.40 NTUC FairPrice Groceries #Groceries`
  );

  const [rows, setRows] = useState<BulkExpenseDraftRow[]>(() => [
    {
      id: `row-1`,
      date: today,
      amount: '',
      currency: 'SGD',
      categoryId: defaultCategory,
      item: '',
      isShared: true,
      tags: [],
    },
    {
      id: `row-2`,
      date: today,
      amount: '',
      currency: 'SGD',
      categoryId: defaultCategory,
      item: '',
      isShared: true,
      tags: [],
    },
    {
      id: `row-3`,
      date: today,
      amount: '',
      currency: 'SGD',
      categoryId: defaultCategory,
      item: '',
      isShared: true,
      tags: [],
    },
  ]);

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Add an empty row
  const handleAddRow = () => {
    setRows((prev) => [
      ...prev,
      {
        id: `row-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        date: today,
        amount: '',
        currency: 'SGD',
        categoryId: defaultCategory,
        item: '',
        isShared: true,
        tags: [],
      },
    ]);
  };

  // Remove a row
  const handleDeleteRow = (id: string) => {
    setRows((prev) => (prev.length > 1 ? prev.filter((r) => r.id !== id) : prev));
  };

  // Update a row field
  const handleUpdateRow = (id: string, updates: Partial<BulkExpenseDraftRow>) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...updates } : r)));
  };

  // Parse text into grid rows
  const handleApplyPasteText = () => {
    const parsed = parseBulkExpenseText(pasteText, today, categories);
    if (parsed.length > 0) {
      setRows(parsed);
      setActiveTab('grid');
      setErrorMessage(null);
    } else {
      setErrorMessage('No valid lines detected in pasted text.');
    }
  };

  // Compute total count & estimated SGD total
  const summary = useMemo(() => {
    let count = 0;
    let totalSGD = 0;
    for (const r of rows) {
      const num = typeof r.amount === 'number' ? r.amount : parseFloat(r.amount);
      if (num && num > 0) {
        count++;
        const { amountInSGD } = convertToSGD(num, r.currency);
        totalSGD += amountInSGD;
      }
    }
    return {
      count,
      totalSGD: Math.round(totalSGD * 100) / 100,
    };
  }, [rows]);

  // Submit all valid rows
  const handleSubmit = async () => {
    // Filter rows with positive amount and item description
    const validRows = rows.filter((r) => {
      const num = typeof r.amount === 'number' ? r.amount : parseFloat(r.amount);
      return Boolean(num && num > 0 && r.item.trim());
    });

    if (validRows.length === 0) {
      setErrorMessage('Please fill in at least one expense with amount and description.');
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage(null);

      const expenseInputs: CreateExpenseInput[] = validRows.map((r) => {
        const num = typeof r.amount === 'number' ? r.amount : parseFloat(r.amount);
        const { amountInSGD, exchangeRate } = convertToSGD(num, r.currency);
        return {
          payer_id: payerId,
          category_id: r.categoryId || null,
          date: r.date || today,
          item: r.item.trim(),
          amount: amountInSGD,
          original_amount: r.currency !== 'SGD' ? num : null,
          original_currency: r.currency,
          exchange_rate: r.currency !== 'SGD' ? exchangeRate : null,
          is_shared: r.isShared,
          split_ratio: r.isShared ? 0.5 : 0.5,
          tags: r.tags || [],
        };
      });

      const created = await financeService.bulkAddExpenses(expenseInputs);
      if (typeof window !== 'undefined' && created.length > 0) {
        const totalAmount = created.reduce((sum, e) => sum + e.amount, 0);
        window.dispatchEvent(
          new CustomEvent('expenseAdded', {
            detail: {
              ...created[0],
              item: created.length === 1 ? created[0].item : `${created.length} expenses logged`,
              amount: totalAmount,
            },
          })
        );
      }
      onExpensesAdded?.(created);
      onClose();
    } catch (err) {
      console.error('Failed to bulk add expenses:', err);
      setErrorMessage(err instanceof Error ? err.message : 'Failed to save bulk expenses.');
    } finally {
      setIsSubmitting(false);
    }
  };

    return (
        <AnimatedModal
            isOpen={isOpen}
            onClose={onClose}
            maxWidth="max-w-4xl"
        >
            <div className="flex flex-col min-h-0 flex-1 overflow-hidden">
                {/* Header */}
                <ModalHeader
                    title="Bulk Add Expenses"
                    subtitle="Rapid multi-row batch entry or paste receipts / text"
                    icon={<Sparkles className="h-4.5 w-4.5" strokeWidth={2.5} />}
                    iconBgColor="bg-(--pastel-lilac-light)"
                    onClose={onClose}
                />

                {/* Global Controls & Tabs */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-(--border-subtle) bg-(--bg-card) px-4 sm:px-6 py-2.5">
                    {/* Mode Tabs */}
                    <div className="flex items-center rounded-xl bg-(--bg-canvas) p-1 border border-(--border-subtle)">
                        <button
                            type="button"
                            onClick={() => setActiveTab("grid")}
                            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                                activeTab === "grid"
                                    ? "bg-(--pastel-lilac) text-(--text-ink) border border-(--border-ink) shadow-cute-sm"
                                    : "text-(--text-muted) hover:text-(--text-ink)"
                            }`}
                        >
                            <TableIcon className="h-3.5 w-3.5" />
                            <span>Table Grid ({rows.length})</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab("paste")}
                            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                                activeTab === "paste"
                                    ? "bg-(--pastel-lilac) text-(--text-ink) border border-(--border-ink) shadow-cute-sm"
                                    : "text-(--text-muted) hover:text-(--text-ink)"
                            }`}
                        >
                            <FileText className="h-3.5 w-3.5" />
                            <span>Paste Text / Receipts</span>
                        </button>
                    </div>

                    {/* Payer Selector */}
                    <div className="flex items-center gap-2 text-xs">
                        <span className="font-bold text-[11px] uppercase tracking-wider text-(--text-muted)">
                            Payer:
                        </span>
                        <div className="relative flex items-center">
                            <select
                                aria-label="Payer for all expenses"
                                value={payerId}
                                onChange={(e) => setPayerId(e.target.value)}
                                className="appearance-none rounded-xl border border-(--border-subtle) hover:border-(--border-ink) bg-(--bg-canvas) pl-3 pr-8 py-1 text-xs font-bold text-(--text-ink) cursor-pointer focus:outline-none focus:ring-2 focus:ring-(--pastel-lilac)"
                            >
                                {members.map((m) => (
                                    <option key={m.id} value={m.id}>
                                        {m.avatar_url || "👤"} {m.display_name}
                                    </option>
                                ))}
                            </select>
                            <ChevronDown
                                className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-(--text-muted)"
                                strokeWidth={2.5}
                            />
                        </div>
                    </div>
                </div>

                {/* Modal Body */}
                <ModalBody className="p-4 sm:p-6 space-y-4">
                    {errorMessage && (
                        <div className="flex items-center gap-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 p-3 text-xs font-medium text-rose-700 dark:text-rose-300">
                            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
                            <span>{errorMessage}</span>
                        </div>
                    )}

                    {activeTab === "paste" ? (
                        /* Paste Text Mode */
                        <div className="space-y-4">
                            <div className="rounded-2xl bg-(--pastel-butter-light) p-4 text-xs text-(--text-ink) border-2 border-(--border-ink) shadow-cute-sm">
                                <p className="font-bold mb-1 flex items-center gap-1.5 text-(--text-ink)">
                                    <Sparkles className="h-4 w-4 stroke-3 text-(--text-ink)" />
                                    <span>Smart Text &amp; Receipt Parser</span>
                                </p>
                                <p className="text-(--text-muted) text-xs">
                                    Paste lines with amount, item description, and optional hashtags. Amounts and categories will be detected automatically!
                                </p>
                                <div className="mt-2.5 font-mono text-[11px] bg-(--bg-card) p-2.5 rounded-xl border border-(--border-ink) text-(--text-ink) leading-relaxed">
                                    Example: 12.50 Lunch at Maxwell<br />
                                    4.20 Coffee #Coffee<br />
                                    35.00 Grab to Airport #VietnamTrip
                                </div>
                            </div>

                            <textarea
                                rows={8}
                                value={pasteText}
                                onChange={(e) => setPasteText(e.target.value)}
                                placeholder="Paste multi-line transactions here..."
                                className="w-full rounded-2xl border-2 border-(--border-subtle) focus:border-(--border-ink) bg-(--bg-card) p-4 font-mono text-xs text-(--text-ink) placeholder:text-(--text-muted) focus:outline-none focus:ring-2 focus:ring-(--pastel-lilac)"
                            />

                            <div className="flex justify-end">
                                <button
                                    type="button"
                                    onClick={handleApplyPasteText}
                                    className="inline-flex items-center gap-1.5 rounded-xl border-2 border-(--border-ink) bg-(--pastel-lilac) px-4 py-2 text-xs font-black text-(--text-ink) shadow-cute-sm hover:bg-[#1a1a1a] hover:text-[#fbf7f1] active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer"
                                >
                                    <Sparkles className="h-4 w-4 stroke-3" />
                                    <span>Parse into Table Grid</span>
                                </button>
                            </div>
                        </div>
                    ) : (
                        /* Table Grid Mode */
                        <div className="space-y-3">
                            <div className="overflow-x-auto rounded-2xl border-2 border-(--border-ink) shadow-cute-sm bg-(--bg-card)">
                                <table className="w-full text-left text-xs text-(--text-ink)">
                                    <thead className="bg-(--bg-canvas) text-[11px] font-bold uppercase tracking-wider text-(--text-muted) border-b-2 border-(--border-ink)">
                                        <tr>
                                            <th className="py-2.5 pl-3 pr-2 w-32">Date</th>
                                            <th className="px-2 py-2.5 w-24">Amount</th>
                                            <th className="px-2 py-2.5 w-24">Currency</th>
                                            <th className="px-2 py-2.5 w-36">Category</th>
                                            <th className="px-2 py-2.5 min-w-35">Description</th>
                                            <th className="px-2 py-2.5 w-20 text-center">Shared</th>
                                            <th className="px-2 py-2.5 w-32">Tags</th>
                                            <th className="py-2.5 pl-2 pr-3 w-10 text-center"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-(--border-subtle)">
                                        {rows.map((row, idx) => (
                                            <tr key={row.id} className="hover:bg-(--pastel-butter-light)/30 transition-colors">
                                                {/* Date */}
                                                <td className="py-2 pl-3 pr-2">
                                                    <input
                                                        type="date"
                                                        value={row.date}
                                                        onChange={(e) => handleUpdateRow(row.id, { date: e.target.value })}
                                                        className="w-full rounded-xl border border-(--border-subtle) hover:border-(--border-ink) focus:border-(--border-ink) bg-(--bg-canvas) px-2 py-1.5 text-xs font-medium text-(--text-ink) focus:outline-none focus:ring-1 focus:ring-(--pastel-lilac)"
                                                    />
                                                </td>

                                                {/* Amount */}
                                                <td className="px-2 py-2">
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        min="0"
                                                        placeholder="0.00"
                                                        value={row.amount}
                                                        onChange={(e) =>
                                                            handleUpdateRow(row.id, {
                                                                amount: e.target.value === "" ? "" : parseFloat(e.target.value),
                                                            })
                                                        }
                                                        className="w-full rounded-xl border border-(--border-subtle) hover:border-(--border-ink) focus:border-(--border-ink) bg-(--bg-canvas) px-2 py-1.5 text-xs font-bold font-mono-num text-(--text-ink) focus:outline-none focus:ring-1 focus:ring-(--pastel-lilac)"
                                                    />
                                                </td>

                                                {/* Currency */}
                                                <td className="px-2 py-2">
                                                    <div className="relative flex items-center">
                                                        <select
                                                            aria-label={`Currency for row ${idx + 1}`}
                                                            value={row.currency}
                                                            onChange={(e) => handleUpdateRow(row.id, { currency: e.target.value })}
                                                            className="w-full appearance-none rounded-xl border border-(--border-subtle) hover:border-(--border-ink) focus:border-(--border-ink) bg-(--bg-canvas) pl-2 pr-6 py-1.5 text-xs font-bold text-(--text-ink) focus:outline-none focus:ring-1 focus:ring-(--pastel-lilac) cursor-pointer"
                                                        >
                                                            {SUPPORTED_CURRENCIES.map((c) => (
                                                                <option key={c.code} value={c.code}>
                                                                    {c.code}
                                                                </option>
                                                            ))}
                                                        </select>
                                                        <ChevronDown
                                                            className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 h-3 w-3 text-(--text-muted)"
                                                            strokeWidth={2.5}
                                                        />
                                                    </div>
                                                </td>

                                                {/* Category */}
                                                <td className="px-2 py-2">
                                                    <div className="relative flex items-center">
                                                        <select
                                                            aria-label={`Category for row ${idx + 1}`}
                                                            value={row.categoryId}
                                                            onChange={(e) => handleUpdateRow(row.id, { categoryId: e.target.value })}
                                                            className="w-full appearance-none rounded-xl border border-(--border-subtle) hover:border-(--border-ink) focus:border-(--border-ink) bg-(--bg-canvas) pl-2 pr-6 py-1.5 text-xs font-medium text-(--text-ink) focus:outline-none focus:ring-1 focus:ring-(--pastel-lilac) cursor-pointer"
                                                        >
                                                            {categories.map((cat) => (
                                                                <option key={cat.id} value={cat.id}>
                                                                    {cat.name}
                                                                </option>
                                                            ))}
                                                        </select>
                                                        <ChevronDown
                                                            className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 h-3 w-3 text-(--text-muted)"
                                                            strokeWidth={2.5}
                                                        />
                                                    </div>
                                                </td>

                                                {/* Item / Description */}
                                                <td className="px-2 py-2">
                                                    <input
                                                        type="text"
                                                        placeholder="e.g. Lunch"
                                                        value={row.item}
                                                        onChange={(e) => handleUpdateRow(row.id, { item: e.target.value })}
                                                        className="w-full rounded-xl border border-(--border-subtle) hover:border-(--border-ink) focus:border-(--border-ink) bg-(--bg-canvas) px-2.5 py-1.5 text-xs text-(--text-ink) placeholder:text-(--text-muted) focus:outline-none focus:ring-1 focus:ring-(--pastel-lilac)"
                                                    />
                                                </td>

                                                {/* Shared Toggle */}
                                                <td className="px-2 py-2 text-center">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleUpdateRow(row.id, { isShared: !row.isShared })}
                                                        className={`inline-flex items-center justify-center rounded-lg px-2.5 py-1 text-[11px] font-bold border transition-all cursor-pointer active:translate-x-0.5 active:translate-y-0.5 ${
                                                            row.isShared
                                                                ? "bg-(--pastel-sage-light) text-(--text-ink) border-(--border-ink) shadow-cute-sm"
                                                                : "bg-(--bg-canvas) text-(--text-muted) border-(--border-subtle) hover:border-(--border-ink)"
                                                        }`}
                                                    >
                                                        {row.isShared ? "50/50" : "Solo"}
                                                    </button>
                                                </td>

                                                {/* Tags */}
                                                <td className="px-2 py-2">
                                                    <input
                                                        type="text"
                                                        placeholder="#tag"
                                                        value={row.tags.join(", ")}
                                                        onChange={(e) =>
                                                            handleUpdateRow(row.id, {
                                                                tags: e.target.value
                                                                    .split(",")
                                                                    .map((t) => t.trim().replace(/^#/, ""))
                                                                    .filter(Boolean),
                                                            })
                                                        }
                                                        className="w-full rounded-xl border border-(--border-subtle) hover:border-(--border-ink) focus:border-(--border-ink) bg-(--bg-canvas) px-2 py-1.5 text-xs font-mono text-(--text-ink) placeholder:text-(--text-muted) focus:outline-none focus:ring-1 focus:ring-(--pastel-lilac)"
                                                    />
                                                </td>

                                                {/* Delete Row Button */}
                                                <td className="py-2 pl-2 pr-3 text-center">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDeleteRow(row.id)}
                                                        aria-label={`Delete row ${idx + 1}`}
                                                        className="flex h-7 w-7 mx-auto items-center justify-center rounded-lg text-(--text-muted) hover:text-(--text-ink) hover:bg-(--pastel-coral-light) active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer"
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Add Row Button */}
                            <button
                                type="button"
                                onClick={handleAddRow}
                                className="inline-flex items-center gap-1.5 rounded-xl border-2 border-dashed border-(--border-ink) bg-(--bg-canvas) px-3.5 py-2 text-xs font-bold text-(--text-ink) hover:bg-(--pastel-butter-light) active:translate-x-0.5 active:translate-y-0.5 cursor-pointer transition-all shadow-cute-sm"
                            >
                                <Plus className="h-4 w-4" strokeWidth={2.5} />
                                <span>+ Add Row</span>
                            </button>
                        </div>
                    )}
                </ModalBody>

                {/* Footer Summary & Submit */}
                <ModalFooter className="justify-between">
                    <div className="text-xs text-(--text-muted)">
                        <span className="font-bold text-(--text-ink)">
                            {summary.count} item{summary.count === 1 ? "" : "s"}
                        </span>{" "}
                        totaling{" "}
                        <span className="font-black text-(--text-ink) text-sm font-mono-num">
                            {formatSGD(summary.totalSGD)}
                        </span>
                    </div>

                    <div className="flex items-center gap-2.5">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isSubmitting}
                            className="rounded-xl px-4 py-2 text-xs font-bold text-(--text-muted) hover:text-(--text-ink) cursor-pointer"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={handleSubmit}
                            disabled={isSubmitting || summary.count === 0}
                            className="inline-flex items-center gap-1.5 rounded-xl border-2 border-(--border-ink) bg-(--pastel-lilac) px-5 py-2 text-xs font-black text-(--text-ink) shadow-cute-sm hover:bg-[#1a1a1a] hover:text-[#fbf7f1] active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer disabled:opacity-50"
                        >
                            <CheckCircle2 className="h-4 w-4" />
                            <span>{isSubmitting ? "Saving All..." : `Log All (${summary.count})`}</span>
                        </button>
                    </div>
                </ModalFooter>
            </div>
        </AnimatedModal>
    );
}

export default BulkAddExpenseModal;
