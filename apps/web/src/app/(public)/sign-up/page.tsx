import type { Metadata } from 'next'

import { AuthPageLayout } from '@/components/features/auth/auth-page-layout'
import { SignUpForm } from '@/components/features/auth/sign-up-form'
import { sanitizeNextPath } from '@/lib/next-param'

export const metadata: Metadata = { title: 'Create your account' }

interface SignUpPageProps {
  searchParams: Promise<{ next?: string }>
}

export default async function SignUpPage({ searchParams }: SignUpPageProps) {
  const params = await searchParams
  const nextPath = sanitizeNextPath(params.next)

  return (
    <AuthPageLayout>
      <SignUpForm nextPath={nextPath} />
    </AuthPageLayout>
  )
}
