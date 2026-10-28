import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ExpensesPage } from '../src/pages/ExpensesPage';
import { HouseholdProvider } from '../src/context/HouseholdContext';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

function renderWithProviders(ui: React.ReactElement) {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: { retry: false },
        },
    });
    return render(
        <QueryClientProvider client={queryClient}>
            <HouseholdProvider>
                {ui}
            </HouseholdProvider>
        </QueryClientProvider>
    );
}

describe('ExpensesPage Pacing & 4-Card Summary Strip', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
    });

    it('renders Spendable Remaining as the primary card in a 4-card summary strip', async () => {
        renderWithProviders(<ExpensesPage />);

        await waitFor(() => {
            expect(screen.getByText(/Spendable Remaining/i)).toBeInTheDocument();
            expect(screen.getByText(/Total Spent/i)).toBeInTheDocument();
            expect(screen.getByText(/Shared Spending/i)).toBeInTheDocument();
            expect(screen.getByText(/Unsettled Balance/i)).toBeInTheDocument();
        });
    });

    it('displays dynamic daily pace and spending limit in the Spendable Remaining card', async () => {
        renderWithProviders(<ExpensesPage />);

        await waitFor(() => {
            expect(screen.getByText(/\/day/i)).toBeInTheDocument();
            expect(screen.getByText(/Limit/i)).toBeInTheDocument();
        });
    });
});
