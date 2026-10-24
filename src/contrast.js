// WCAG contrast math + a "make this colour readable" solver.
//
// Why this exists: a customer's brand colour is arbitrary. Any token derived
// from it that carries TEXT (a link colour, a button label on a brand fill, the
// ink on an accent chip) has a contrast requirement that a fixed palette rung
// cannot satisfy — #F5D90A (a near-white yellow) and #1A1A6E (a near-black
// navy) are both perfectly legal brand colours, and they need opposite
// treatment. The functions below turn "brand colour" into "readable brand
// colour". Use the same functions in your token tests, so the rule and its
// enforcement cannot drift apart.
//
// Formulas: WCAG 2.1 relative luminance and contrast ratio (SC 1.4.3 / 1.4.11).

/** Pure white, the default light ink. */
export const WHITE = '#FFFFFF'

/**
 * Default neutral dark ink (a cool near-black). Used by {@link bestInk} and as
 * the fallback when a colour cannot be parsed.
 */
export const DEFAULT_DARK_INK = '#101828'

/**
 * WCAG 2.1 contrast thresholds.
 * - `AA_TEXT` / `AAA_TEXT`: normal body text (SC 1.4.3 / 1.4.6).
 * - `AA_LARGE`: large text (≥ 24px, or ≥ 18.66px bold) and non-text UI such as
 *   icons, borders and focus rings (SC 1.4.11).
 * - `AAA_LARGE`: large text at the enhanced level.
 */
export const WCAG = Object.freeze({
  AA_TEXT: 4.5,
  AA_LARGE: 3,
  AAA_TEXT: 7,
  AAA_LARGE: 4.5,
})

// How far toward black tintedInk starts its walk. 80% black is roughly the
// "900" rung of a colour's own ramp.
const TINT_TO_BLACK = 0.8
const STEPS = 100

/**
 * Parse a hex colour into an `[r, g, b]` triple (0–255).
 * Accepts `#rgb` and `#rrggbb`, with or without the leading `#`, any case,
 * surrounding whitespace ignored. Alpha forms (`#rgba`, `#rrggbbaa`) and CSS
 * colour names are not supported.
 *
 * @param {string} hex
 * @returns {[number, number, number] | null} `null` when the input is not a valid hex colour.
 */
