---
name: EaveHQ
description: Field service command center for roofline lighting contractors.
colors:
  pacific-douglas-fir: "#3a6349"
  old-growth-canopy: "#1f3d2c"
  ember-copper: "#d96f0a"
  morning-limestone: "#f5f2ed"
  clean-slate: "#ffffff"
  worn-edge: "#dedad4"
  night-work: "#1a1a1a"
  overcast: "#5a6070"
  go-signal: "#3d9e6a"
  warning-amber: "#c47a1a"
  stop-sign: "#c94040"
typography:
  display:
    fontFamily: "'Syne', sans-serif"
    fontWeight: 700
    fontSize: "1.5rem"
    lineHeight: 1.15
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "'Syne', sans-serif"
    fontWeight: 600
    fontSize: "1.125rem"
    lineHeight: 1.25
    letterSpacing: "-0.01em"
  body:
    fontFamily: "'DM Sans', sans-serif"
    fontWeight: 400
    fontSize: "0.9375rem"
    lineHeight: 1.55
  label:
    fontFamily: "'DM Sans', sans-serif"
    fontWeight: 600
    fontSize: "0.75rem"
    lineHeight: 1.3
    letterSpacing: "0.01em"
  mono:
    fontFamily: "'Geist Mono', monospace"
    fontWeight: 400
    fontSize: "0.875rem"
    lineHeight: 1.4
rounded:
  sm: "4px"
  md: "6px"
  lg: "10px"
  xl: "16px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  2xl: "48px"
components:
  button-primary:
    backgroundColor: "{colors.ember-copper}"
    textColor: "#ffffff"
    rounded: "{rounded.md}"
    padding: "10px 20px"
  button-primary-hover:
    backgroundColor: "#b85d08"
    textColor: "#ffffff"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.overcast}"
    rounded: "{rounded.md}"
    padding: "10px 20px"
  button-ghost-hover:
    backgroundColor: "{colors.morning-limestone}"
    textColor: "{colors.night-work}"
  input-default:
    backgroundColor: "{colors.clean-slate}"
    textColor: "{colors.night-work}"
    rounded: "{rounded.md}"
    padding: "10px 14px"
  status-chip-active:
    backgroundColor: "#eaf3ed"
    textColor: "{colors.pacific-douglas-fir}"
    rounded: "{rounded.sm}"
    padding: "3px 8px"
  status-chip-complete:
    backgroundColor: "#e8f5ee"
    textColor: "{colors.go-signal}"
    rounded: "{rounded.sm}"
    padding: "3px 8px"
  status-chip-destructive:
    backgroundColor: "#fbeaea"
    textColor: "{colors.stop-sign}"
    rounded: "{rounded.sm}"
    padding: "3px 8px"
---

# Design System: EaveHQ

## 1. Overview

**Creative North Star: "The Fieldwork Standard"**

EaveHQ is built for people who use their phone between jobs, in truck cabs, in full sun. The design system earns trust through precision, not polish. Every element has a job. Every interaction feels mechanical and deliberate — the kind of tool that gets passed to an apprentice and explained in ten seconds.

The palette is drawn from the job site itself: forest greens anchored in the Pacific Northwest timber industry, warm stone surfaces that read clearly under sunlight, ember copper reserved for live data and the one tap that matters. Nothing is decorative. Space varies by purpose. Shadows lift surfaces just enough to separate them — never to impress.

This system explicitly rejects: generic SaaS blue-gray interfaces, glassmorphism and blurred overlays used decoratively, dashboard hero-metric templates, identical card grids, dark-mode-by-default for its own sake, and anything that requires reading a tooltip to understand what a button does.

**Key Characteristics:**
- Mobile-first: every interactive target is reachable one-handed
- Warm and precise: stone surfaces, forest greens, no clinical white
- Earned density: power users run 15 active jobs; the layout accommodates real data
- Accent scarcity: ember copper appears on CTAs and live numbers only
- Functional typography: Syne for authority, DM Sans for readability, Geist Mono for numbers

## 2. Colors: The Fieldwork Palette

Four roles, no more. Primary carries navigation and interactive elements. Accent fires on CTAs and live values. Neutral holds the canvas. Semantic handles status.

### Primary
- **Pacific Douglas Fir** (`#3a6349` / `oklch(40% 0.08 145)`): Primary actions, active nav states, interactive links. The authoritative green — appears sparingly so its presence registers.
- **Old Growth Canopy** (`#1f3d2c` / `oklch(24% 0.06 145)`): Desktop sidebar, page-level shell backgrounds. Deep enough to anchor the layout without reading as black.

### Secondary
- **Ember Copper** (`#d96f0a` / `oklch(56% 0.16 55)`): CTAs, deposit buttons, live prices, quote totals. Used on ≤10% of any screen. Its rarity is the point — when the contractor sees orange, they know what to do next.

