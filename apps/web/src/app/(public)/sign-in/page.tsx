import type { Metadata } from 'next'

import { AuthPageLayout } from '@/components/features/auth/auth-page-layout'
import { SignInForm } from '@/components/features/auth/sign-in-form'
import { sanitizeNextPath } from '@/lib/next-param'

export const metadata: Metadata = { title: 'Sign in' }

interface SignInPageProps {
  searchParams: Promise<{ next?: string; email?: string }>
}

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const params = await searchParams
  const nextPath = sanitizeNextPath(params.next)

  return (
    <AuthPageLayout>
      <SignInForm nextPath={nextPath} prefillEmail={params.email} />
    </AuthPageLayout>
  )
}
