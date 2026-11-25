import { MemoryScrapbook } from '@/components/memories/memory-scrapbook'
import { loadCoupleDashboard } from '@/lib/couple/dashboard'
import '../home/dashboard.css'
import '../notes/letters.css'
import './memories.css'
import '../device-polish.css'

export const dynamic = 'force-dynamic'
export default async function MemoriesPage() {
  const { dashboard } = await loadCoupleDashboard()
  return <MemoryScrapbook spaceId={dashboard.space_id}/>
}
