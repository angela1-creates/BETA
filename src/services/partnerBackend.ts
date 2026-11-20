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
  status: 'active' | 'matched' | 'cancelled' | 'expired'
}

export interface PartnerInvitation {
  id: string
  availabilityId: string
  status: 'pending' | 'accepted' | 'declined' | 'cancelled' | 'expired'
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
  expiresAt: string
}

export interface PartnerSession {
  id: string
  gymName: string
  startsAt: string
  endsAt: string
  status: 'confirmed' | 'reconfirmation_pending' | 'reconfirmed' | 'at_risk' | 'completed' | 'cancelled' | 'disputed'
  counterpartId?: string
  counterpartName?: string
  reconfirmBy?: string
  reconfirmedAt?: string
  completionResponse?: 'climbed' | 'did_not_climb'
}

export interface SmsPreference {
  phoneLast4: string
  smsOptIn: boolean
  verifiedAt: string
  stoppedAt?: string
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
  expiresAt: String(row.expires_at || ''),
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
        return {
          id: String(item.id), gymName: String(item.gym_name), startsAt: String(item.starts_at),
          endsAt: item.ends_at ? String(item.ends_at) : new Date(new Date(String(item.starts_at)).getTime() + 2 * 60 * 60_000).toISOString(),
          status: String(item.status) as PartnerSession['status'], counterpartId: item.counterpart_id ? String(item.counterpart_id) : undefined,
          counterpartName: item.counterpart_name ? String(item.counterpart_name) : undefined,
          reconfirmBy: item.reconfirm_by ? String(item.reconfirm_by) : undefined,
          reconfirmedAt: item.reconfirmed_at ? String(item.reconfirmed_at) : undefined,
          completionResponse: item.completion_response as PartnerSession['completionResponse'],
        }
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
  async cancelSession(sessionId: string, reason?: string) {
    const { error } = await client().rpc('cancel_partner_session', { p_session_id: sessionId, p_reason: reason || null })
    if (error) throw error
  },
  async reconfirmSession(sessionId: string) {
    const { data, error } = await client().rpc('reconfirm_partner_session', { p_session_id: sessionId })
    if (error) throw error
    return String(data)
  },
  async completeSession(sessionId: string, climbed: boolean) {
    const { data, error } = await client().rpc('complete_partner_session', { p_session_id: sessionId, p_climbed: climbed })
    if (error) throw error
    return String(data)
  },
  async block(profileId: string) {
    const { error } = await client().rpc('block_partner_profile', { p_profile_id: profileId })
    if (error) throw error
  },
  async report(profileId: string, reason: string) {
    const user = (await client().auth.getUser()).data.user
    if (!user) throw new Error('Sign in required')
    const { error } = await client().from('reports').insert({ reporter_id: user.id, reported_id: profileId, reason })
    if (error) throw error
  },
  async smsStatus(): Promise<SmsPreference | null> {
    const { data, error } = await client().functions.invoke('partner-sms', { body: { action: 'status' } })
    if (error) throw error
    const value = data?.preference as Record<string, unknown> | null
    if (!value) return null
    return {
      phoneLast4: String(value.phone_last4), smsOptIn: Boolean(value.sms_opt_in), verifiedAt: String(value.verified_at),
      stoppedAt: value.stopped_at ? String(value.stopped_at) : undefined,
    }
  },
  async startSmsVerification(phone: string) {
    const { error } = await client().functions.invoke('partner-sms', { body: { action: 'start', phone } })
    if (error) throw error
  },
  async confirmSmsVerification(phone: string, code: string) {
    const { error } = await client().functions.invoke('partner-sms', { body: { action: 'confirm', phone, code } })
    if (error) throw error
  },
  async disableSms() {
    const { error } = await client().functions.invoke('partner-sms', { body: { action: 'disable' } })
    if (error) throw error
  },
}
