import { SurpriseStudio } from '@/components/surprises/surprise-studio'
import { loadCoupleDashboard } from '@/lib/couple/dashboard'
import '../home/dashboard.css'
import './surprises.css'
import '../device-polish.css'

export const dynamic = 'force-dynamic'
export default async function SurprisesPage() {
  const { dashboard } = await loadCoupleDashboard()
  return <SurpriseStudio spaceId={dashboard.space_id}/>
}
