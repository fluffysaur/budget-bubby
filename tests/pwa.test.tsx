import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { usePWAInstall } from '../src/hooks/usePWAInstall';
import { IOSInstallModal } from '../src/components/pwa/IOSInstallModal';
import { PWAInstallButton } from '../src/components/pwa/PWAInstallButton';
import { OfflineBanner } from '../src/components/pwa/OfflineBanner';
import { PWAUpdateToast } from '../src/components/pwa/PWAUpdateToast';
import { renderHook } from '@testing-library/react';

describe('PWA Features & Installation', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('usePWAInstall hook', () => {
    it('detects standalone mode when matchMedia matches', () => {
      vi.spyOn(window, 'matchMedia').mockImplementation((query: string) => ({
        matches: query.includes('standalone'),
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));

      const { result } = renderHook(() => usePWAInstall());
      expect(result.current.isInstalled).toBe(true);
      expect(result.current.canInstall).toBe(false);
    });

    it('captures beforeinstallprompt event and enables promptInstall', async () => {
      vi.spyOn(window, 'matchMedia').mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));

      const { result } = renderHook(() => usePWAInstall());
      expect(result.current.canInstall).toBe(false);

      const promptMock = vi.fn().mockResolvedValue(undefined);
      const userChoiceMock = Promise.resolve({ outcome: 'accepted' as const, platform: 'web' });
      const promptEvent = new Event('beforeinstallprompt') as any;
      promptEvent.prompt = promptMock;
      promptEvent.userChoice = userChoiceMock;

      act(() => {
        window.dispatchEvent(promptEvent);
      });

      expect(result.current.canInstall).toBe(true);

      await act(async () => {
        await result.current.promptInstall();
      });

      expect(promptMock).toHaveBeenCalled();
    });
  });

  describe('IOSInstallModal component', () => {
    it('does not render when isOpen is false', () => {
      const { container } = render(<IOSInstallModal isOpen={false} onClose={vi.fn()} />);
      expect(container).toBeEmptyDOMElement();
    });

    it('renders step-by-step instructions and calls onClose when clicked', () => {
      const onClose = vi.fn();
      render(<IOSInstallModal isOpen={true} onClose={onClose} />);

      expect(screen.getByText('Install Budget Bubby')).toBeInTheDocument();
      expect(screen.getByText(/Tap the Share button/i)).toBeInTheDocument();
      expect(screen.getByText(/Select 'Add to Home Screen'/i)).toBeInTheDocument();
      expect(screen.getByText(/Tap 'Add'/i)).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: /Got it/i }));
      expect(onClose).toHaveBeenCalled();
    });
  });

  describe('PWAInstallButton component', () => {
    it('renders install button when beforeinstallprompt event is dispatched', () => {
      render(<PWAInstallButton />);

      // Initially null because not installable yet
      expect(screen.queryByLabelText(/Install Budget Bubby App/i)).not.toBeInTheDocument();

      // Trigger beforeinstallprompt
      const promptEvent = new Event('beforeinstallprompt') as any;
      promptEvent.prompt = vi.fn();
      promptEvent.userChoice = Promise.resolve({ outcome: 'dismissed' });
      act(() => {
        window.dispatchEvent(promptEvent);
      });

      expect(screen.getByLabelText(/Install Budget Bubby App/i)).toBeInTheDocument();
    });
  });

  describe('OfflineBanner component', () => {
    afterEach(() => {
      Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
    });

    it('renders offline alert bar when offline', () => {
      Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });

      render(<OfflineBanner />);

      expect(screen.getByRole('status')).toBeInTheDocument();
      expect(screen.getByText(/You are offline\. Showing cached Budget Bubby view\./i)).toBeInTheDocument();
    });

    it('is hidden when online', () => {
      Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });

      render(<OfflineBanner />);

      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });
  });

  describe('PWAUpdateToast component', () => {
    it('renders without crashing', () => {
      const { container } = render(<PWAUpdateToast />);
      // Default mock has needRefresh = false, offlineReady = false, so it returns null
      expect(container).toBeEmptyDOMElement();
    });
  });
});

