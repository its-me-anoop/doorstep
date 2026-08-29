/**
 * CaptchaVerifier — fronts Cloudflare Turnstile (PRD §7.4 / ENQ-2).
 * Guest enquiry submissions must pass verification; signed-in users skip
 * the challenge at the service layer.
 */

export interface CaptchaVerifier {
  /**
   * @returns true when the token is valid for this sitekey/secret pair.
   * Implementations must fail closed (network errors → false).
   */
  verify(token: string, remoteIp?: string | null): Promise<boolean>
}
