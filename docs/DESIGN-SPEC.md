# Doorstep — M0 Visual Foundation

Design direction, tokens, and page specs for the M0 milestone (sign-up/sign-in, account shell, landing page). Written against `docs/PRD.md` §1, §3, §7.3.

---

## 0. Direction: "Reading, on paper"

**Name for the direction:** *Reading, on paper* — a warm editorial-daylight aesthetic that reads like a well-typeset local newspaper property section, not a SaaS dashboard. Doorstep's whole strategic bet (PRD §2.2) is hyperlocal trust over incumbent scale — the UI has to say "we know this town" on first paint, before a single listing exists.

**Why this, not something else:**
- Sarah and Tom (PRD §3) are used to Rightmove/Zoopla's cold, corporate-blue chrome. Looking different from that immediately signals "not another portal."
- Priya and David need to trust Doorstep with their livelihood/family sale before there's any social proof. Warm, considered typography reads as care taken; generic SaaS blue reads as a side project.
- M0 has no listings. Without real inventory to lean on, typography and editorial pacing *are* the product's credibility signal. A template-y hero-metric page would actively undercut the "we're serious, and we're local" positioning.
- Terracotta/clay as the brand hue is a deliberate nod to Reading's Victorian brick terraces (the exact housing stock Sarah is searching for) without being literal or twee.

**Color strategy: Committed.** One brand hue (warm clay/terracotta) is used consistently and confidently everywhere something is actionable or emphasised — primary buttons, links, focus rings, selected states, the "Reading" accent in the wordmark — but it does not spill into decoration, backgrounds, or illustration fills. A single supporting hue (moss green) is reserved *only* for positive/verified semantic states (never decorative). This is not Restrained (the brand hue must feel confident, not timid, given zero listings to lean on for credibility) and not Full/Drenched (a property marketplace that people scan for 10+ minutes needs a calm canvas; heavy saturation everywhere would fight the content).

**Light or dark: light only for M0.** Property listings are browsed in daylight, mid-task, often at speed on a phone during a commute (Sarah) — light-on-warm-paper is the higher-legibility, lower-cognitive-load default for scanning dense factual content (prices, beds, EPC ratings) and it matches the "newspaper property page" reference. Dark mode is a real, deliberate future addition (not "we didn't get to it") — tokens below are structured so a `[data-theme="dark"]` block can be added later without renaming anything, but M0 ships light only. State this decision in the PR description so it isn't re-litigated ad hoc.

**Type pairing:**
- **Display: Fraunces** (variable, Google Fonts) — a warm, slightly idiosyncratic serif with real optical-size personality. Weights used: 600 (headings), 500 (subheads), with `font-optical-sizing: auto` and occasional italic (opsz + ital axis) for the single editorial pull-line on the landing page. This is the "not another SaaS product" signal — Fraunces has none of the corporate neutrality of the banned list.
- **Body: Karla** (Google Fonts) — a humanist grotesque with warm, slightly rounded terminals that sits comfortably next to Fraunces without competing. Weights used: 400 (body), 500 (UI labels, buttons), 600 (emphasis within body copy, rarely).
- Both ship via `next/font/google`, self-hosted at build time (no runtime Google Fonts request, no CLS from web font swap, no third-party network call — good for the LCP/CWV budget in PRD §7.1).

```ts
// app/fonts.ts
import { Fraunces, Karla } from "next/font/google";

export const fraunces = Fraunces({
  subsets: ["latin"],
  axes: ["opsz", "SOFT", "WONK"],
  weight: ["500", "600"],
  style: ["normal", "italic"],
  variable: "--font-display",
  display: "swap",
});

export const karla = Karla({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-body",
  display: "swap",
});
```

Apply `className={`${fraunces.variable} ${karla.variable}`}` on `<html>` in the root layout; tokens below reference `var(--font-display)` / `var(--font-body)`.

**Layout system:** plain document flow + Flexbox for the 1D groupings (nav, button rows, form fields), CSS Grid only where content is genuinely two-dimensional (the hero's asymmetric split, the auth page's two-column desktop layout). No 12-column grid framework, no card-grid default. Asymmetric column splits (60/40, 55/45) replace centring wherever the page has a clear "read this first" primacy.

---

## 1. Design tokens

Full OKLCH values are given below. **Note on precision:** every colour in the contrast table (§2) was validated using its sRGB hex equivalent (shown alongside) via the standard WCAG relative-luminance formula — that's the source of truth for the AA claims. The OKLCH values are the direct conversion of those same hex swatches, so they render identically; if you regenerate them through a different converter, re-run the contrast check before shipping.

