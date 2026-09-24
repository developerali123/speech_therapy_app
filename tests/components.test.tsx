import '@testing-library/jest-dom';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { ProgressBar } from '../src/components/ui/ProgressBar';
import { ExerciseCard } from '../src/components/practice/ExerciseCard';
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
});
