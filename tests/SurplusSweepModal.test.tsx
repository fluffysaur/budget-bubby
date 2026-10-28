import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { SurplusSweepModal } from '../src/components/budget/SurplusSweepModal';
import type { SavingsGoal } from '../src/types/finance';

const mockGoals: SavingsGoal[] = [
    {
        id: 'goal-wedding',
        household_id: 'hh-1',
        title: 'Wedding Fund',
        target_amount: 50000,
        saved_so_far: 20000,
        target_date: '2027-05-01',
        monthly_contribution: 1000,
        emoji: '💍',
        status: 'on_track',
    },
    {
        id: 'goal-emergency',
        household_id: 'hh-1',
        title: 'Emergency Reserve',
        target_amount: 30000,
        saved_so_far: 15000,
        target_date: '2026-12-31',
        monthly_contribution: 500,
        emoji: '🛡️',
        status: 'on_track',
    },
];

describe('SurplusSweepModal', () => {
    it('renders surplus amount, goals, and mode selector when open', () => {
        render(
            <SurplusSweepModal
                isOpen={true}
                onClose={vi.fn()}
                surplusAmount={500}
                month="2026-09"
                goals={mockGoals}
                onSweepComplete={vi.fn()}
            />
        );

        expect(screen.getByText(/Sweep Unspent Surplus/i)).toBeInTheDocument();
        expect(screen.getByText(/Wedding Fund/i)).toBeInTheDocument();
        expect(screen.getByText(/Emergency Reserve/i)).toBeInTheDocument();
    });

    it('splits surplus evenly across selected goals when clicking Split Evenly', () => {
        render(
            <SurplusSweepModal
                isOpen={true}
                onClose={vi.fn()}
                surplusAmount={500}
                month="2026-09"
                goals={mockGoals}
                onSweepComplete={vi.fn()}
            />
        );

        const splitEvenlyBtn = screen.getByRole('button', { name: /split evenly/i });
        fireEvent.click(splitEvenlyBtn);

        // With 2 goals and 500 surplus: 250 each
        const inputs = screen.getAllByRole('spinbutton');
        expect(inputs.length).toBe(2);
        // In dollar mode (or percent mode), amounts should sum to 500
        expect(screen.getByText(/100% Allocated/i)).toBeInTheDocument();
    });

    it('submits allocations to onSweepComplete with correct distribution', async () => {
        const handleSweepComplete = vi.fn().mockResolvedValue(undefined);
        render(
            <SurplusSweepModal
                isOpen={true}
                onClose={vi.fn()}
                surplusAmount={400}
                month="2026-09"
                goals={mockGoals}
                onSweepComplete={handleSweepComplete}
            />
        );

        // Click Split Evenly => 200 each
        fireEvent.click(screen.getByRole('button', { name: /split evenly/i }));

        const submitBtn = screen.getByRole('button', { name: /deposit/i });
        fireEvent.click(submitBtn);

        await waitFor(() => {
            expect(handleSweepComplete).toHaveBeenCalledWith([
                { goalId: 'goal-wedding', amount: 200 },
                { goalId: 'goal-emergency', amount: 200 },
            ]);
        });
    });

    it('prevents submission if total allocated exceeds surplus', () => {
        render(
            <SurplusSweepModal
                isOpen={true}
                onClose={vi.fn()}
                surplusAmount={300}
                month="2026-09"
                goals={mockGoals}
                onSweepComplete={vi.fn()}
            />
        );

        const inputs = screen.getAllByRole('spinbutton');
        // Set first input to 500 (greater than 300)
        fireEvent.change(inputs[0], { target: { value: '500' } });

        const submitBtn = screen.getByRole('button', { name: /deposit/i });
        expect(submitBtn).toBeDisabled();
    });
});
