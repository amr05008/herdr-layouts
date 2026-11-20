// The two colors Index works out from the theme instead of adding to it
// (Herdr's theme `colors` override known names; unknown ones may not reach
// theme()). Pure: Node tests it (tests/colors.test.js). `t` is theme().

const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const hex2 = (n) => Math.round(n).toString(16).padStart(2, "0");

// Relative luminance above one half.
export function isLight(hex) {
  const [r, g, b] = rgb(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.5;
}

// `a` moved fraction `f` of the way to `b`, as #rrggbb.
export function mix(a, b, f) {
  const [x, y] = [rgb(a), rgb(b)];
  return `#${x.map((c, i) => hex2(c + (y[i] - c) * f)).join("")}`;
}

// A lit row's fill: the accent, about 15% on dark, 9% on light.
export const wash = (t) => `${t.accent.slice(0, 7)}${isLight(t.chrome) ? "17" : "26"}`;

// Quiet names and ages: one step fainter than dim.
export const quiet = (t) => mix(t.dim, t.chrome, 0.35);
