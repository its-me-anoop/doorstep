/**
 * Mailer — fronts Resend. Services depend on this port to send
 * transactional email (enquiry notifications, moderation decisions)
 * without knowing which provider or template engine is behind it.
 */

export interface EmailMessage {
  to: string
  subject: string
  template: string
  data: Record<string, unknown>
}

export interface Mailer {
  send(message: EmailMessage): Promise<{ id: string }>
}
