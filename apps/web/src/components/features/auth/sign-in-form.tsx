'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useForm } from 'react-hook-form'

import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import {
  mapFirebaseAuthError,
  type AuthErrorPresentation,
} from '@/lib/auth-error-messages'
import { signInWithEmail } from '@/lib/firebase-client'
import { signInSchema, type SignInFormValues } from '@/lib/validation/auth'

import { AuthDivider } from './auth-divider'
import { finishSignIn } from './finish-sign-in'
import { OAuthButtons } from './oauth-buttons'
import { PasswordInput } from './password-input'

const fieldClassName = 'h-11 rounded-[var(--radius-md)]'

interface SignInFormProps {
  nextPath: string
  /** Pre-fills the email field — used by the "sign in instead" link the
   *  sign-up form shows for auth/email-already-in-use. */
  prefillEmail?: string
}

export function SignInForm({ nextPath, prefillEmail }: SignInFormProps) {
  const router = useRouter()
  const [authError, setAuthError] = useState<AuthErrorPresentation | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const form = useForm<SignInFormValues>({
    resolver: zodResolver(signInSchema),
    mode: 'onBlur',
    defaultValues: { email: prefillEmail ?? '', password: '' },
  })

  async function onSubmit(values: SignInFormValues) {
    setSubmitting(true)
    setAuthError(null)
    try {
      const credential = await signInWithEmail(values.email, values.password)
      await finishSignIn(credential, router, nextPath)
    } catch (error) {
      const presentation = mapFirebaseAuthError(error)
      if (!presentation.silent) setAuthError(presentation)
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-[length:var(--text-h1)] leading-[1.12]">Sign in</h1>

      <OAuthButtons nextPath={nextPath} onError={setAuthError} />
      <AuthDivider />

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          noValidate
          className="flex flex-col gap-6"
        >
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    autoComplete="email"
                    className={fieldClassName}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <div className="flex items-baseline justify-between">
                  <FormLabel>Password</FormLabel>
                  <Link
                    href="/forgot-password"
                    className="text-muted-foreground hover:text-primary text-sm"
                  >
                    Forgot password?
                  </Link>
                </div>
                <FormControl>
                  <PasswordInput autoComplete="current-password" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {authError && (
            <p
              role="alert"
              className="opacity-transition text-destructive text-sm"
            >
              {authError.message}
            </p>
          )}

          <Button
            type="submit"
            aria-disabled={submitting}
            className="h-11 w-full rounded-[var(--radius-md)]"
          >
            {submitting ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
      </Form>

      <p className="text-muted-foreground text-sm">
        New to Doorstep?{' '}
        <Link
          href={`/sign-up?next=${encodeURIComponent(nextPath)}`}
          className="text-primary underline underline-offset-2"
        >
          Create an account
        </Link>
      </p>
    </div>
  )
}
