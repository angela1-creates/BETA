export interface MovementGym {
  id: string
  name: string
  city: string
  disciplines: Array<'Bouldering' | 'Top rope' | 'Lead'>
}

// Stable IDs are mirrored in the Supabase seed migration so web and native
// clients can share drafts before the remote gym directory has loaded.
export const MOVEMENT_GYMS: MovementGym[] = [
  { id: 'ba000000-0000-4000-8000-000000000001', name: 'Movement Belmont', city: 'Belmont', disciplines: ['Bouldering', 'Top rope', 'Lead'] },
  { id: 'ba000000-0000-4000-8000-000000000002', name: 'Movement Mountain View', city: 'Mountain View', disciplines: ['Bouldering'] },
  { id: 'ba000000-0000-4000-8000-000000000003', name: 'Movement San Francisco', city: 'San Francisco', disciplines: ['Bouldering', 'Top rope', 'Lead'] },
  { id: 'ba000000-0000-4000-8000-000000000004', name: 'Movement Santa Clara', city: 'Santa Clara', disciplines: ['Bouldering'] },
  { id: 'ba000000-0000-4000-8000-000000000005', name: 'Movement Sunnyvale', city: 'Sunnyvale', disciplines: ['Bouldering', 'Top rope', 'Lead'] },
]

export const movementGymByName = (name: string) => MOVEMENT_GYMS.find(gym => gym.name === name) || MOVEMENT_GYMS[4]
