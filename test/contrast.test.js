import { describe, it, expect } from 'vitest'
import {
  WHITE,
  DEFAULT_DARK_INK,
  WCAG,
  parseHex,
  toHex,
  relativeLuminance,
  contrastRatio,
  bestInk,
  tintedInk,
  buttonInk,
  readableOn,
  wcagLevel,
  brandTokens,
} from '../src/index.js'

const LIGHT_SURFACE = '#FFFFFF'
const DARK_SURFACE = '#1F2A37'

// Deliberately nasty: a near-white yellow and a near-black navy are the two
// ends where a fixed palette rung would be exactly wrong, plus mid-tones that
// fail against BOTH inks and so force the colour itself to move.
const BRANDS = [
  '#0284C7', '#F5D90A', '#1A1A6E', '#66C61C', '#FFFFFF', '#000000',
  '#7A5AF8', '#F63D68', '#00E5FF', '#808080', '#EF6820', '#2E90FA',
]

// Coarse sweep of the whole RGB cube (8 levels per channel = 512 colours) for
// properties that must hold for ANY input, not just hand-picked ones.
const LEVELS = [0, 36, 73, 109, 146, 182, 219, 255]
const CUBE = LEVELS.flatMap((r) => LEVELS.flatMap((g) => LEVELS.map((b) => toHex([r, g, b]))))

const channels = (hex) => parseHex(hex)
const argmax = (a) => a.indexOf(Math.max(...a))

describe('parseHex / toHex', () => {
  it('parses 6-digit hex in any case, with or without #', () => {
    expect(parseHex('#0284C7')).toEqual([2, 132, 199])
    expect(parseHex('#0284c7')).toEqual([2, 132, 199])
    expect(parseHex('0284C7')).toEqual([2, 132, 199])
    expect(parseHex('  #0284C7 ')).toEqual([2, 132, 199])
  })

  it('expands 3-digit shorthand', () => {
    expect(parseHex('#fff')).toEqual([255, 255, 255])
    expect(parseHex('#F0A')).toEqual([255, 0, 170])
    expect(parseHex('abc')).toEqual(parseHex('#aabbcc'))
  })

  it('rejects anything else', () => {
    for (const bad of ['', '#', '#12', '#1234', '#12345', '#1234567', '#11223344', '#ggg', 'red', 'rgb(0,0,0)', null, undefined]) {
      expect(parseHex(bad), String(bad)).toBeNull()
    }
  })

  it('toHex rounds, clamps and pads', () => {
    expect(toHex([0, 0, 0])).toBe('#000000')
    expect(toHex([255, 255, 255])).toBe('#ffffff')
    expect(toHex([1.6, 300, -20])).toBe('#02ff00')
  })

  it('round-trips', () => {
    for (const hex of CUBE) expect(toHex(parseHex(hex))).toBe(hex)
  })
})

describe('relativeLuminance / contrastRatio', () => {
  it('matches the WCAG endpoints', () => {
    expect(relativeLuminance('#000000')).toBe(0)
    expect(relativeLuminance('#FFFFFF')).toBeCloseTo(1, 10)
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 10)
    expect(contrastRatio('#123456', '#123456')).toBe(1)
  })

  it('matches known reference values', () => {
    // #767676 is the classic "lightest gray that passes AA on white".
    expect(contrastRatio('#767676', '#FFFFFF')).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio('#777777', '#FFFFFF')).toBeLessThan(4.5)
    expect(contrastRatio('#F59E0B', WHITE)).toBeCloseTo(2.15, 2)
    expect(contrastRatio('#0284C7', WHITE)).toBeCloseTo(4.10, 2)
  })

  it('is symmetric and shorthand-agnostic', () => {
    expect(contrastRatio('#F5D90A', '#1A1A6E')).toBe(contrastRatio('#1A1A6E', '#F5D90A'))
    expect(contrastRatio('#fff', '#000')).toBe(contrastRatio('#FFFFFF', '#000000'))
  })

  it('treats an unparseable colour as black', () => {
    expect(relativeLuminance('not-a-colour')).toBe(0)
    expect(contrastRatio('not-a-colour', '#000000')).toBe(1)
  })
})

