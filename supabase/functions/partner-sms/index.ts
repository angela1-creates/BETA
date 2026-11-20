import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const allowedOrigins = (Deno.env.get('ALLOWED_ORIGINS') || '').split(',').map(value => value.trim()).filter(Boolean)
const cors = (request: Request) => {
  const origin = request.headers.get('origin') || ''
  return {
    'Access-Control-Allow-Origin': allowedOrigins.includes(origin) ? origin : allowedOrigins[0] || 'null',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-dispatch-secret',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  }
}

const json = (headers: HeadersInit, body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...headers, 'Content-Type': 'application/json' } })
const twilioAuth = () => `Basic ${btoa(`${Deno.env.get('TWILIO_ACCOUNT_SID')}:${Deno.env.get('TWILIO_AUTH_TOKEN')}`)}`
const twilioPost = async (url: string, values: Record<string, string>) => {
  const response = await fetch(url, { method: 'POST', headers: { Authorization: twilioAuth(), 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(values) })
  const value = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(String(value.message || 'SMS provider request failed'))
  return value as Record<string, unknown>
}

const e164 = (value: unknown) => {
  const normalized = String(value || '').replace(/[\s().-]/g, '')
  return /^\+[1-9]\d{7,14}$/.test(normalized) ? normalized : ''
}

const formatSessionTime = (value: unknown) => new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Los_Angeles', weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
}).format(new Date(String(value)))