Radius scale is deliberately restrained (no giant `rounded-2xl` blobs) — small, confident radii read as considered, not templated.

- `--radius-sm: 6px` — inputs, checkboxes, small chips
- `--radius-md: 10px` — buttons, form fields on desktop
- `--radius-lg: 16px` — the sign-in panel, hero media frame
- `--radius-full: 999px` — pills/badges (status, "New in Reading" tag) only

Spacing rhythm: 4px base unit, used *unevenly* on purpose.
- Micro (4–8px): icon-to-label gaps, form label-to-input
- Tight (12–16px): related field groups, button internal padding
- Standard (24px): component-to-component within a section
- Generous (48–64px): section-to-section vertical rhythm on the landing page
- Breather (96px): before/after the hero, and around the "Launching in Reading" section, so it doesn't read as one continuous scroll of identical blocks

Type scale, ratio ≈1.3125 (exceeds the 1.25 minimum), base 16px, body line-height 1.6:

| Token | Size | Line-height | Weight | Font | Use |
|---|---|---|---|---|---|
| `--text-xs` | 12px | 1.4 | 600 | Karla | Uppercase micro-labels only (tracked +0.04em), never body copy |
| `--text-sm` | 14px | 1.5 | 400/500 | Karla | Meta text, helper/error text, nav links |
| `--text-base` | 16px | 1.6 | 400 | Karla | Body copy (never smaller) |
| `--text-lead` | 18px | 1.6 | 400 | Karla | Hero subcopy, lede paragraphs |
| `--text-h4` | 21px | 1.4 | 600 | Fraunces | Card/section sub-headings |
| `--text-h3` | 28px | 1.3 | 600 | Fraunces | Section headings |
| `--text-h2` | 38px | 1.2 | 600 | Fraunces | Major section headings |
| `--text-h1` | 50px | 1.12 | 600 | Fraunces | Page title (sign-in/account) |
| `--text-display` | 67px | 1.05 | 600 | Fraunces | Landing hero headline (clamp down on mobile, see §4) |

Body copy is capped at `max-width: 65ch` everywhere prose appears (hero subcopy, value-prop section, legal footer text).

### Full `:root` block (paste into `globals.css`, Tailwind v4 `@theme` compatible, shadcn/ui variable names)

The token values below live in `apps/web/src/app/globals.css` (merged into the Tailwind v4 `@theme` block). Structure summary:

- Doorstep-native scale tokens (`--clay-*`, `--ink-*`, `--paper-*`, `--moss-*`) define the actual palette.
- shadcn/ui semantic tokens (`--background`, `--foreground`, `--primary`, etc.) are mapped **from** the scale tokens, one layer down, so the palette can be retuned without hunting through every component.
- A Tailwind v4 `@theme inline` block re-exposes the shadcn variables as `--color-*` utilities (`bg-background`, `text-foreground`, `bg-primary`, …) so `className="bg-primary text-primary-foreground"` works exactly as shadcn expects out of the box.

---

## 2. Contrast check table

All pairs computed via WCAG relative-luminance contrast ratio on the sRGB hex values backing each token.

| Foreground | Background | Hex pair | Ratio | Requirement | Result |
|---|---|---|---|---|---|
| `--foreground` (ink) | `--background` (paper) | `#2B2420` on `#FBF7F2` | 14.31:1 | 4.5:1 body | Pass (large margin) |
| `--muted-foreground` | `--background` | `#6B6058` on `#FBF7F2` | 5.72:1 | 4.5:1 body | Pass |
| `--primary` text (links, inline emphasis) | `--background` | `#B34527` on `#FBF7F2` | 5.19:1 | 4.5:1 body | Pass |
| `--primary-foreground` (button label) | `--primary` (button fill) | `#FDF6F1` on `#B34527` | 5.17:1 | 4.5:1 (button label set at 16px/500, treated as body-strength, not relying on "large text" leniency) | Pass |
| `--destructive` (error text) | `--background` | `#B3261E` on `#FBF7F2` | 6.13:1 | 4.5:1 body | Pass |
| `--destructive-foreground` | `--destructive` (error banner fill) | `#FFF5F3` on `#B3261E` | ≈6.4:1 | 4.5:1 body | Pass |
| `--success` (moss, "Verified"/positive text) | `--background` | `#4B6B4A` on `#FBF7F2` | 5.62:1 | 4.5:1 body | Pass |
| `--foreground` | `--surface` (panel fill, e.g. sign-in card) | `#2B2420` on `#F5EFE7` | ≈13.4:1 | 4.5:1 body | Pass |
| `--input-border` (form field outline) | `--background` | `#967D5E` on `#FBF7F2` | 3.65:1 | 3:1 UI component | Pass |
| `--ring` (focus ring) | `--background` | `#B34527` on `#FBF7F2` | 5.19:1 | 3:1 UI/large | Pass |
| `--border` (hairline divider, decorative) | `--background` | `#E4DACD` on `#FBF7F2` | 1.29:1 | none (decorative only, never text-bearing) | N/A by design |

