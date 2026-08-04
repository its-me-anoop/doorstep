/**
 * The API's one error envelope shape, `{ error: { code, message } }`
 * (PRD §8.5's "thin handler" — route handlers map a service outcome to a
 * response, they don't invent their own error shapes per-route).
 */

import { NextResponse } from 'next/server'

export interface ApiErrorBody {
  error: {
    code: string
    message: string
  }
}

export function apiError(
  status: number,
  code: string,
  message: string,
): NextResponse<ApiErrorBody> {
  return NextResponse.json({ error: { code, message } }, { status })
}
