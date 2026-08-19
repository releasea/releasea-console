import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DocumentationLink } from '@/components/layout/DocumentationLink';
import { ListPageHeader } from '@/components/layout/ListPageHeader';

describe('contextual documentation links', () => {
  it('opens the requested documentation article in a new tab', () => {
    render(<DocumentationLink slug="credentials" label="Credential guide" variant="button" />);

    const link = screen.getByRole('link', { name: /credential guide.*new tab/i });
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('href', expect.stringContaining('doc=credentials'));
  });

  it('keeps page guidance compact beside the page subtitle', () => {
    render(<ListPageHeader title="Services" description="Create and operate applications." docsSlug="services" />);

    expect(screen.getByText('Create and operate applications.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /learn more.*new tab/i })).toHaveAttribute('href', expect.stringContaining('doc=services'));
  });
});
