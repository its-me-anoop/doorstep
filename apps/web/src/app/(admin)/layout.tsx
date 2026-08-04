import type { ReactNode } from 'react'

import { SiteHeader } from '@/components/site-header'

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main className="flex-1">{children}</main>
    </>
  )
}
