import type { ReactNode } from 'react'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Privacy policy',
  description: 'How Doorstep and Flutterly Ltd handle your personal data.',
}

export default function PrivacyPage() {
  return (
    <LegalLayout title="Privacy policy">
      <p>
        Doorstep is operated by Flutterly Ltd (&ldquo;we&rdquo;, &ldquo;us&rdquo;),
        company number placeholder, registered in England and Wales. This policy
        explains how we collect, use, and protect personal data when you use
        doorstep.co.uk and related services, in line with UK GDPR and the Data
        Protection Act 2018.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li>
          Account details: name, email address, phone number (if provided), and
          authentication identifiers from Firebase Auth.
        </li>
        <li>
          Listing and enquiry data: messages you send to listers, property
          details you submit, and reports you file.
        </li>
        <li>
          Usage data: searches, phone-number reveals, and similar events needed
          to operate and improve the service.
        </li>
        <li>
          Technical data: IP address, browser type, and cookies strictly
          necessary for security and session management.
        </li>
      </ul>

      <h2>How we use your data</h2>
      <p>We process personal data to:</p>
      <ul>
        <li>Provide the property search and listing platform.</li>
        <li>Deliver enquiries to listers and send transactional emails.</li>
        <li>Moderate content, prevent abuse, and comply with legal obligations.</li>
        <li>Improve reliability and understand aggregate demand in our launch areas.</li>
      </ul>
      <p>
        Our lawful bases include contract (providing the service you request),
        legitimate interests (security, fraud prevention, product improvement),
        and consent where required (for example, non-essential cookies).
      </p>

      <h2>Sharing</h2>
      <p>
        We share data with processors who help us run Doorstep: hosting
        (Vercel), database (Neon), email (Resend), authentication (Firebase),
        search (Meilisearch), and security providers (Cloudflare Turnstile,
        Upstash). We do not sell your personal data.
      </p>

      <h2>Retention</h2>
      <p>
        Enquiry messages are anonymised after 24 months. When you delete your
        account, we remove or anonymise personal data associated with your
        profile, subject to records we must keep for legal or fraud-prevention
        reasons.
      </p>

      <h2>Your rights</h2>
      <p>
        You may request access, correction, erasure, restriction, or portability
        of your personal data, and object to certain processing. Contact{' '}
        <a href="mailto:privacy@doorstep.co.uk">privacy@doorstep.co.uk</a>. You
        may also complain to the Information Commissioner&rsquo;s Office (ICO).
      </p>

      <h2>International transfers</h2>
      <p>
        Some processors may store data outside the UK. Where they do, we rely on
        appropriate safeguards such as UK adequacy regulations or standard
        contractual clauses.
      </p>

      <p className="text-muted-foreground text-sm">Last updated: August 2026</p>
    </LegalLayout>
  )
}

function LegalLayout({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <div className="mx-auto max-w-[720px] px-5 py-16 sm:px-8">
      <h1 className="text-[length:var(--text-h1)] leading-[1.12]">{title}</h1>
      <div className="prose-doorstep text-foreground mt-10 flex flex-col gap-6 text-base leading-relaxed [&_h2]:mt-4 [&_h2]:text-[length:var(--text-h3)] [&_ul]:list-disc [&_ul]:pl-6">
        {children}
      </div>
    </div>
  )
}
