/**
 * Self-hosted font loading for the "Reading, on paper" direction
 * (DESIGN-SPEC.md §0). Both fonts ship via next/font/google so the
 * files are bundled at build time — no runtime Google Fonts request, no
 * font-swap CLS, no third-party network call (PRD §7.1 CWV budget).
 *
 * Fraunces is the display face (headings, the landing hero, the
 * editorial pull-line); Karla is the body/UI face. Applied as CSS
 * variables on <html> in the root layout; globals.css's token block
 * references var(--font-display) / var(--font-body).
 */
import { Fraunces, Karla } from 'next/font/google'

export const fraunces = Fraunces({
  subsets: ['latin'],
  // Next's font loader rejects `axes` combined with a discrete `weight`
  // list ("Axes can only be defined for variable fonts when the weight
  // property is nonexistent or set to `variable`") — DESIGN-SPEC.md's
  // snippet predates that constraint. Loading the full variable font
  // instead keeps the opsz/SOFT/WONK axis access the spec wants; the
  // 500/600 weights it calls for come from globals.css's `font-weight`
  // rules (h1-h4 at 600) rather than being baked into the font subset.
  axes: ['opsz', 'SOFT', 'WONK'],
  weight: 'variable',
  style: ['normal', 'italic'],
  variable: '--font-display',
  display: 'swap',
})

export const karla = Karla({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-body',
  display: 'swap',
})
