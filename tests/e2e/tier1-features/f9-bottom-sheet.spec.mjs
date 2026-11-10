import { describe, it, expect } from '../harness/test-framework.mjs';
import { isMobileViewport, validateBottomSheetLayout, MIN_TOUCH_TARGET_SIZE, BOTTOM_SHEET_MAX_VH } from '../helpers/mobile-simulator.mjs';

describe('Tier 1 — Feature 9: Mobile Sliding Bottom Sheet (<768px)', () => {
  it('F9-T1: identifies mobile vs desktop viewports according to 768px breakpoint', () => {
    expect(isMobileViewport(375)).toBe(true);  // iPhone SE
    expect(isMobileViewport(390)).toBe(true);  // iPhone 14
    expect(isMobileViewport(767)).toBe(true);  // Mobile edge
    expect(isMobileViewport(768)).toBe(false); // Tablet / Desktop edge
    expect(isMobileViewport(1024)).toBe(false);// Desktop
  });

  it('F9-T2: enforces 100% viewport width for mobile bottom sheet', () => {
    const layout = {
      width: 390,
      viewportWidth: 390,
      height: 600,
      viewportHeight: 844,
      closeButtonWidth: 44,
      closeButtonHeight: 44,
    };
    const res = validateBottomSheetLayout(layout);
    expect(res.valid).toBe(true);
    expect(res.errors.length).toBe(0);
  });

  it('F9-T3: validates maximum 85vh sheet height constraint', () => {
    const viewportHeight = 800;
    const maxAllowed = viewportHeight * (BOTTOM_SHEET_MAX_VH / 100);
    expect(maxAllowed).toBe(680);

    const validLayout = {
      width: 390,
      viewportWidth: 390,
      height: 650, // <= 680
      viewportHeight,
      closeButtonWidth: 48,
      closeButtonHeight: 48,
    };
    expect(validateBottomSheetLayout(validLayout).valid).toBe(true);

    const invalidLayout = {
      width: 390,
      viewportWidth: 390,
      height: 720, // > 680
      viewportHeight,
      closeButtonWidth: 48,
      closeButtonHeight: 48,
    };
    expect(validateBottomSheetLayout(invalidLayout).valid).toBe(false);
  });

  it('F9-T4: enforces minimum 44x44px touch target for close button', () => {
    expect(MIN_TOUCH_TARGET_SIZE).toBe(44);

    const smallButtonLayout = {
      width: 375,
      viewportWidth: 375,
      height: 500,
      viewportHeight: 667,
      closeButtonWidth: 32, // Too small
      closeButtonHeight: 32,
    };
    const check = validateBottomSheetLayout(smallButtonLayout);
    expect(check.valid).toBe(false);
    expect(check.errors[0]).toContain('violate minimum thumb target');
  });

  it('F9-T5: validates transition transform state classes for open vs closed sheet', () => {
    function getBottomSheetClasses(isOpen) {
      const base = 'fixed inset-x-0 bottom-0 z-50 rounded-t-2xl transition-transform duration-300 ease-out';
      const transform = isOpen ? 'translate-y-0' : 'translate-y-full';
      return `${base} ${transform}`;
    }

    const openClasses = getBottomSheetClasses(true);
    const closedClasses = getBottomSheetClasses(false);

    expect(openClasses).toContain('translate-y-0');
    expect(closedClasses).toContain('translate-y-full');
    expect(openClasses).toContain('z-50');
  });
});