Anti-pattern avoided: the *undarkened* terracotta swatch (`#C1502E`, the first one tried) measured 4.42:1 against paper — just under body-text AA. Rather than ship a borderline value and hope, the shipped `--primary` (`#B34527`) is deliberately darkened until it clears 4.5:1 as running text, which also means it never needs a separate "link colour" token — one value does both jobs.

---

## 3. Landing page

No search UI exists yet (M0). The page must do three jobs honestly: explain what Doorstep is, prove the Reading-first positioning is real strategy not vapourware, and convert to sign-up. No hero-metric template, no icon-card grid, nothing centred except the CTA.

### Structure (top to bottom)

**1. Nav bar** — flush left wordmark, flush right two items. Not centred, not a hamburger at desktop widths.
- Left: "Doorstep" wordmark, Fraunces 600, 21px, ink colour, with "step" or the full mark subtly using `--primary` on hover only (never a gradient fill, per the banned-pattern list).
- Right: `Sign in` (text link, `--text-sm`, 500 weight) then `Get early access` (primary button, small size).
- Height 72px desktop / 56px mobile. Background = `--background` (page colour, not a floating white bar with a shadow — no drop-shadow default).

**2. Hero — asymmetric 58/42 grid, left-aligned**
- Left column: micro-label above headline, `--text-xs`, uppercase, tracked, `--primary` colour: `LAUNCHING IN READING & THE THAMES VALLEY`
- Headline (`--text-display`, Fraunces 600): **"A property site that actually knows Reading."**
- Subcopy (`--text-lead`, max 42ch, `--muted-foreground`): "We're onboarding independent agents across Caversham, Tilehurst, Earley and the town centre right now, and taking vetted listings straight from private owners and landlords too. Create your account and be first through the door when we open search."
- CTA row (not centred): primary button **"Create your account"** + secondary text link **"I'm an agent →"** (routes to sign-up with an agent-intent query param, see §5).
- Below the CTA row, small reassurance line at `--text-sm`, `--muted-foreground`: "Free while we build Reading's supply. No card required."
- Right column (42%): a single full-bleed editorial photograph — a Reading streetscape (Victorian terrace or the Thames at Christchurch Bridge), warm-graded, framed at `--radius-lg`, no drop shadow, no decorative gradient overlay. If no photography exists yet at build time, the placeholder is a flat `--surface` panel with a thin `--border` — never a generic icon or stock-illustration placeholder.

**3. Value proposition — editorial list, not an icon-card grid**
Set as a staggered, asymmetric column (not three identical boxes). Left margin offsets each line slightly to create rhythm rather than a grid.
- Section eyebrow (`--text-xs`, uppercase, `--muted-foreground`): "WHY DOORSTEP"
- Three statements set as a running list at increasing/varying type weight, each with its own generous top margin (not equal gutters — deliberately uneven, 32px / 48px / 32px), left-aligned to the same baseline as the hero:
  1. (`--text-h3`, Fraunces 600) "Every listing, checked by a person." — (`--text-base`, `--muted-foreground`, 60ch) "No scraped feeds, no fake urgency banners. An admin reviews every home before it goes live, usually within a day."
  2. (`--text-h3`) "Built for Reading, not bolted on." — "Search, filters and area pages are tuned to how this town is actually searched — Caversham versus Reading town centre, RG postcodes, cycling distance to the station."
  3. (`--text-h3`) "Open to private sellers and landlords." — "David selling his mother's house or letting a spare flat doesn't need an agent to get a fair hearing here — the incumbents won't let him list at all."

