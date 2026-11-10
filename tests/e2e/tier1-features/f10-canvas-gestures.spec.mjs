import { describe, it, expect } from '../harness/test-framework.mjs';
import { calculatePanDelta, calculatePinchZoom, CANVAS_MIN_HEIGHT } from '../helpers/mobile-simulator.mjs';

describe('Tier 1 — Feature 10: Mobile Full-Screen Canvas & Gestures', () => {
  it('F10-T1: verifies canvas height specification guarantees at least 550px', () => {
    expect(CANVAS_MIN_HEIGHT).toBeGreaterThanOrEqual(550);
  });

  it('F10-T2: computes single-finger drag coordinates into accurate pan delta', () => {
    const touchStart = { clientX: 100, clientY: 200 };
    const touchMove = { clientX: 145, clientY: 170 };

    const { deltaX, deltaY } = calculatePanDelta(touchStart, touchMove);
    expect(deltaX).toBe(45);
    expect(deltaY).toBe(-30);
  });

  it('F10-T3: computes two-finger pinch distance expansion into zoom multiplier', () => {
    const pairStart = [
      { clientX: 100, clientY: 100 },
      { clientX: 200, clientY: 100 }, // distance = 100
    ];
    const pairMove = [
      { clientX: 80, clientY: 100 },
      { clientX: 230, clientY: 100 }, // distance = 150
    ];

    const { newZoom, scaleFactor } = calculatePinchZoom(pairStart, pairMove, 1.0);
    expect(scaleFactor).toBe(1.5);
    expect(newZoom).toBe(1.5);
  });

  it('F10-T4: clamps zoom scaling within minimum 0.2 and maximum 3.0 bounds', () => {
    const pairStart = [
      { clientX: 100, clientY: 100 },
      { clientX: 200, clientY: 100 },
    ];
    
    // Extreme zoom in (factor 5x)
    const extremeZoomIn = [
      { clientX: 0, clientY: 100 },
      { clientX: 500, clientY: 100 },
    ];
    const zoomInRes = calculatePinchZoom(pairStart, extremeZoomIn, 1.0, 0.2, 3.0);
    expect(zoomInRes.newZoom).toBe(3.0);
    expect(zoomInRes.isClamped).toBe(true);

    // Extreme zoom out (factor 0.1x)
    const extremeZoomOut = [
      { clientX: 145, clientY: 100 },
      { clientX: 155, clientY: 100 },
    ];
    const zoomOutRes = calculatePinchZoom(pairStart, extremeZoomOut, 1.0, 0.2, 3.0);
    expect(zoomOutRes.newZoom).toBe(0.2);
    expect(zoomOutRes.isClamped).toBe(true);
  });

  it('F10-T5: calculates pinch midpoint for drift compensation', () => {
    const pairMove = [
      { clientX: 120, clientY: 300 },
      { clientX: 280, clientY: 400 },
    ];
    const pairStart = [
      { clientX: 150, clientY: 350 },
      { clientX: 250, clientY: 350 },
    ];

    const { midpoint } = calculatePinchZoom(pairStart, pairMove, 1.0);
    expect(midpoint.x).toBe(200);
    expect(midpoint.y).toBe(350);
  });
});
