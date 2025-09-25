import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}


/**
 * Converts an RGBA string to a HEX color and an alpha value.
 * @param rgba - e.g., "rgba(255, 128, 0, 0.5)"
 * @returns An object with hex color and alpha value, e.g., { hex: '#ff8000', alpha: 0.5 }
 */
export const rgbaToHexAlpha = (rgba: string): { hex: string; alpha: number } => {
  const result = /^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)$/.exec(rgba);
  if (!result) return { hex: '#000000', alpha: 1 };

  const r = parseInt(result[1], 10);
  const g = parseInt(result[2], 10);
  const b = parseInt(result[3], 10);
  const alpha = result[4] !== undefined ? parseFloat(result[4]) : 1;

  const toHex = (c: number) => ('0' + c.toString(16)).slice(-2);

  return { hex: `#${toHex(r)}${toHex(g)}${toHex(b)}`, alpha };
};

/**
 * Converts a HEX color string to an RGB object.
 * @param hex - e.g., "#ff8000"
 * @returns An object with r, g, b values, e.g., { r: 255, g: 128, b: 0 }
 */
export const hexToRgb = (hex: string): { r: number; g: number; b: number } | null => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16),
    }
    : null;
};