### Neutral
- **Morning Limestone** (`#f5f2ed` / `oklch(96% 0.005 80)`): Page background. Warm, not clinical. Reads clean in direct sunlight.
- **Clean Slate** (`#ffffff`): Card and modal surfaces. Slightly cooler than the page background — creates one layer of lift without a shadow.
- **Worn Edge** (`#dedad4` / `oklch(88% 0.007 80)`): All borders and dividers. Warm enough to disappear when the content is right.
- **Night Work** (`#1a1a1a` / `oklch(14% 0.005 145)`): Primary text. Tinted faintly green so it pairs with the palette instead of fighting it.
- **Overcast** (`#5a6070` / `oklch(43% 0.02 245)`): Secondary and muted text, inactive nav labels, metadata.

### Semantic
- **Go Signal** (`#3d9e6a`): Success states, completed job indicators.
- **Warning Amber** (`#c47a1a`): Warnings, degraded states.
- **Stop Sign** (`#c94040`): Errors, destructive action confirmation.

### Named Rules
**The Ember Scarcity Rule.** Ember Copper appears on the one action that matters on any given screen. Never apply it to two interactive elements side-by-side. If it reads like decoration, it has failed.

**The Warm Canvas Rule.** Page backgrounds use Morning Limestone, not white. Cards use Clean Slate. This one-step tonal shift creates depth without shadow and keeps the interface from reading as sterile.

## 3. Typography

**Display Font:** Syne (600, 700, 800) — `'Syne', sans-serif`
**Body Font:** DM Sans (400, 500, 600) — `'DM Sans', sans-serif`
**Mono Font:** Geist Mono (400, 500) — `'Geist Mono', monospace`

**Character:** Syne carries the command authority of a site-foreman's marker on a blueprint. DM Sans keeps body copy warm and legible at small sizes in variable lighting. Geist Mono makes prices and measurements feel like instruments, not labels.

### Hierarchy
- **Display** (Syne 700, 1.375–1.75rem, lh 1.15, ls -0.02em): Page and section titles. Used once per view.
- **Headline** (Syne 600, 1.125rem, lh 1.25, ls -0.01em): Card headers, modal titles, panel headings.
- **Title** (DM Sans 600, 1rem, lh 1.4): List item primaries, form section labels.
- **Body** (DM Sans 400, 0.9375rem, lh 1.55): All prose content. Line length capped at 65–75ch.
- **Label** (DM Sans 600, 0.75rem, ls 0.01em): Status chips, meta tags, button text, nav labels.
- **Mono** (Geist Mono 400–500, 0.875rem): All numeric output — prices, totals, measurements, timestamps past 7 days.

### Named Rules
**The Instrument Rule.** Any number that represents money, measurement, or time uses Geist Mono. Body text that happens to contain a digit does not.

## 4. Elevation

Light touch, structural purpose. Shadows separate layers; they do not decorate them.

The system has three elevation levels that correspond to content hierarchy. Page backgrounds are flat. Cards rest one level above the surface with a diffuse ambient shadow. Dropdowns and floating panels sit at the second level. Modals claim the full screen.

### Shadow Vocabulary
- **Card** (`0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)`): Default card lift. Barely perceptible at rest; its role is to separate, not to impress. Used on job cards, quote cards, content panels.
- **Dropdown** (`0 8px 24px rgba(0,0,0,0.12)`): Menus, autocomplete, date pickers. One level above cards.
- **Modal** (`0 24px 64px rgba(0,0,0,0.18)`): Full-screen overlays. Modal backdrops are a solid semi-transparent dark green (`rgba(31,61,44,0.75)`) — not a blur. The blur is banned.

### Named Rules
**The Flat-By-Default Rule.** Surfaces are flat at rest. Shadows appear only in response to layer level (card vs. modal) or interactive hover state. Hover shadows use the card value. No element uses a shadow to look important.

**The No-Blur Rule.** `backdrop-filter: blur` is prohibited on modal and overlay backgrounds. Blurred overlays are decoration. The dark green semi-transparent backdrop is EaveHQ's modal signature — it is distinctive, branded, and does not require blur to communicate depth.

## 5. Components

### Buttons
Tactile and unambiguous. The primary button is the one orange thing on the screen.

- **Shape:** Gently rounded edges (6px radius / `--radius-md`)
- **Primary:** Ember Copper background (`#d96f0a`), white text, 10px/20px padding. Hover darkens to `#b85d08`. No shadow at rest; `0 2px 8px rgba(217,111,10,0.3)` on hover.
- **Ghost:** Transparent background, Overcast text, same padding. Hover: Morning Limestone background, Night Work text. Used for secondary actions adjacent to a primary.
- **Destructive:** Stop Sign background (`#c94040`), white text. Appears only in confirmation flows.
- **Disabled:** 40% opacity. No cursor change on the element — the surrounding state communicates unavailability.

### Status Chips
Pill-shaped status flags. Each job status maps to a chip variant. Background is a 10% tint of the semantic color; text is the full semantic color. Shape: 4px radius. Never outlined.

