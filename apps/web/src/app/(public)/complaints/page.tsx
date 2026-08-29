import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Complaints',
  description: 'How to raise a complaint about Doorstep.',
}

export default function ComplaintsPage() {
  return (
    <div className="mx-auto max-w-[720px] px-5 py-16 sm:px-8">
      <h1 className="text-[length:var(--text-h1)] leading-[1.12]">
        Complaints
      </h1>
      <div className="text-foreground mt-10 flex flex-col gap-6 text-base leading-relaxed">
        <p>
          We want Doorstep to be fair, transparent, and safe. If something has
          gone wrong, please tell us so we can put it right.
        </p>

        <h2 className="text-[length:var(--text-h3)]">How to complain</h2>
        <p>
          Email{' '}
          <a href="mailto:complaints@doorstep.co.uk">
            complaints@doorstep.co.uk
          </a>{' '}
          with your name, account email, a description of the issue, and any
          relevant listing links. We aim to acknowledge complaints within two
          working days.
        </p>

        <h2 className="text-[length:var(--text-h3)]">What we will do</h2>
        <p>
          We will investigate, keep you updated, and propose a proportionate
          resolution. Serious concerns about listing content can also be
          reported in-product via &ldquo;Report this listing&rdquo; on the
          property page.
        </p>

        <h2 className="text-[length:var(--text-h3)]">
          Data protection complaints
        </h2>
        <p>
          For privacy-related complaints, contact{' '}
          <a href="mailto:privacy@doorstep.co.uk">privacy@doorstep.co.uk</a>.
          You have the right to refer matters to the ICO if you are not
          satisfied with our response.
        </p>

        <p className="text-muted-foreground text-sm">
          Last updated: August 2026
        </p>
      </div>
    </div>
  )
}