describe('readableOn — brand-coloured text stays readable', () => {
  it.each(BRANDS)('%s → readable on both a light and a dark surface', (brand) => {
    expect(contrastRatio(readableOn(brand, LIGHT_SURFACE, 4.5), LIGHT_SURFACE)).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio(readableOn(brand, DARK_SURFACE, 4.5), DARK_SURFACE)).toBeGreaterThanOrEqual(4.5)
  })

  it('reaches the target for every colour in the RGB sweep, at AA and AAA', () => {
    for (const ground of [LIGHT_SURFACE, DARK_SURFACE, '#F2F4F7', '#000000', '#808080']) {
      for (const target of [WCAG.AA_LARGE, WCAG.AA_TEXT, WCAG.AAA_TEXT]) {
        // A mid gray ground cannot host 7:1 at all (max ~5.3:1 against black);
        // only check targets that are physically reachable.
        const reachable = Math.max(contrastRatio(ground, '#000000'), contrastRatio(ground, '#FFFFFF'))
        if (target > reachable) continue
        for (const color of CUBE) {
          expect(contrastRatio(readableOn(color, ground, target), ground), `${color} on ${ground} @${target}`)
            .toBeGreaterThanOrEqual(target)
        }
      }
    }
  })

  it('mid-tone grounds: walks toward whichever end can actually reach the target', () => {
    // Black and white tie at a ground luminance of ~0.18, not 0.5. A naive
    // "lighten on grounds darker than 0.5" walks toward white on #808080,
    // which tops out at 3.95:1 — black reaches 5.32:1.
    expect(contrastRatio('#FFFFFF', '#808080')).toBeLessThan(4.5)
    const out = readableOn('#00006d', '#808080', 4.5)
    expect(contrastRatio(out, '#808080')).toBeGreaterThanOrEqual(4.5)
    expect(relativeLuminance(out)).toBeLessThan(relativeLuminance('#00006d'))
    for (const ground of ['#808080', '#5A5A5A', '#B0B0B0', '#9A9A9A']) {
      for (const color of CUBE) {
        expect(contrastRatio(readableOn(color, ground, 4.5), ground), `${color} on ${ground}`).toBeGreaterThanOrEqual(4.5)
      }
    }
  })

  it('keeps the colour on its own side of the ground when that side can reach the target', () => {
    // A dark navy on a mid gray gets darker, not inverted into a pale lavender.
    expect(relativeLuminance(readableOn('#1A1A6E', '#808080', 4.5))).toBeLessThan(relativeLuminance('#1A1A6E'))
    // A light olive on a mid-dark gray gets lighter.
    expect(relativeLuminance(readableOn('#A3A060', '#5A5A5A', 4.5))).toBeGreaterThan(relativeLuminance('#A3A060'))
  })

  it('an unreachable target returns the best achievable endpoint', () => {
    // 7:1 against #808080 is impossible (black gives 5.32:1, white 3.95:1).
    expect(readableOn('#F5D90A', '#808080', 7)).toBe('#000000')
    expect(readableOn('#F5D90A', '#808080', 22)).toBe('#000000')
    expect(readableOn('#00E5FF', '#000000', 22)).toBe('#ffffff')
  })

  it('a colour that already passes comes back UNTOUCHED', () => {
    // A customer who picked a legible colour must get their exact hex back —
    // "fix the contrast" must never mean "repaint the brand".
    expect(readableOn('#0369A1', LIGHT_SURFACE, 4.5)).toBe('#0369A1')
    expect(readableOn('#7A5AF8', LIGHT_SURFACE, 4.5)).toBe('#7A5AF8')
    expect(readableOn('#F5D90A', DARK_SURFACE, 4.5)).toBe('#F5D90A')
    expect(readableOn('#1A1A6E', LIGHT_SURFACE, 4.5)).toBe('#1A1A6E')
    // …including its original spelling.
    expect(readableOn('#fff', DARK_SURFACE)).toBe('#fff')
  })

  it('moves only as far as needed — one step less would still fail', () => {
    const mix = (rgb, to, t) => toHex(rgb.map((v) => v + (to - v) * t))
    for (const [color, ground] of [['#F5D90A', LIGHT_SURFACE], ['#1A1A6E', DARK_SURFACE], ['#808080', LIGHT_SURFACE], ['#00E5FF', '#F2F4F7']]) {
      const out = readableOn(color, ground, 4.5)
      const rgb = parseHex(color)
      const to = relativeLuminance(ground) < 0.5 ? 255 : 0
      // The result lies on the straight line from the colour to black/white,
      // at the first 1% step that passes.
      const step = Array.from({ length: 101 }, (_, i) => i).find((i) => mix(rgb, to, i / 100) === out)
      expect(step, `${color} on ${ground}`).toBeGreaterThan(0)
      expect(contrastRatio(mix(rgb, to, (step - 1) / 100), ground)).toBeLessThan(4.5)
    }
  })

  it('darkens on light grounds and lightens on dark grounds', () => {
    expect(relativeLuminance(readableOn('#F5D90A', LIGHT_SURFACE))).toBeLessThan(relativeLuminance('#F5D90A'))
    expect(relativeLuminance(readableOn('#1A1A6E', DARK_SURFACE))).toBeGreaterThan(relativeLuminance('#1A1A6E'))
  })

  it('handles the pure extremes', () => {
    // White text on white → the lightest gray that passes.
    expect(readableOn('#FFFFFF', '#FFFFFF')).toBe('#757575')
    expect(contrastRatio(readableOn('#000000', '#000000'), '#000000')).toBeGreaterThanOrEqual(4.5)
    expect(readableOn('#000000', '#FFFFFF')).toBe('#000000')
    expect(readableOn('#FFFFFF', '#000000')).toBe('#FFFFFF')
  })

  it('returns an unparseable colour as given', () => {
    expect(readableOn('tomato', LIGHT_SURFACE)).toBe('tomato')
  })
})

