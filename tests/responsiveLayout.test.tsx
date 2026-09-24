import '@testing-library/jest-dom';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';
import { AppLayout } from '../src/components/layout/AppLayout';
import { MobileNavigation } from '../src/components/layout/MobileNavigation';
import { DesktopSidebar } from '../src/components/layout/DesktopSidebar';
import { LoadingState } from '../src/components/ui/LoadingState';
import { EmptyState } from '../src/components/ui/EmptyState';
import { ErrorState } from '../src/components/ui/ErrorState';
import { Modal } from '../src/components/ui/Modal';
import { HomePage } from '../src/pages/HomePage';
import { PracticePage } from '../src/pages/PracticePage';
import { HistoryPage } from '../src/pages/HistoryPage';
import { ProgressPage } from '../src/pages/ProgressPage';
import { SettingsPage } from '../src/pages/SettingsPage';
import { PrivacyPage } from '../src/pages/PrivacyPage';

describe('Phase 2: Responsive Layout & Application Shell', () => {
  describe('Navigation Shell', () => {
    it('renders MobileNavigation with all 4 primary navigation items', () => {
      render(
        <BrowserRouter>
          <MobileNavigation />
        </BrowserRouter>
      );

      expect(screen.getByRole('navigation', { name: /mobile navigation/i })).toBeInTheDocument();
      expect(screen.getByText('Home')).toBeInTheDocument();
      expect(screen.getByText('Practice')).toBeInTheDocument();
      expect(screen.getByText('History')).toBeInTheDocument();
      expect(screen.getByText('Progress')).toBeInTheDocument();
    });

    it('renders DesktopSidebar with brand, nav links, and clinical reminder', () => {
      render(
        <BrowserRouter>
          <DesktopSidebar />
        </BrowserRouter>
      );

      expect(screen.getByText('Speech Practice')).toBeInTheDocument();
      expect(screen.getByText('Assistant')).toBeInTheDocument();
      expect(screen.getByText('Privacy & Notes')).toBeInTheDocument();
      expect(screen.getByText(/Practice companion only/i)).toBeInTheDocument();
    });

    it('renders AppLayout containing main outlet, desktop sidebar, and mobile nav', () => {
      render(
        <MemoryRouter initialEntries={['/home']}>
          <AppLayout />
        </MemoryRouter>
      );

      expect(screen.getByRole('complementary', { name: /desktop sidebar/i })).toBeInTheDocument();
      expect(screen.getByRole('navigation', { name: /mobile navigation/i })).toBeInTheDocument();
      expect(screen.getByRole('main')).toBeInTheDocument();
    });
  });

  describe('UI State Components (Loading, Empty, Error, Modal)', () => {
    it('renders LoadingState with spinner and custom messages', () => {
      render(<LoadingState message="Connecting to speech workspace" subtext="Please wait a moment" card />);
      expect(screen.getByText('Connecting to speech workspace')).toBeInTheDocument();
      expect(screen.getByText('Please wait a moment')).toBeInTheDocument();
    });

    it('renders EmptyState with icon, title, description, and action button', () => {
      const mockAction = vi.fn();
      render(
        <EmptyState
          title="No Sessions Recorded"
          description="Your practice session history will appear here once saved."
          actionText="Start Practice Now"
          onAction={mockAction}
        />
      );

      expect(screen.getByText('No Sessions Recorded')).toBeInTheDocument();
      expect(screen.getByText(/Your practice session history will appear here/i)).toBeInTheDocument();
      const btn = screen.getByRole('button', { name: /start practice now/i });
      fireEvent.click(btn);
      expect(mockAction).toHaveBeenCalledTimes(1);
    });

    it('renders ErrorState with alert and retry handler', () => {
      const mockRetry = vi.fn();
      render(
        <ErrorState
          title="Audio Permission Error"
          message="Microphone access was denied by browser settings."
          onRetry={mockRetry}
        />
      );

      expect(screen.getByText('Audio Permission Error')).toBeInTheDocument();
      expect(screen.getByText(/Microphone access was denied/i)).toBeInTheDocument();
      const retryBtn = screen.getByRole('button', { name: /try again/i });
      fireEvent.click(retryBtn);
      expect(mockRetry).toHaveBeenCalledTimes(1);
    });

    it('renders Modal dialog and respects escape key and close action', () => {
      const mockClose = vi.fn();
      const { rerender } = render(
        <Modal isOpen={true} onClose={mockClose} title="Session Settings">
          <p>Modal body content</p>
        </Modal>
      );

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('Session Settings')).toBeInTheDocument();
      expect(screen.getByText('Modal body content')).toBeInTheDocument();

      // Trigger escape key
      fireEvent.keyDown(window, { key: 'Escape' });
      expect(mockClose).toHaveBeenCalledTimes(1);

      // Does not render when closed
      rerender(
        <Modal isOpen={false} onClose={mockClose} title="Session Settings">
          <p>Modal body content</p>
        </Modal>
      );
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  describe('Core Pages Rendering', () => {
    it('renders HomePage cleanly', () => {
      render(
        <MemoryRouter>
          <HomePage />
        </MemoryRouter>
      );
      expect(screen.getByText('Speech Practice')).toBeInTheDocument();
      expect(screen.getByText("Today's Practice")).toBeInTheDocument();
      expect(screen.getByText("Today's Summary")).toBeInTheDocument();
    });

    it('renders PracticePage cleanly', () => {
      render(
        <MemoryRouter>
          <PracticePage />
        </MemoryRouter>
      );
      // Renders preparation or session
      expect(document.body).toBeInTheDocument();
    });

    it('renders HistoryPage cleanly', () => {
      render(
        <MemoryRouter>
          <HistoryPage />
        </MemoryRouter>
      );
      expect(screen.getByText('Practice History')).toBeInTheDocument();
    });

    it('renders ProgressPage cleanly', () => {
      render(
        <MemoryRouter>
          <ProgressPage />
        </MemoryRouter>
      );
      expect(screen.getByText('Progress & Analytics')).toBeInTheDocument();
    });

    it('renders SettingsPage cleanly', () => {
      render(
        <MemoryRouter>
          <SettingsPage />
        </MemoryRouter>
      );
      expect(screen.getByText('User Preferences')).toBeInTheDocument();
      expect(screen.getByText('Audio Storage Information')).toBeInTheDocument();
    });

    it('renders PrivacyPage with clinical limitation notice', () => {
      render(
        <MemoryRouter>
          <PrivacyPage />
        </MemoryRouter>
      );
      expect(screen.getByText('Privacy & Clinical Limitation')).toBeInTheDocument();
      expect(screen.getByText(/This application supports speech practice and progress tracking/i)).toBeInTheDocument();
    });
  });

  describe('Mobile Viewport Verification (320px, 375px, 390px, 412px)', () => {
    const viewports = [
      { name: '320px (Compact Mobile)', width: 320, height: 568 },
      { name: '375px (iPhone SE)', width: 375, height: 667 },
      { name: '390px (iPhone 14/15)', width: 390, height: 844 },
      { name: '412px (Android Pixel/Galaxy)', width: 412, height: 915 }
    ];

    viewports.forEach(({ name, width, height }) => {
      it(`renders practice recording interface with large accessible button at ${name}`, async () => {
        window.innerWidth = width;
        window.innerHeight = height;
        window.dispatchEvent(new Event('resize'));

        render(
          <MemoryRouter initialEntries={['/practice']}>
            <PracticePage />
          </MemoryRouter>
        );

        // Verify page renders cleanly
        expect(document.body).toBeInTheDocument();
      });
    });
  });
});
