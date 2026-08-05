/**
 * M1-DESIGN-SPEC.md §3.5, deliberately left as a placeholder pane per
 * this task's scope: photo upload (LST-3's signed-upload/variant/
 * blurhash pipeline) is a separate build. Rather than ship a drop zone
 * with nothing behind it, this pane keeps the spec's own three
 * subsections and copy structure, but says plainly that upload isn't
 * available yet — no button, no input, nothing that looks live and does
 * nothing (the same reasoning agency-form.tsx's logo field doc comment
 * already gives for a not-yet-built upload target). The review step
 * (step-review.tsx) carries the corresponding honesty: it explains that
 * submitting still needs a photo, because the server enforces
 * PHOTO_MINIMUM regardless of what this pane can do today.
 */
export function StepPhotosPlaceholder() {
  return (
    <div className="flex flex-col gap-8">
      <p className="text-muted-foreground max-w-[60ch] text-base leading-relaxed">
        Up to 25 photos, 15MB each. Drag to reorder, or use the arrows on each
        photo — the first photo is your cover image.
      </p>

      <div className="border-input rounded-[var(--radius-md)] border border-dashed p-6">
        <p className="text-foreground text-sm font-medium">Coming soon</p>
        <p className="text-muted-foreground mt-2 max-w-[60ch] text-sm leading-relaxed">
          Photo upload isn&rsquo;t available in this update yet. You can carry
          on filling in the rest of your listing — you&rsquo;ll be able to add
          photos, a floorplan and an EPC certificate, and then submit for
          approval, once this ships.
        </p>
      </div>

      <div className="flex flex-col gap-6">
        <h3 className="text-[length:var(--text-h4)]">Photos</h3>
        <h3 className="text-[length:var(--text-h4)]">Floorplan</h3>
        <h3 className="text-[length:var(--text-h4)]">EPC certificate</h3>
      </div>
    </div>
  )
}
