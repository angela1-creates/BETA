import { supabase } from './supabase'

export interface CrewMemberRecord {
  id: string
  displayName: string
  role: 'owner' | 'member'
  joinedAt: string
}

export interface CrewRecord {
  id: string
  name: string
  kind: 'Friends' | 'Couple' | 'Family' | 'Gym group'
  guardianManaged: boolean
  ownerId: string
  role: 'owner' | 'member'
  createdAt: string
  members: CrewMemberRecord[]
}

export interface CrewInvitationPreview {
  crewName: string
  inviterName: string
  expiresAt: string
}

export interface CrewInvitationRecord {
  id: string
  crewId: string
  status: 'pending' | 'accepted' | 'declined' | 'revoked' | 'expired'
  expiresAt: string
  createdAt: string
}

const client = () => {
  if (!supabase) throw new Error('The crew backend is not configured.')
  return supabase
}

const secureToken = () => {
  if (!globalThis.crypto?.getRandomValues) throw new Error('Secure invitation links are unavailable in this browser.')
  const bytes = new Uint8Array(32)
  globalThis.crypto.getRandomValues(bytes)
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')
}

const sha256 = async (value: string) => {
  if (!globalThis.crypto?.subtle) throw new Error('Secure invitation links are unavailable in this browser.')
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
}

const toCrew = (row: Record<string, unknown>): CrewRecord => ({
  id: String(row.id),
  name: String(row.name),
  kind: row.kind as CrewRecord['kind'],
  guardianManaged: Boolean(row.guardian_managed),
  ownerId: String(row.owner_id),
  role: row.role as CrewRecord['role'],
  createdAt: String(row.created_at),
  members: Array.isArray(row.members) ? row.members.map(member => {
    const item = member as Record<string, unknown>
    return {
      id: String(item.id),
      displayName: String(item.display_name),
      role: item.role as CrewMemberRecord['role'],
      joinedAt: String(item.joined_at),
    }
  }) : [],
})

export const crewBackend = {
  async list(): Promise<CrewRecord[]> {
    const { data, error } = await client().rpc('my_crews')
    if (error) throw error
    return (Array.isArray(data) ? data : []).map(row => toCrew(row as Record<string, unknown>))
  },

  async create(input: { name: string; kind: CrewRecord['kind']; guardianManaged: boolean }) {
    const { data, error } = await client().rpc('create_crew', {
      p_name: input.name,
      p_kind: input.kind,
      p_guardian_managed: input.guardianManaged,
    })
    if (error) throw error
    return String(data)
  },

  async createInvitation(crewId: string) {
    const token = secureToken()
    const tokenHash = await sha256(token)
    const { data, error } = await client().rpc('create_crew_invitation', {
      p_crew_id: crewId,
      p_token_hash: tokenHash,
    })
    if (error) throw error
    const row = Array.isArray(data) ? data[0] : data
    if (!row) throw new Error('The invitation could not be created.')
    return { id: String(row.id), token, expiresAt: String(row.expires_at) }
  },

  async invitations(): Promise<CrewInvitationRecord[]> {
    const { data, error } = await client().from('crew_invitations')
      .select('id,crew_id,status,expires_at,created_at')
      .eq('status', 'pending')
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
    if (error) throw error
    return (data || []).map(row => ({
      id: String(row.id),
      crewId: String(row.crew_id),
      status: row.status as CrewInvitationRecord['status'],
      expiresAt: String(row.expires_at),
      createdAt: String(row.created_at),
    }))
  },

  async resolveInvitation(token: string): Promise<CrewInvitationPreview | null> {
    const tokenHash = await sha256(token)
    const { data, error } = await client().rpc('resolve_crew_invitation', { p_token_hash: tokenHash })
    if (error) throw error
    const row = Array.isArray(data) ? data[0] : data
    return row ? {
      crewName: String(row.crew_name),
      inviterName: String(row.inviter_name),
      expiresAt: String(row.expires_at),
    } : null
  },

  async respondToInvitation(token: string, response: 'accepted' | 'declined') {
    const tokenHash = await sha256(token)
    const { data, error } = await client().rpc('respond_crew_invitation', {
      p_token_hash: tokenHash,
      p_response: response,
    })
    if (error) throw error
    return String(data)
  },

  async revokeInvitation(invitationId: string) {
    const { error } = await client().rpc('revoke_crew_invitation', { p_invitation_id: invitationId })
    if (error) throw error
  },

  async delete(crewId: string) {
    const { error } = await client().rpc('delete_crew', { p_crew_id: crewId })
    if (error) throw error
  },

  async leave(crewId: string) {
    const { error } = await client().rpc('leave_crew', { p_crew_id: crewId })
    if (error) throw error
  },

  async removeMember(crewId: string, profileId: string) {
    const { error } = await client().rpc('remove_crew_member', { p_crew_id: crewId, p_profile_id: profileId })
    if (error) throw error
  },
}
