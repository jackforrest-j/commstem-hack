# Style Guide — DataSci × ComStem Platform

Design language: data-dense, terminal-precise, zero decoration. Think Bloomberg Terminal meets Palantir Foundry. Every pixel earns its place.

---

## Principles

1. **Data is the hero.** UI chrome exists only to organise information, never to impress.
2. **Borders over shadows.** Depth is communicated with 1px lines, not glows.
3. **Monospace for numbers.** All numeric data renders in a monospace stack so columns align and deltas read instantly.
4. **Muted palette, single accent.** One blue for interactive elements. Semantic colours (green/red/amber) reserved for status only.
5. **Density by default.** Tight padding, small font sizes, compact rows. Users are analysts — they want more data on screen, not more whitespace.

---

## Colour Tokens

Defined as CSS custom properties in `index.css`.

| Token               | Value     | Usage                                 |
|---------------------|-----------|---------------------------------------|
| `--bg-base`         | `#080d14` | Page background                       |
| `--bg-surface`      | `#0f1623` | Card / panel background               |
| `--bg-elevated`     | `#17202e` | Hover states, nested panels           |
| `--bg-input`        | `#0d1420` | Form inputs, search bars              |
| `--border`          | `#1c2b3a` | All borders, dividers                 |
| `--border-subtle`   | `#141e2b` | Low-emphasis separators               |
| `--text-primary`    | `#dce6f0` | Body text, headings                   |
| `--text-secondary`  | `#7a9bb5` | Labels, subtitles, helper text        |
| `--text-muted`      | `#3d5268` | Placeholders, disabled                |
| `--accent`          | `#3b82f6` | Links, active states, focus rings     |
| `--accent-dim`      | `#1d4ed840`| Accent backgrounds (badges, hover)   |
| `--green`           | `#10b981` | Positive delta, success status        |
| `--red`             | `#f43f5e` | Negative delta, error status          |
| `--amber`           | `#f59e0b` | Warning, neutral-change status        |
| `--chart-1`         | `#3b82f6` | Primary chart series                  |
| `--chart-2`         | `#10b981` | Secondary chart series                |
| `--chart-3`         | `#f59e0b` | Tertiary chart series                 |

---

## Typography

```css
/* UI labels, body */
font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;

/* All numeric data, code, IDs */
font-family: 'Cascadia Code', 'Fira Code', 'Consolas', 'Courier New', monospace;
```

| Role              | Size    | Weight | Colour            |
|-------------------|---------|--------|-------------------|
| Page title        | 16px    | 600    | `--text-primary`  |
| Section heading   | 12px    | 600    | `--text-secondary`|
| Body / cell       | 12px    | 400    | `--text-primary`  |
| Label / caption   | 11px    | 400    | `--text-secondary`|
| Numeric (mono)    | 13px    | 500    | `--text-primary`  |
| Stat figure       | 22px    | 700    | `--text-primary`  |

Letter-spacing: `0.04em` on section headings (uppercase, tracked).

---

## Spacing Scale

| Token   | Value  | Use                               |
|---------|--------|-----------------------------------|
| `--s1`  | 4px    | Icon padding, tight gutters       |
| `--s2`  | 8px    | Cell padding, small gaps          |
| `--s3`  | 12px   | Component padding (default)       |
| `--s4`  | 16px   | Card padding, section gaps        |
| `--s5`  | 24px   | Panel gaps                        |
| `--s6`  | 32px   | Page-level margins                |

---

## Layout

- Page uses a **12-column CSS grid** at 1280px max-width.
- Panels use a **2px border-radius** — barely rounded, not bubbly.
- Top navbar height: **48px**.
- Stat card row: 4-up on ≥1024px, 2-up on tablet, 1-up on mobile.
- Chart area: minimum 280px height.

---

## Components

### Stat Card
- 1px border (`--border`), `--bg-surface` background
- Figure in monospace, large (22px 700)
- Delta badge: green/red/amber background + matching text
- Label in 11px uppercase tracked secondary text

### Panel / Chart Container
- 1px border, `--bg-surface` background
- Section header: 12px uppercase 600, `--text-secondary`, `--border-subtle` bottom divider
- Chart tooltip: `--bg-elevated` background, `--border` border, 11px text

### Data Table
- Row height: 36px
- Header: 11px uppercase tracked, `--text-muted`
- Alternating rows: base + subtle tint (`--bg-elevated` at 40% on odd)
- Hover row: `--bg-elevated`
- Numeric columns: right-aligned, monospace
- Status badges: 2px radius, 10px uppercase

### Navbar
- `--bg-surface` background, `--border` bottom border
- App name: monospace 14px 600
- Nav links: 12px, `--text-secondary` default, `--text-primary` on active/hover
- Right side: user email (truncated) + sign out

---

## Chart Conventions

- **No chart titles** — panels have their own header
- Grid lines: `--border-subtle`, dashed
- Axes: `--text-muted`, 10px
- Tooltips: always show raw value + formatted delta
- Dot/point size: 3px
- Line stroke width: 2px
- Area fill: chart colour at 15% opacity

---

## What Not To Do

- No box-shadows (use borders)
- No border-radius > 4px
- No gradients on backgrounds
- No animations except `transition: background 120ms` on hover
- No font sizes above 20px in data panels
- No bright colours outside the semantic palette
- No icons without text labels in nav
