import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CreateTeamModal } from '@/components/modals/CreateTeamModal';

describe('CreateTeamModal', () => {
  it('explains the objective and validates required team details and invitations', async () => {
    render(<CreateTeamModal open onOpenChange={vi.fn()} />);

    const dialog = screen.getByRole('dialog', { name: 'Create team' });
    expect(within(dialog).getByText(/Member invitations are optional/)).toBeInTheDocument();

    const createButton = within(dialog).getByRole('button', { name: 'Create team' });
    expect(createButton).toBeDisabled();

    fireEvent.change(within(dialog).getByLabelText('Team name'), { target: { value: 'Core Platform' } });
    expect(within(dialog).getByLabelText('Slug')).toHaveValue('core-platform');
    expect(createButton).toBeEnabled();

    fireEvent.change(within(dialog).getByLabelText('Member email'), { target: { value: 'invalid-email' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add member to invitation list' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Enter a valid email address.');
  });
});
