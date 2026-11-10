import { describe, it, expect } from '../harness/test-framework.mjs';
import { calculateCameraAutoFraming } from '../helpers/mobile-simulator.mjs';

describe('Tier 1 — Feature 12: Mobile Camera Auto-Framing', () => {
  it('F12-T1: centers camera on node coordinates in desktop viewports', () => {
    const framing = calculateCameraAutoFraming({
      nodeX: 500,
      nodeY: 300,
      viewportWidth: 1280,
      viewportHeight: 800,
      isMobile: false,
      bottomSheetOpen: false,
    });

    expect(framing.targetX).toBe(500);
    expect(framing.targetY).toBe(300);
    expect(framing.nodeScreenYPercent).toBe(50);
  });

  it('F12-T2: offsets camera target vertically on mobile to clear bottom sheet', () => {
    const framing = calculateCameraAutoFraming({
      nodeX: 500,
      nodeY: 300,
      viewportWidth: 390,
      viewportHeight: 844,
      isMobile: true,
      bottomSheetOpen: true,
    });

    expect(framing.targetX).toBe(500);
    // targetY is shifted so the node displays in upper viewport
    expect(framing.targetY).toBeLessThan(300);
    expect(framing.nodeScreenYPercent).toBeLessThan(40);
  });

  it('F12-T3: restores standard centering on mobile when bottom sheet is dismissed', () => {
    const framing = calculateCameraAutoFraming({
      nodeX: 420,
      nodeY: 250,
      viewportWidth: 375,
      viewportHeight: 667,
      isMobile: true,
      bottomSheetOpen: false,
    });

    expect(framing.targetX).toBe(420);
    expect(framing.targetY).toBe(250);
    expect(framing.nodeScreenYPercent).toBe(50);
  });

  it('F12-T4: scales vertical offset proportionally with mobile viewport height', () => {
    const smallDevice = calculateCameraAutoFraming({
      nodeX: 0,
      nodeY: 0,
      viewportWidth: 375,
      viewportHeight: 667,
      isMobile: true,
      bottomSheetOpen: true,
    });

    const largeDevice = calculateCameraAutoFraming({
      nodeX: 0,
      nodeY: 0,
      viewportWidth: 412,
      viewportHeight: 915,
      isMobile: true,
      bottomSheetOpen: true,
    });

    const offsetSmall = Math.abs(smallDevice.targetY);
    const offsetLarge = Math.abs(largeDevice.targetY);
    expect(offsetLarge).toBeGreaterThan(offsetSmall);
  });

  it('F12-T5: simulates linear camera interpolation toward calculated target', () => {
    function lerp(start, end, factor) {
      return start + (end - start) * factor;
    }

    const currentX = 0;
    const currentY = 0;
    const targetX = 500;
    const targetY = -150;

    const step1X = lerp(currentX, targetX, 0.2);
    const step1Y = lerp(currentY, targetY, 0.2);

    expect(step1X).toBe(100);
    expect(step1Y).toBe(-30);
  });
});
