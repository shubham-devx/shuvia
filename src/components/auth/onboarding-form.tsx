'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ArrowRight, Check } from 'lucide-react'
import { activityOptions, discoveryOptions, expectationOptions, relationshipOptions, type OnboardingData } from '@/lib/auth/schemas'
import { safeInternalPath } from '@/lib/auth/redirect'
import { AuthMessage } from './frame'
import { ShuviaLogo } from '@/components/brand/shuvia-logo'

const steps = [
  { title: 'What do you hope to find here?', hint: 'Choose every little thing that feels right.', options: expectationOptions, field: 'expectations', multiple: true },
  { title: 'What describes your relationship?', hint: 'Every story has its own shape.', options: relationshipOptions, field: 'relationshipType', multiple: false },
  { title: 'What sounds fun to you both?', hint: 'We’ll make more room for what you love.', options: activityOptions, field: 'interestedActivities', multiple: true },
  { title: 'How did you find us?', hint: 'We’re glad you did.', options: discoveryOptions, field: 'discoverySource', multiple: false },
] as const

type Props = { initial: OnboardingData; nextRoute: string }

export function OnboardingForm({ initial, nextRoute }: Props) {
  const [step, setStep] = useState(0); const [data, setData] = useState<OnboardingData>(initial)
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const router = useRouter()
  const current = steps[step]!
  const picked = current.field === 'expectations' ? data.expectations : current.field === 'interestedActivities' ? data.interestedActivities : current.field === 'relationshipType' ? data.relationshipType : data.discoverySource

  function toggle(option: string) {
    setData((previous) => {
      if (current.field === 'expectations') {
        const values = previous.expectations
        return { ...previous, expectations: values.includes(option as typeof expectationOptions[number]) ? values.filter((value) => value !== option) : [...values, option as typeof expectationOptions[number]] }
      }
      if (current.field === 'interestedActivities') {
        const values = previous.interestedActivities
        return { ...previous, interestedActivities: values.includes(option as typeof activityOptions[number]) ? values.filter((value) => value !== option) : [...values, option as typeof activityOptions[number]] }
      }
      if (current.field === 'relationshipType') return { ...previous, relationshipType: previous.relationshipType === option ? null : option as typeof relationshipOptions[number] }
      return { ...previous, discoverySource: previous.discoverySource === option ? null : option as typeof discoveryOptions[number] }
    })
  }

  async function finish(values: OnboardingData) {
    setBusy(true); setError('')
    try {
      const response = await fetch('/api/auth/onboarding', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(values) })
      const result: { error?: string } = await response.json()
      if (!response.ok) throw new Error(result.error ?? 'We could not save that just now. Please try again.')
      router.replace(safeInternalPath(nextRoute, '/home'))
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'We could not save that just now.') }
    finally { setBusy(false) }
  }

  return <div className="onboarding-wrap"><div className="onboarding-top"><ShuviaLogo className="auth-logo"/><button className="onboarding-skip" disabled={busy} onClick={() => finish({ expectations: [], relationshipType: null, interestedActivities: [], discoverySource: null })}>Skip for now</button></div>
    <div className="progress-meta"><span>GETTING TO KNOW YOU</span><span>{step + 1} OF {steps.length}</span></div><div className="progress-track" role="progressbar" aria-valuemin={1} aria-valuemax={4} aria-valuenow={step + 1}><div className="progress-fill" style={{ width: `${((step + 1) / steps.length) * 100}%` }}/></div>
    <section className="onboarding-step" aria-labelledby="onboarding-title"><p className="eyebrow">A LITTLE ABOUT YOUR US</p><h1 id="onboarding-title">{current.title}</h1><p>{current.hint}</p>{error && <AuthMessage kind="error">{error}</AuthMessage>}
      <div className="choice-grid">{current.options.map((option) => {
        const selected = Array.isArray(picked) ? picked.includes(option as never) : picked === option
        return <button type="button" className={`choice${selected ? ' selected' : ''}`} aria-pressed={selected} key={option} onClick={() => toggle(option)}><span className="choice-mark">{selected && <Check size={11}/>}</span>{option}</button>
      })}</div>
    </section><div className="onboarding-actions"><button className="onboarding-back" disabled={busy || step === 0} onClick={() => setStep((value) => Math.max(0, value - 1))}><ArrowLeft size={14}/> Back</button>{step < steps.length - 1 ? <button className="button button-dark" disabled={busy} onClick={() => setStep((value) => Math.min(steps.length - 1, value + 1))}>Continue <ArrowRight size={15}/></button> : <button className="button button-dark" disabled={busy} onClick={() => finish(data)}>{busy ? 'Saving…' : 'Finish my space'} <ArrowRight size={15}/></button>}</div>
  </div>
}
