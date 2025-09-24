// Implement common easing functions
export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export function easeInOutCirc(t: number): number {
  return t < 0.5
    ? (1 - Math.sqrt(1 - Math.pow(2 * t, 2))) / 2
    : (Math.sqrt(1 - Math.pow(-2 * t + 2, 2)) + 1) / 2;
}

export function easeInOutQuad(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

export function easeInOutQuart(t: number): number {
  return t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2;
}

export function easeInOutQuint(t: number): number {
  return t < 0.5 ? 32 * t * t * t * t * t : 1 - Math.pow(-2 * t + 2, 5) / 2;
}

// Easing map
export const EASING_MAP = {
  'easeInOutCubic': easeInOutCubic,
  'easeInOutCirc': easeInOutCirc,
  'easeInOutQuad': easeInOutQuad,
  'easeInOutQuart': easeInOutQuart,
  'easeInOutQuint': easeInOutQuint,
};
