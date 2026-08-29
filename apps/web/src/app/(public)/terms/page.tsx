import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Terms of use',
  description: 'Terms governing use of the Doorstep property platform.',
}

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-[720px] px-5 py-16 sm:px-8">
      <h1 className="text-[length:var(--text-h1)] leading-[1.12]">
        Terms of use
      </h1>
      <div className="text-foreground mt-10 flex flex-col gap-6 text-base leading-relaxed">
        <p>
          These terms apply between you and Flutterly Ltd when you access or use
          Doorstep. By creating an account or browsing listings, you agree to
          them.
        </p>

        <h2 className="text-[length:var(--text-h3)]">The service</h2>
        <p>
          Doorstep is a property search and listing platform focused on Reading
          and the Thames Valley. We connect buyers and renters with private
          sellers, landlords, and independent agents. We are not an estate agent
          and do not provide property advice.
        </p>

        <h2 className="text-[length:var(--text-h3)]">Your account</h2>
        <p>
          You must provide accurate information and keep your credentials secure.
          You are responsible for activity under your account. We may suspend or
          terminate accounts that breach these terms or our community standards.
        </p>

        <h2 className="text-[length:var(--text-h3)]">Listings and enquiries</h2>
        <p>
          Listers are responsible for the accuracy of their listings and for
          responding to enquiries lawfully. Buyers and renters should verify
          details independently before making decisions.
        </p>

        <h2 className="text-[length:var(--text-h3)]">Acceptable use</h2>
        <p>
          You must not post misleading, discriminatory, or unlawful content;
          scrape the site; interfere with security; or misuse contact details
          obtained through Doorstep.
        </p>

        <h2 className="text-[length:var(--text-h3)]">Liability</h2>
        <p>
          Doorstep is provided &ldquo;as is&rdquo;. To the fullest extent
          permitted by law, Flutterly Ltd is not liable for indirect or
          consequential loss arising from use of the platform. Nothing in these
          terms limits liability for death or personal injury caused by
          negligence, fraud, or other rights that cannot be excluded under UK
          law.
        </p>

        <h2 className="text-[length:var(--text-h3)]">Governing law</h2>
        <p>
          These terms are governed by the laws of England and Wales. Disputes are
          subject to the exclusive jurisdiction of the courts of England and
          Wales.
        </p>

        <p className="text-muted-foreground text-sm">Last updated: August 2026</p>
      </div>
    </div>
  )
}
