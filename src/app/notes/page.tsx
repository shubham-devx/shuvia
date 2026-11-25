import { LoveNotes } from '@/components/notes/love-notes'
import { loadCoupleDashboard } from '@/lib/couple/dashboard'
import '../home/dashboard.css'
import './letters.css'
import '../device-polish.css'

export const dynamic = 'force-dynamic'
export default async function NotesPage() {
  const { dashboard } = await loadCoupleDashboard()
  return <LoveNotes spaceId={dashboard.space_id}/>
}