Deno.serve(async request => {
  const headers = cors(request)
  if (request.method === 'OPTIONS') return new Response('ok', { headers })
  if (request.method !== 'POST') return json(headers, { error: 'Method not allowed' }, 405)

  const url = new URL(request.url)
  const webhook = url.searchParams.get('webhook')
  if (webhook) {
    if (url.searchParams.get('token') !== Deno.env.get('PARTNER_NOTIFICATION_WEBHOOK_SECRET')) return json(headers, { error: 'Webhook unavailable' }, 403)
    const form = await request.formData()
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })
    if (webhook === 'inbound') {
      const from = e164(form.get('From'))
      const body = String(form.get('Body') || '').trim().toUpperCase()
      if (from && ['STOP', 'UNSUBSCRIBE', 'CANCEL', 'END', 'QUIT'].includes(body)) {
        await admin.from('partner_sms_preferences').update({ sms_opt_in: false, stopped_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('phone_e164', from)
      }
      return new Response('<?xml version="1.0" encoding="UTF-8"?><Response/>', { headers: { 'Content-Type': 'text/xml' } })
    }
    if (webhook === 'status') {
      const eventId = url.searchParams.get('event')
      const messageId = String(form.get('MessageSid') || '')
      const providerStatus = String(form.get('MessageStatus') || '')
      const mapped = providerStatus === 'delivered' ? 'delivered' : ['failed', 'undelivered'].includes(providerStatus) ? 'failed' : 'sent'
      const now = new Date().toISOString()
      let update = admin.from('partner_notification_events').update({ status: mapped, provider_message_id: messageId, sent_at: mapped === 'sent' || mapped === 'delivered' ? now : undefined, delivered_at: mapped === 'delivered' ? now : undefined, last_error: mapped === 'failed' ? String(form.get('ErrorMessage') || providerStatus) : null })
      if (mapped === 'sent') update = update.in('status', ['sending', 'sent'])
      if (mapped === 'failed') update = update.neq('status', 'delivered')
      if (eventId) await update.eq('id', eventId)
      else await update.eq('provider_message_id', messageId)
      return new Response('<?xml version="1.0" encoding="UTF-8"?><Response/>', { headers: { 'Content-Type': 'text/xml' } })
    }
    return json(headers, { error: 'Unknown webhook' }, 404)
  }

  const body = await request.json().catch(() => ({})) as Record<string, unknown>
  const action = String(body.action || '')
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const admin = createClient(supabaseUrl, serviceRole, { auth: { persistSession: false } })

  if (action === 'dispatch') {
    if (request.headers.get('x-dispatch-secret') !== Deno.env.get('PARTNER_NOTIFICATION_DISPATCH_SECRET')) return json(headers, { error: 'Dispatch unavailable' }, 403)
    const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID')
    const messagingService = Deno.env.get('TWILIO_MESSAGING_SERVICE_SID')
    if (!accountSid || !messagingService) return json(headers, { error: 'SMS delivery is not configured' }, 503)
    await admin.rpc('queue_due_partner_notifications')
    const { data: events, error } = await admin.rpc('claim_partner_notification_events', { p_limit: 50 })
    if (error) return json(headers, { error: 'Could not load notification queue' }, 500)
    let sent = 0
    for (const event of events || []) {
      const { data: preference } = await admin.from('partner_sms_preferences').select('phone_e164,sms_opt_in,stopped_at').eq('profile_id', event.profile_id).maybeSingle()
      if (!preference?.sms_opt_in || preference.stopped_at) {
        await admin.from('partner_notification_events').update({ status: 'opted_out' }).eq('id', event.id)
        continue
      }
      const payload = (event.payload || {}) as Record<string, unknown>
      const when = formatSessionTime(payload.starts_at)
      const appUrl = `${Deno.env.get('APP_REDIRECT_URL') || ''}?screen=find`
      const message = event.event_type === 'interest_received'
        ? `BETA: A climber is interested in your ${when} plan. Accept or decline: ${appUrl} Reply STOP to opt out or HELP for help.`
        : event.event_type === 'session_confirmed'
          ? `BETA: Confirmed. You have a climbing partner ${when}. Meet at the front desk and complete normal safety checks: ${appUrl} Reply STOP to opt out or HELP for help.`
          : event.event_type === 'session_reminder'
            ? `BETA: Reminder: your climbing session is ${when}. Review the plan or add it to your calendar: ${appUrl} Reply STOP to opt out or HELP for help.`
            : event.event_type === 'reconfirmation_due'
              ? `BETA: Still climbing ${when}? Confirm or cancel in BETA: ${appUrl} Reply STOP to opt out or HELP for help.`
              : event.event_type === 'session_at_risk'
                ? `BETA: Your partner has not reconfirmed the ${when} session yet. Review or cancel the plan: ${appUrl} Reply STOP to opt out or HELP for help.`
                : event.event_type === 'session_cancelled'
            ? `BETA: Your climbing session for ${when} is cancelled. Review options or report a concern: ${appUrl} Reply STOP to opt out or HELP for help.`
            : `BETA: Please review your upcoming climbing session for ${when}: ${appUrl} Reply STOP to opt out or HELP for help.`
      try {
        const statusCallback = Deno.env.get('PARTNER_NOTIFICATION_STATUS_CALLBACK_URL')
        const eventStatusCallback = statusCallback ? new URL(statusCallback) : null
        eventStatusCallback?.searchParams.set('event', String(event.id))
        const result = await twilioPost(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
          To: preference.phone_e164,
          MessagingServiceSid: messagingService,
          Body: message,
          ...(eventStatusCallback ? { StatusCallback: eventStatusCallback.toString() } : {}),
        })
        await admin.from('partner_notification_events').update({ status: 'sent', provider_message_id: String(result.sid || ''), sent_at: new Date().toISOString(), last_error: null }).eq('id', event.id).eq('status', 'sending')
        sent += 1
      } catch (cause) {
        await admin.from('partner_notification_events').update({ status: 'failed', last_error: cause instanceof Error ? cause.message : 'Provider request failed' }).eq('id', event.id)
      }
    }
    return json(headers, { sent })
  }

  const origin = request.headers.get('origin') || ''
  if (!allowedOrigins.includes(origin)) return json(headers, { error: 'Origin not allowed' }, 403)
  const authorization = request.headers.get('Authorization')
  if (!authorization) return json(headers, { error: 'Authentication required' }, 401)
  const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } })
  const { data: userData } = await userClient.auth.getUser()
  if (!userData.user) return json(headers, { error: 'Invalid session' }, 401)

  if (action === 'status') {
    const { data } = await admin.from('partner_sms_preferences').select('phone_last4,sms_opt_in,verified_at,stopped_at').eq('profile_id', userData.user.id).maybeSingle()
    return json(headers, { preference: data || null })
  }
  if (action === 'disable') {
    await admin.from('partner_sms_preferences').update({ sms_opt_in: false, stopped_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('profile_id', userData.user.id)
    return json(headers, { disabled: true })
  }

  const phone = e164(body.phone)
  if (!phone) return json(headers, { error: 'Enter a valid phone number with country code' }, 400)
  const verifyService = Deno.env.get('TWILIO_VERIFY_SERVICE_SID')
  if (!verifyService) return json(headers, { error: 'SMS verification is not configured' }, 503)
  if (action === 'start') {
    await twilioPost(`https://verify.twilio.com/v2/Services/${verifyService}/Verifications`, { To: phone, Channel: 'sms' })
    return json(headers, { started: true })
  }
  if (action === 'confirm') {
    const code = String(body.code || '').trim()
    if (!/^\d{4,10}$/.test(code)) return json(headers, { error: 'Enter the verification code' }, 400)
    const result = await twilioPost(`https://verify.twilio.com/v2/Services/${verifyService}/VerificationCheck`, { To: phone, Code: code })
    if (result.status !== 'approved') return json(headers, { error: 'The verification code was not accepted' }, 400)
    const now = new Date().toISOString()
    const { error } = await admin.from('partner_sms_preferences').upsert({ profile_id: userData.user.id, phone_e164: phone, phone_last4: phone.slice(-4), verified_at: now, sms_opt_in: true, consent_version: 'partner-sms-v1', consented_at: now, stopped_at: null, updated_at: now })
    if (error) return json(headers, { error: 'Could not save SMS preference' }, 500)
    return json(headers, { verified: true, phoneLast4: phone.slice(-4) })
  }
  return json(headers, { error: 'Unknown action' }, 400)
})
