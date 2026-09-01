import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { EnquiryInbox } from '@/components/features/enquiries/enquiry-inbox'
import { createServices } from '@/lib/composition'
import { getSessionUser } from '@/lib/session'

export const metadata: Metadata = { title: 'Enquiries' }

export default async function ListerEnquiriesPage() {
  const session = await getSessionUser()
  if (!session) redirect('/sign-in?next=%2Flister%2Fenquiries')

  const { enquiries } = createServices()
  const page = await enquiries.listListerEnquiries.execute(session.user, {
    limit: 50,
  })

  return (
    <div className="mx-auto max-w-[880px] px-5 py-16 sm:px-8">
      <h1 className="text-[length:var(--text-h1)] leading-[1.12]">Enquiries</h1>
      <p className="text-muted-foreground mt-3 max-w-[60ch] text-base leading-relaxed">
        Messages from people interested in your listings.
      </p>
      <EnquiryInbox enquiries={page.data} />
    </div>
  )
}
