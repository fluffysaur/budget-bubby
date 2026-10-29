import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PlanPage } from '../src/pages/PlanPage';
import { HouseholdProvider } from '../src/context/HouseholdContext';

describe('PlanPage Component', () => {
  it('renders all plan sub-tabs with no-scrollbar styling', () => {
    render(
      <MemoryRouter>
        <HouseholdProvider>
          <PlanPage />
        </HouseholdProvider>
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { level: 1, name: 'Plan' })).toBeInTheDocument();

    const tabNav = screen.getByRole('navigation', { name: 'Navigation Tabs' });
    expect(tabNav).toBeInTheDocument();
    // Verify no-scrollbar class is applied to remove horizontal scrollbar
    expect(tabNav.className).toContain('no-scrollbar');

    expect(within(tabNav).getByRole('tab', { name: /Goals/i })).toBeInTheDocument();
    expect(within(tabNav).getByRole('tab', { name: /Loans/i })).toBeInTheDocument();
    expect(within(tabNav).getByRole('tab', { name: /Recurring/i })).toBeInTheDocument();
    expect(within(tabNav).getByRole('tab', { name: /Bonus/i })).toBeInTheDocument();
  });

  it('switches sub-tabs when tab buttons are clicked', () => {
    render(
      <MemoryRouter>
        <HouseholdProvider>
          <PlanPage />
        </HouseholdProvider>
      </MemoryRouter>
    );

    const bonusTab = screen.getByRole('tab', { name: /Bonus/i });
    fireEvent.click(bonusTab);

    expect(bonusTab).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText(/Bonus Allocation Calculator/i)).toBeInTheDocument();
  });
});
