import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { enforceRateLimit } from '@/lib/auth/rate-limit'

export const runtime = 'nodejs'
const schema = z.discriminatedUnion('action', [
  z.object({ action:z.literal('send'), requestId:z.string().uuid(), templateId:z.enum(['postcard','pressed-flower','afterglow','little-letter']), title:z.string().trim().min(1).max(100), body:z.string().trim().min(1).max(5000), revealAt:z.string().datetime().optional() }),
  z.object({ action:z.enum(['read','favorite','notification-read']), id:z.string().uuid() }),
])
function sameOrigin(req:NextRequest) { return req.headers.get('origin') === new URL(req.url).origin }
async function actor() {
  const client=await createSupabaseServerClient(); const {data:{user}}=await client.auth.getUser()
  if(!user) return {error:NextResponse.json({error:'Log in to open your letters.'},{status:401})} as const
  if(!user.email_confirmed_at) return {error:NextResponse.json({error:'Verify your email first.'},{status:403})} as const
  const {data}=await client.from('profiles').select('onboarding_completed').eq('id',user.id).maybeSingle()
  if(!data?.onboarding_completed) return {error:NextResponse.json({error:'Finish onboarding first.'},{status:403})} as const
  return {user} as const
}
async function room(id:string) { return createSupabaseAdminClient().rpc('get_couple_love_notes',{p_actor_id:id}) }
async function applyNotificationPreference(userId:string,roomData:unknown){const {data}=await createSupabaseAdminClient().from('user_preferences').select('notifications_enabled').eq('user_id',userId).maybeSingle();if(data?.notifications_enabled===false&&roomData&&typeof roomData==='object')return {...roomData,notifications:[]};return roomData}
function errorResponse(message:string,code?:string) { return NextResponse.json({error:code==='42501'?'Connect your person before opening this feature.':message},{status:code==='42501'?403:code==='P0002'?404:400}) }
export async function GET() {
  try { const auth=await actor(); if('error' in auth)return auth.error; const {data,error}=await room(auth.user.id); if(error)return errorResponse(error.message,error.code); return NextResponse.json({room:await applyNotificationPreference(auth.user.id,data)},{headers:{'Cache-Control':'private, no-store'}}) }
  catch { return NextResponse.json({error:'Your letters are taking a moment to open.'},{status:503}) }
}
export async function POST(req:NextRequest) {
  if(!sameOrigin(req))return NextResponse.json({error:'This request could not be verified.'},{status:403})
  const parsed=schema.safeParse(await req.json().catch(()=>null)); if(!parsed.success)return NextResponse.json({error:'Check the letter details and try again.'},{status:400})
  try {
    const auth=await actor(); if('error' in auth)return auth.error
    const admin=createSupabaseAdminClient(); const value=parsed.data; let mutation
    if(value.action==='send') {
      if(!await enforceRateLimit(auth.user.id,'love-note-send'))return NextResponse.json({error:'You have sent several letters recently. Give the words a little room, then try again.'},{status:429})
      const due=value.revealAt?new Date(value.revealAt):new Date()
      if(due.getTime()<Date.now()-10000||due.getTime()>Date.now()+30*86400000)return NextResponse.json({error:'Choose a reveal time from now to 30 days ahead.'},{status:400})
      mutation=await admin.rpc('send_love_note',{p_actor_id:auth.user.id,p_request_id:value.requestId,p_template_id:value.templateId,p_title:value.title,p_body:value.body,p_reveal_at:value.revealAt??null})
    } else if(value.action==='read') mutation=await admin.rpc('mark_love_note_read',{p_actor_id:auth.user.id,p_note_id:value.id})
    else if(value.action==='favorite') mutation=await admin.rpc('toggle_love_note_favorite',{p_actor_id:auth.user.id,p_note_id:value.id})
    else mutation=await admin.rpc('mark_shuvia_notification_read',{p_actor_id:auth.user.id,p_notification_id:value.id})
    if(mutation.error)return errorResponse(mutation.error.message,mutation.error.code)
    const {data,error}=await room(auth.user.id); if(error)return errorResponse(error.message,error.code)
    return NextResponse.json({room:await applyNotificationPreference(auth.user.id,data),result:mutation.data??null},{headers:{'Cache-Control':'private, no-store'}})
  } catch { return NextResponse.json({error:'We could not save that just now. Please try again.'},{status:503}) }
}
