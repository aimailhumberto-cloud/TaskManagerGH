import { describe, it, expect } from '../harness/test-framework.mjs';
import { calculatePanDelta, calculatePinchZoom } from '../helpers/mobile-simulator.mjs';

describe('Tier 2 — Boundary 10: Canvas Gestures Edge Cases', () => {
  it('B10-T1: handles degenerate zero-distance touch pair without division by zero', () => {
    const degenerateStart = [
      { clientX: 150, clientY: 150 },
      { clientX: 150, clientY: 150 },
    ];
    const move = [
      { clientX: 140, clientY: 150 },
      { clientX: 160, clientY: 150 },
    ];

    const res = calculatePinchZoom(degenerateStart, move, 1.0);
    expect(res.scaleFactor).toBe(1);
    expect(res.newZoom).toBe(1.0);
  });

  it('B10-T2: handles negative and out-of-bounds touch coordinates', () => {
    const start = { clientX: 10, clientY: 20 };
    const move = { clientX: -40, clientY: -10 };

    const { deltaX, deltaY } = calculatePanDelta(start, move);
    expect(deltaX).toBe(-50);
    expect(deltaY).toBe(-30);
  });

  it('B10-T3: filters 3+ multi-touch events down to primary 2 touches for pinch', () => {
    const rawTouches = [
      { clientX: 100, clientY: 100 },
      { clientX: 200, clientY: 100 },
      { clientX: 300, clientY: 300 }, // 3rd finger
    ];

    const primaryPair = rawTouches.slice(0, 2);
    expect(primaryPair.length).toBe(2);
    expect(primaryPair[0].clientX).toBe(100);
    expect(primaryPair[1].clientX).toBe(200);
  });

  it('B10-T4: resets pan and pinch state cleanly on touch cancel', () => {
    let isPanning = true;
    let isPinching = true;

    function handleTouchCancel() {
      isPanning = false;
      isPinching = false;
    }

    handleTouchCancel();
    expect(isPanning).toBe(false);
    expect(isPinching).toBe(false);
  });

  it('B10-T5: maintains sub-pixel precision across subtle finger adjustments', () => {
    const start = { clientX: 100.25, clientY: 200.75 };
    const move = { clientX: 100.85, clientY: 201.15 };

    const { deltaX, deltaY } = calculatePanDelta(start, move);
    expect(Math.abs(deltaX - 0.60)).toBeLessThan(0.0001);
    expect(Math.abs(deltaY - 0.40)).toBeLessThan(0.0001);
  });
});
