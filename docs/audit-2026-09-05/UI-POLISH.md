# UI polish — September 5

Focused mobile-only follow-up; backend and interpretation behavior unchanged.

- Corrected iOS logging dock clearance: the old 83pt height included a safe-area allowance that was added again. Now use 49pt content + actual safe area + 8pt gap. Android clearance unchanged.
- Added touch feedback and a plain-language accessibility label to the shared logging bar.
- Fixed the blank workout header menu by providing an explicit, non-collapsing action container. Screenshot verified the ellipsis is visible; native header interaction remains unverified because coordinate automation reports noWindowsAvailable and AX omits the header.
- Expanded workout menu and new-session touch targets to 44pt; added new-session accessibility semantics.
- Replaced the generic meal empty state with date-aware copy and a first-meal action only for today. Historical dates do not offer an action that would inadvertently log for today.
- Simplified logging hints and workout empty-state instructions.

Validation: TypeScript and whitespace checks pass; all 77 existing tests pass. Signed-in iOS dashboard and completed workout visually inspected before/after. Dashboard accessibility exposes the new empty-state action. Logging-bar press was issued, but further screenshot verification became unavailable through the computer-use service. No test records created. Active-session header, Android visuals, smaller screens and physical-device checks remain outstanding.
