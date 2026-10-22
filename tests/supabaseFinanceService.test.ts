import { describe, it, expect, vi, beforeEach } from 'vitest';
import { supabaseFinanceService } from '../src/services/supabaseFinanceService';
import * as supabaseClientModule from '../src/services/supabaseClient';
import type { BaseBudgetProfile, BaseProfileAllocation } from '../src/types/finance';
import { isValidUuid } from '../src/lib/uuid';

describe('supabaseFinanceService.updateBaseProfile', () => {
  const validHouseholdId = '00000000-0000-0000-0000-000000000001';
  const validMemberId = '00000000-0000-0000-0000-000000000011';
  const validCategoryId = '00000000-0000-0000-0000-000000000101';
  const validProfileId = '00000000-0000-0000-0000-000000000201';

  let mockClient: any;
  let upsertProfileSpy: any;
  let insertAllocationsSpy: any;
  let deleteAllocationsSpy: any;

  beforeEach(() => {
    vi.restoreAllMocks();

    upsertProfileSpy = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: { id: validProfileId },
          error: null,
        }),
      }),
    });

    insertAllocationsSpy = vi.fn().mockResolvedValue({ error: null });

    deleteAllocationsSpy = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });

    mockClient = {
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
        if (table === 'household_members') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: [
                  { id: validMemberId, display_name: 'Yi Jia' },
                ],
                error: null,
              }),
            }),
          };
        }
        if (table === 'categories') {
          return {
            select: vi.fn().mockResolvedValue({
              data: [
                { id: validCategoryId, name: 'Food' },
              ],
              error: null,
            }),
          };
        }
        if (table === 'base_budget_profiles') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: { id: validProfileId },
                    error: null,
                  }),
                }),
              }),
            }),
            upsert: upsertProfileSpy,
          };
        }
        if (table === 'base_profile_allocations') {
          return {
            delete: deleteAllocationsSpy,
            insert: insertAllocationsSpy,
          };
        }
        return {};
      }),
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { email: 'yijia@example.com' } } }),
      },
    };

    vi.spyOn(supabaseClientModule, 'supabase', 'get').mockReturnValue(mockClient);
  });

  it('sanitizes mock IDs ("hh-00000000-0001", "mem-...", "prof-...") to valid UUIDs before sending to Supabase', async () => {
    const mockInputProfile: BaseBudgetProfile = {
      id: 'prof-00000000-0201',
      household_id: 'hh-00000000-0001', // This was causing the invalid input syntax for type uuid error!
      owner_id: 'mem-00000000-0011',
      gross_salary: 6000,
      cpf_employee_rate: 0.20,
      tithing_enabled: true,
    };

    const mockInputAllocations: BaseProfileAllocation[] = [
      {
        id: 'alloc-yj-01',
        profile_id: 'prof-00000000-0201',
        category_id: 'cat-00000000-0101',
        target_percentage: 1.0,
      },
    ];

    await supabaseFinanceService.updateBaseProfile(mockInputProfile, mockInputAllocations);

    // Verify profile upsert payload
    expect(upsertProfileSpy).toHaveBeenCalledTimes(1);
    const [upsertPayload, options] = upsertProfileSpy.mock.calls[0];

    expect(options).toEqual({ onConflict: 'household_id,owner_id' });
    expect(upsertPayload.household_id).not.toBe('hh-00000000-0001');
    expect(isValidUuid(upsertPayload.household_id)).toBe(true);
    expect(upsertPayload.household_id).toBe(validHouseholdId);

    expect(upsertPayload.owner_id).not.toBe('mem-00000000-0011');
    expect(isValidUuid(upsertPayload.owner_id)).toBe(true);
    expect(upsertPayload.owner_id).toBe(validMemberId);

    expect(isValidUuid(upsertPayload.id)).toBe(true);

    // Verify allocations payload
    expect(insertAllocationsSpy).toHaveBeenCalledTimes(1);
    const [insertedAllocations] = insertAllocationsSpy.mock.calls[0];
    expect(insertedAllocations).toHaveLength(1);

    const alloc = insertedAllocations[0];
    expect(alloc.profile_id).toBe(validProfileId);
    expect(isValidUuid(alloc.profile_id)).toBe(true);

    expect(alloc.category_id).not.toBe('cat-00000000-0101');
    expect(isValidUuid(alloc.category_id)).toBe(true);
    expect(alloc.category_id).toBe(validCategoryId);

    expect(alloc.id).not.toBe('alloc-yj-01');
    expect(isValidUuid(alloc.id)).toBe(true);
  });
});

