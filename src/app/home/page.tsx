import { CoupleHome } from '@/components/dashboard/couple-home'
import { ConnectionHome } from '@/components/dashboard/connection-home'
import { loadCoupleDashboard } from '@/lib/couple/dashboard'
import './dashboard.css'
import './dashboard-details.css'
import '../device-polish.css'

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const { dashboard, userId, name, space, loadError } = await loadCoupleDashboard({ allowUnconnected: true })
  if (!dashboard) return <ConnectionHome name={name} state={space?.state ?? 'disconnected'} isOwner={space?.is_owner ?? false} loadError={loadError}/>
  return <CoupleHome data={dashboard} userId={userId}/>
}
