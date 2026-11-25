import { CoupleHome } from '@/components/dashboard/couple-home'
import { loadCoupleDashboard } from '@/lib/couple/dashboard'
import './dashboard.css'
import './dashboard-details.css'
import '../device-polish.css'

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const { dashboard, userId } = await loadCoupleDashboard()
  return <CoupleHome data={dashboard} userId={userId}/>
}
