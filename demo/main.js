import {
  parseHex,
  toHex,
  contrastRatio,
  readableOn,
  buttonInk,
  brandTokens,
  wcagLevel,
  WHITE,
  WCAG,
} from '../src/index.js'

const PRESETS = [
  { name: 'Sky', hex: '#0284C7' },
  { name: 'Sunflower', hex: '#F5D90A' },
  { name: 'Midnight', hex: '#1A1A6E' },
  { name: 'Amber', hex: '#F59E0B' },
  { name: 'Lime', hex: '#66C61C' },
  { name: 'Gold', hex: '#AE8E35' },
  { name: 'Violet', hex: '#7A5AF8' },
  { name: 'Rose', hex: '#F63D68' },
  { name: 'Cyan', hex: '#00E5FF' },
  { name: 'Orange', hex: '#EF6820' },
  { name: 'Gray', hex: '#808080' },
  { name: 'White', hex: '#FFFFFF' },
  { name: 'Black', hex: '#000000' },
]

// Two example themes. Brand text is solved against the card surface it sits on.
const THEMES = [
  { id: 'light', name: 'Light theme', page: '#F2F4F7', surface: '#FFFFFF', text: '#101828', textSec: '#475467', border: '#E4E7EC' },
  { id: 'dark', name: 'Dark theme', page: '#111827', surface: '#1F2A37', text: '#F9FAFB', textSec: '#C3CAD5', border: '#344054' },
]

const state = { brand: '#F5D90A', mode: 'solved' }

const $ = (id) => document.getElementById(id)
const els = {
  color: $('color'),
  hex: $('hex'),
  random: $('random'),
  presets: $('presets'),
  previews: $('previews'),
  strip: $('strip'),
  code: $('code'),
  modeNote: $('mode-note'),
  segmented: document.querySelectorAll('.segmented [data-mode]'),
}

/** Linear sRGB blend of `a` toward `b` by `t` (0–1). Demo-only helper. */
function mix(a, b, t) {
  const ra = parseHex(a)
  const rb = parseHex(b)
  return toHex(ra.map((v, i) => v + (rb[i] - v) * t))
}

function normalize(hex) {
  const rgb = parseHex(hex)
  return rgb ? toHex(rgb).toUpperCase() : null
}

const fmt = (r) => (r >= 10 ? r.toFixed(1) : r.toFixed(2))
const up = (hex) => hex.toUpperCase()

/** Every colour pair a theme preview paints, solved or naive. */
function pairsFor(theme, brand, mode) {
  const naive = mode === 'naive'
  const chipBg = mix(brand, theme.surface, theme.id === 'light' ? 0.86 : 0.78)
  const tint = mix(brand, theme.surface, theme.id === 'light' ? 0.9 : 0.84)

  const pick = (solved, raw) => (naive ? raw : solved)
  return {
    chipBg,
    tint,
    rows: [
      {
        key: 'link',
        label: 'Link text',
        fn: 'readableOn(brand, surface)',
        fg: pick(readableOn(brand, theme.surface, WCAG.AA_TEXT), brand),
        raw: brand,
        bg: theme.surface,
        target: WCAG.AA_TEXT,
      },
      {
        key: 'ink',
        label: 'Button label',
        fn: 'buttonInk(brand)',
        fg: pick(buttonInk(brand), WHITE),
        raw: WHITE,
        bg: brand,
        target: WCAG.AA_LARGE,
      },
      {
        key: 'chip',
        label: 'Chip text on tint',
        fn: 'readableOn(brand, chipBg)',
        fg: pick(readableOn(brand, chipBg, WCAG.AA_TEXT), brand),
        raw: brand,
        bg: chipBg,
        target: WCAG.AA_TEXT,
      },
      {
        key: 'callout',
        label: 'Heading on tinted panel',
        fn: 'readableOn(brand, tint)',
        fg: pick(readableOn(brand, tint, WCAG.AA_TEXT), brand),
        raw: brand,
        bg: tint,
        target: WCAG.AA_TEXT,
      },
      {
        key: 'indicator',
        label: 'Active tab indicator',
        fn: 'readableOn(brand, surface, 3)',
        fg: pick(readableOn(brand, theme.surface, WCAG.AA_LARGE), brand),
        raw: brand,
        bg: theme.surface,
        target: WCAG.AA_LARGE,
        nonText: true,
      },
    ],
  }
}

