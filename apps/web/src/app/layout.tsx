import type { Metadata } from 'next'

import { fraunces, karla } from './fonts'
import './globals.css'

export const metadata: Metadata = {
  title: {
    template: '%s · Doorstep',
    default: 'Doorstep — A property site that actually knows Reading.',
  },
  description:
    "We're onboarding independent agents across Reading and the Thames Valley and taking vetted listings straight from private owners and landlords too. Create your account and be first through the door when we open search.",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en-GB"
      className={`${fraunces.variable} ${karla.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  )
}
