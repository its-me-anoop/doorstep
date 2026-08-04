/** Thin rule with a centred label, between the OAuth row and the email
 *  form (DESIGN-SPEC.md §4). Not focusable — it's a visual separator. */
export function AuthDivider() {
  return (
    <div className="flex items-center gap-4" role="presentation">
      <div className="bg-border h-px flex-1" />
      <span className="text-muted-foreground text-xs tracking-[0.04em] uppercase">
        Or continue with email
      </span>
      <div className="bg-border h-px flex-1" />
    </div>
  )
}
