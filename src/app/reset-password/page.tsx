import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { AuthFrame } from '@/components/auth/frame'
import { ResetPasswordForm } from '@/components/auth/reset-form'
import { recoveryCookieName, validRecoveryCookie } from '@/lib/auth/recovery-cookie'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { pageMetadata } from '@/lib/seo/metadata'

export const metadata = pageMetadata({ title: 'Choose a new password', description: 'Set a new password for your Shuvia account.', path: '/reset-password', noIndex: true })

export default async function ResetPasswordPage() {
  const jar = await cookies()
  if (!validRecoveryCookie(jar.get(recoveryCookieName())?.value)) redirect('/forgot-password?error=invalid-link')
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/forgot-password?error=expired-link')
  return <AuthFrame eyebrow="A NEW LITTLE BEGINNING" title={<>Make a fresh<br/><em>password.</em></>} description="This private reset window is open for a short time. Choose a new password you’ll remember." note="Your old password will stop working once you save this one."><ResetPasswordForm/></AuthFrame>
}
