import { describe, it, expect } from 'vitest';
import {
  playChaChingSound,
  playBudgetWarningSound,
  playBudgetExceededSound,
} from '../src/lib/soundEffects';

describe('Sound Effects Engine', () => {
  it('executes audio chimes without throwing', () => {
    expect(() => playChaChingSound()).not.toThrow();
    expect(() => playBudgetWarningSound()).not.toThrow();
    expect(() => playBudgetExceededSound()).not.toThrow();
  });
});

