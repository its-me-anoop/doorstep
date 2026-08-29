import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Cookie policy',
  description: 'How Doorstep uses cookies and similar technologies.',
}

export default function CookiesPage() {
  return (
    <div className="mx-auto max-w-[720px] px-5 py-16 sm:px-8">
      <h1 className="text-[length:var(--text-h1)] leading-[1.12]">
        Cookie policy
      </h1>
      <div className="text-foreground mt-10 flex flex-col gap-6 text-base leading-relaxed">
        <p>
          This policy explains how Flutterly Ltd uses cookies and similar
          technologies on Doorstep.
        </p>

        <h2 className="text-[length:var(--text-h3)]">Essential cookies</h2>
        <p>
          We set a secure, HTTP-only session cookie when you sign in so we can
          keep you authenticated. This cookie is strictly necessary for the
          service and does not require consent under UK PECR.
        </p>

        <h2 className="text-[length:var(--text-h3)]">Preference storage</h2>
        <p>
          We store your cookie-banner choice in your browser&rsquo;s local
          storage so we do not ask again on every visit. Until you accept,
          we run essential-only mode.
        </p>

        <h2 className="text-[length:var(--text-h3)]">Analytics</h2>
        <p>
          We record first-party events (such as searches and phone reveals) in
          our own database using an anonymous identifier. We do not use
          third-party advertising cookies in the MVP.
        </p>

        <h2 className="text-[length:var(--text-h3)]">Managing cookies</h2>
        <p>
          You can clear cookies and site data through your browser settings.
          Blocking essential cookies will prevent you from staying signed in.
        </p>

        <p className="text-muted-foreground text-sm">Last updated: August 2026</p>
      </div>
    </div>
  )
}
