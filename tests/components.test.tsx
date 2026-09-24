import '@testing-library/jest-dom';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { ProgressBar } from '../src/components/ui/ProgressBar';
import { ExerciseCard } from '../src/components/practice/ExerciseCard';
import { PracticeSessionComponent } from '../src/components/practice/PracticeSession';
import { ManualReview } from '../src/components/therapist/ManualReview';
import { Exercise, Recording } from '../src/types';

describe('UI and Practice Components', () => {
  it('renders ProgressBar with accurate ARIA attributes and percentage', () => {
    render(<ProgressBar value={7} max={10} label="Today's Goal" showCount />);
    const progressbar = screen.getByRole('progressbar');
    expect(progressbar).toHaveAttribute('aria-valuenow', '7');
    expect(progressbar).toHaveAttribute('aria-valuemax', '10');
    expect(screen.getByText("Today's Goal")).toBeInTheDocument();
    expect(screen.getByText('7 / 10 (70%)')).toBeInTheDocument();
  });

  it('renders ExerciseCard with target sound "کا"', () => {
    const exercise: Exercise = {
      id: 'ex-1',
      name: 'Qaf — Ka Practice',
      targetText: 'کا',
      description: 'Practice the target sound according to the instructions.',
      isActive: true,
      createdAt: new Date().toISOString()
    };

    render(
      <BrowserRouter>
        <ExerciseCard exercise={exercise} />
      </BrowserRouter>
    );

    expect(screen.getByText('Qaf — Ka Practice')).toBeInTheDocument();
    expect(screen.getByText('کا')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /practice now/i })).toBeInTheDocument();
  });

  it('allows manual therapist review with remarks and submission', async () => {
    const mockSave = vi.fn();
    const dummyBlob = new Blob([''], { type: 'audio/webm' });

    const recording: Recording = {
      id: 'rec-test-1',
      sessionId: 'sess-1',
      exerciseId: 'ex-1',
      blob: dummyBlob,
      duration: 0.82,
      mimeType: 'audio/webm',
      createdAt: new Date().toISOString()
    };

    render(<ManualReview recording={recording} onSave={mockSave} />);

    // Click CORRECT
    const correctBtn = screen.getByText('CORRECT').closest('button')!;
    fireEvent.click(correctBtn);

    // Enter remarks
    const input = screen.getByPlaceholderText(/clinical observations/i);
    fireEvent.change(input, { target: { value: 'Good velar placement' } });

    // Click Save Review
    const saveBtn = screen.getByRole('button', { name: /save review/i });
    fireEvent.click(saveBtn);

    expect(mockSave).toHaveBeenCalledWith('rec-test-1', 'CORRECT', 'Good velar placement');
  });

  it('renders Phase 3 Practice Session with target "کا", instruction, and large Start button', () => {
    const exercise: Exercise = {
      id: 'ex-qaf-ka-01',
      name: 'Qaf — Ka Practice',
      targetText: 'کا',
      description: 'Practice the target sound according to therapist instructions.',
      isActive: true,
      createdAt: new Date().toISOString()
    };

    render(
      <BrowserRouter>
        <PracticeSessionComponent exercise={exercise} targetAttempts={5} />
      </BrowserRouter>
    );

    // Verify Exercise title
    expect(screen.getAllByText('Qaf — Ka Practice').length).toBeGreaterThan(0);

    // Verify Target text "کا"
    expect(screen.getByRole('heading', { level: 1, name: /target word: کا/i })).toBeInTheDocument();

    // Verify Instruction
    expect(screen.getByText('Say the target sound as instructed by your speech therapist.')).toBeInTheDocument();

    // Verify Large Start button
    const startBtn = screen.getByRole('button', { name: /start recording/i });
    expect(startBtn).toBeInTheDocument();
    expect(startBtn).toHaveTextContent(/start/i);
  });

  it('renders HistoryPage with Date, Exercise, Attempts, Duration, and Playable recordings', async () => {
    const { createSession } = await import('../src/storage/sessionRepository');
    const { createRecording } = await import('../src/storage/recordingRepository');
    const { HistoryPage } = await import('../src/pages/HistoryPage');

    const testSessId = 'sess-history-test-1';
    await createSession({
      id: testSessId,
      exerciseId: 'ex-qaf-ka-01',
      startedAt: '2026-09-25T10:00:00.000Z',
      completedAt: '2026-09-25T10:02:30.000Z',
      status: 'COMPLETED',
      attemptCount: 2,
      targetAttempts: 10
    });

    const dummyBlob = new Blob(['mock-audio'], { type: 'audio/webm' });
    await createRecording({
      id: 'rec-hist-1',
      sessionId: testSessId,
      exerciseId: 'ex-qaf-ka-01',
      blob: dummyBlob,
      duration: 0.82,
      mimeType: 'audio/webm',
      createdAt: '2026-09-25T10:00:30.000Z',
      attemptNumber: 1,
      therapistResult: 'CORRECT'
    });

    await createRecording({
      id: 'rec-hist-2',
      sessionId: testSessId,
      exerciseId: 'ex-qaf-ka-01',
      blob: dummyBlob,
      duration: 1.15,
      mimeType: 'audio/webm',
      createdAt: '2026-09-25T10:01:15.000Z',
      attemptNumber: 2
    });

    render(
      <BrowserRouter>
        <HistoryPage />
      </BrowserRouter>
    );

    // Wait for history records to load from IndexedDB
    expect(await screen.findByText('2 attempts', {}, { timeout: 4000 })).toBeInTheDocument();

    // Verify Exercise
    expect(screen.getAllByText(/Qaf — Ka Practice/i).length).toBeGreaterThan(0);

    // Verify Number of attempts
    expect(screen.getAllByText(/2 attempts/i).length).toBeGreaterThan(0);

    // Verify Session duration
    expect(screen.getAllByText(/Session duration/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/2 min 30 sec/i)).toBeInTheDocument();

    // Verify Reviewed recordings
    expect(screen.getAllByText(/Reviewed recordings/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/1 of 2/i)).toBeInTheDocument();

    // Verify Playable recordings
    expect(screen.getAllByText(/Playable Recordings/i).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: /play recording/i }).length).toBeGreaterThan(0);
  });
});