function badges(ratio, target) {
  const lvl = wcagLevel(ratio)
  const items = [
    { label: '3:1', ok: lvl.aaLarge, title: 'AA large text / UI components (3:1)', need: target === WCAG.AA_LARGE },
    { label: 'AA', ok: lvl.aa, title: 'AA normal text (4.5:1)', need: target === WCAG.AA_TEXT },
    { label: 'AAA', ok: lvl.aaa, title: 'AAA normal text (7:1)', need: false },
  ]
  return items
    .map((b) => `<span class="badge ${b.ok ? 'badge--ok' : 'badge--fail'}${b.need ? ' badge--need' : ''}" title="${b.title}${b.need ? ' — required here' : ''}: ${b.ok ? 'pass' : 'fail'}">${b.ok ? '✓' : '✕'} ${b.label}</span>`)
    .join('')
}

function renderPreview(theme) {
  const { brand, mode } = state
  const { rows, chipBg, tint } = pairsFor(theme, brand, mode)
  const c = Object.fromEntries(rows.map((r) => [r.key, r.fg]))

  const vars = [
    `--p-page:${theme.page}`,
    `--p-surface:${theme.surface}`,
    `--p-text:${theme.text}`,
    `--p-text-sec:${theme.textSec}`,
    `--p-border:${theme.border}`,
    `--p-fill:${brand}`,
    `--p-ink:${c.ink}`,
    `--p-link:${c.link}`,
    `--p-chip-bg:${chipBg}`,
    `--p-chip-text:${c.chip}`,
    `--p-tint:${tint}`,
    `--p-tint-text:${c.callout}`,
    `--p-indicator:${c.indicator}`,
  ].join(';')

  const tableRows = rows
    .map((r) => {
      const ratio = contrastRatio(r.fg, r.bg)
      const rawRatio = contrastRatio(r.raw, r.bg)
      const changed = mode === 'solved' && up(r.fg) !== up(r.raw)
      const passes = ratio >= r.target
      return `
        <tr class="${passes ? '' : 'is-failing'}">
          <th scope="row">
            <span class="row-label">${r.label}</span>
            <code class="row-fn">${mode === 'solved' ? r.fn : r.key === 'ink' ? '#FFFFFF' : 'brand'}</code>
          </th>
          <td>
            <span class="pair" aria-hidden="true">
              <span class="pair__chip" style="background:${r.bg};color:${r.fg}">${r.nonText ? '<i class="pair__bar" style="background:' + r.fg + '"></i>' : 'Aa'}</span>
            </span>
            <span class="hex">${up(r.fg)}</span>
            ${changed ? `<span class="was" title="Raw value would be ${up(r.raw)} at ${fmt(rawRatio)}:1">was ${fmt(rawRatio)}:1</span>` : ''}
          </td>
          <td class="contrast">
            <span class="ratio"><strong>${fmt(ratio)}</strong>:1</span>
            <span class="badges">${badges(ratio, r.target)}</span>
          </td>
        </tr>`
    })
    .join('')

  const failing = rows.filter((r) => contrastRatio(r.fg, r.bg) < r.target).length

  return `
    <article class="preview preview--${theme.id}" aria-label="${theme.name}">
      <header class="preview__head">
        <h2>${theme.name}</h2>
        <span class="status ${failing ? 'status--fail' : 'status--ok'}">${failing ? `${failing} failing` : 'All pairs pass'}</span>
      </header>

      <div class="stage" style="${vars}">
        <div class="mock">
          <div class="mock__tabs" role="presentation">
            <span class="mock__tab is-active">Overview</span>
            <span class="mock__tab">Bookings</span>
            <span class="mock__tab">Reports</span>
          </div>
          <div class="mock__body">
            <div class="mock__title-row">
              <h3 class="mock__title">Summer season</h3>
              <span class="mock__chip">Active</span>
            </div>
            <p class="mock__text">
              42 arrivals this week. <a href="#" class="mock__link" onclick="return false">View the full schedule</a>
              or adjust check-in times.
            </p>
            <div class="mock__callout">
              <strong>Tip</strong>
              <span>Brand-tinted panels keep their heading readable too.</span>
            </div>
            <div class="mock__actions">
              <button type="button" class="mock__btn" tabindex="-1">Create booking</button>
              <button type="button" class="mock__btn mock__btn--quiet" tabindex="-1">Cancel</button>
            </div>
          </div>
        </div>
      </div>

      <div class="table-wrap">
        <table class="pairs">
          <thead>
            <tr><th scope="col">Token</th><th scope="col">Colour</th><th scope="col">Contrast · WCAG</th></tr>
          </thead>
          <tbody>${tableRows}</tbody>
        </table>
      </div>
    </article>`
}

