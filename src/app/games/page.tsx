import { GameRoom } from '@/components/dashboard/game-room'
import { loadCoupleDashboard } from '@/lib/couple/dashboard'
import './game.css'

export const dynamic = 'force-dynamic'
export default async function GamesPage() {
  const { dashboard, userId } = await loadCoupleDashboard()
  return <GameRoom spaceId={dashboard.space_id} userId={userId}/>
}
