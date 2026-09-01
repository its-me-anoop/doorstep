'use client'

import { useState } from 'react'

import { EnquiryForm } from '@/components/features/enquiries/enquiry-form'
import { ReportListingLink } from '@/components/features/reports/report-listing-link'
import { Button } from '@/components/ui/button'
import { getOrCreateAnonId } from '@/lib/analytics-client'

interface ListerCardActionsProps {
  propertyId: string
  signedIn: boolean
  defaultName?: string
  defaultEmail?: string
  defaultPhone?: string | null
  contactPhone?: string | null
  turnstileSiteKey?: string
}

export function ListerCardActions({
  propertyId,
  signedIn,
  defaultName,
  defaultEmail,
  defaultPhone,
  contactPhone,
  turnstileSiteKey,
}: ListerCardActionsProps) {
  const [phoneVisible, setPhoneVisible] = useState(false)

  async function revealPhone() {
    setPhoneVisible(true)
    try {
      await fetch('/api/v1/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'phone_reveal',
          anonId: getOrCreateAnonId(),
          properties: { propertyId },
        }),
      })
    } catch {
      // analytics must not block the UI
    }
  }

  return (
    <div className="border-border mt-6 flex flex-col gap-4 border-t pt-6">
      {contactPhone && (
        <div>
          {phoneVisible ? (
            <a
              href={`tel:${contactPhone.replace(/\s/g, '')}`}
              className="text-foreground text-base font-medium"
            >
              {contactPhone}
            </a>
          ) : (
            <Button
              type="button"
              variant="secondary"
              onClick={revealPhone}
              className="h-11 rounded-[var(--radius-md)] px-6"
            >
              Show phone number
            </Button>
          )}
        </div>
      )}

      <div>
        <p className="text-foreground text-sm font-medium">Send a message</p>
        <EnquiryForm
          propertyId={propertyId}
          signedIn={signedIn}
          defaultName={defaultName}
          defaultEmail={defaultEmail}
          defaultPhone={defaultPhone}
          turnstileSiteKey={turnstileSiteKey}
        />
      </div>

      <ReportListingLink
        propertyId={propertyId}
        signedIn={signedIn}
        defaultEmail={defaultEmail}
      />
    </div>
  )
}
