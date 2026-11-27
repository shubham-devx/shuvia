import 'server-only'

import { brevoEnv } from '@/lib/server-env'

export async function sendBrevoEmail(input: {
  to: string
  subject: string
  htmlContent: string
  textContent: string
}) {
  const env = brevoEnv()
  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': env.BREVO_API_KEY,
      'content-type': 'application/json',
      accept: 'application/json',
    },
    cache: 'no-store',
    body: JSON.stringify({
      sender: { email: env.BREVO_SENDER_EMAIL, name: env.BREVO_SENDER_NAME },
      to: [{ email: input.to }],
      subject: input.subject,
      htmlContent: input.htmlContent,
      textContent: input.textContent,
    }),
    signal: AbortSignal.timeout(8000),
  })
  if (!response.ok) {
    console.error('Brevo email delivery failed with status', response.status)
    return false
  }
  return true
}

export async function sendVerificationEmail(email: string, verifyUrl: string) {
  const htmlVerifyUrl = verifyUrl.replaceAll('&', '&amp;')
  return sendBrevoEmail({
    to: email,
    subject: 'Confirm your email for your Shuvia space',
    htmlContent: `<!doctype html><html><body style="margin:0;background:#fff9f5;font-family:Arial,sans-serif;color:#29212a"><div style="max-width:560px;margin:36px auto;padding:40px 32px;background:#fffdfb;border:1px solid #efe3de"><p style="font-family:Georgia,serif;font-size:28px;color:#6b2948;margin:0 0 28px">shuvia</p><p style="font-size:16px;line-height:1.7">Welcome to Shuvia. Open the private link below to verify your email address and continue to your space.</p><p style="margin:28px 0"><a href="${htmlVerifyUrl}" style="display:inline-block;padding:15px 21px;background:#6b2948;color:#fff9f5;text-decoration:none">Verify my email</a></p><p style="font-size:13px;line-height:1.7;color:#796c72">This link can only be used once. If you didn’t create a Shuvia account, you can safely ignore this email.</p><p style="margin-top:32px;font-family:Georgia,serif;font-style:italic;color:#8c777e">Two hearts. One little world.</p></div></body></html>`,
    textContent: `Welcome to Shuvia. Verify your email address using this private link: ${verifyUrl} If you did not create a Shuvia account, ignore this email.`,
  })
}
