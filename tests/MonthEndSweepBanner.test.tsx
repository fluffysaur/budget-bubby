import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MonthEndSweepBanner } from '../src/components/budget/MonthEndSweepBanner';

describe('MonthEndSweepBanner', () => {
    it('renders shortened title with amount and month, plus actionable subtitle', () => {
        render(
            <MonthEndSweepBanner
                month="2026-09"
                surplusAmount={3654.05}
                onSweepClick={vi.fn()}
                onBankSurplusClick={vi.fn()}
            />
        );

        // Title: "$3,654.05 unspent from September 2026 budget"
        expect(screen.getByText(/3,654\.05 unspent from September 2026 budget/i)).toBeInTheDocument();
        // Subtitle: "Sweep it into your Savings Goals or bank it as surplus!"
        expect(screen.getByText(/Sweep it into your Savings Goals or bank it as surplus!/i)).toBeInTheDocument();

        // 2 Action Buttons
        expect(screen.getByRole('button', { name: /sweep to goals/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /bank as surplus/i })).toBeInTheDocument();
    });

    it('triggers onSweepClick when clicking Sweep to Goals button', () => {
        const handleSweepClick = vi.fn();
        render(
            <MonthEndSweepBanner
                month="2026-09"
                surplusAmount={350}
                onSweepClick={handleSweepClick}
                onBankSurplusClick={vi.fn()}
            />
        );

        fireEvent.click(screen.getByRole('button', { name: /sweep to goals/i }));
        expect(handleSweepClick).toHaveBeenCalledTimes(1);
    });

    it('triggers onBankSurplusClick when clicking Bank as Surplus button', () => {
        const handleBankSurplus = vi.fn();
        render(
            <MonthEndSweepBanner
                month="2026-09"
                surplusAmount={350}
                onSweepClick={vi.fn()}
                onBankSurplusClick={handleBankSurplus}
            />
        );

        fireEvent.click(screen.getByRole('button', { name: /bank as surplus/i }));
        expect(handleBankSurplus).toHaveBeenCalledTimes(1);
    });
});
