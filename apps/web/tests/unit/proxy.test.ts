import { NextRequest } from 'next/server'
import { describe, expect, it } from 'vitest'

import { SESSION_COOKIE_NAME } from '@/lib/session-cookie-name'
import { proxy } from '@/proxy'

function base64Url(input: string): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

function fakeSessionCookie(claims: Record<string, unknown>): string {
  const header = base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const body = base64Url(JSON.stringify(claims))
  return `${header}.${body}.fake-signature`
}

function requestFor(pathname: string, cookie?: string): NextRequest {
  const headers = new Headers()
  if (cookie) {
    headers.set('cookie', `${SESSION_COOKIE_NAME}=${cookie}`)
  }
  return new NextRequest(new URL(pathname, 'https://doorstep.test'), {
    headers,
  })
}

const futureExp = Math.floor(Date.now() / 1000) + 3600

describe('proxy', () => {
  it('passes through an unrelated path with no session', () => {
    const response = proxy(requestFor('/for-sale/reading'))
    expect(response.headers.get('location')).toBeNull()
  })

  it('redirects /account to /sign-in with no session cookie', () => {
    const response = proxy(requestFor('/account'))
    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe(
      'https://doorstep.test/sign-in?next=%2Faccount',
    )
  })

  it('passes through /account with a valid session cookie', () => {
    const cookie = fakeSessionCookie({ role: 'user', exp: futureExp })
    const response = proxy(requestFor('/account', cookie))
    expect(response.headers.get('location')).toBeNull()
  })

  it('redirects /lister to /sign-in for role user', () => {
    const cookie = fakeSessionCookie({ role: 'user', exp: futureExp })
    const response = proxy(requestFor('/lister', cookie))
    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe(
      'https://doorstep.test/sign-in?next=%2Flister',
    )
  })

  it('passes through /lister for role agent', () => {
    const cookie = fakeSessionCookie({ role: 'agent', exp: futureExp })
    const response = proxy(requestFor('/lister', cookie))
    expect(response.headers.get('location')).toBeNull()
  })

  it('redirects /admin to /sign-in for role agent', () => {
    const cookie = fakeSessionCookie({ role: 'agent', exp: futureExp })
    const response = proxy(requestFor('/admin', cookie))
    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe(
      'https://doorstep.test/sign-in?next=%2Fadmin',
    )
  })

  it('passes through /admin for role admin', () => {
    const cookie = fakeSessionCookie({ role: 'admin', exp: futureExp })
    const response = proxy(requestFor('/admin', cookie))
    expect(response.headers.get('location')).toBeNull()
  })
})
