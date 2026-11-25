import { SpecialDays } from '@/components/days/special-days'
import { loadCoupleDashboard } from '@/lib/couple/dashboard'
import '../home/dashboard.css'
import '../notes/letters.css'
import '../memories/memories.css'

export const dynamic = 'force-dynamic'
export default async function OurDaysPage() {
  const { dashboard, userId } = await loadCoupleDashboard()
  return <SpecialDays spaceId={dashboard.space_id} userId={userId}/>
}
