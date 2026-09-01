/**
 * Minimal HTML/text template renderer for transactional email.
 * Keeps React Email out of the dependency graph for MVP — templates are
 * small, and PRD §11 only requires Resend delivery, not a specific
 * templating engine. Template names are the Mailer port's `template`
 * field.
 */

export interface RenderedEmail {
  subject: string
  html: string
  text: string
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function str(data: Record<string, unknown>, key: string): string {
  const value = data[key]
  return typeof value === 'string' ? value : value == null ? '' : String(value)
}

export function renderTemplate(
  template: string,
  subjectFallback: string,
  data: Record<string, unknown>,
): RenderedEmail {
  switch (template) {
    case 'enquiry-to-lister': {
      const listingTitle = str(data, 'listingTitle')
      const listingUrl = str(data, 'listingUrl')
      const enquirerName = str(data, 'enquirerName')
      const enquirerEmail = str(data, 'enquirerEmail')
      const enquirerPhone = str(data, 'enquirerPhone')
      const message = str(data, 'message')
      const viewing =
        data.viewingRequested === true ? 'Yes — viewing requested' : 'No'
      const subject =
        subjectFallback || `New enquiry on ${listingTitle || 'your listing'}`
      const text = [
        `You have a new enquiry on ${listingTitle}.`,
        listingUrl ? `View listing: ${listingUrl}` : '',
        '',
        `From: ${enquirerName} <${enquirerEmail}>`,
        enquirerPhone ? `Phone: ${enquirerPhone}` : '',
        `Viewing requested: ${viewing}`,
        '',
        message,
      ]
        .filter((line) => line !== undefined)
        .join('\n')
      const html = `<p>You have a new enquiry on <strong>${escapeHtml(listingTitle)}</strong>.</p>
${listingUrl ? `<p><a href="${escapeHtml(listingUrl)}">View listing</a></p>` : ''}
<p><strong>From:</strong> ${escapeHtml(enquirerName)} &lt;${escapeHtml(enquirerEmail)}&gt;<br/>
${enquirerPhone ? `<strong>Phone:</strong> ${escapeHtml(enquirerPhone)}<br/>` : ''}
<strong>Viewing requested:</strong> ${escapeHtml(viewing)}</p>
<blockquote style="border-left:3px solid #ccc;padding-left:12px;white-space:pre-wrap">${escapeHtml(message)}</blockquote>
<p>Reply directly to this email to respond to the enquirer.</p>`
      return { subject, html, text }
    }
    case 'enquiry-receipt': {
      const listingTitle = str(data, 'listingTitle')
      const subject =
        subjectFallback || `We received your enquiry about ${listingTitle}`
      const text = `Thanks ${str(data, 'enquirerName')}. We've passed your enquiry about ${listingTitle} to the lister. They'll be in touch using the details you provided.`
      const html = `<p>Thanks ${escapeHtml(str(data, 'enquirerName'))}.</p>
<p>We've passed your enquiry about <strong>${escapeHtml(listingTitle)}</strong> to the lister. They'll be in touch using the details you provided.</p>`
      return { subject, html, text }
    }
    case 'listing-approved': {
      const listingTitle = str(data, 'listingTitle')
      const listingUrl = str(data, 'listingUrl')
      const subject = subjectFallback || `Your listing is live: ${listingTitle}`
      const text = `Good news — "${listingTitle}" has been approved and is now live.${listingUrl ? `\n\nView it: ${listingUrl}` : ''}`
      const html = `<p>Good news — <strong>${escapeHtml(listingTitle)}</strong> has been approved and is now live.</p>
${listingUrl ? `<p><a href="${escapeHtml(listingUrl)}">View listing</a></p>` : ''}`
      return { subject, html, text }
    }
    case 'listing-rejected': {
      const listingTitle = str(data, 'listingTitle')
      const reason = str(data, 'reason')
      const subject =
        subjectFallback || `Action needed on your listing: ${listingTitle}`
      const text = `We couldn't approve "${listingTitle}" yet.\n\nReason: ${reason}\n\nEdit and resubmit from your lister dashboard.`
      const html = `<p>We couldn&rsquo;t approve <strong>${escapeHtml(listingTitle)}</strong> yet.</p>
<p><strong>Reason:</strong> ${escapeHtml(reason)}</p>
<p>Edit and resubmit from your lister dashboard.</p>`
      return { subject, html, text }
    }
    default: {
      const subject = subjectFallback || template
      const dump = JSON.stringify(data, null, 2)
      return {
        subject,
        html: `<pre>${escapeHtml(dump)}</pre>`,
        text: dump,
      }
    }
  }
}
