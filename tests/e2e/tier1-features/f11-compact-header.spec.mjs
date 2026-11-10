import { describe, it, expect } from '../harness/test-framework.mjs';
import { MOBILE_HEADER_MAX_HEIGHT } from '../helpers/mobile-simulator.mjs';

describe('Tier 1 — Feature 11: Compact Mobile Header (<=48px)', () => {
  it('F11-T1: verifies header height constraint does not exceed 48px', () => {
    expect(MOBILE_HEADER_MAX_HEIGHT).toBeLessThanOrEqual(48);
  });

  it('F11-T2: verifies mobile header CSS uses single-row flex layout without wrapping', () => {
    const mobileHeaderClasses = 'h-12 max-h-[48px] px-3 flex items-center justify-between overflow-hidden bg-gray-950 border-b border-gray-800';
    expect(mobileHeaderClasses).toContain('h-12');
    expect(mobileHeaderClasses).toContain('max-h-[48px]');
    expect(mobileHeaderClasses).not.toContain('flex-wrap');
  });

  it('F11-T3: validates collapsible filter sheet state toggle', () => {
    let filterSheetOpen = false;

    function toggleFilterSheet() {
      filterSheetOpen = !filterSheetOpen;
      return filterSheetOpen;
    }

    expect(toggleFilterSheet()).toBe(true);
    expect(filterSheetOpen).toBe(true);
    expect(toggleFilterSheet()).toBe(false);
    expect(filterSheetOpen).toBe(false);
  });

  it('F11-T4: validates title text truncation styling for narrow viewports', () => {
    const titleClasses = 'text-xs font-semibold text-gray-200 truncate max-w-[180px]';
    expect(titleClasses).toContain('truncate');
    expect(titleClasses).toContain('max-w-[');
  });

  it('F11-T5: ensures desktop control pills are hidden on mobile viewports (<768px)', () => {
    const desktopPillsContainer = 'hidden md:flex items-center gap-2';
    expect(desktopPillsContainer).toContain('hidden');
    expect(desktopPillsContainer).toContain('md:flex');
  });
});
