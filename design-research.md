# VoiceFit Mobile Design Research

## Goal
Research modern health/fitness app UI patterns and define a design system for VoiceFit mobile.
Target aesthetic: Cal AI — clean, minimal, bold numbers, lots of whitespace.

## References Studied
1. **Cal AI** (primary reference) — calorie tracker, very clean
2. **Dr. Cal (Dribbble)** — Cal AI-inspired concept by Reza Grafix
3. **Hevy** — workout tracking app (green accent, clean tables for sets)
4. **Oura Ring** — dark immersive dashboard (too dark for us, but good data viz patterns)
5. **Various Dribbble** — minimal health tracker app concepts

---

## Key Design Patterns Observed

### Cal AI Design Language
- **Pure white background** (#FFFFFF) — no gray cards on gray backgrounds
- **One accent color** — the circular progress ring is the only color pop
- **Massive bold numbers** — calorie count is the hero (40-48pt, bold)
- **Circular progress ring** — single ring for calories, smaller rings for macros
- **Thin, subtle separators** — no heavy borders or card shadows
- **Minimal color palette** — black text, gray secondary text, 1-2 accent colors
- **Day picker** — horizontal week strip at top (S M T W T F S with dates)
- **Recently uploaded** — food log with image thumbnail, name, calories, time
- **Bottom nav** — 3 tabs + floating FAB button (Home, Progress, Settings + center plus)
- **Very generous whitespace** — sections breathe, not cramped

### Typography Patterns (across all apps)
- Hero numbers: 36-48pt, bold/black weight
- Section titles: 18-20pt, bold
- Body/labels: 14-15pt, medium weight
- Captions/secondary: 12-13pt, regular, gray
- All apps use system font (SF Pro) or clean sans-serif

### Card/Layout Patterns
- Cal AI uses very subtle cards — thin 1px border or slight background tint, NOT heavy shadows
- Rounded corners: 16-20px for cards, 12px for smaller elements, 999 for pills
- Content sections separated by whitespace, not by heavy dividers
- Macro breakdown: 3 equal columns with individual circular progress rings
- Food log items: horizontal row with image, description, calories, time

### Color Approaches
- **Cal AI light mode**: White bg, black/dark gray text, orange/amber ring for calories
- **Cal AI dark mode**: Near-black bg (#1C1C1E), same accent colors
- **Hevy**: White bg, green accent (#4CAF50-ish), clean blue for links
- **Common**: One warm accent (orange/amber) for calories, green for steps/activity, blue for hydration

### Navigation
- 3-4 tabs maximum in bottom nav
- Some use floating action button (FAB) for primary action (log food)
- Tab icons are thin/outline style, filled when active

---

## Design System Proposal for VoiceFit

### Color Palette

#### Light Mode (Primary)
```
Background:        #FFFFFF (pure white)
Surface:           #F8F8F8 (very subtle gray for secondary surfaces)
Border:            #E8E8E8 (thin, subtle)

Text Primary:      #1A1A1A (near-black)
Text Secondary:    #8E8E93 (iOS system gray)
Text Tertiary:     #AEAEB2 (lighter gray for hints)

Accent - Calories: #FF9500 (warm amber/orange — iOS system orange)
Accent - Steps:    #34C759 (green — iOS system green)
Accent - Weight:   #007AFF (blue — iOS system blue)
Accent - Workouts: #AF52DE (purple — iOS system purple)

Error:             #FF3B30 (iOS system red)
Success:           #34C759 (same as steps green)

Tab Active:        #1A1A1A (black)
Tab Inactive:      #8E8E93 (gray)
```

### Typography Scale (SF Pro / System Default)
```
Display:     34pt  Bold    — Hero numbers (calorie count)
Title 1:     28pt  Bold    — Page titles
Title 2:     22pt  Bold    — Section headings
Title 3:     20pt  Semibold — Card titles
Headline:    17pt  Semibold — Emphasized labels
Body:        17pt  Regular  — Default text
Callout:     16pt  Regular  — Secondary body
Subhead:     15pt  Regular  — Supporting text
Footnote:    13pt  Regular  — Timestamps, hints
Caption 1:   12pt  Regular  — Labels on small elements
Caption 2:   11pt  Regular  — Smallest text
```

### Spacing Scale (4pt grid)
```
xs:    4px
sm:    8px
md:    12px
lg:    16px
xl:    20px
2xl:   24px
3xl:   32px
4xl:   40px
5xl:   48px
```

### Border Radii
```
sm:    8px   — small buttons, inputs
md:    12px  — chips, small cards
lg:    16px  — cards, sheets
xl:    20px  — large cards, bottom sheet
pill:  999px — pills, progress indicators
```

### Component Patterns

#### Cards
- Background: #FFFFFF (on #F8F8F8 surface) or #F8F8F8 (on white)
- Border: 1px solid #E8E8E8 (subtle, not heavy)
- No shadows (flat, clean)
- Border radius: 16px
- Padding: 16px
- Gap between cards: 12-16px

#### Circular Progress Ring
- Main ring: 120px diameter, 8px stroke width
- Mini rings: 48px diameter, 4px stroke width
- Track color: #F0F0F0
- Ring color: accent color for that metric
- Number centered inside ring

#### Bottom Tab Bar
- 4 tabs: Home, Log, Workouts, Settings
- Icons: SF Symbols style (outline inactive, filled active)
- Active color: #1A1A1A
- Inactive color: #8E8E93
- No labels (icon only) OR tiny 10pt labels
- Height: 49pt (iOS standard)

#### Buttons
- Primary: #1A1A1A background, white text, 12px radius, 48px height
- Secondary: #F8F8F8 background, #1A1A1A text, 12px radius
- Destructive: #FF3B30 text, no background
- Disabled: 0.4 opacity

#### Inputs
- 48px height
- 12px border radius
- 1px #E8E8E8 border
- 16px horizontal padding
- Placeholder: #AEAEB2
- Focus: 1px #1A1A1A border

#### List Rows
- No card wrapping — just horizontal rows with subtle bottom divider
- 44pt minimum tap target
- Chevron (>) for navigation items

### Screen Layout Template
```
SafeAreaView (white bg)
├─ ScrollView (vertical, padding-horizontal: 20px)
│  ├─ [Header area - title, date picker]
│  ├─ [Hero metric - big number + ring]
│  ├─ [Secondary metrics - 2-3 col grid]
│  ├─ [Section title + "See all" link]
│  ├─ [Content list/cards]
│  └─ [Bottom spacing: 100px for tab bar]
└─ Tab Bar
```

### What Makes This Different From Current
1. **White bg instead of gray** — current uses #F9FAFB cards on #FFFFFF, creating muddy contrast
2. **Bold hero numbers** — current numbers are 14pt, should be 34pt for the primary metric
3. **Circular progress rings** — instead of flat progress bars
4. **iOS system colors** — instead of arbitrary Tailwind palette colors
5. **Much more whitespace** — sections breathe
6. **Consistent typography scale** — instead of ad-hoc font sizes
7. **Subtle borders** — instead of heavy card backgrounds
8. **Tab icons** — instead of text-only tabs

---

## Implementation Plan

### Phase 1: Theme Foundation
1. Create `lib/theme.ts` with all tokens (colors, typography, spacing, radii)
2. Create shared component primitives: Card, ProgressRing, MetricDisplay, SectionHeader, Button
3. Update `_layout.tsx` tab bar with icons and proper styling

### Phase 2: Screen Refactors (one at a time)
1. Dashboard (Home) — hero calorie ring, metric grid, recent meals, activity
2. Log — clean voice/text input with prominent mic button
3. Workouts — session list with clean cards
4. Settings — clean form layout
5. Hidden screens (coach, meals, feed) — consistent with new system

### Phase 3: Polish
1. Micro-animations (ring fill animation, card press feedback)
2. Pull-to-refresh with branded animation
3. Empty states with illustrations/icons
4. Loading skeletons instead of ActivityIndicator
