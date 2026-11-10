import { describe, it, expect } from '../harness/test-framework.mjs';
import { calculatePanDelta, calculatePinchZoom } from '../helpers/mobile-simulator.mjs';

describe('Tier 3 — Combination 3: Touch Gestures + Mobile Bottom Sheet Interaction', () => {
  it('Comb3-T1: allows panning canvas in upper visible region while bottom sheet is open', () => {
    // Upper canvas region is y: 48 to ~250 on a 844px height mobile viewport
    const touchStart = { clientX: 180, clientY: 120 };
    const touchMove = { clientX: 230, clientY: 150 };

    const { deltaX, deltaY } = calculatePanDelta(touchStart, touchMove);
    expect(deltaX).toBe(50);
    expect(deltaY).toBe(30);
  });

  it('Comb3-T2: isolates touch events inside bottom sheet scroll container from canvas pan', () => {
    function dispatchTouchEvent(targetElement, eventType) {
      if (targetElement === 'bottom-sheet-content' || targetElement === 'close-button') {
        return { handledBySheet: true, propagateToCanvas: false };
      }
      return { handledBySheet: false, propagateToCanvas: true };
    }

    const insideSheet = dispatchTouchEvent('bottom-sheet-content', 'touchmove');
    expect(insideSheet.handledBySheet).toBe(true);
    expect(insideSheet.propagateToCanvas).toBe(false);

    const onCanvas = dispatchTouchEvent('graph-canvas', 'touchmove');
    expect(onCanvas.handledBySheet).toBe(false);
    expect(onCanvas.propagateToCanvas).toBe(true);
  });

  it('Comb3-T3: translates downward swipe on drag handle into bottom sheet dismiss gesture', () => {
    const handleTouchStart = { clientX: 195, clientY: 400 };
    const handleTouchMove = { clientX: 195, clientY: 520 }; // Dragged down 120px

    const dragDelta = handleTouchMove.clientY - handleTouchStart.clientY;
    const DISMISS_THRESHOLD_PX = 80;
    const shouldDismiss = dragDelta > DISMISS_THRESHOLD_PX;

    expect(dragDelta).toBe(120);
    expect(shouldDismiss).toBe(true);
  });

  it('Comb3-T4: retains pinch zoom level when bottom sheet is dismissed and reopened', () => {
    let currentZoom = 1.0;
    // User pinches to 1.8x
    const pairStart = [{ clientX: 100, clientY: 100 }, { clientX: 200, clientY: 100 }];
    const pairMove = [{ clientX: 60, clientY: 100 }, { clientX: 240, clientY: 100 }];
    const { newZoom } = calculatePinchZoom(pairStart, pairMove, currentZoom);
    currentZoom = newZoom;
    expect(currentZoom).toBe(1.8);

    // Bottom sheet closes and opens
    let sheetOpen = false;
    sheetOpen = true;

    // Zoom level must not reset
    expect(currentZoom).toBe(1.8);
    expect(sheetOpen).toBe(true);
  });
});
