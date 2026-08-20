import * as React from 'npm:react@18.3.1'
import { renderAsync } from 'npm:@react-email/components@0.0.22'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { TEMPLATES } from '../_shared/transactional-email-templates/registry.ts'
import { validateEmailDomains } from '../_shared/email-domain-config.ts'

// Must mirror the constants in send-transactional-email/index.ts
const SITE_NAME = 'scardtopiacatalogo'
const SENDER_DOMAIN = 'notify.spencerscardtopia.com.br'
const FROM_DOMAIN = 'spencerscardtopia.com.br'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Admin-only: preview email templates and inspect email_send_log.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
  const admin = createClient(supabaseUrl, serviceKey)

  const authHeader = req.headers.get('Authorization') ?? ''
  if (!authHeader.startsWith('Bearer ')) {
    return json({ error: 'Unauthorized' }, 401)
  }
  const token = authHeader.slice('Bearer '.length)
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(token)
  if (claimsErr || !claimsData?.claims?.sub) return json({ error: 'Unauthorized' }, 401)

  const { data: roleRow } = await admin
    .from('user_roles')
    .select('role')
    .eq('user_id', claimsData.claims.sub as string)
    .eq('role', 'admin')
    .maybeSingle()
  if (!roleRow) return json({ error: 'Forbidden' }, 403)

  let body: any
  try { body = await req.json() } catch { return json({ error: 'Invalid JSON' }, 400) }

  const action = body?.action as string

  // List templates
  if (action === 'list-templates') {
    const templates = Object.entries(TEMPLATES).map(([name, t]) => ({
      name,
      displayName: t.displayName || name,
      hasPreviewData: !!t.previewData,
      subject: typeof t.subject === 'string' ? t.subject : '(dynamic)',
    }))
    return json({ templates })
  }

  // Render a template
  if (action === 'render') {
    const name = String(body?.templateName ?? '')
    const entry = TEMPLATES[name]
    if (!entry) return json({ error: 'Template not found' }, 404)

    let data = body?.templateData
    if (!data && body?.orderId) {
      // Build sample data from a real order
      const { data: order } = await admin
        .from('orders')
        .select('id, user_id, items, total, payment_method, status, tracking_code')
        .eq('id', body.orderId)
        .maybeSingle()
      if (!order) return json({ error: 'Order not found' }, 404)
      let customerName = 'Cliente'
      if (order.user_id) {
        const { data: profile } = await admin
          .from('customer_profiles').select('display_name').eq('id', order.user_id).maybeSingle()
        customerName = profile?.display_name ?? customerName
      }
      const items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items
      const common = { customerName, orderId: order.id, total: order.total, items,
        paymentMethod: order.payment_method, status: order.status, trackingCode: order.tracking_code }
      data = common
    }
    if (!data) data = entry.previewData || {}

    try {
      const html = await renderAsync(React.createElement(entry.component, data))
      const subject = typeof entry.subject === 'function' ? entry.subject(data) : entry.subject
      return json({ html, subject, templateData: data })
    } catch (err) {
      return json({ error: 'Render failed', detail: String(err) }, 500)
    }
  }

  // List recent orders for the picker
  if (action === 'recent-orders') {
    const { data: orders } = await admin
      .from('orders')
      .select('id, total, status, payment_method, created_at, customer_info')
      .order('created_at', { ascending: false })
      .limit(25)
    return json({ orders: orders ?? [] })
  }

  // Email logs (deduped by message_id, latest status per message)
  if (action === 'logs') {
    const limit = Math.min(Math.max(Number(body?.limit ?? 100), 1), 500)
    const templateName = body?.templateName as string | undefined
    const status = body?.status as string | undefined
    const search = body?.search as string | undefined // matches recipient or message_id

    let q = admin.from('email_send_log').select('*').order('created_at', { ascending: false }).limit(limit * 3)
    if (templateName) q = q.eq('template_name', templateName)
    if (status) q = q.eq('status', status)
    if (search) q = q.or(`recipient_email.ilike.%${search}%,message_id.ilike.%${search}%`)
    const { data: rows, error } = await q
    if (error) return json({ error: error.message }, 500)

    // Dedupe by message_id keeping latest
    const seen = new Map<string, any>()
    const grouped = new Map<string, any[]>()
    for (const r of rows ?? []) {
      const key = r.message_id ?? r.id
      if (!seen.has(key)) seen.set(key, r)
      if (!grouped.has(key)) grouped.set(key, [])
      grouped.get(key)!.push(r)
    }
    const latest = Array.from(seen.values()).slice(0, limit).map((r) => ({
      ...r,
      attempts: grouped.get(r.message_id ?? r.id)!.length,
      history: grouped.get(r.message_id ?? r.id),
    }))
    return json({ logs: latest })
  }

  // Queue stats (pending + dead-lettered per queue)
  if (action === 'queue-stats') {
    const { data, error } = await admin.rpc('email_queue_stats')
    if (error) return json({ error: error.message }, 500)
    return json({ stats: data })
  }

  // Send a test transactional email using the exact same FROM/SENDER as the queue
  if (action === 'send-test') {
    const recipient = String(body?.recipientEmail ?? '').trim()
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(recipient)) {
      return json({ error: 'E-mail de destino inválido' }, 400)
    }
    const { data, error } = await admin.functions.invoke('send-transactional-email', {
      body: {
        templateName: 'email-test',
        recipientEmail: recipient,
        idempotencyKey: `email-test-${crypto.randomUUID()}`,
        templateData: {
          triggeredBy: (claimsData.claims.email as string) ?? 'admin',
          sentAt: new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
        },
      },
    })
    if (error) {
      const detail = await safeErrorDetail(error)
      return json({ error: `Falha ao enfileirar teste: ${detail}` }, 500)
    }
    if ((data as any)?.error) return json({ error: (data as any).error }, 500)

    // Kick the queue right away so the admin does not wait for cron
    await admin.functions.invoke('process-email-queue', { body: {} }).catch(() => {})
    return json({ success: true, queued: true, recipient })
  }

  // Reprocess the queue now (also useful right after fixing configuration)
  if (action === 'process-queue') {
    const { data, error } = await admin.functions.invoke('process-email-queue', { body: {} })
    if (error) return json({ error: `Falha ao processar fila: ${await safeErrorDetail(error)}` }, 500)
    return json({ success: true, result: data })
  }

  // Re-enqueue dead-lettered messages, rewriting the sender to the current config
  if (action === 'requeue-dlq') {
    const queues: string[] = Array.isArray(body?.queues) && body.queues.length
      ? body.queues.filter((q: string) => q === 'transactional_emails' || q === 'auth_emails')
      : ['transactional_emails', 'auth_emails']
    const limit = Math.min(Math.max(Number(body?.limit ?? 200), 1), 500)

    const requeued: Record<string, number> = {}
    for (const queue of queues) {
      const { data, error } = await admin.rpc('requeue_dlq_emails', {
        _queue: queue,
        _limit: limit,
        _new_from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
        _new_sender_domain: SENDER_DOMAIN,
      })
      if (error) return json({ error: `Falha ao reenfileirar (${queue}): ${error.message}` }, 500)
      requeued[queue] = Number(data ?? 0)
    }

    await admin.functions.invoke('process-email-queue', { body: {} }).catch(() => {})
    return json({ success: true, requeued })
  }

  return json({ error: 'Unknown action' }, 400)

  async function safeErrorDetail(error: any): Promise<string> {
    try {
      if (error?.context?.text) return String(await error.context.text()).slice(0, 500)
    } catch { /* ignore */ }
    return String(error?.message ?? error).slice(0, 500)
  }

  function json(b: unknown, status = 200) {
    return new Response(JSON.stringify(b), {
      status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
