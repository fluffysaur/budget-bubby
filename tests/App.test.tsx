import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import App from '../src/App';

describe('App', () => {
  it('renders Budget Buddy header and key financial features', () => {
    render(<App />);
    expect(screen.getByText('Budget Buddy')).toBeInTheDocument();
    expect(screen.getByText(/Yi Jia & Rachel/i)).toBeInTheDocument();
    expect(screen.getByText('SGD (S$)')).toBeInTheDocument();
    expect(screen.getByText('50 / 50')).toBeInTheDocument();
    expect(screen.getByText('20% Gross')).toBeInTheDocument();
  });
});
