import { redirect } from 'next/navigation'

const segmentMap: Record<string, string> = {
  memories: '/memories',
  notes: '/notes',
  dates: '/our-days',
  activities: '/games',
  settings: '/settings',
}

export default async function DashboardSubrouteRedirect({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params
  redirect(segmentMap[section] ?? '/home')
}
