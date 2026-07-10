import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { render } from '../../test/render';
import { EmptyState } from '../ui/EmptyState';
import { PageActions, PageHeader } from '../ui/PageHeader';
import { SurfaceCard } from '../ui/SurfaceCard';

describe('design system primitives', () => {
  it('renders one page heading with optional context and actions', () => {
    render(
      <PageHeader
        pretitle="Catalogue"
        title="Ouvrages"
        description="Fiches"
        actions={
          <PageActions>
            <button type="button">Ajouter</button>
          </PageActions>
        }
      />
    );

    expect(screen.getByRole('heading', { level: 1, name: 'Ouvrages' })).toBeInTheDocument();
    expect(screen.getByText('Catalogue')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ajouter' })).toBeInTheDocument();
  });

  it('keeps empty states useful when no action is available', () => {
    render(<EmptyState icon="notes-off" title="Aucune fiche" description="Revenez plus tard." />);

    expect(screen.getByRole('heading', { level: 2, name: 'Aucune fiche' })).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('combines shared surface variants with caller classes', () => {
    const { container } = render(
      <SurfaceCard variant="toolbar" className="mb-3">
        Contenu
      </SurfaceCard>
    );

    expect(container.querySelector('.card.hap-records-toolbar.mb-3')).toBeInTheDocument();
  });
});
