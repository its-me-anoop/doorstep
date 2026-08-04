'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
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
import { signUpWithEmail } from '@/lib/firebase-client'
import { signUpSchema, type SignUpFormValues } from '@/lib/validation/auth'

import { AuthDivider } from './auth-divider'
import { finishSignIn } from './finish-sign-in'
import { OAuthButtons } from './oauth-buttons'
import { PasswordInput } from './password-input'
import { PasswordStrengthHint } from './password-strength-hint'

const fieldClassName = 'h-11 rounded-[var(--radius-md)]'

interface SignUpFormProps {
  nextPath: string
}

export function SignUpForm({ nextPath }: SignUpFormProps) {
  const router = useRouter()
  const [authError, setAuthError] = useState<AuthErrorPresentation | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const form = useForm<SignUpFormValues>({
    resolver: zodResolver(signUpSchema),
    mode: 'onBlur',
    defaultValues: { fullName: '', email: '', password: '', consent: false },
  })

  const password = useWatch({ control: form.control, name: 'password' })
  const passwordTouched =
    Boolean(form.formState.touchedFields.password) || form.formState.isSubmitted

  async function onSubmit(values: SignUpFormValues) {
    setSubmitting(true)
    setAuthError(null)
    try {
      const credential = await signUpWithEmail(values.email, values.password)
      await finishSignIn(credential, router, nextPath)
    } catch (error) {
      const presentation = mapFirebaseAuthError(error)
      if (!presentation.silent) setAuthError(presentation)
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-[length:var(--text-h1)] leading-[1.12]">
        Create your account
      </h1>

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
            name="fullName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Full name</FormLabel>
                <FormControl>
                  <Input
                    autoComplete="name"
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
                {authError?.code === 'email-already-in-use' && (
                  <p
                    role="alert"
                    className="opacity-transition text-destructive text-sm"
                  >
                    You&rsquo;ve already got an account with that email —{' '}
                    <Link
                      href={`/sign-in?next=${encodeURIComponent(nextPath)}&email=${encodeURIComponent(field.value)}`}
                      className="underline underline-offset-2"
                    >
                      sign in instead
                    </Link>
                    .
                  </p>
                )}
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Password</FormLabel>
                <FormControl>
                  <PasswordInput autoComplete="new-password" {...field} />
                </FormControl>
                <PasswordStrengthHint
                  id={`${field.name}-strength`}
                  password={password}
                  showAsError={passwordTouched}
                />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="consent"
            render={({ field }) => (
              <FormItem>
                <div className="flex items-start gap-3">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onChange={(event) => field.onChange(event.target.checked)}
                      onBlur={field.onBlur}
                      name={field.name}
                    />
                  </FormControl>
                  <FormLabel className="text-sm leading-snug font-normal">
                    I agree to the{' '}
                    <Link
                      href="/terms"
                      className="text-primary hover:underline"
                    >
                      Terms
                    </Link>{' '}
                    and{' '}
                    <Link
                      href="/privacy"
                      className="text-primary hover:underline"
                    >
                      Privacy Policy
                    </Link>
                  </FormLabel>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />

          {authError && authError.code !== 'email-already-in-use' && (
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
            {submitting ? 'Creating account…' : 'Create account'}
          </Button>
        </form>
      </Form>

      <p className="text-muted-foreground text-sm">
        Already have an account?{' '}
        <Link
          href={`/sign-in?next=${encodeURIComponent(nextPath)}`}
          className="text-primary hover:underline"
        >
          Sign in
        </Link>
      </p>
    </div>
  )
}