function renderStrip() {
  els.strip.innerHTML = PRESETS.map((p) => {
    const ink = buttonInk(p.hex)
    const ratio = contrastRatio(ink, p.hex)
    const white = contrastRatio(WHITE, p.hex)
    const active = up(p.hex) === up(state.brand)
    return `
      <button type="button" class="strip__item${active ? ' is-active' : ''}" data-hex="${p.hex}" aria-pressed="${active}">
        <span class="strip__btn" style="background:${p.hex};color:${ink}">${p.name}</span>
        <span class="strip__meta">
          <span>${up(ink) === WHITE ? 'White' : 'Tinted'} ${fmt(ratio)}:1</span>
          ${up(ink) === WHITE ? '' : `<span class="strip__white">white ${fmt(white)}:1</span>`}
        </span>
      </button>`
  }).join('')
}

function renderPresets() {
  els.presets.innerHTML = PRESETS.map((p) => {
    const active = up(p.hex) === up(state.brand)
    return `<button type="button" role="listitem" class="preset${active ? ' is-active' : ''}" data-hex="${p.hex}" style="--swatch:${p.hex}" aria-pressed="${active}" title="${p.name} ${p.hex}">
      <span class="preset__dot" aria-hidden="true"></span><span class="preset__name">${p.name}</span>
    </button>`
  }).join('')
}

function renderCode() {
  const [light, dark] = THEMES
  const t = brandTokens(state.brand, { lightSurface: light.surface, darkSurface: dark.surface })
  const q = (s) => `<span class="tok-str">'${s}'</span>`
  els.code.innerHTML = [
    `<span class="tok-kw">import</span> { brandTokens } <span class="tok-kw">from</span> ${q('brand-contrast')}`,
    '',
    `brandTokens(${q(state.brand)}, { lightSurface: ${q(light.surface)}, darkSurface: ${q(dark.surface)} })`,
    `<span class="tok-cm">// → {</span>`,
    `<span class="tok-cm">//     fill:        '${t.fill}',</span>`,
    `<span class="tok-cm">//     onFill:      '${t.onFill}',   ${fmt(contrastRatio(t.onFill, t.fill))}:1</span>`,
    `<span class="tok-cm">//     textOnLight: '${t.textOnLight}',   ${fmt(contrastRatio(t.textOnLight, light.surface))}:1</span>`,
    `<span class="tok-cm">//     textOnDark:  '${t.textOnDark}',   ${fmt(contrastRatio(t.textOnDark, dark.surface))}:1</span>`,
    `<span class="tok-cm">//   }</span>`,
  ].join('\n')
}

function render() {
  const { brand, mode } = state
  els.previews.innerHTML = THEMES.map(renderPreview).join('')
  renderPresets()
  renderStrip()
  renderCode()

  els.segmented.forEach((b) => b.setAttribute('aria-checked', String(b.dataset.mode === mode)))
  els.modeNote.textContent = mode === 'solved'
    ? 'Brand-coloured text is pushed just far enough to pass; colours that already pass are returned untouched.'
    : 'What you get by using the raw brand colour as text and hardcoding a white button label.'

  // The page chrome follows the chosen brand as well.
  const root = document.documentElement.style
  root.setProperty('--brand', brand)
  root.setProperty('--brand-ink', buttonInk(brand))
  root.setProperty('--brand-text-light', readableOn(brand, '#F7F8FA'))
  root.setProperty('--brand-text-dark', readableOn(brand, '#0C111D'))
}

function setBrand(hex, { fromField = false } = {}) {
  const n = normalize(hex)
  if (!n) return false
  state.brand = n
  els.color.value = n.toLowerCase()
  if (!fromField) els.hex.value = n
  els.hex.removeAttribute('aria-invalid')
  try {
    history.replaceState(null, '', '#' + n.slice(1).toLowerCase())
  } catch {
    /* ignore — e.g. sandboxed iframes */
  }
  render()
  return true
}

els.color.addEventListener('input', (e) => setBrand(e.target.value))
els.hex.addEventListener('input', (e) => {
  const v = e.target.value.trim()
  if (!setBrand(v.startsWith('#') ? v : '#' + v, { fromField: true })) els.hex.setAttribute('aria-invalid', 'true')
})
els.hex.addEventListener('blur', () => {
  els.hex.value = state.brand
  els.hex.removeAttribute('aria-invalid')
})
els.random.addEventListener('click', () => {
  setBrand(toHex([0, 0, 0].map(() => Math.floor(Math.random() * 256))))
})
document.addEventListener('click', (e) => {
  const target = e.target.closest('[data-hex]')
  if (target) setBrand(target.dataset.hex)
})
els.segmented.forEach((b) =>
  b.addEventListener('click', () => {
    state.mode = b.dataset.mode
    render()
  }),
)

setBrand(normalize(location.hash.slice(1)) || state.brand)
