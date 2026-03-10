# Home Screen Asset Inventory

## Scope
- Screen: `Home`
- Date captured: 2026-02-10
- Status: Locked UI baseline (inventory v2)

## Source of truth
- UI index: `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/prototypes/spec-ui-source-of-truth.md`
- Design decisions: `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/prototypes/design-decisions.md`
- Prototype: `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/prototypes/home.html`

## Asset summary
- External raster files (`.png`, `.jpg`, `.webp`): `0`
- Standalone SVG files: `19`
- External custom font files: `0` (system stack only)
- Required generated assets for Home: `0` (premium replacements already created)

## Design token assets

| Asset ID | Type | Value / Notes |
|---|---|---|
| `color.bg` | Color token | `#FFFFFF` |
| `color.surface` | Color token | `#F8F8F8` |
| `color.border` | Color token | `#E8E8E8` |
| `color.textPrimary` | Color token | `#1A1A1A` |
| `color.textSecondary` | Color token | `#8E8E93` |
| `color.textTertiary` | Color token | `#AEAEB2` |
| `color.calories` | Semantic token | `#FF9500` |
| `color.steps` | Semantic token | `#34C759` |
| `color.weight` | Semantic token | `#007AFF` |
| `color.workouts` | Semantic token | `#AF52DE` |
| `color.error` | Semantic token | `#FF3B30` |
| `radius.card` | Radius token | `16px` |
| `radius.input` | Radius token | `12px` |
| `radius.pill` | Radius token | `999px` |
| `font.stack` | Typography token | `-apple-system, BlinkMacSystemFont, SF Pro Display, SF Pro Text, Helvetica Neue, system-ui, sans-serif` |
| `frame.phone` | Layout token | `390x844` |
| `frame.statusBar` | Layout token | `54px` |
| `frame.tabBar` | Layout token | `83px` |

## Extracted SVG assets

### Icons (`/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/prototypes/assets/home/icons`)
- `status-cellular.svg`
- `status-wifi.svg`
- `status-battery.svg`
- `icon-add-circle.svg`
- `ring-calorie-180.svg`
- `ring-steps-40.svg`
- `sparkline-weight.svg`
- `icon-coach-chevron.svg`
- `chart-weekly-calories.svg`
- `icon-command-sparkle.svg`
- `icon-mic.svg`
- `icon-tab-home.svg`
- `icon-tab-workouts.svg`
- `icon-tab-settings.svg`
- `meal-salad.svg`
- `meal-oats.svg`
- `meal-salmon-rice.svg`

### Illustrations (`/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/prototypes/assets/home/illustrations`)
- `coach-badge-premium.svg` (used in Home card)
- `coach-illustration-card.svg` (available for future expanded Coach surfaces)

## Current Home integration
- `home.html` now uses:
  - `./assets/home/illustrations/coach-badge-premium.svg`
  - `./assets/home/icons/meal-salad.svg`
  - `./assets/home/icons/meal-oats.svg`
  - `./assets/home/icons/meal-salmon-rice.svg`
- Emoji meal thumbnails have been removed from Home.

## Motion assets

| Asset ID | Type | Definition |
|---|---|---|
| `motion.commandMicPulse` | Keyframe animation | `cc-pulse`, 2.5s, infinite, ease-in-out |

## Premium policy status (Home)
- Home satisfies current premium constraints:
  - No emoji meal thumbnails.
  - Coach visual is branded illustration asset.
  - Core icons are available as reusable standalone SVG files.

## Iteration notes (2026-02-10)
- Meal icon set was redesigned to a richer premium style (multi-tone, higher detail, consistent stroke language).
- `home.html` meal thumbnail icon size updated from `28px` to `32px` for better legibility.
- Image generation path was evaluated but is currently blocked in this environment because `OPENAI_API_KEY` is not set.
