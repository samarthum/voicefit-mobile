# VoiceFit Mobile — Design Decisions Log

## Design System

### Color Palette (Cal AI-inspired, iOS system colors)
- **Background:** #FFFFFF (pure white)
- **Surface:** #F8F8F8 (light gray cards)
- **Border:** #E8E8E8
- **Text Primary:** #1A1A1A (near-black)
- **Text Secondary:** #8E8E93 (iOS system gray)
- **Text Tertiary:** #AEAEB2 (light gray)
- **Calories:** #FF9500 (orange)
- **Steps:** #34C759 (green)
- **Weight:** #007AFF (blue)
- **Workouts:** #AF52DE (purple)
- **Error/Danger:** #FF3B30 (red)

### Typography
- Font: -apple-system / SF Pro Display / system-ui
- Page titles: 28px bold, -0.5px tracking
- Section titles: 20px bold, -0.3px tracking
- Body: 16px
- Labels: 13px semibold uppercase, 0.5px tracking
- Small: 12px

### Components
- Border radius: 16px (cards), 12px (inputs), 999px (pills/avatars)
- Phone frame: 390x844px (iPhone 14 Pro)
- Status bar: 54px
- Tab bar: 83px
- Command center: floats above tab bar at bottom: 83px

---

## Navigation (decided Feb 7, 2026)

### 3-Tab Layout
- **Home** — Dashboard with calorie ring, steps, weight, weekly trends, recent meals
- **Workouts** — Session list + create
- **Settings** — Goals, profile, integrations

### Command Center (persistent, all screens)
- Floating bar above tab bar: sparkle icon + hint text + mic button
- Tap to expand: bottom sheet overlay with textarea, quick action pills, large mic, send, quick add
- Replaces old dedicated "Log" tab
- Voice-first philosophy: always accessible from any screen

**Rationale:** VoiceFit is voice-first. The command center makes logging available everywhere without needing a separate tab. Reduces tabs from 7 (original) to 3.

### Command Center Interpreting + Error UX (updated Feb 11, 2026)
- Typed meal/workout path is: type -> interpret -> review -> save.
- Voice meal/workout path is: record -> interpreting (with editable transcript) -> review -> save.
- Non-meal/workout intents (steps, weight, question) can skip review and save directly.
- `cc_interpreting_voice` controls are fixed to: `Edit text`, `Retry voice`, `Discard`.
- Editing transcript during interpreting restarts interpretation immediately.
- Error copy/CTA are locked by subtype:
  - `typed_interpret_failure`: "Couldn't understand that entry" -> `Retry typed`, `Edit text`, `Discard`
  - `voice_interpret_failure`: "Couldn't understand your recording" -> `Retry voice`, `Edit text`, `Discard`
  - `mic_permission_denied`: "Microphone access is off" -> `Open Settings`, `Use typing instead`, `Discard`
  - `auto_save_failure`: "Couldn't save right now" -> `Retry save`, `Discard`
  - `quick_add_failure`: "Couldn't add that item" -> `Retry save`, `Discard`
- Canonical state/transition source: `prototypes/interaction-specs/command-center-interaction-spec.md`

---

## Home Screen (decided Feb 7, 2026)

### Layout (top to bottom)
1. Header: "VoiceFit" + add button
2. Day picker (7 days ending today, dots for logged days, no future dates)
3. Hero calorie ring (180px, orange, shows calories remaining)
4. Steps (mini progress ring) + Weight (delta indicator, no ring) metric cards side by side
5. Ask Coach card (black circle + white sparkle icon)
6. Weekly Trends (Calories/Steps/Weight tabs, line chart)
7. Recent Meals (3 most recent)

### Weekly Trends Chart
- **Line chart** (not bar chart) — more elegant
- Rolling 7 completed days (not calendar week) — avoids empty charts early in week
- SVG polyline with gradient fill underneath
- Dashed horizontal target/goal line
- Day labels inside SVG for perfect alignment
- Shows average + % change vs prior 7 days
- Matches web app's `getLastNDays(8, timezone)` logic

