import { Header, Footer } from '@/App'
import { JoinByCode } from '@/components/couple/invitation-acceptance'
import { requireShuviaUser } from '@/lib/auth/require-user'

export const dynamic = 'force-dynamic'

export default async function JoinPage() {
  await requireShuviaUser()
  return <><Header/><JoinByCode/><Footer/></>
}
