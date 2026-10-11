import { supabase } from './supabase'

export interface PartnerRequest {
  id: string
  ownerId: string
  displayName: string
  experienceLevel?: string
  gymId: string
  gymName: string
  startsAt: string
  endsAt: string
  disciplines: string[]
  lookingFor: string
  message: string
  status: 'active' | 'pending' | 'confirmed' | 'cancelled' | 'expired'
}

export interface PartnerInvitation {
  id: string
  availabilityId: string
  status: 'pending' | 'accepted' | 'declined' | 'cancelled'
  direction: 'sent' | 'received'
  counterpartId: string
  counterpartName: string
  gymId: string
  gymName: string
  startsAt: string
  endsAt: string
  disciplines: string[]
  lookingFor: string
  message: string
}

export interface PartnerSession {
  id: string
  gymName: string
  startsAt: string
  status: 'confirmed' | 'completed' | 'cancelled'
}

export interface PartnerActivity {
  requests: PartnerRequest[]
  invitations: PartnerInvitation[]
  sessions: PartnerSession[]
}

const client = () => {
  if (!supabase) throw new Error('Supabase is not configured')
  return supabase
}

const requestFromRow = (row: Record<string, unknown>): PartnerRequest => ({
  id: String(row.id), ownerId: String(row.owner_id), displayName: String(row.display_name),
  experienceLevel: row.experience_level ? String(row.experience_level) : undefined,
  gymId: String(row.gym_id), gymName: String(row.gym_name), startsAt: String(row.starts_at),
  endsAt: String(row.ends_at), disciplines: Array.isArray(row.disciplines) ? row.disciplines.map(String) : [],
  lookingFor: String(row.looking_for), message: String(row.message || ''),
  status: String(row.status) as PartnerRequest['status'],
})

const invitationFromRow = (row: Record<string, unknown>): PartnerInvitation => ({
  id: String(row.id), availabilityId: String(row.availability_id),
  status: String(row.status) as PartnerInvitation['status'], direction: String(row.direction) as PartnerInvitation['direction'],
  counterpartId: String(row.counterpart_id), counterpartName: String(row.counterpart_name),
  gymId: String(row.gym_id), gymName: String(row.gym_name), startsAt: String(row.starts_at),
  endsAt: String(row.ends_at), disciplines: Array.isArray(row.disciplines) ? row.disciplines.map(String) : [],
  lookingFor: String(row.looking_for), message: String(row.message || ''),
})

export const partnerBackend = {
  async board(gymId: string) {
    const { data, error } = await client().rpc('partner_board', { p_gym_id: gymId })
    if (error) throw error
    return ((data || []) as Record<string, unknown>[]).map(requestFromRow)
  },
  async activity(): Promise<PartnerActivity> {
    const { data, error } = await client().rpc('my_partner_activity')
    if (error) throw error
    const value = (data || {}) as Record<string, unknown>
    return {
      requests: (Array.isArray(value.requests) ? value.requests : []).map(row => requestFromRow(row as Record<string, unknown>)),
      invitations: (Array.isArray(value.invitations) ? value.invitations : []).map(row => invitationFromRow(row as Record<string, unknown>)),
      sessions: (Array.isArray(value.sessions) ? value.sessions : []).map(row => {
        const item = row as Record<string, unknown>
        return { id: String(item.id), gymName: String(item.gym_name), startsAt: String(item.starts_at), status: String(item.status) as PartnerSession['status'] }
      }),
    }
  },
  async create(input: { ownerId: string; gymId: string; startsAt: string; endsAt: string; disciplines: string[]; lookingFor: string; message: string }) {
    const { error } = await client().from('availability').insert({
      owner_id: input.ownerId, gym_id: input.gymId, starts_at: input.startsAt, ends_at: input.endsAt,
      expires_at: input.endsAt, disciplines: input.disciplines, looking_for: input.lookingFor,
      message: input.message || null, status: 'active',
    })
    if (error) throw error
  },
  async cancelRequest(id: string) {
    const { error } = await client().from('availability').update({ status: 'cancelled' }).eq('id', id)
    if (error) throw error
  },
  async invite(availabilityId: string) {
    const { error } = await client().rpc('send_partner_invitation', { p_availability_id: availabilityId })
    if (error) throw error
  },
  async respond(invitationId: string, response: 'accepted' | 'declined') {
    const { error } = await client().rpc('respond_partner_invitation', { p_invitation_id: invitationId, p_response: response })
    if (error) throw error
  },
  async cancelInvitation(invitationId: string) {
    const { error } = await client().rpc('cancel_partner_invitation', { p_invitation_id: invitationId })
    if (error) throw error
  },
  async block(profileId: string) {
    const user = (await client().auth.getUser()).data.user
    if (!user) throw new Error('Sign in required')
    const { error } = await client().from('blocks').insert({ blocker_id: user.id, blocked_id: profileId })
    if (error) throw error
  },
  async report(profileId: string, reason: string) {
    const user = (await client().auth.getUser()).data.user
    if (!user) throw new Error('Sign in required')
    const { error } = await client().from('reports').insert({ reporter_id: user.id, reported_id: profileId, reason })
    if (error) throw error
  },
}