describe('buttonInk — white-first ink on a brand fill', () => {
  it.each(BRANDS)('%s → label clears the 3:1 threshold', (brand) => {
    expect(contrastRatio(buttonInk(brand), brand)).toBeGreaterThanOrEqual(3)
  })

  it('every colour in the RGB sweep gets a label of at least 3:1', () => {
    for (const fill of CUBE) expect(contrastRatio(buttonInk(fill), fill), fill).toBeGreaterThanOrEqual(3)
  })

  it('white stays wherever it holds 3:1 — including a 4.10:1 mid blue', () => {
    // If this fails, someone raised the default threshold to 4.5. That flips a
    // very common CTA blue to dark lettering, which is the trade-off this
    // policy deliberately refuses.
    expect(buttonInk('#0284C7')).toBe(WHITE)
    expect(buttonInk('#7A5AF8')).toBe(WHITE)
    expect(buttonInk('#1A1A6E')).toBe(WHITE)
    expect(buttonInk('#000000')).toBe(WHITE)
    // …and genuinely hostile fills still flip to dark ink:
    expect(buttonInk('#F5D90A')).not.toBe(WHITE)
    expect(buttonInk('#F59E0B')).not.toBe(WHITE)
    expect(buttonInk('#FFFFFF')).not.toBe(WHITE)
  })

  it('switches exactly at the threshold', () => {
    for (const fill of CUBE) {
      const whiteOk = contrastRatio(WHITE, fill) >= 3
      expect(buttonInk(fill) === WHITE, fill).toBe(whiteOk)
    }
  })

  it('a stricter threshold is opt-in', () => {
    expect(buttonInk('#0284C7', 4.5)).not.toBe(WHITE)
    expect(contrastRatio(buttonInk('#0284C7', 4.5), '#0284C7')).toBeGreaterThanOrEqual(4.5)
  })

  // The dark fallback is a TINT of the brand, not a neutral near-black: a cold
  // blue-black on a warm gold reads like a warning sticker. Guard both halves —
  // it keeps the brand's hue AND still clears full text AA.
  it.each(['#B3933A', '#F5D90A', '#F59E0B', '#66C61C', '#00E5FF', '#C9A94A'])(
    '%s → dark ink is tinted with the brand and clears AA', (brand) => {
      const ink = buttonInk(brand)
      expect(ink).toBe(tintedInk(brand))
      expect(ink).not.toBe(DEFAULT_DARK_INK)
      expect(ink).not.toBe('#000000')
      expect(contrastRatio(ink, brand)).toBeGreaterThanOrEqual(4.5)
      // Same hue: the dominant channel of the brand stays dominant in the ink.
      expect(argmax(channels(ink))).toBe(argmax(channels(brand)))
    })

  it('gives #F5D90A a dark olive, not black', () => {
    expect(buttonInk('#F5D90A')).toBe('#312b02')
  })
})

