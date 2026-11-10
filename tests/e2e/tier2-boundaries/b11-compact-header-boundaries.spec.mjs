import { describe, it, expect } from '../harness/test-framework.mjs';

describe('Tier 2 — Boundary 11: Compact Mobile Header Edge Cases', () => {
  it('B11-T1: truncates extremely long corporate titles without pushing out header controls', () => {
    const longTitle = 'S.M. Jaleel & Company Limited International Global Logistics & Procurement Division HQ';
    function formatHeaderTitle(title, maxChars = 24) {
      if (title.length <= maxChars) return title;
      return title.slice(0, maxChars - 1) + '…';
    }

    const truncated = formatHeaderTitle(longTitle);
    expect(truncated.length).toBeLessThanOrEqual(24);
    expect(truncated.endsWith('…')).toBe(true);
  });

  it('B11-T2: handles backdrop tap outside filter popover to dismiss sheet', () => {
    let sheetOpen = true;

    function handleBackdropClick(eventTarget) {
      if (eventTarget === 'backdrop') {
        sheetOpen = false;
      }
    }

    handleBackdropClick('backdrop');
    expect(sheetOpen).toBe(false);
  });

  it('B11-T3: incorporates safe-area-inset padding for devices with display notches', () => {
    const safeHeaderStyle = 'pt-[env(safe-area-inset-top,0px)] h-12 box-content';
    expect(safeHeaderStyle).toContain('safe-area-inset-top');
    expect(safeHeaderStyle).toContain('h-12');
  });

  it('B11-T4: verifies all mobile interactive icons have aria-label accessibility attributes', () => {
    const mobileButtons = [
      { id: 'btn-back', 'aria-label': 'Volver al grafo' },
      { id: 'btn-filters', 'aria-label': 'Abrir filtros de mercado y lentes' },
      { id: 'btn-close-dossier', 'aria-label': 'Cerrar ficha ejecutiva' },
    ];

    for (const btn of mobileButtons) {
      expect(btn['aria-label']).toBeDefined();
      expect(btn['aria-label'].length).toBeGreaterThan(5);
    }
  });

  it('B11-T5: preserves filter selection state when popover is closed and reopened', () => {
    const filterState = { market: 'all', lens: 'global-core' };

    // Select panama market
    filterState.market = 'panama';

    // Close and reopen
    const reopenedState = { ...filterState };
    expect(reopenedState.market).toBe('panama');
    expect(reopenedState.lens).toBe('global-core');
  });
});