**4. "Launching in Reading" positioning — asymmetric two-column**
- Left (40%): heading (`--text-h2`) "Starting local, on purpose." + short paragraph explaining the wedge in plain terms: "Property portals win on how many homes they list. We're not trying to beat that game nationally on day one — we're proving it works in one place first: Reading and the Thames Valley."
- Right (60%): a simple set-in-type list of neighbourhoods actually being covered, styled as running text with `--primary` used for each place name (not chips, not a tag cloud) — e.g. "Caversham. Tilehurst. Earley. Woodley. Wokingham. Emmer Green. Reading town centre." — set large (`--text-lead`), generous line-height, reads like a masthead list, not a data grid.

**5. For agents & owners — reversed asymmetric split (42/58, image or texture left this time to break rhythm from the hero)**
- Speaks to Priya and David directly. Heading (`--text-h2`): "Free to list, while we build supply." Subcopy addresses the two personas separately in two short paragraphs (not bullet fragments): one line for independent agencies ("no membership fee during the Reading beta"), one line for private owners/landlords ("a guided wizard tells you exactly what a legal listing needs, EPC included").
- Single CTA, secondary style (not competing with the hero's primary CTA): "List with Doorstep →"

**6. Footer — minimal, not decorative**
- Left: wordmark + one-line description.
- Right: two link columns (Company: About, Contact — Legal: Privacy, Cookies, Terms) at `--text-sm`.
- Bottom line, `--text-xs`, `--muted-foreground`: "Doorstep is a Flutterly Ltd project, built and run from Reading." No social icon row if there are no active accounts yet — empty icon links are a worse signal than no row at all.

### Responsive behaviour (360px and up)

- Below 768px: hero grid collapses to single column, image moves *below* the CTA row (not above — headline and CTA must be visible without scrolling on a 360px-wide, ~700px-tall viewport). `--text-display` clamps: `clamp(2.25rem, 6vw + 1rem, 4.1875rem)` so the headline never wraps to more than 3 lines on a small phone.
- Value-prop staggered list collapses to equal, single-column spacing on mobile (the asymmetric offsets are a desktop-only rhythm device; on mobile, vertical scroll rhythm alone carries the hierarchy) — use `32px` uniform gap under 768px.
- Nav: both nav items stay visible at 360px (no hamburger) — "Sign in" shrinks to icon+label only under 400px if truly tight, but the CTA button never disappears; it is the page's job.
- All section side padding: 20px at 360–599px, 32px at 600–1023px, `max-width: 1200px` centred container with 64px+ side padding at 1024px+.
- Touch targets ≥44×44px on the nav and CTA at all widths.

---

## 4. Sign-in / sign-up

### Layout

Desktop: asymmetric two-column, `--radius-lg` panel on the right (not centred, not a floating card on a busy background). Left column (55%) carries a short, real editorial moment — not marketing filler: the same hero photograph treatment (smaller), plus one short reassurance line ("Reading's newest property site — free to browse, free to list while we build supply."). This keeps auth pages from feeling like a generic SaaS login screen. Right column (45%, min 400px, max 480px) holds the form in a `--surface` panel with `--radius-lg`, `padding: 40px`, subtle `1px solid --border` (no drop shadow — flat, matches the rest of the product).

Mobile (<768px): left column drops entirely (no wasted scroll before the form); form panel becomes full-width with 24px side padding and sits directly under a compact top bar (logo only, 56px height).

### Field order — sign up

1. **OAuth row first** (Google, then Apple, full-width stacked buttons, 12px gap) — fastest path for most users, PRD ACC-1 lists Google/Apple alongside email.
2. Divider: thin `--border` line with centred `--text-xs` `--muted-foreground` label "OR CONTINUE WITH EMAIL".
3. **Full name** (single field, not split first/last — reduces friction; matches Firebase `displayName`).
4. **Email**.
5. **Password** — with a visible (not tooltip-hidden) requirement line under the field, updating live: "At least 8 characters" turns from `--muted-foreground` to `--success` with a check as it's satisfied, never turns `--destructive` while the user is still typing (only on blur/submit if genuinely invalid).
6. **Consent checkbox** (unchecked by default — no dark pattern pre-ticking): "I agree to the Terms and Privacy Policy" with both words as inline text links in `--primary`.
7. Primary button, full width: **"Create account"**.
8. Below the button, `--text-sm`: "Already have an account? Sign in" (text link).

### Field order — sign in

1. OAuth row (Google, Apple).
2. Divider, same treatment.
3. Email.
4. Password (with a right-aligned "Forgot password?" text link at the same baseline as the Password label — not buried below the field).
5. Primary button: **"Sign in"**.
6. Below: "New to Doorstep? Create an account" (text link).

### OAuth button treatment

Use each provider's official mark and button convention rather than a custom-styled pill — this is a trust surface, and non-standard OAuth buttons read as phishing to a wary user:
- **Google:** white background, `1px solid --input-border`, Google's official multicolour "G" glyph, `--foreground` label text "Continue with Google", `--radius-md`, 44px height minimum.
- **Apple:** solid black (`#000000` is the one permitted exception to "never pure black" — it's Apple's mandated brand asset, not a Doorstep token, and is used only inside the Apple button component per Apple's Sign in with Apple HIG), white Apple glyph + "Continue with Apple" in white, `--radius-md`, 44px height.
- Both buttons are full-width, equal size, stacked (not side-by-side at any width — side-by-side halves the tap target on mobile).

### Error and validation copy tone

Plain, specific, never blames the user, never says "invalid input":
- Empty required field on submit: "Enter your email address." (not "Email is required" — imperative and human)
- Bad email format: "That email address doesn't look quite right — check for typos."
- Weak password (submit-time, if still unmet): "Your password needs at least 8 characters."
- Wrong credentials on sign-in: "That email and password don't match. Try again, or reset your password." — never confirm/deny whether the *email* exists (enumeration protection).
- Account already exists (sign-up with existing email): "You've already got an account with that email — sign in instead." with the word "sign in" as a link that pre-fills the email field.
- Network/Firebase error: "Something went wrong on our end — try again in a moment." (never expose raw Firebase error strings to the user; log them to Sentry per PRD §7.7 instead).
- Errors render inline directly under the relevant field, `--text-sm`, `--destructive`, with a small icon — never as a top-of-page banner that disconnects the message from the field, and never as a modal/alert dialog for a simple field error.

### Focus states & keyboard / a11y (WCAG 2.2 AA)

- Every interactive element gets a visible focus ring: `2px solid var(--ring)` with `2px` offset, applied via `:focus-visible` (not `:focus`, so mouse clicks don't show a ring but keyboard nav always does).
- Tab order follows visual/DOM order exactly: OAuth buttons → divider (not focusable) → form fields in order → consent checkbox → submit → footer link. No `tabindex` overrides.
- Labels are real `<label for>` elements, always visible (no placeholder-as-label — placeholder text disappears on input, which fails multiple WCAG success criteria and is a genuine usability problem, not just a technicality).
- Password field ships a visible "Show password" toggle (icon button, `aria-pressed`, `aria-label="Show password"`/`"Hide password"`), not just masked-forever — improves error recovery on mobile.
- Inline errors are associated via `aria-describedby` on the input and announced via `role="alert"` (or a live region with `aria-live="polite"` for the password-strength helper, which shouldn't interrupt like an alert).
- Submit button shows a loading state (label changes to "Signing in…" plus a non-motion-reliant spinner respecting reduced-motion, see §6) and is `aria-disabled` (not `disabled`, so it stays announced) during the request — prevents double-submit without silently vanishing from the tab order.
- Minimum 44×44px touch targets on all buttons and the checkbox hit area (the visual checkbox can be 18px, but the clickable/tappable area, including its label, is the full row).
- Colour is never the only error signal — icon + text accompany the red colour, satisfying 1.4.1 (Use of Color).

---

## 5. Account page shell (M0 minimal)

M0 ships exactly one authenticated page: greeting, profile summary, sign-out. No sidebar nav, no teased "coming soon" sections for favourites/listings — those don't exist yet (M1–M4), and stubbing them out as greyed nav items is noise, not progressive disclosure done well. Ship what exists; add navigation *when the second page exists*.

### Layout

Single column, left-aligned, `max-width: 640px`, generous top margin (64px) so it doesn't feel like a bare form dumped at the top of the viewport. No card wrapper around the whole page — the profile summary is the one legitimate "panel," everything else is plain flow.

1. **Top bar**: same minimal bar as the rest of the product — wordmark left, `Sign out` text button right (`--text-sm`, `--muted-foreground`, hover → `--foreground`; deliberately *not* styled as a destructive/red action — signing out isn't dangerous, don't cry wolf with colour).
2. **Greeting** (`--text-h1`, Fraunces): time-of-day aware, first name only — "Morning, Sarah." / "Afternoon, Sarah." / "Evening, Sarah." (server-computed from request time, falls back to "Hello, Sarah." if the name is missing). Small, specific, human touch that costs one `switch` statement.
3. **Profile summary panel** (`--surface`, `--radius-lg`, `1px solid --border`, 32px padding): the one panel on the page.
   - Name (editable inline — click reveals a text input in place, not a modal; Save/Cancel appear inline below).
   - Email (shown, not editable in M0 — Firebase email changes need re-verification flow, out of scope; shown with a small `--muted-foreground` note: "Contact us to change your email" rather than a disabled-looking greyed field, which reads as broken).
   - Phone (editable inline, optional, same pattern as name).
   - Each field: `--text-sm` `--muted-foreground` label above, `--text-base` value below — no repeated redundant helper text under a value that already says what it is.
4. **Account actions**, plain text below the panel, not another card: "Delete account" as a quiet `--text-sm` link in `--muted-foreground` (not `--destructive` — it's a real permanent action but M0 doesn't need to shout at users who haven't done anything wrong; PRD ACC-3 confirms this needs a confirmation step, which happens inline via progressive disclosure — clicking reveals a short warning paragraph + a genuinely `--destructive`-styled confirm button — not a modal).

### Motion/interaction notes specific to this page

- Inline-edit fields expand via a height-auto reveal is *not* used (animating height causes layout thrash — banned per impeccable.style). Instead the static text and the input occupy the same slot; the swap is an opacity crossfade only (120ms).

---

## 6. Motion (three transitions, no more)

All motion animates `transform` and/or `opacity` only. Easing: `cubic-bezier(0.16, 1, 0.3, 1)` (ease-out-expo) for anything that should feel like it's settling into place; `cubic-bezier(0.65, 0, 0.35, 1)` (ease-out-quart-ish, quicker) for micro-interactions. No bounce, no elastic, ever.

1. **Button press/hover feedback** (every primary/secondary button, site-wide): hover → background shifts to `--primary-hover` (a pre-defined darker token, not a computed filter) over 120ms ease-out; active/press → `transform: scale(0.98)` over 80ms. Signals "this is clickable" and "this registered your click" — nothing decorative.
2. **Hero content entrance** (landing page only, once, on initial load): eyebrow label, headline, subcopy and CTA row fade+rise in with a 60ms stagger — `opacity 0→1`, `transform: translateY(8px)→translateY(0)`, 400ms ease-out-expo each. Signals the page has finished arriving/loading; it is not a scroll-triggered replay (fires once on mount only, never re-triggers on scroll-into-view — repeated scroll animation is decorative, not stateful).
3. **Inline validation / focus states** (forms): error text and the focus ring both transition `opacity` (150ms ease-out-quart) rather than popping in instantly — signals a state change without being loud. The inline-edit crossfade on the account page (§5) uses the same 120ms opacity transition, reused rather than inventing a fourth motion pattern.

`prefers-reduced-motion: reduce` handling (global, one rule, applies to all three):

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.001ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.001ms !important;
    scroll-behavior: auto !important;
  }
}
```

The hero entrance and button scale both degrade gracefully under this rule (content is simply present immediately; buttons still show a colour-based hover, just without the scale). Nothing in this spec depends on motion to convey information — a reduced-motion user loses zero functionality.

---

## Anti-patterns explicitly avoided (checklist)

- No Inter/Roboto/Open Sans/Lato/Montserrat/Arial/IBM Plex — Fraunces + Karla instead.
- No pure `#000`/`#fff` in the product palette (the one exception, Apple's mandated button black, is called out explicitly in §4 as a third-party brand asset, not a Doorstep token).
- No purple-to-blue gradient, no gradient text, no glowing dark-mode box-shadows (M0 ships light-only anyway).
- No side-stripe/side-tab card borders anywhere in this spec.
- No nested cards — the sign-in panel and the account profile panel are each the *only* panel on their page.
- No icon-card grid for the value proposition — an asymmetric editorial list instead.
- No hero-metric template (no big-number-plus-label, because there are no real metrics yet, and even once there are, PRD's north-star metric is an internal ops number, not a consumer-facing vanity stat).
- No modal for account deletion — inline progressive disclosure instead.
- No decorative motion — every transition above signals a concrete state change.
- No centred body copy or centred page layouts outside the hero/CTA elements.
- No redundant label/sublabel/helper stacking — each form field carries exactly one label and, where relevant, one live helper, never both plus a placeholder repeating the label.
