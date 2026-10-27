/**
 * SpendTagsOverviewCard Component
 * Aggregates expenses across categories by Spend Tag (e.g. 'Vietnam Trip', 'Home Reno', 'Wedding'):
 * - Total spend per tag across categories
 * - Number of transactions
 * - Category breakdown per tag
 * - 1-tap tag filter button that filters ledger directly to that tag
 */

import { useMemo } from 'react';
import { Tag, Filter, Check, X, Layers } from 'lucide-react';
import { formatSGD } from '../../lib/currency';
import type { Expense, Category } from '../../types/finance';

export interface TagAggregate {
  tag: string;
  totalAmount: number;
  transactionCount: number;
  categories: { id: string; name: string; color: string; amount: number }[];
}

export interface SpendTagsOverviewCardProps {
  expenses: Expense[];
  categories?: Category[];
  activeTag?: string;
  onSelectTag?: (tag: string) => void;
  onClearTag?: () => void;
  className?: string;
}

export function SpendTagsOverviewCard({
  expenses,
  categories = [],
  activeTag,
  onSelectTag,
  onClearTag,
  className = '',
}: SpendTagsOverviewCardProps) {
  // Aggregate expenses by tag
  const tagAggregates = useMemo<TagAggregate[]>(() => {
    const categoryMap = new Map<string, Category>();
    for (const cat of categories) {
      categoryMap.set(cat.id, cat);
    }

    const tagMap = new Map<string, {
      totalAmount: number;
      transactionCount: number;
      catMap: Map<string, number>;
    }>();

    for (const exp of expenses) {
      if (!exp.tags || exp.tags.length === 0) continue;

      for (const rawTag of exp.tags) {
        const trimmed = rawTag.trim();
        if (!trimmed) continue;

        let entry = tagMap.get(trimmed);
        if (!entry) {
          entry = {
            totalAmount: 0,
            transactionCount: 0,
            catMap: new Map<string, number>(),
          };
          tagMap.set(trimmed, entry);
        }

        entry.totalAmount += exp.amount;
        entry.transactionCount += 1;

        if (exp.category_id) {
          const currentCatAmt = entry.catMap.get(exp.category_id) || 0;
          entry.catMap.set(exp.category_id, currentCatAmt + exp.amount);
        }
      }
    }

    const result: TagAggregate[] = [];
    for (const [tag, data] of tagMap.entries()) {
      const catList: { id: string; name: string; color: string; amount: number }[] = [];
      for (const [catId, amt] of data.catMap.entries()) {
        const cat = categoryMap.get(catId);
        catList.push({
          id: catId,
          name: cat?.name || 'Other',
          color: cat?.color || '#64748b',
          amount: Math.round(amt * 100) / 100,
        });
      }
      catList.sort((a, b) => b.amount - a.amount);

      result.push({
        tag,
        totalAmount: Math.round(data.totalAmount * 100) / 100,
        transactionCount: data.transactionCount,
        categories: catList,
      });
    }

    // Sort by total spend descending
    result.sort((a, b) => b.totalAmount - a.totalAmount);
    return result;
  }, [expenses, categories]);

  const totalTaggedSpend = useMemo(() => {
    return Math.round(tagAggregates.reduce((sum, t) => sum + t.totalAmount, 0) * 100) / 100;
  }, [tagAggregates]);

  return (
    <div
      data-testid="spend-tags-overview-card"
      className={`rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900 ${className}`}
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-50 text-purple-600 dark:bg-purple-950/50 dark:text-purple-400">
            <Tag className="h-4.5 w-4.5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span>Spend Tags Overview</span>
              {tagAggregates.length > 0 && (
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300">
                  {tagAggregates.length} {tagAggregates.length === 1 ? 'tag' : 'tags'}
                </span>
              )}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Cross-category tracking for big trips, renovations, and milestone events
            </p>
          </div>
        </div>

        {activeTag && (
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <span className="text-xs font-semibold text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/60 border border-purple-200 dark:border-purple-800 px-2.5 py-1 rounded-xl flex items-center gap-1.5">
              <Filter className="h-3 w-3" />
              <span>Filtering by #{activeTag}</span>
            </span>
            <button
              type="button"
              aria-label="Clear tag filter"
              onClick={onClearTag}
              className="flex h-6 w-6 items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:text-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {tagAggregates.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-800 p-6 text-center">
          <Tag className="h-8 w-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
          <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">No Spend Tags Recorded</p>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 max-w-sm mx-auto mt-0.5">
            Add tags like &ldquo;Vietnam Trip&rdquo;, &ldquo;Home Reno&rdquo;, or &ldquo;Wedding&rdquo; when logging expenses to group costs across Food, Transport, and Lifestyle.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Tag Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {tagAggregates.map((item) => {
              const isSelected = activeTag?.toLowerCase() === item.tag.toLowerCase();

              return (
                <div
                  key={item.tag}
                  data-testid={`tag-card-${item.tag}`}
                  onClick={() => onSelectTag?.(item.tag)}
                  className={`group relative flex flex-col justify-between p-3.5 rounded-xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'border-purple-500 bg-purple-50/40 dark:bg-purple-950/30 ring-2 ring-purple-500/20 shadow-xs'
                      : 'border-slate-200/80 bg-slate-50/60 hover:bg-white dark:border-slate-800 dark:bg-slate-800/40 dark:hover:bg-slate-800/80'
                  }`}
                >
                  <div>
                    {/* Tag Title & Filter Action */}
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-xs text-slate-900 dark:text-white flex items-center gap-1 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                        <span className="text-purple-500 font-extrabold">#</span>
                        <span className="truncate">{item.tag}</span>
                      </span>

                      <button
                        type="button"
                        aria-label={`Filter by ${item.tag}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (isSelected) {
                            onClearTag?.();
                          } else {
                            onSelectTag?.(item.tag);
                          }
                        }}
                        className={`flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-purple-600 text-white'
                            : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600 group-hover:border-purple-300'
                        }`}
                      >
                        {isSelected ? (
                          <>
                            <Check className="h-3 w-3" />
                            <span>Active</span>
                          </>
                        ) : (
                          <>
                            <Filter className="h-2.5 w-2.5" />
                            <span>Filter</span>
                          </>
                        )}
                      </button>
                    </div>

                    {/* Spend & Count Highlight */}
                    <div className="mt-2.5 flex items-baseline justify-between">
                      <span className="text-base font-extrabold text-slate-900 dark:text-white">
                        {formatSGD(item.totalAmount)}
                      </span>
                      <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                        {item.transactionCount} {item.transactionCount === 1 ? 'tx' : 'txs'}
                      </span>
                    </div>
                  </div>

                  {/* Category breakdown tags */}
                  {item.categories.length > 0 && (
                    <div className="mt-3 pt-2.5 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center gap-1.5 flex-wrap">
                      <Layers className="h-3 w-3 text-slate-400 shrink-0" />
                      {item.categories.slice(0, 3).map((cat) => (
                        <span
                          key={cat.id}
                          className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-700/80 px-1.5 py-0.5 rounded-md border border-slate-200/50 dark:border-slate-600/50"
                        >
                          <span
                            className="h-1.5 w-1.5 rounded-full"
                            style={{ backgroundColor: cat.color }}
                          />
                          <span>{cat.name}</span>
                          <span className="text-slate-400 font-mono text-[9px]">
                            {formatSGD(cat.amount)}
                          </span>
                        </span>
                      ))}
                      {item.categories.length > 3 && (
                        <span className="text-[10px] text-slate-400">
                          +{item.categories.length - 3} more
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Footer note */}
          <div className="flex items-center justify-between text-[11px] text-slate-400 dark:text-slate-500 pt-1">
            <span>Click any tag to filter the transaction ledger</span>
            <span>Total Tagged Spend: <span className="font-bold text-slate-600 dark:text-slate-300">{formatSGD(totalTaggedSpend)}</span></span>
          </div>
        </div>
      )}
    </div>
  );
}
