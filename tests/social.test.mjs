import test from 'node:test'
import assert from 'node:assert/strict'
import { createToken, isRequestActive, requestDisplayStatus, transitionInvitation } from '../src/social.ts'

const request = (endsAt, status = 'active') => ({
  id: 'request-1', personId: 'maya', personName: 'Maya', avatar: 'M', gym: 'Movement Santa Clara',
  startsAt: '2030-01-01T18:00:00.000Z', endsAt, disciplines: ['Top rope'], lookingFor: 'Belay partner',
  status, selfReported: true, fictional: true
})

test('expired availability never appears active', () => {
  const now = new Date('2030-01-02T00:00:00.000Z')
  assert.equal(isRequestActive(request('2030-01-01T20:00:00.000Z'), now), false)
  assert.equal(requestDisplayStatus(request('2030-01-01T20:00:00.000Z'), [], now), 'expired')
})

test('invitation state follows valid transitions', () => {
  const invitation = { id: 'invite-1', requestId: 'request-1', fromId: 'you', toId: 'maya', status: 'pending', createdAt: '2030-01-01' }
  assert.equal(transitionInvitation(invitation, 'accepted').status, 'accepted')
  assert.throws(() => transitionInvitation({ ...invitation, status: 'declined' }, 'accepted'), /Cannot change invitation/)
})

test('pending and accepted invitations determine request display state', () => {
  const active = request('2030-01-03T20:00:00.000Z')
  const invite = { id: 'invite-1', requestId: active.id, fromId: 'you', toId: 'maya', status: 'pending', createdAt: '2030-01-01' }
  const now = new Date('2030-01-01T00:00:00.000Z')
  assert.equal(requestDisplayStatus(active, [invite], now), 'pending')
  assert.equal(requestDisplayStatus(active, [{ ...invite, status: 'accepted' }], now), 'confirmed')
})

test('share tokens are long, unpredictable-looking, and unique', () => {
  const first = createToken(), second = createToken()
  assert.ok(first.length >= 30)
  assert.notEqual(first, second)
})
