import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { supabaseFinanceService } from '../src/services/supabaseFinanceService';
import { mockFinanceService } from '../src/services/mockFinanceService';
import * as supabaseClientModule from '../src/services/supabaseClient';
import { ManageCategoriesModal } from '../src/components/categories/ManageCategoriesModal';

describe('Category Management & Auto-Seeding', () => {
  const validHouseholdId = '00000000-0000-0000-0000-000000000001';

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('supabaseFinanceService Category CRUD', () => {
    it('auto-seeds recommended default categories if household has no categories in Supabase', async () => {
      let isFirstCall = true;
      const upsertSpy = vi.fn().mockReturnValue({
        select: vi.fn().mockResolvedValue({
          data: [
            { id: '00000000-0000-0000-0000-000000000101', name: 'Food', color: '#F59E0B', icon: 'utensils', is_system: false },
            { id: '00000000-0000-0000-0000-000000000102', name: 'Lifestyle', color: '#EC4899', icon: 'sparkles', is_system: false },
            { id: '00000000-0000-0000-0000-000000000103', name: 'Transport', color: '#3B82F6', icon: 'car', is_system: false },
            { id: '00000000-0000-0000-0000-000000000104', name: 'Investments', color: '#10B981', icon: 'trending-up', is_system: false },
            { id: '00000000-0000-0000-0000-000000000105', name: 'Savings', color: '#6366F1', icon: 'piggy-bank', is_system: false },
            { id: '00000000-0000-0000-0000-000000000106', name: 'Tithing', color: '#8B5CF6', icon: 'heart', is_system: false },
            { id: '00000000-0000-0000-0000-000000000107', name: 'Buffer', color: '#64748B', icon: 'shield', is_system: false },
          ],
          error: null,
        }),
      });

      const mockClient = {
        from: vi.fn((table: string) => {
          if (table === 'households') {
            return {
              select: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: { id: validHouseholdId },
                    error: null,
                  }),
                }),
              }),
            };
          }
          if (table === 'categories') {
            return {
              select: vi.fn().mockImplementation(() => {
                if (isFirstCall) {
                  isFirstCall = false;
                  return Promise.resolve({ data: [], error: null });
                }
                return Promise.resolve({
                  data: [
                    { id: '00000000-0000-0000-0000-000000000101', name: 'Food', color: '#F59E0B', icon: 'utensils', is_system: false },
                  ],
                  error: null,
                });
              }),
              upsert: upsertSpy,
            };
          }
          return {};
        }),
      };

      vi.spyOn(supabaseClientModule, 'supabase', 'get').mockReturnValue(mockClient as any);

      const cats = await supabaseFinanceService.getCategories();
      expect(upsertSpy).toHaveBeenCalledTimes(1);
      expect(cats).toHaveLength(7);
      expect(cats.map((c) => c.name)).toContain('Food');
      expect(cats.map((c) => c.name)).toContain('Lifestyle');
      expect(cats.find((c) => c.name === 'Food')?.group).toBe('spendable');
      expect(cats.find((c) => c.name === 'Investments')?.group).toBe('allocation');
    });

    it('adds, updates, and deletes categories in Supabase', async () => {
      const insertSpy = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              id: '00000000-0000-0000-0000-000000000999',
              household_id: validHouseholdId,
              name: 'Pet Care',
              color: '#10B981',
              icon: 'heart',
              is_system: false,
            },
            error: null,
          }),
        }),
      });

      const updateSpy = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: {
                id: '00000000-0000-0000-0000-000000000999',
                household_id: validHouseholdId,
                name: 'Pet Supplies',
                color: '#EC4899',
                icon: 'heart',
                is_system: false,
              },
              error: null,
            }),
          }),
        }),
      });

      const deleteSpy = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });

      const mockClient = {
        from: vi.fn((table: string) => {
          if (table === 'households') {
            return {
              select: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: { id: validHouseholdId },
                    error: null,
                  }),
                }),
              }),
            };
          }
          if (table === 'categories') {
            return {
              insert: insertSpy,
              update: updateSpy,
              delete: deleteSpy,
            };
          }
          return {};
        }),
      };

      vi.spyOn(supabaseClientModule, 'supabase', 'get').mockReturnValue(mockClient as any);

      // Add
      const created = await supabaseFinanceService.addCategory({
        name: 'Pet Care',
        color: '#10B981',
        icon: 'heart',
        group: 'spendable',
      });
      expect(created.name).toBe('Pet Care');
      expect(insertSpy).toHaveBeenCalled();

      // Update
      const updated = await supabaseFinanceService.updateCategory(created.id, {
        name: 'Pet Supplies',
        color: '#EC4899',
      });
      expect(updated.name).toBe('Pet Supplies');
      expect(updateSpy).toHaveBeenCalled();

      // Delete
      await supabaseFinanceService.deleteCategory(created.id);
      expect(deleteSpy).toHaveBeenCalled();
    });
  });

  describe('mockFinanceService Category CRUD', () => {
    beforeEach(() => {
      mockFinanceService.resetData();
    });

    it('adds, updates, deletes, and restores preset categories in mock store', async () => {
      const initialCount = (await mockFinanceService.getCategories()).length;

      // Add
      const newCat = await mockFinanceService.addCategory({
        name: 'Gym & Fitness',
        color: '#3B82F6',
        icon: 'sparkles',
        group: 'spendable',
      });
      expect(newCat.name).toBe('Gym & Fitness');
      const afterAdd = await mockFinanceService.getCategories();
      expect(afterAdd.length).toBe(initialCount + 1);

      // Update
      const updated = await mockFinanceService.updateCategory(newCat.id, {
        name: 'Fitness & Health',
      });
      expect(updated.name).toBe('Fitness & Health');

      // Delete
      await mockFinanceService.deleteCategory(newCat.id);
      const afterDelete = await mockFinanceService.getCategories();
      expect(afterDelete.length).toBe(initialCount);

      // Restore
      const restored = await mockFinanceService.seedDefaultCategories();
      expect(restored.length).toBe(7);
    });
  });

  describe('ManageCategoriesModal UI', () => {
    it('renders category list and allows opening Add Category form', async () => {
      await act(async () => {
        render(
          <ManageCategoriesModal
            isOpen={true}
            onClose={vi.fn()}
          />
        );
      });

      await waitFor(() => {
        expect(screen.getByText('Manage Categories')).toBeInTheDocument();
        expect(screen.getByText(/spendable categories/i)).toBeInTheDocument();
        expect(screen.getByText(/wealth & fixed allocations/i)).toBeInTheDocument();
      });

      // Click Add Category button
      const addBtn = screen.getByRole('button', { name: /add category/i });
      fireEvent.click(addBtn);

      // Verify Add Category form appears
      expect(screen.getByText('Add New Category')).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/e\.g\. Groceries/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /create category/i })).toBeInTheDocument();
    });
  });
});
