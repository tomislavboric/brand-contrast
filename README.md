# brand-contrast

Turn any brand colour into readable link, text and button-label colours that pass WCAG contrast, without repainting the brand.

[![CI](https://github.com/tomislavboric/brand-contrast/actions/workflows/ci.yml/badge.svg)](https://github.com/tomislavboric/brand-contrast/actions/workflows/ci.yml)

**Live demo → [tomislavboric.github.io/brand-contrast](https://tomislavboric.github.io/brand-contrast/)**

## The problem

In a white-label or multi-tenant app, every customer picks their own brand colour, and you have to build UI from it. A fixed palette stops working at this point:

- `#F5D90A` (a near-white yellow) and `#1A1A6E` (a near-black navy) are both legal brand colours, and they need **opposite** treatment. Used as link text, the yellow measures 1.42:1 on white and the navy 1.02:1 on a dark surface.
- Hardcoding a white button label "because brand colours are usually dark" fails on every colour lighter than roughly a mid blue. White on an amber like `#F59E0B` is **2.15:1**.
- Switching to neutral black ink where white fails is readable, but a cool blue-black on a warm gold reads like a warning-sign sticker. It looks foreign to the brand.
- Fixing contrast by repainting the customer's colour is not acceptable either. A brand that already passes must come back **exactly** as chosen.

This library solves each of these with small, deterministic functions, so you can derive the tokens at runtime and use the same functions in your tests.

## Install

Not published to npm. Install straight from GitHub:

```sh
npm install github:tomislavboric/brand-contrast
```

Plain ESM, zero runtime dependencies. You can also copy `src/contrast.js` into your project.

## Usage

```js
import { readableOn, buttonInk, contrastRatio, brandTokens } from 'brand-contrast'

const brand = '#F5D90A' // whatever the customer picked

// Brand-coloured text (links, active tab labels) on each theme's surface:
readableOn(brand, '#FFFFFF') // '#847505', darkened just enough: 4.64:1
readableOn(brand, '#1F2A37') // '#F5D90A', already passes, returned untouched

// Label on a solid brand fill (primary button, chip, avatar):
buttonInk('#0284C7') // '#FFFFFF', white holds 4.10:1 (≥ 3), so white stays
buttonInk(brand)     // '#312b02', white would be 1.42:1, so a dark tint of the brand

contrastRatio('#312b02', brand) // 10.0

// Or everything at once:
brandTokens(brand, { lightSurface: '#FFFFFF', darkSurface: '#1F2A37' })
// → { fill: '#F5D90A', onFill: '#312b02', textOnLight: '#847505', textOnDark: '#F5D90A' }
```

Typical wiring: compute the tokens when the brand loads and set them as CSS custom properties.

```js
const t = brandTokens(brand)
const root = document.documentElement.style
root.setProperty('--brand', t.fill)
root.setProperty('--brand-ink', t.onFill)
root.setProperty('--brand-text-on-light', t.textOnLight)
root.setProperty('--brand-text-on-dark', t.textOnDark)
```

Solve against the **hardest** ground the text actually sits on in each theme, such as the darkest of your light-theme surfaces. The result then works on every other surface of that theme.

## API

| Function | Returns |
| --- | --- |
| `readableOn(color, background, target = 4.5)` | `color` moved in a straight line toward black or white, in 1% steps, until it clears `target`, and no further. Returned untouched (same string) if it already passes. A colour keeps its side of the ground when it can, so a dark colour gets darker instead of being inverted. |
| `buttonInk(fill, threshold = 3)` | Ink for text on a solid brand fill. **White-first:** white while it clears `threshold`, otherwise `tintedInk(fill)`. Pass `4.5` for strict AA labels. |
| `tintedInk(fill, target = 4.5)` | A dark ink in the fill's own hue: the fill mixed 80% toward black, pushed further only if needed. On gold `#AE8E35` it measures 5.41:1, against 5.68:1 for a neutral `#101828`: the same readability, but it belongs to the brand. |
| `bestInk(background, { dark, light })` | Whichever of two inks has more contrast. For neutral grounds. |
| `contrastRatio(a, b)` | WCAG 2.1 contrast ratio, 1–21. Symmetric. |
| `relativeLuminance(hex)` | WCAG 2.1 relative luminance, 0–1. |
| `wcagLevel(ratio)` | `{ ratio, aa, aaa, aaLarge, aaaLarge }` |
| `brandTokens(brand, options)` | `{ fill, onFill, textOnLight, textOnDark }`. Options: `lightSurface`, `darkSurface`, `textTarget`, `labelThreshold`. |
| `parseHex(hex)` / `toHex(rgb)` | `#rgb` / `#rrggbb` (`#` optional) ↔ `[r, g, b]`. `parseHex` returns `null` on invalid input. |
| `WCAG` | `{ AA_TEXT: 4.5, AA_LARGE: 3, AAA_TEXT: 7, AAA_LARGE: 4.5 }` |

Notes:

- Colours derived by the library are lowercase `#rrggbb`. Input that passes unchanged keeps its original spelling.
- Unparseable input is treated as black by `relativeLuminance` and `contrastRatio`. `readableOn` returns it unchanged. Validate user input with `parseHex` first.
- Alpha hex (`#rrggbbaa`) and CSS colour names are not supported.

### Why the white-first 3:1 threshold?

WCAG asks for 4.5:1 for body text, but 3:1 for large text and UI components. A very common CTA blue like `#0284C7` gets **4.10:1** under a white label. With the label bar at 4.5, that button flips to dark lettering, which almost everyone reads as broken branding. So `buttonInk` keeps white down to 3:1 and switches only where white genuinely fails: pale yellows, pastels, mid golds. If your product needs strict AA on button labels, call `buttonInk(fill, 4.5)`.

## Testing

```sh
npm test
```

The suite checks hand-picked hostile colours (`#F5D90A`, `#1A1A6E`, pure white and black, mid gray) and sweeps a 512-colour grid of the RGB cube on light, dark and mid-tone grounds. It asserts that every solved pair reaches its target, that passing colours are never repainted, and that the dark fallback keeps the brand's hue.

## Demo

`npm run demo` starts the demo locally, and `npm run demo:build` builds it into `demo-dist/`. The live demo is at **https://tomislavboric.github.io/brand-contrast/**.

## Origin

Extracted from Camppy, a camp operations PWA, where it runs in production.

## License

[MIT](LICENSE) © 2026 Tomislav Borić
