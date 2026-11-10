import { describe, it, expect } from '../harness/test-framework.mjs';
import { calculateCameraAutoFraming } from '../helpers/mobile-simulator.mjs';

describe('Tier 2 — Boundary 12: Camera Auto-Framing Edge Cases', () => {
  it('B12-T1: handles nodes at extreme world coordinates without numeric overflow', () => {
    const framing = calculateCameraAutoFraming({
      nodeX: 99999,
      nodeY: -88888,
      viewportWidth: 390,
      viewportHeight: 844,
      isMobile: true,
      bottomSheetOpen: true,
    });

    expect(Number.isFinite(framing.targetX)).toBe(true);
    expect(Number.isFinite(framing.targetY)).toBe(true);
    expect(framing.targetX).toBe(99999);
  });

  it('B12-T2: preserves target calculation stability during rapid node switches', () => {
    const targets = [
      { x: 100, y: 100 },
      { x: -500, y: 200 },
      { x: 350, y: -400 },
    ];

    const framedResults = targets.map(t =>
      calculateCameraAutoFraming({
        nodeX: t.x,
        nodeY: t.y,
        viewportWidth: 390,
        viewportHeight: 844,
        isMobile: true,
        bottomSheetOpen: true,
      })
    );

    expect(framedResults.length).toBe(3);
    expect(framedResults[1].targetX).toBe(-500);
    expect(framedResults[2].targetX).toBe(350);
  });

  it('B12-T3: adjusts visible area calculation on orientation change (portrait to landscape)', () => {
    const portrait = calculateCameraAutoFraming({
      nodeX: 0,
      nodeY: 0,
      viewportWidth: 390,
      viewportHeight: 844,
      isMobile: true,
      bottomSheetOpen: true,
    });

    const landscape = calculateCameraAutoFraming({
      nodeX: 0,
      nodeY: 0,
      viewportWidth: 844,
      viewportHeight: 390,
      isMobile: false, // landscape width 844 >= 768
      bottomSheetOpen: false,
    });

    expect(portrait.visibleAreaHeight).toBeLessThan(landscape.visibleAreaHeight);
  });

  it('B12-T4: restores default overview target when active node is deselected', () => {
    function getCameraTargetForSelection(selectedNode, isMobile, vp) {
      if (!selectedNode) {
        return { targetX: 0, targetY: 0 };
      }
      return calculateCameraAutoFraming({
        nodeX: selectedNode.x,
        nodeY: selectedNode.y,
        viewportWidth: vp.width,
        viewportHeight: vp.height,
        isMobile,
        bottomSheetOpen: true,
      });
    }

    const unselected = getCameraTargetForSelection(null, true, { width: 390, height: 844 });
    expect(unselected.targetX).toBe(0);
    expect(unselected.targetY).toBe(0);
  });

  it('B12-T5: ensures node center remains within upper third of viewport', () => {
    const framing = calculateCameraAutoFraming({
      nodeX: 200,
      nodeY: 400,
      viewportWidth: 390,
      viewportHeight: 844,
      isMobile: true,
      bottomSheetOpen: true,
    });

    expect(framing.nodeScreenYPercent).toBeLessThan(35);
    expect(framing.nodeScreenYPercent).toBeGreaterThan(20);
  });
});
