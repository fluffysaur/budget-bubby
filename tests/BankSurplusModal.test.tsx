import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { BankSurplusModal } from '../src/components/budget/BankSurplusModal';

describe('BankSurplusModal', () => {
    it('renders modal with title, amount, and reserve cushion explanation', () => {
        render(
            <BankSurplusModal
                isOpen={true}
                onClose={vi.fn()}
                surplusAmount={1200}
                month="2026-09"
                onConfirm={vi.fn()}
            />
        );

        expect(screen.getByRole('heading', { name: /bank as surplus/i })).toBeInTheDocument();
        expect(screen.getByText(/Reserve Cushion Confirmation/i)).toBeInTheDocument();
        expect(screen.getByText(/Destination:/i)).toBeInTheDocument();
    });

    it('calls onConfirm when confirming and close', () => {
        const handleConfirm = vi.fn();
        const handleClose = vi.fn();

        render(
            <BankSurplusModal
                isOpen={true}
                onClose={handleClose}
                surplusAmount={1200}
                month="2026-09"
                onConfirm={handleConfirm}
            />
        );

        const confirmBtn = screen.getByRole('button', { name: /confirm & bank as surplus/i });
        fireEvent.click(confirmBtn);

        expect(handleConfirm).toHaveBeenCalledTimes(1);
        expect(handleClose).toHaveBeenCalledTimes(1);
    });
});
