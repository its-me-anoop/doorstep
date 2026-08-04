/**
 * greetingFor — the account page's time-of-day, first-name-only greeting
 * (DESIGN-SPEC.md §5: "Morning, Sarah." / "Afternoon, Sarah." /
 * "Evening, Sarah.", falling back to a plain "Hello." when there's no
 * name to use). Pure and server-computed from the request time — no
 * client clock, no hydration mismatch.
 */
export function greetingFor(hour: number, fullName: string | null): string {
  const firstName = fullName?.trim().split(/\s+/)[0]
  if (!firstName) return 'Hello.'

  return `${periodFor(hour)}, ${firstName}.`
}

function periodFor(hour: number): 'Morning' | 'Afternoon' | 'Evening' {
  if (hour < 12) return 'Morning'
  if (hour < 18) return 'Afternoon'
  return 'Evening'
}
