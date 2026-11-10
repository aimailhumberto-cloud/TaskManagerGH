/**
 * Mobile Viewport, Touch Mechanics & Layout Geometry Simulator.
 * Models viewport dimensions, touch gestures (pan/pinch), and camera auto-framing.
 */

export const BREAKPOINT_MOBILE_MAX = 767;
export const MOBILE_HEADER_MAX_HEIGHT = 48;
export const CANVAS_MIN_HEIGHT = 550;
export const MIN_TOUCH_TARGET_SIZE = 44;
export const BOTTOM_SHEET_MAX_VH = 85;

export function isMobileViewport(width) {
  return width <= BREAKPOINT_MOBILE_MAX;
}

export function calculatePanDelta(touchStart, touchMove) {
  return {
    deltaX: touchMove.clientX - touchStart.clientX,
    deltaY: touchMove.clientY - touchStart.clientY,
  };
}

export function calculatePinchZoom(touchPairStart, touchPairMove, currentZoom, minZoom = 0.2, maxZoom = 3.0) {
  const distStart = Math.hypot(
    touchPairStart[1].clientX - touchPairStart[0].clientX,
    touchPairStart[1].clientY - touchPairStart[0].clientY
  );

  const distMove = Math.hypot(
    touchPairMove[1].clientX - touchPairMove[0].clientX,
    touchPairMove[1].clientY - touchPairMove[0].clientY
  );

  if (distStart === 0) return { newZoom: currentZoom, scaleFactor: 1, midpoint: { x: 0, y: 0 } };

  const scaleFactor = distMove / distStart;
  const rawZoom = currentZoom * scaleFactor;
  const clampedZoom = Math.min(Math.max(rawZoom, minZoom), maxZoom);

  const midpoint = {
    x: (touchPairMove[0].clientX + touchPairMove[1].clientX) / 2,
    y: (touchPairMove[0].clientY + touchPairMove[1].clientY) / 2,
  };

  return {
    newZoom: clampedZoom,
    scaleFactor,
    midpoint,
    isClamped: clampedZoom !== rawZoom,
  };
}

export function calculateCameraAutoFraming({
  nodeX,
  nodeY,
  viewportWidth,
  viewportHeight,
  isMobile,
  bottomSheetOpen = true,
}) {
  if (!isMobile) {
    // Desktop: center horizontally and vertically, or slight offset for right sidebar
    return {
      targetX: nodeX,
      targetY: nodeY,
      visibleAreaHeight: viewportHeight,
      nodeScreenYPercent: 50,
    };
  }

  // Mobile: If bottom sheet is open (up to 85vh), the visible upper canvas window is roughly 25-35% of screen.
  // Camera needs to pan down (shifting the graph down, so targetY on camera offsets upward).
  const sheetHeight = bottomSheetOpen ? viewportHeight * (BOTTOM_SHEET_MAX_VH / 100) : 0;
  const visibleCanvasHeight = viewportHeight - (bottomSheetOpen ? sheetHeight * 0.75 : 0);
  
  // Offset camera target so node centers in the upper visible section
  const verticalOffset = bottomSheetOpen ? (viewportHeight * 0.22) : 0;
  const targetY = nodeY - verticalOffset;

  return {
    targetX: nodeX,
    targetY,
    visibleAreaHeight: visibleCanvasHeight,
    nodeScreenYPercent: bottomSheetOpen ? 28 : 50,
  };
}

export function validateBottomSheetLayout(dimensions) {
  const { width, viewportWidth, height, viewportHeight, closeButtonWidth, closeButtonHeight } = dimensions;
  const errors = [];

  if (Math.abs(width - viewportWidth) > 2) {
    errors.push(`Bottom sheet width ${width}px does not span 100% of mobile viewport ${viewportWidth}px`);
  }

  const maxAllowedHeight = viewportHeight * (BOTTOM_SHEET_MAX_VH / 100);
  if (height > maxAllowedHeight + 1) {
    errors.push(`Bottom sheet height ${height}px exceeds maximum allowed ${BOTTOM_SHEET_MAX_VH}vh (${maxAllowedHeight}px)`);
  }

  if (closeButtonWidth < MIN_TOUCH_TARGET_SIZE || closeButtonHeight < MIN_TOUCH_TARGET_SIZE) {
    errors.push(`Close button dimensions (${closeButtonWidth}x${closeButtonHeight}px) violate minimum thumb target (${MIN_TOUCH_TARGET_SIZE}x${MIN_TOUCH_TARGET_SIZE}px)`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