- Estimate Sent: Overcast tint background, Overcast text
- Deposit Paid: Go Signal tint, Go Signal text
- Scheduled: Pacific Douglas Fir tint, Pacific Douglas Fir text
- In Progress: Ember Copper tint, Ember Copper text
- Complete: Go Signal tint, Go Signal text
- Archived: Worn Edge background, Overcast text

### Cards / Containers
- **Corner Style:** Rounded (10px / `--radius-lg`)
- **Background:** Clean Slate (`#ffffff`)
- **Shadow:** Card shadow at rest. No shadow on hover.
- **Border:** 1px Worn Edge (`#dedad4`)
- **Internal Padding:** 16px standard, 20px on larger content panels

### Inputs / Fields
- **Style:** Stroke-bordered, Clean Slate background, 6px radius. Border: 1px Worn Edge at rest.
- **Focus:** Border shifts to Pacific Douglas Fir (`#3a6349`), 2px. No glow, no blur. Clean and direct.
- **Error:** Border shifts to Stop Sign (`#c94040`). Error message appears below in Stop Sign at label size.
- **Disabled:** Morning Limestone background, Overcast text, 50% opacity border.

### Navigation
- **Desktop sidebar:** Old Growth Canopy background (`#1f3d2c`), full height fixed. Nav items: Overcast label at rest, white on hover, Ember Copper background when active. 18px Lucide icons + 14px Syne label.
- **Mobile bottom tab bar:** White background, 1px Worn Edge top border, fixed bottom. Active: Pacific Douglas Fir icon and label. Inactive: Overcast. 4 primary items only; admin link appears only for admin role.
- **Header:** White background, 1px Worn Edge bottom border, h-14. EaveHQ wordmark: Eave in Pacific Douglas Fir, HQ in Ember Copper, Syne 700.

### Modals
- **Overlay:** `rgba(31,61,44,0.75)` — the branded dark-green semi-transparent backdrop. No `backdrop-filter`. Full viewport, `z-50`.
- **Card:** White background, 10px radius, modal shadow, max-w-md. No accent stripe on the modal card itself.
- **Internal layout:** 20px padding, Headline for title, body text for supporting copy.

### Estimator Floating Panels (PricingPanel, EditorToolbar)
The estimator is a special context: the contractor is looking at a satellite map, often in poor lighting conditions on a phone. Dark panels overlaying the map are appropriate here and only here.

- **Dark panel treatment:** `rgba(15,25,40,0.92)` background — acceptable on map overlays only. Carries white body text and Ember Copper for numeric readouts.
- **Floating toolbar:** Same dark treatment, pill-shaped (16px radius), fixed bottom of canvas on mobile.

## 6. Do's and Don'ts

### Do:
- **Do** use Ember Copper on the single most important action per screen. One orange CTA. Its rarity creates urgency.
- **Do** use Geist Mono for all prices, totals, deposit amounts, and timestamps older than 7 days.
- **Do** use Morning Limestone (`#f5f2ed`) as the page background and Clean Slate (`#ffffff`) for card surfaces. The one-step contrast creates depth without shadow.
- **Do** vary spacing deliberately: 8px for tight UI, 16px for content, 24–32px for section separation. Same padding everywhere is monotony.
- **Do** use Old Growth Canopy (`#1f3d2c`) as the sidebar shell. It is the heaviest surface in the product and anchors the layout.
- **Do** cap body line length at 65–75ch on all prose content.
- **Do** use the dark panel treatment (`rgba(15,25,40,0.92)`) for map-overlay elements in the Estimator only.

### Don't:
- **Don't** use `backdrop-filter: blur` anywhere. Modal overlays use a solid dark-green tint. Blur is decoration; EaveHQ does not decorate.
- **Don't** use glassmorphism: no blurred glass cards, no frosted panels outside the Estimator map context, no `backdrop-blur` on modals.
- **Don't** use generic SaaS blue-gray interfaces. If the palette reads as "default Material Design" or "generic Tailwind gray", the green tokens have not been applied.
- **Don't** use hero-metric dashboard templates: big number, small label, gradient accent. This is the first banned pattern.
- **Don't** place an accent-colored horizontal stripe at the top of modal cards. The modal is identified by its overlay and shadow; a stripe is decoration.
- **Don't** use identical card grids: same-size cards, same icon, same heading, same body text, repeated. Vary density.
- **Don't** use `border-left` or `border-right` greater than 1px as a colored accent stripe. Use background tints or leading icons instead.
- **Don't** use gradient text (`background-clip: text`). Emphasis is weight or size, never gradient.
- **Don't** apply Ember Copper to two interactive elements on the same screen. It signals "do this next" — giving that signal twice voids it.
- **Don't** use raw hex or Tailwind color utilities in components. All colors reference CSS custom properties (`var(--color-*)`) so the token system remains the single source of truth.