### Day Picker (updated Feb 8, 2026)
- **7 days ending on today** — no future dates shown. Future dates are meaningless (no data to display), and showing them implies you can log forward.
- **Today (active):** Black filled pill, white text — strongest visual emphasis, matches Cal AI's pattern.
- **Past dates with data logged:** Normal weight (600) dark text + small dot indicator below the number. The dot signals "you logged something this day."
- **Past dates without data:** Light gray text (font-weight 400, color #C7C7CC), no dot. Clearly "empty" at a glance — creates gentle nudge to log consistently.
- **Day labels (S, M, T...):** 12px uppercase, tertiary color — subordinate to the date numbers.
- Research: Cal AI uses green outline rings for logged days + black fill for today + faded gray for future. VoiceFit simplifies to dots instead of rings (cleaner, less visual noise).

### Weight Card (updated Feb 8, 2026)
- **No progress ring** — rings represent completion toward a daily target (calories eaten, steps walked). Weight doesn't work that way; it's a directional/trend metric, not a daily "fill up" metric.
- **Delta indicator instead** — green down-arrow + "-0.8" shows weekly change direction. Green = moving toward goal, red = moving away.
- Research: MFP uses mini line charts, Fitbit uses line chart + delta text, Apple Health shows number + "Trending higher/lower for X weeks", Happy Scale uses moving average trend lines. Nobody uses a ring for weight.
- Card layout: WEIGHT label (top-left) + delta badge (top-right) + big number + "goal: X kg" subtitle

### Ask Coach Card (updated Feb 8, 2026)
- **Black circle + white 4-pointed sparkle** — replaced purple-to-blue gradient chat bubble icon
- The 4-pointed sparkle is the universal "AI" symbol (used by Google Gemini, Apple Intelligence, ChatGPT). More recognizable and premium than a chat bubble.
- Black monochrome circle matches the design system's primary color. No gradient needed — cleaner.
- Research: Oura Advisor, Whoop Coach, and most modern AI features use sparkle/star iconography, not chat bubbles.

### Premium Asset Policy (updated Feb 10, 2026)
- **Meal thumbnails must not use emoji glyphs** in locked prototypes or implementation.
- Home now uses custom meal SVGs: `meal-salad.svg`, `meal-oats.svg`, `meal-salmon-rice.svg`.
- Coach card now uses branded coach badge illustration asset: `coach-badge-premium.svg`.
- Home inline SVGs have been extracted to standalone reusable assets under:
  - `prototypes/assets/home/icons/`
  - `prototypes/assets/home/illustrations/`
- This premium asset policy is mandatory (not optional) for Home and should be the baseline for future locked screens.

---

## Workout Session Detail (decided Feb 7, 2026)

### Research Sources
- Hevy, Strong, JEFIT, Fitbod — analyzed UI patterns
- Hevy/Strong are the gold standard for workout logging UX

### Session Header
- Back arrow (left)
- Session title (center, editable inline)
- "Finish" pill button (right, green when active)
- Below header: running timer + total volume + total sets counters

### Empty State
- Illustration or simple icon
- "Start by adding an exercise" message
- Primary "+ Add Exercise" button
- Secondary: "or use voice" prompt linking to command center
- **Voice-first twist:** the command center is still visible, so users can speak "bench press 3 sets of 10 at 80kg" directly

### Exercise Cards (Hevy/Strong pattern)
- Exercise name (bold, left) + overflow menu (right, 3 dots)
- Exercise type badge: "Barbell" / "Dumbbell" / "Machine" / "Bodyweight" / "Cardio"
- **Set Table** (the core UI primitive):
  - Columns: SET | PREVIOUS | KG | REPS | checkmark
  - SET column: set number, tappable to change type (Normal/Warm-up/Drop/Failure)
  - PREVIOUS: muted gray text showing last session's data (e.g. "80 x 8")
  - KG: weight input field
  - REPS: reps input field
  - Checkmark: tap to complete set (green fill when done)
- "+ Add Set" row below the table
- Rest timer info per exercise (optional)

### Set Row States
- **Empty/current:** white background, editable inputs
- **Completed:** subtle green tint (#34C75910), green checkmark
- **Warm-up:** "W" badge on set number, lighter styling

### Add Exercise Flow
- "+ Add Exercise" button at bottom of all exercises
- Opens full-screen exercise picker (see below)
- Also available via voice command center

### Key Decisions
- Followed Hevy/Strong 5-column set table (industry standard)
- PREVIOUS column included — critical for progressive overload
- Checkmark completes set (single tap, no confirm)
- No rest timer in prototype (future feature)
- Command center visible on session screen for voice logging
- Session can be ended (sets endedAt) or left active

### Data Model Alignment
- WorkoutSession: id, title, startedAt, endedAt (null = active)
- WorkoutSet: exerciseName, exerciseType, reps, weightKg, durationMinutes, notes
- Sets grouped by exerciseName for display (multiple sets per exercise)

---

## Exercise Picker (decided Feb 7, 2026)

### Research Sources
- Hevy (filter chips + recent exercises + animated thumbnails)
- Strong (fuzzy search, flat alphabetical list)
- Fitbod (body part tabs), JEFIT (granular muscle groups)
- Hevy's approach is the most feature-rich; Strong's is the cleanest

### Layout (top to bottom)
1. Header: X (close) + "Add Exercise" title + "Create" link (blue)
2. Search bar (44px tall, gray surface background, magnifying glass icon)
3. Horizontal scrollable filter chips: All | Chest | Back | Shoulders | Legs | Arms | Core | Compound
4. Scrollable exercise list with sticky section headers

### Sections
- **Recent** — Last 3 used exercises with green "X days ago" timestamp
- **Chest / Back / Shoulders / Legs / Arms / Core / Compound** — Grouped by muscle group, matching exercises.ts categories

### Exercise Row
- **Icon** (42x42px, rounded 10px): Color-coded by muscle group
  - Chest: red tint (#FF3B30 at 8% opacity)
  - Back: blue tint (#007AFF at 8%)
  - Shoulders: purple tint (#AF52DE at 8%)
  - Legs: green tint (#34C759 at 8%)
  - Arms: orange tint (#FF9500 at 8%)
  - Core: yellow tint (#FFCC00 at 8%)
  - Compound: indigo tint (#5856D6 at 8%)
- **Exercise name** (16px semibold)
- **Meta line**: Equipment tag (11px uppercase pill, e.g. "BARBELL") + muscle group text
- **+ button** (28px circle) on right side
- Min row height: 56px for easy mid-workout tapping

### Filter Chips
- Horizontal scroll, no wrapping
- Active chip: black fill + white text
- Inactive: transparent + gray border + gray text
- Padding: 7px 16px, border-radius: 999px

### Key Decisions
- **Hevy-inspired approach** (filter chips + grouped list) rather than Strong's flat alphabetical
- **Single-select** (tap to add) — simpler than Hevy's multi-select checkboxes
- **Color-coded icons** per muscle group for quick visual scanning
- **Equipment tags** (BARBELL, DUMBBELL, CABLE, MACHINE, BODYWEIGHT, KETTLEBELL) as small uppercase pills
- **Recent section** at top for quick re-selection (most common workflow)
- **"Create" option** in header for custom exercises (future feature)
- **Voice hint** at bottom of list — reinforces voice-first identity
- **No exercise thumbnails/GIFs** — keeps it clean, fast, and avoids asset management
- Exercise library sourced from `voicefit/lib/exercises.ts` (63 exercises, 7 categories)
- **Floating voice bar** at bottom of picker (always visible) — mic accessible even on full-screen modal

---

## Authentication Screens (decided Feb 7, 2026)

### Research Sources
- Strava (clean white, email+password, social buttons below)
- Cal AI (minimal, white, social-first)
- Modern iOS patterns (social-first with Apple/Google prominent)
- Muzli "60+ Login screen designs" collection

### Design Philosophy
- **Social-first**: Google and Apple buttons are primary actions (top of screen)
- **Email as secondary**: "or continue with email" below social buttons
- **Single unified screen**: Sign-in and sign-up share the same initial screen (social auth handles both)
- **Voice-first brand touch**: Subtle mic icon or waveform in the logo/branding area
- **Minimal friction**: No password fields on initial screen — social login is one-tap

### Welcome / Sign-In Screen Layout (top to bottom)
1. **Brand area** (top 40%): App name "VoiceFit" in large bold type, subtle tagline "Track with your voice", small mic waveform decoration
2. **Social buttons** (stacked, full-width):
   - "Continue with Apple" — black fill, white text, Apple icon (iOS standard)
   - "Continue with Google" — white fill, gray border, Google "G" icon
3. **Divider**: "or" with horizontal lines
4. **Email option**: "Continue with email" — outlined button or text link
5. **Terms**: Small text "By continuing, you agree to Terms & Privacy Policy"
6. **Bottom toggle**: "Already have an account? Sign in" / "Don't have an account? Sign up"

### Sign-In with Email Screen
- Back arrow to return to welcome
- "Welcome back" title
- Email input field (gray surface bg, 12px radius)
- Password input field with show/hide toggle
- "Forgot password?" link (right-aligned, blue)
- "Sign In" primary button (black fill, full-width)
- Error message area (red text)

### Sign-Up with Email Screen
- Back arrow to return to welcome
- "Create account" title
- Full name input
- Email input
- Password input with show/hide toggle
- Password requirements hint (8+ chars)
- "Create Account" primary button (black fill, full-width)
- Error message area

### Key Decisions
- **Social-first pattern** — reduces friction, most users prefer Google/Apple sign-in
- **No Facebook** — declining usage, Apple + Google covers 95%+ of users
- **Black primary buttons** — consistent with rest of app design system
- **White background** — consistent Cal AI-inspired theme
- **Brand moment**: The welcome screen is the first impression; large "VoiceFit" wordmark with mic motif
- **Clerk handles both sign-in and sign-up** — social auth creates account automatically
- **Email flow is secondary** — visible but not the default path
- **Password field only on email screens** — social login skips password entirely

---

## Voice Flow States (decided Feb 7, 2026)

### Research Sources
- Voice memo apps (iOS Voice Memos, Otter.ai)
- ChatGPT voice mode (pulsing orb, live transcription)
- Google Assistant (waveform + transcript overlay)
- Shazam (pulsing animation while listening)

### Design Philosophy
- **Bottom sheet pattern** — all voice states appear as bottom sheets over dimmed/blurred background
- **Consistent structure** — transcript bubble → confidence → content card → action buttons
- **Minimal chrome** — focus on the content, reduce cognitive load
- **Joy through animation** — pulsing mic, animated waveform, blinking cursor make recording feel alive

### Recording State (voice-recording.html)
1. **Overlay**: Dimmed background (0.4 opacity) + 2px blur
2. **Bottom sheet** with:
   - **Header**: Red blinking rec-dot + timer (0:04) | "Listening" title | X close
   - **Live transcript**: 20px centered text with blinking cursor animation
   - **Waveform**: 20 animated bars with staggered delays (0-0.95s), scaleY oscillation
   - **Stop button**: 80px red circle with white square stop icon, dual pulse rings
   - **Label**: "Tap to stop" below button

### Review State — Shared Elements
Both meal and workout review share:
- **Transcript bubble**: Gray surface bg, "YOU SAID" uppercase label, transcript text, blue "Edit" button (top-right)
- **Confidence badge**: Green dot + "High confidence" text in green-tinted pill
- **Action buttons**: Discard (outlined, flex:1) + Save (black fill, flex:2, with checkmark icon)
- **Bottom sheet**: 28px top border-radius, sheet handle, max-height 85%, scrollable

### Review Meal (voice-review-meal.html)
- **Meal card** with:
  - Header: meal description (bold) + meal type badge (orange, e.g. "LUNCH")
  - Hero calorie number: 48px, orange (#FF9500), centered
  - Macro row: 3 equal columns (Protein/Carbs/Fat) in gray surface pills
  - **Ingredients breakdown** (Cal AI / MacroFactor "AI Plate" inspired):
    - Section header: "INGREDIENTS" uppercase label (left) + "+ Add Item" blue link (right)
    - Each row: ingredient name (15px semibold) + editable quantity pill (e.g. "150g" in rounded surface chip) + per-ingredient calories (orange) + chevron for edit
    - Rows separated by subtle 1px divider
    - Hero total calories at top remain the sum; ingredients show the per-item breakdown
  - Time selector: "Eaten at" + time value with chevron
- CTA: "Save Meal"

### Review Workout (voice-review-workout.html)
- **Exercise card** with:
  - Header: exercise name (bold) + type badge (purple, e.g. "BARBELL")
  - Set table: 4-column grid (SET | KG | REPS | NOTES)
  - Editable input fields for KG, REPS, NOTES per row
  - "+ Add Set" link below table
- **Session selector**: "Add to session" + session name with chevron
- CTA: "Save Sets"

### Key Decisions
- **Bottom sheet over full-screen** — maintains context, user can see their previous screen behind the blur
- **Transcript always shown** — builds trust, user can verify what the AI "heard"
- **Edit button on transcript** — allows correction before re-interpretation
- **Confidence badge** — signals AI reliability (green = high, yellow = medium, red = low)
- **Editable fields** — user can tweak any value before saving (weight, reps, calories, macros)
- **Discard is low-emphasis** — secondary action to prevent accidental data loss
- **Save is high-emphasis** — 2:1 flex ratio, checkmark icon, black fill
- **Waveform animation** — pure CSS (no JS), 20 bars with staggered delays for organic feel
- **Red recording button** — universal "recording" color, matches iOS conventions
- **Dual pulse rings** on mic — subtle glow effect that says "I'm listening"
- **No "processing/thinking" state shown** — in production this would be a brief spinner between recording stop and review sheet appearing

---

## Coach Chat Screen (decided Feb 8, 2026)

### Research Sources
- ChatGPT app (conversation UI, bubble alignment, follow-up suggestions)
- Apple Health summaries (structured highlights format)
- Cal AI coach (headline + bullet insights pattern)
- Whoop AI coach (read-only health Q&A)

### Design Philosophy
- **Read-only assistant** — coach can only read logged data, never create/modify entries
- **Structured responses** — headline + dash-prefixed highlights, not freeform paragraphs
- **Purple identity** — matches the Ask Coach card gradient (#AF52DE) from Home screen
- **Ephemeral chat** — no history persistence across sessions; fresh conversation each time

### Layout (top to bottom)
1. **Header**: Back arrow (left) + "Coach" title (center) + subtitle "Read-only insights from your logs"
2. **Starter prompt chips**: Horizontal-scrolling pills ("Summarize my last 7 days", "How are my calories trending?", "Weight changes this week?", "Workout consistency?")
3. **Message area**: Alternating user/assistant bubbles with realistic sample conversation
4. **Composer**: Text input + send button (no command center — redundant on chat screen)
5. **Tab bar**: Same as all other screens

### Message Bubbles
- **User bubble**: bg #1A1A1A, white text, right-aligned, border-radius 16px 4px 16px 16px (sharp top-right for speech tail), max-width 80%
- **Assistant bubble**: bg #F8F8F8, left-aligned, border-left 2px solid #AF52DE (purple accent), border-radius 4px 16px 16px 16px (sharp top-left), max-width 90%
- **Gap between different senders**: 16px; **same sender consecutive**: 4px
- **Sender labels**: 11px uppercase, text-tertiary for "You", purple for "Coach"

### Assistant Response Format
- **Sparkle icon** (16px, purple) + "COACH" label as header row
- **Natural text**: 15px, normal weight, conversational paragraphs — NOT structured headline + bullet points
- LLM responds in free-form text/markdown, like a real coach talking to you
- **Follow-up prompts** (optional): Small blue pills below the message for suggested next questions

### Starter & Follow-up Prompts
- **Starter chips**: Surface bg, border, rounded pill, 13px, text-secondary, horizontal scroll
- **Follow-up chips**: White bg, border, rounded pill, 12px, blue text (#007AFF), below assistant message
- Same 4 starter prompts as web implementation for consistency

### Key Decisions
- **Full-screen pushed view** (not a tab) — back arrow returns to Home; no tab is active in the tab bar
- **Purple accent** for coach identity — matches the gradient from Home's Ask Coach card
- **Natural conversational text** — no rigid headline + bullet format; LLM responds like a real coach, free-form paragraphs
- **Follow-up prompts** after assistant messages — encourages continued conversation without requiring the user to think of questions
- **No command center on coach screen** — redundant since user is chatting with the LLM, not logging food/workouts
- **Ephemeral chat** — no history persistence; fresh start each session keeps it simple
- **Subtitle says "Insights from your logs"** — simple, not redundant
- **Starter prompts scroll horizontally** — same 4 as web implementation for parity
- **No typing indicator shown** — in production, a pulsing dots animation would appear while waiting for LLM response
- **Tab bar shows no active tab** — this is a pushed screen from Home, not a tab destination
