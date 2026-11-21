// The one color Signal works out from the theme instead of adding to it
// (unknown theme color names may not reach theme()). Pure: Node tests it.

const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

// Relative luminance above one half.
export function isLight(hex) {
  const [r, g, b] = rgb(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.5;
}

// A waiting row's or tab's fill: the accent at 18% on dark, 10% on light.
export const wash = (t) => `${t.accent.slice(0, 7)}${isLight(t.chrome) ? "1a" : "2e"}`;

export const CLEAR = "#00000000";
