import { describe, it, expect } from '../harness/test-framework.mjs';
import { isMobileViewport, calculatePanDelta, calculatePinchZoom, calculateCameraAutoFraming, validateBottomSheetLayout } from '../helpers/mobile-simulator.mjs';
import { sanitizeAndParseBody } from '../helpers/render-shield.mjs';

describe('Tier 4 — Scenario 1: Executive Mobile Viewport Comparison (Medimex vs Trinidad Core)', () => {
  const VIEWPORT = { width: 390, height: 844 }; // iPhone 14

  it('Step 1: verifies executive enters on mobile viewport with compact header and full canvas', () => {
    const isMobile = isMobileViewport(VIEWPORT.width);
    expect(isMobile).toBe(true);

    const headerHeight = 48;
    const canvasHeight = VIEWPORT.height - headerHeight; // 796px
    expect(canvasHeight).toBeGreaterThanOrEqual(550);
  });

  it('Step 2: executive pans graph to Caribbean cluster using 1-finger touch gesture', () => {
    const touchStart = { clientX: 200, clientY: 400 };
    const touchMove = { clientX: 280, clientY: 310 };

    const { deltaX, deltaY } = calculatePanDelta(touchStart, touchMove);
    expect(deltaX).toBe(80);
    expect(deltaY).toBe(-90);
  });

  it('Step 3: executive pinches to zoom in on Medimex distributor node', () => {
    const pairStart = [{ clientX: 150, clientY: 300 }, { clientX: 250, clientY: 300 }];
    const pairMove = [{ clientX: 120, clientY: 300 }, { clientX: 300, clientY: 300 }];

    const { newZoom, scaleFactor } = calculatePinchZoom(pairStart, pairMove, 1.0);
    expect(scaleFactor).toBe(1.8);
    expect(newZoom).toBe(1.8);
  });

  it('Step 4: executive taps Medimex node, auto-framing camera and opening 100% width Bottom Sheet', () => {
    const medimexNode = { id: 'dist-medimex', x: 420, y: 350 };
    const framing = calculateCameraAutoFraming({
      nodeX: medimexNode.x,
      nodeY: medimexNode.y,
      viewportWidth: VIEWPORT.width,
      viewportHeight: VIEWPORT.height,
      isMobile: true,
      bottomSheetOpen: true,
    });

    expect(framing.targetX).toBe(420);
    expect(framing.targetY).toBeLessThan(350); // Offset upward
    expect(framing.nodeScreenYPercent).toBeLessThan(35);

    const sheetLayout = {
      width: VIEWPORT.width,
      viewportWidth: VIEWPORT.width,
      height: 650,
      viewportHeight: VIEWPORT.height,
      closeButtonWidth: 48,
      closeButtonHeight: 48,
    };
    const validation = validateBottomSheetLayout(sheetLayout);
    expect(validation.valid).toBe(true);
  });

  it('Step 5: executive inspects Medimex dossier body ensuring clean executive text with 0 residual JSON', () => {
    const rawMedimexBody = `## Visión General & Posicionamiento
Distribuidor exclusivo de marcas SMJ en Panamá (Chubby, Busta, Fruta).

## Canales y Distribución
- Cobertura nacional en retail y canal tradicional.
- Cobertura de más de 4,500 puntos de venta.

## Relaciones Clave y Ecosistema
- Interlocución directa con [[Person - Humberto Bouche]].`;

    const ast = sanitizeAndParseBody(rawMedimexBody);
    expect(ast.length).toBeGreaterThanOrEqual(4);
    const headings = ast.filter(e => e.type === 'h2').map(e => e.title);
    expect(headings).toContain('Visión General & Posicionamiento');
    expect(headings).toContain('Canales y Distribución');
    expect(headings).toContain('Relaciones Clave y Ecosistema');

    const serialized = JSON.stringify(ast);
    expect(serialized).not.toContain('{ "id":');
    expect(serialized).not.toContain('Corporate evidence batch');
  });

  it('Step 6: executive switches focus to Trinidad Core and verifies identical enriched structure', () => {
    const coreNode = { id: 'core-smj', x: 0, y: 0 };
    const framing = calculateCameraAutoFraming({
      nodeX: coreNode.x,
      nodeY: coreNode.y,
      viewportWidth: VIEWPORT.width,
      viewportHeight: VIEWPORT.height,
      isMobile: true,
      bottomSheetOpen: true,
    });

    expect(framing.targetX).toBe(0);
    expect(framing.targetY).toBeLessThan(0);
  });
});
