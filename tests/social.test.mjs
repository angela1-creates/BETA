import test from 'node:test'
import assert from 'node:assert/strict'
import { calendarHref, createToken, hasPendingInvitation, isRequestActive, nextConfirmedSession, requestDisplayStatus, screenHref, transitionInvitation, transitionRequest } from '../src/social.ts'

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

test('availability requests cannot skip or repeat state transitions', () => {
  const active = request('2030-01-03T20:00:00.000Z')
  const pending = transitionRequest(active, 'pending')
  assert.equal(pending.status, 'pending')
  assert.equal(transitionRequest(pending, 'confirmed').status, 'confirmed')
  assert.throws(() => transitionRequest(active, 'confirmed'), /Cannot change request/)
  assert.throws(() => transitionRequest({ ...active, status: 'cancelled' }, 'active'), /Cannot change request/)
})

test('cancelled invitations release a pending request display state', () => {
  const active = { ...request('2030-01-03T20:00:00.000Z'), status: 'pending' }
  const cancelled = { id: 'invite-1', requestId: active.id, fromId: 'you', toId: 'maya', status: 'cancelled', createdAt: '2030-01-01' }
  assert.equal(requestDisplayStatus(active, [cancelled], new Date('2030-01-01T00:00:00.000Z')), 'active')
  assert.equal(hasPendingInvitation([cancelled], active.id), false)
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

// Regression: Route Lab query persisted after returning to the social app.
// Found by /investigate on 2026-10-09.
test('screen navigation removes stale Route Lab query on home and updates other screens', () => {
  assert.equal(screenHref('/BETA/', '?screen=learn', 'home'), '/BETA/')
  assert.equal(screenHref('/BETA/', '?screen=learn', 'climbs'), '/BETA/?screen=climbs')
  assert.equal(screenHref('/BETA/', '?shared=secret&screen=learn', 'share'), '/BETA/?screen=share')
})

test('the next confirmed climbing session is selected chronologically', () => {
  const sessions = [
    { id: 'later', gymName: 'Movement Sunnyvale', startsAt: '2030-01-03T18:00:00.000Z', status: 'confirmed' },
    { id: 'cancelled', gymName: 'Movement Belmont', startsAt: '2030-01-01T18:00:00.000Z', status: 'cancelled' },
    { id: 'next', gymName: 'Movement Santa Clara', startsAt: '2030-01-02T18:00:00.000Z', status: 'confirmed' },
  ]
  assert.equal(nextConfirmedSession(sessions, new Date('2030-01-01T00:00:00.000Z'))?.id, 'next')
})

test('confirmed sessions can be downloaded as calendar events', () => {
  const href = calendarHref({ id: 'session-1', gymName: 'Movement Sunnyvale', startsAt: '2030-01-02T18:00:00.000Z', status: 'confirmed' })
  const calendar = decodeURIComponent(href.split(',')[1])
  assert.match(calendar, /BEGIN:VCALENDAR/)
  assert.match(calendar, /DTSTART:20300102T180000Z/)
  assert.match(calendar, /LOCATION:Movement Sunnyvale/)
})
