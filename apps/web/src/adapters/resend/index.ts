/**
 * adapters/resend/ — Mailer port via Resend (PRD §11, ENQ-3).
 *
 * When RESEND_API_KEY is unset (local/CI without credentials), falls back
 * to a ConsoleMailer that logs the message and returns a synthetic id so
 * enquiry/admin flows remain exercisable without a paid provider. The
 * composition root picks the concrete class; services never see the
 * distinction.
 */

import { Resend } from 'resend'

import type { EmailMessage, Mailer } from '@/ports/mailer'

import { renderTemplate } from './templates'

export class ConsoleMailer implements Mailer {
  async send(message: EmailMessage): Promise<{ id: string }> {
    const id = `console-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    console.info('[ConsoleMailer] send', {
      id,
      to: message.to,
      subject: message.subject,
      template: message.template,
    })
    return { id }
  }
}

export class ResendMailer implements Mailer {
  private readonly client: Resend
  private readonly from: string

  constructor(
    apiKey: string = process.env.RESEND_API_KEY ?? '',
    from: string = process.env.RESEND_FROM_EMAIL ??
      'Doorstep <noreply@doorstep.local>',
  ) {
    if (!apiKey) {
      throw new Error(
        'ResendMailer requires RESEND_API_KEY — use ConsoleMailer when unset',
      )
    }
    this.client = new Resend(apiKey)
    this.from = from
  }

  async send(message: EmailMessage): Promise<{ id: string }> {
    const { subject, html, text } = renderTemplate(
      message.template,
      message.subject,
      message.data,
    )
    const result = await this.client.emails.send({
      from: this.from,
      to: message.to,
      subject,
      html,
      text,
      ...(typeof message.data.replyTo === 'string'
        ? { replyTo: message.data.replyTo }
        : {}),
    })
    if (result.error) {
      throw new Error(`ResendMailer.send failed: ${result.error.message}`)
    }
    if (!result.data?.id) {
      throw new Error('ResendMailer.send: response missing id')
    }
    return { id: result.data.id }
  }
}

/** Prefer Resend when configured; otherwise the console fallback. */
export function createMailer(): Mailer {
  const key = process.env.RESEND_API_KEY
  if (key) return new ResendMailer(key)
  return new ConsoleMailer()
}
