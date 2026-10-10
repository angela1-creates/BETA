import type { AvailabilityRequest, DemoState } from './social'

const nextDate = (days: number, hour: number) => {
  const date = new Date()
  date.setDate(date.getDate() + days)
  date.setHours(hour, 0, 0, 0)
  return date.toISOString()
}

export const demoRequests = (): AvailabilityRequest[] => [
  {
    id: 'maya-friday', personId: 'maya', personName: 'Maya', avatar: 'M', gym: 'Movement Santa Clara',
    startsAt: nextDate(2, 18), endsAt: nextDate(2, 20), disciplines: ['Top rope'], lookingFor: 'Belay partner',
    experience: 'Comfortable on 5.9–5.10', message: 'Looking for someone to trade belays. Warm, patient, and happy to take turns!',
    status: 'active', selfReported: true, fictional: true
  },
  {
    id: 'jordan-saturday', personId: 'jordan', personName: 'Jordan', avatar: 'J', gym: 'Movement Santa Clara',
    startsAt: nextDate(3, 10), endsAt: nextDate(3, 12), disciplines: ['Lead', 'Top rope'], lookingFor: 'Climbing buddy',
    experience: 'Lead certified (self-reported)', message: 'Easy mileage morning. I give attentive catches and like projecting together.',
    status: 'active', selfReported: true, fictional: true
  },
  {
    id: 'sam-boulder', personId: 'sam', personName: 'Sam', avatar: 'S', gym: 'The Studio',
    startsAt: nextDate(4, 17), endsAt: nextDate(4, 19), disciplines: ['Bouldering'], lookingFor: 'Small group',
    experience: 'V2–V4', message: 'New to town. Come trade ideas, no grade chasing required.',
    status: 'active', selfReported: true, fictional: true
  }
]

export const initialDemoState = (): DemoState => ({
  requests: demoRequests(), invitations: [], sessions: [], favoriteIds: ['jordan'], favoriteRequests: [],
  climbs: [{
    id: 'climb-first-lead', title: 'My first lead climb', caption: 'Shaky start, big exhale, best crew.', grade: '5.9',
    gym: 'Movement Santa Clara', mediaUrl: `${import.meta.env.BASE_URL}routes/weight-shift-v3-coral.webp`, mediaKind: 'image',
    private: true, createdAt: new Date().toISOString()
  }],
  challenges: [{
    id: 'challenge-corner', title: 'The corner problem', prompt: 'How would YOU climb this?',
    mediaUrl: `${import.meta.env.BASE_URL}routes/multiple-betas-v4-sage.webp`, private: true, revealResponses: false,
    responses: [
      { id: 'r1', personName: 'Maya', caption: 'I think I would keep the left hip close.', move: 'High right foot, flag left, then reach.', revealed: false },
      { id: 'r2', personName: 'Jordan', caption: 'Different body, different idea.', move: 'Foot swap first, turn in, then go left hand.', revealed: false }
    ], createdAt: new Date().toISOString()
  }],
  crews: [{ id: 'family-crew', name: 'Sunday Senders', kind: 'Family', members: ['You', 'Alex', 'Nana Jo'], private: true, guardianManaged: true }],
  safety: { profileVisibility: 'Gym only', blockedIds: [], adultConfirmed: true, shareConsent: false }, events: []
})

const KEY = 'beta-social-demo-v1'

export function loadDemoState(): DemoState {
  try {
    const saved = localStorage.getItem(KEY)
    if (!saved) return initialDemoState()
    return { ...initialDemoState(), ...JSON.parse(saved) }
  } catch { return initialDemoState() }
}

export function saveDemoState(state: DemoState) {
  try { localStorage.setItem(KEY, JSON.stringify(state)); return true }
  catch { return false }
}