export function parseHex(hex) {
  let h = String(hex).trim().replace('#', '')
  if (h.length === 3) h = h.split('').map((c) => c + c).join('')
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null
  const n = parseInt(h, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

/**
 * Format an `[r, g, b]` triple as a lowercase `#rrggbb` string. Channels are
 * rounded and clamped to 0–255.
 *
 * @param {[number, number, number]} rgb
 * @returns {string}
 */
export function toHex([r, g, b]) {
  return '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')
}

function channelLuminance(c) {
  const s = c / 255
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
}

/**
 * WCAG 2.1 relative luminance of a colour: 0 for black, 1 for white.
 * An unparseable colour is treated as black (returns 0).
 *
 * @param {string} hex
 * @returns {number}
 */
export function relativeLuminance(hex) {
  const rgb = parseHex(hex)
  if (!rgb) return 0
  const [r, g, b] = rgb.map(channelLuminance)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/**
 * WCAG 2.1 contrast ratio between two colours, from 1 (identical) to 21
 * (black on white). Symmetric: the order of the arguments does not matter.
 *
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
export function contrastRatio(a, b) {
  const la = relativeLuminance(a)
  const lb = relativeLuminance(b)
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la]
  return (hi + 0.05) / (lo + 0.05)
}

/**
 * Whichever of a dark ink or white reads better ON `background`.
 *
 * A neutral pick for neutral grounds. Hardcoding white "because the accent is
 * usually dark" is wrong for every colour lighter than roughly a mid blue:
 * white on an amber like #F59E0B is only 2.15:1.
 *
 * @param {string} background
 * @param {{ dark?: string, light?: string }} [inks] Candidate inks.
 * @returns {string} `dark` or `light`, whichever has the higher contrast.
 */
export function bestInk(background, { dark = DEFAULT_DARK_INK, light = WHITE } = {}) {
  return contrastRatio(background, dark) >= contrastRatio(background, light) ? dark : light
}

/**
 * A dark ink that belongs to `background`'s own hue: the colour mixed 80%
 * toward black (roughly its "900" rung), pushed further only if that still
 * misses `target`.
 *
 * Why not a neutral near-black: a cool blue-black on a warm fill (a gold, an
 * amber) reads like a warning-sign sticker — black-on-yellow, foreign to the
 * brand. A tint of the brand itself reads as "the dark version of this
 * colour", at practically the same contrast. On the gold #AE8E35 the neutral
 * #101828 measures 5.68:1 and the tinted ink 5.41:1 — both pass AA.
 *
 * Pure black is only returned if the walk reaches it. For any fill where white
 * fails (luminance above ~0.3) it does not: 80% black already clears 5:1 there.
 * On a fill that is itself very dark, no darker ink can reach the target, and
 * the walk ends at `#000000` — use {@link buttonInk} rather than calling this
 * directly if the fill could be dark.
 *
 * @param {string} background The fill the ink sits on.
 * @param {number} [target=4.5] Minimum contrast ratio to aim for.
 * @returns {string} Lowercase `#rrggbb`, or `DEFAULT_DARK_INK` if `background` cannot be parsed.
 */
export function tintedInk(background, target = WCAG.AA_TEXT) {
  const rgb = parseHex(background)
  if (!rgb) return DEFAULT_DARK_INK
  for (let i = Math.round(TINT_TO_BLACK * STEPS); i <= STEPS; i++) {
    const candidate = toHex(rgb.map((v) => v * (1 - i / STEPS)))
    if (contrastRatio(candidate, background) >= target) return candidate
  }
  return '#000000'
}

/**
 * Ink (label/icon colour) for a solid BRAND fill: a primary button, an avatar
 * disc, an active segment, an accent chip.
 *
 * White-first policy: white is the default and stays white while it clears
 * `threshold` (3:1 by default — the WCAG bar for large text and UI
 * components). This is a deliberate trade-off: brand identity outranks strict
 * 4.5:1 body-text AA on a call-to-action. A mid sky blue like #0284C7 measures
 * 4.10:1 under white; raising the bar to 4.5 would flip that very common
 * button to dark lettering, which looks wrong to almost everyone. Dark ink is a
 * FALLBACK only, for colours where white genuinely dies (pale yellows, pastels,
 * mid golds — under 3:1), and that fallback is a tint of the brand
 * ({@link tintedInk}), not a neutral gray.
 *
 * Pass `threshold = 4.5` if you need strict AA on button labels.
 *
 * The fill itself is never changed: repainting a customer's brand to chase
 * contrast is not this function's job.
 *
 * @param {string} background The brand fill.
 * @param {number} [threshold=3] Minimum white-on-fill ratio before switching to dark ink.
 * @returns {string} `#FFFFFF`, or a brand-tinted dark ink.
 */
export function buttonInk(background, threshold = WCAG.AA_LARGE) {
  return contrastRatio(background, WHITE) >= threshold ? WHITE : tintedInk(background)
}

const BLACK_RGB = [0, 0, 0]
const WHITE_RGB = [255, 255, 255]

// Which way to walk: toward black or toward white.
//
// Not simply "black on light grounds, white on dark ones" split at luminance
// 0.5 — black and white are equally contrasty against a ground of luminance
// ~0.18, so on a mid-tone ground (#808080, luminance 0.22) a 0.5 split walks
// toward white, which tops out at 3.95:1, while black would reach 5.32:1.
// Instead: keep the colour on the side of the ground it is already on (a dark
// colour gets darker, a light one lighter — the smallest visible change), and
// switch sides only when that endpoint cannot reach `target`. If neither can,
// take whichever gets closest.
function solveEndpoint(color, background, target) {
  const preferred = relativeLuminance(color) <= relativeLuminance(background) ? BLACK_RGB : WHITE_RGB
  const other = preferred === BLACK_RGB ? WHITE_RGB : BLACK_RGB
  const reach = (rgb) => contrastRatio(toHex(rgb), background)
  if (reach(preferred) >= target) return preferred
  if (reach(other) >= target) return other
  return reach(preferred) >= reach(other) ? preferred : other
}

/**
 * Push `color` away from `background` — darker on a light ground, lighter on a
 * dark one — until it clears `target`, and no further.
 *
 * Returns `color` untouched (same string, same case) when it already passes,
 * so a brand colour that is fine stays exactly as the customer chose it. Use
 * it for brand-coloured TEXT: links, the active tab label, a brand-coloured
 * heading.
 *
 * Solve against the hardest ground the text will actually sit on in each theme
 * (e.g. the darkest of your light-theme surfaces), and you can reuse the
 * result on every other surface of that theme.
 *
 * The colour moves in a straight line toward black or white, in 1% steps.
 * It keeps its side of the ground when it can (a dark colour on a mid-tone
 * ground gets darker, not inverted to a pale one). If no colour on either side
 * can reach `target` — e.g. 7:1 against a mid gray, where the best possible is
 * ~5.3:1 — the endpoint with the highest contrast is returned: the best
 * achievable, but still below `target`.
 *
 * @param {string} color The colour to make readable (e.g. the brand colour).
 * @param {string} background The ground the text sits on.
 * @param {number} [target=4.5] Minimum contrast ratio.
 * @returns {string} `color` itself if it passes, otherwise a lowercase `#rrggbb`.
 *   An unparseable `color` is returned as given.
 */
export function readableOn(color, background, target = WCAG.AA_TEXT) {
  const rgb = parseHex(color)
  if (!rgb) return color
  if (contrastRatio(color, background) >= target) return color

  const endpoint = solveEndpoint(color, background, target)

  for (let i = 1; i <= STEPS; i++) {
    const t = i / STEPS
    const candidate = toHex(rgb.map((v, k) => v + (endpoint[k] - v) * t))
    if (contrastRatio(candidate, background) >= target) return candidate
  }
  return toHex(endpoint)
}

/**
 * WCAG conformance of a contrast ratio, for both text sizes.
 *
 * @param {number} ratio
 * @returns {{ ratio: number, aa: boolean, aaa: boolean, aaLarge: boolean, aaaLarge: boolean }}
 */
export function wcagLevel(ratio) {
  return {
    ratio,
    aa: ratio >= WCAG.AA_TEXT,
    aaa: ratio >= WCAG.AAA_TEXT,
    aaLarge: ratio >= WCAG.AA_LARGE,
    aaaLarge: ratio >= WCAG.AAA_LARGE,
  }
}

/**
 * Derive the whole readable token set from one brand colour, for a light and a
 * dark theme. A convenience wrapper over {@link buttonInk} and
 * {@link readableOn} — the brand fill is passed through untouched.
 *
 * @param {string} brand The brand colour.
 * @param {object} [options]
 * @param {string} [options.lightSurface='#FFFFFF'] Hardest light-theme ground brand text sits on.
 * @param {string} [options.darkSurface='#1F2A37'] Hardest dark-theme ground brand text sits on.
 * @param {number} [options.textTarget=4.5] Contrast target for brand-coloured text.
 * @param {number} [options.labelThreshold=3] White-first threshold for ink on the brand fill.
 * @returns {{ fill: string, onFill: string, textOnLight: string, textOnDark: string }}
 */
export function brandTokens(brand, {
  lightSurface = WHITE,
  darkSurface = '#1F2A37',
  textTarget = WCAG.AA_TEXT,
  labelThreshold = WCAG.AA_LARGE,
} = {}) {
  return {
    fill: brand,
    onFill: buttonInk(brand, labelThreshold),
    textOnLight: readableOn(brand, lightSurface, textTarget),
    textOnDark: readableOn(brand, darkSurface, textTarget),
  }
}
