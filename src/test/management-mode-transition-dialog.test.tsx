import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ManagementModeTransitionDialog } from '@/pages/services/details/ManagementModeTransitionDialog';

describe('ManagementModeTransitionDialog', () => {
  it('requires explicit takeover confirmation before enabling managed mode save', () => {
    const onConfirm = vi.fn();

    render(
      <ManagementModeTransitionDialog
        open
        onOpenChange={() => undefined}
        serviceName="payments"
        environmentLabel="Development"
        requirements={[
          {
            id: 'worker',
            label: 'Worker available',
            description: 'A worker is ready for the target environment.',
            ready: true,
          },
        ]}
        onConfirm={onConfirm}
      />,
    );

    const saveButton = screen.getByRole('button', { name: /save as managed/i });
    expect(saveButton).toBeDisabled();

    fireEvent.click(screen.getByLabelText(/confirm takeover/i));
    expect(saveButton).toBeEnabled();

    fireEvent.click(saveButton);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