describe('tintedInk', () => {
  it('never reaches pure black on a fill where white fails', () => {
    // Where white is under 3:1 the fill is light enough (luminance > 0.3) that
    // 80% black already clears 4.5 — the safety walk toward #000 must not run.
    for (const fill of [...CUBE, '#AE8E35', '#B3933A', '#F5D90A', '#FFFFFF', '#66C61C']) {
      if (contrastRatio(fill, WHITE) >= 3) continue
      const ink = tintedInk(fill)
      expect(ink, fill).not.toBe('#000000')
      expect(contrastRatio(ink, fill), fill).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('starts at 80% toward black', () => {
    expect(tintedInk('#FFFFFF')).toBe('#333333')
    expect(tintedInk('#AE8E35')).toBe('#231c0b')
    expect(contrastRatio(tintedInk('#AE8E35'), '#AE8E35')).toBeCloseTo(5.41, 2)
    // The neutral alternative it replaces measures about the same:
    expect(contrastRatio(DEFAULT_DARK_INK, '#AE8E35')).toBeCloseTo(5.68, 2)
  })

  it('ends at pure black on a fill too dark for any darker ink', () => {
    expect(tintedInk('#1A1A6E')).toBe('#000000')
  })

  it('accepts shorthand and falls back to the neutral ink on garbage', () => {
    expect(tintedInk('#fff')).toBe(tintedInk('#FFFFFF'))
    expect(tintedInk('nope')).toBe(DEFAULT_DARK_INK)
  })
})

describe('bestInk', () => {
  it('picks whichever ink has the higher contrast', () => {
    expect(bestInk('#FFFFFF')).toBe(DEFAULT_DARK_INK)
    expect(bestInk('#000000')).toBe(WHITE)
    expect(bestInk('#F59E0B')).toBe(DEFAULT_DARK_INK)
    expect(bestInk('#1A1A6E')).toBe(WHITE)
    expect(bestInk('#F5D90A', { dark: '#222222', light: '#EEEEEE' })).toBe('#222222')
  })

  it('never loses to the other candidate', () => {
    for (const bg of CUBE) {
      const ink = bestInk(bg)
      const other = ink === WHITE ? DEFAULT_DARK_INK : WHITE
      expect(contrastRatio(ink, bg)).toBeGreaterThanOrEqual(contrastRatio(other, bg))
    }
  })
})

describe('wcagLevel', () => {
  it('reports both text sizes', () => {
    expect(wcagLevel(21)).toEqual({ ratio: 21, aa: true, aaa: true, aaLarge: true, aaaLarge: true })
    expect(wcagLevel(4.5)).toMatchObject({ aa: true, aaa: false, aaLarge: true, aaaLarge: true })
    expect(wcagLevel(3.2)).toMatchObject({ aa: false, aaa: false, aaLarge: true, aaaLarge: false })
    expect(wcagLevel(1.4)).toMatchObject({ aa: false, aaLarge: false })
  })
})

describe('brandTokens', () => {
  it('passes the fill through and solves the rest', () => {
    expect(brandTokens('#F5D90A')).toEqual({
      fill: '#F5D90A',
      onFill: buttonInk('#F5D90A'),
      textOnLight: readableOn('#F5D90A', LIGHT_SURFACE),
      textOnDark: '#F5D90A',
    })
  })

  it('respects custom surfaces and targets', () => {
    const t = brandTokens('#808080', { lightSurface: '#F2F4F7', darkSurface: '#000000', textTarget: 7, labelThreshold: 4.5 })
    expect(contrastRatio(t.textOnLight, '#F2F4F7')).toBeGreaterThanOrEqual(7)
    expect(contrastRatio(t.textOnDark, '#000000')).toBeGreaterThanOrEqual(7)
    expect(contrastRatio(t.onFill, '#808080')).toBeGreaterThanOrEqual(4.5)
  })
})
