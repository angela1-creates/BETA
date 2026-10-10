export type RequestStatus = 'active' | 'pending' | 'confirmed' | 'expired' | 'cancelled'
export type InvitationStatus = 'pending' | 'accepted' | 'declined' | 'cancelled'
export type RsvpStatus = 'pending' | 'accepted' | 'declined'

export interface AvailabilityRequest {
  id: string
  personId: string
  personName: string
  avatar: string
  gym: string
  startsAt: string
  endsAt: string
  disciplines: string[]
  lookingFor: string
  experience?: string
  message?: string
  status: RequestStatus
  selfReported: boolean
  fictional: boolean
}

export interface Invitation {
  id: string
  requestId: string
  fromId: string
  toId: string
  status: InvitationStatus
  createdAt: string
}

export interface ClimbingSession {
  id: string
  requestId?: string
  partnerIds: string[]
  gym: string
  startsAt: string
  status: 'confirmed' | 'completed' | 'cancelled'
  crewId?: string
  note?: string
}

export interface ClimbMoment {
  id: string
  title: string
  caption: string
  grade?: string
  gym?: string
  mediaUrl?: string
  mediaKind?: 'image' | 'video'
  private: boolean
  shareToken?: string
  createdAt: string
}

export interface ChallengeResponse {
  id: string
  personName: string
  caption: string
  move: string
  reaction?: 'Clever beta' | 'Smooth move' | 'Creative solution' | 'Nice recovery'
  revealed: boolean
}

export interface BetaChallenge {
  id: string
  title: string
  prompt: string
  mediaUrl?: string
  private: boolean
  shareToken?: string
  responses: ChallengeResponse[]
  revealResponses: boolean
  createdAt: string
}

export interface Crew {
  id: string
  name: string
  kind: 'Friends' | 'Couple' | 'Family' | 'Gym group'
  members: string[]
  private: true
  guardianManaged?: boolean
}

export interface CrewInvitation {
  id: string
  crewId: string
  inviteeName: string
  channel: 'link' | 'email'
  status: RsvpStatus
  token: string
  createdAt: string
}

export interface SessionProposal {
  id: string
  crewId: string
  gym: string
  startsAt: string
  note?: string
  responses: { personName: string; status: RsvpStatus }[]
  status: 'proposed' | 'confirmed' | 'cancelled'
  createdAt: string
}

export interface SafetySettings {
  profileVisibility: 'Gym only' | 'Invited people only'
  blockedIds: string[]
  adultConfirmed: boolean
  shareConsent: boolean
}

export interface DemoState {
  requests: AvailabilityRequest[]
  invitations: Invitation[]
  sessions: ClimbingSession[]
  favoriteIds: string[]
  favoriteRequests: string[]
  climbs: ClimbMoment[]
  challenges: BetaChallenge[]
  crews: Crew[]
  crewInvitations: CrewInvitation[]
  sessionProposals: SessionProposal[]
  safety: SafetySettings
  events: { name: string; at: string }[]
}

export const isRequestActive = (request: AvailabilityRequest, now = new Date()) =>
  request.status !== 'cancelled' && request.status !== 'expired' && new Date(request.endsAt).getTime() > now.getTime()

export function requestDisplayStatus(request: AvailabilityRequest, invitations: Invitation[], now = new Date()): RequestStatus {
  if (!isRequestActive(request, now)) return request.status === 'cancelled' ? 'cancelled' : 'expired'
  const invite = invitations.find(item => item.requestId === request.id)
  if (invite?.status === 'accepted') return 'confirmed'
  if (invite?.status === 'pending') return 'pending'
  if (request.status === 'pending') return 'active'
  return request.status
}

export function transitionInvitation(invitation: Invitation, next: InvitationStatus): Invitation {
  const allowed: Record<InvitationStatus, InvitationStatus[]> = {
    pending: ['accepted', 'declined', 'cancelled'],
    accepted: ['cancelled'],
    declined: [],
    cancelled: []
  }
  if (!allowed[invitation.status].includes(next)) throw new Error(`Cannot change invitation from ${invitation.status} to ${next}`)
  return { ...invitation, status: next }
}

export function transitionRequest(request: AvailabilityRequest, next: RequestStatus): AvailabilityRequest {
  const allowed: Record<RequestStatus, RequestStatus[]> = {
    active: ['pending', 'cancelled', 'expired'],
    pending: ['active', 'confirmed', 'cancelled', 'expired'],
    confirmed: ['cancelled'],
    expired: [],
    cancelled: []
  }
  if (!allowed[request.status].includes(next)) throw new Error(`Cannot change request from ${request.status} to ${next}`)
  return { ...request, status: next }
}

export const hasPendingInvitation = (invitations: Invitation[], requestId: string) =>
  invitations.some(item => item.requestId === requestId && item.status === 'pending')

export const createToken = () => {
  const bytes = new Uint8Array(18)
  if (globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(bytes)
  else bytes.forEach((_, index) => { bytes[index] = Math.floor(Math.random() * 256) })
  return Array.from(bytes, byte => byte.toString(36).padStart(2, '0')).join('')
}

export const trackEvent = (state: DemoState, name: string): DemoState => ({
  ...state,
  events: [...state.events.slice(-99), { name, at: new Date().toISOString() }]
})

export function screenHref(pathname: string, search: string, screen: string) {
  const params = new URLSearchParams(search)
  params.delete('shared')
  if (screen === 'home') params.delete('screen')
  else params.set('screen', screen)
  const query = params.toString()
  return `${pathname}${query ? `?${query}` : ''}`
}
