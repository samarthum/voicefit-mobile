# Interaction Diagram Image Registry

- Last updated: 2026-02-10
- Purpose: single source of truth for rendered interaction/state diagram image paths used in specs and handoffs.

## Active rendered diagrams

| Diagram | Rendered PNG | Source MMD | Used by |
|---|---|---|---|
| Home data state | `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/prototypes/interaction-specs/diagrams/home-data-state.png` | `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/prototypes/interaction-specs/diagrams/home-data-state.mmd` | `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/prototypes/interaction-specs/home-interaction-spec.md` |
| Home interaction flowchart | `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/prototypes/interaction-specs/diagrams/home-interaction-flow.png` | `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/prototypes/interaction-specs/diagrams/home-interaction-flow.mmd` | `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/prototypes/interaction-specs/home-interaction-spec.md` |
| Command center panel states | `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/prototypes/interaction-specs/diagrams/command-center-panel-states.png` | `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/prototypes/interaction-specs/diagrams/command-center-panel-states.mmd` | `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/prototypes/interaction-specs/command-center-interaction-spec.md` |
| Command center typed + quick-add flow | `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/prototypes/interaction-specs/diagrams/command-center-typed-quickadd-flow.png` | `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/prototypes/interaction-specs/diagrams/command-center-typed-quickadd-flow.mmd` | `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/prototypes/interaction-specs/command-center-interaction-spec.md`, `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/prototypes/interaction-specs/home-interaction-spec.md` |
| Command center voice + interpret flow | `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/prototypes/interaction-specs/diagrams/command-center-voice-interpret-flow.png` | `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/prototypes/interaction-specs/diagrams/command-center-voice-interpret-flow.mmd` | `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/prototypes/interaction-specs/command-center-interaction-spec.md`, `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/prototypes/interaction-specs/home-interaction-spec.md` |
| Command center error + recovery | `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/prototypes/interaction-specs/diagrams/command-center-error-flow.png` | `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/prototypes/interaction-specs/diagrams/command-center-error-flow.mmd` | `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/prototypes/interaction-specs/command-center-interaction-spec.md`, `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/prototypes/interaction-specs/home-interaction-spec.md` |

## Alternate image formats (SVG)

| Diagram | SVG path |
|---|---|
| Home data state (older export) | `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/prototypes/interaction-specs/diagrams/home-data-state.svg` |
| Home interaction flowchart (older export) | `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/prototypes/interaction-specs/diagrams/home-interaction-flow.svg` |
| Command center voice state (older export) | `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/prototypes/interaction-specs/diagrams/command-center-voice-state.svg` |

## Legacy rendered diagrams (kept for history)

| Diagram | Rendered path | Source path |
|---|---|---|
| Command center combined input flow (older) | `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/prototypes/interaction-specs/diagrams/command-center-input-flow.png` | `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/prototypes/interaction-specs/diagrams/command-center-input-flow.mmd` |
| Command center primary flow (older) | `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/prototypes/interaction-specs/diagrams/command-center-primary-flow.png` | `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/prototypes/interaction-specs/diagrams/command-center-primary-flow.mmd` |
| Command center error recovery (older) | `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/prototypes/interaction-specs/diagrams/command-center-error-recovery.png` | `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/prototypes/interaction-specs/diagrams/command-center-error-recovery.mmd` |
| Command center voice state variants (older) | `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/prototypes/interaction-specs/diagrams/command-center-voice-state.png` | `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/prototypes/interaction-specs/diagrams/command-center-voice-state.mmd` |
| Command center voice state clean v1 (older) | `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/prototypes/interaction-specs/diagrams/command-center-voice-state-clean.png` | `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/prototypes/interaction-specs/diagrams/command-center-voice-state-clean.mmd` |
| Command center voice state clean v2 (older) | `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/prototypes/interaction-specs/diagrams/command-center-voice-state-clean2.png` | `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/prototypes/interaction-specs/diagrams/command-center-voice-state-clean2.mmd` |

## Regeneration command

```bash
npx -y @mermaid-js/mermaid-cli -i <absolute-path-to-diagram.mmd> -o <absolute-path-to-diagram.png> -w 2200 -H 900 --backgroundColor transparent --puppeteerConfigFile /Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/prototypes/interaction-specs/diagrams/puppeteer-config.json
```

## Implementation screenshot set (Home web run)

- Root folder: `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/output/playwright/home-states/`
- Capture script: `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/scripts/capture-home-states.mjs`
- Includes: full Home + Command Center state captures (`01` through `16`) mapped in:
  - `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/prototypes/interaction-specs/home-interaction-spec.md`
  - `/Users/samarth/Desktop/Work/voicefit-all/voicefit-mobile/prototypes/interaction-specs/command-center-interaction-spec.md`
