import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Triggered by the client (admin) after an order status change.
// Looks up the customer email via auth.admin and enqueues a transactional email.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
  const admin = createClient(supabaseUrl, serviceKey)

  // Authenticate caller: must be an admin (or the service role, for backend flows)
  const authHeader = req.headers.get('Authorization') ?? ''
  if (!authHeader.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
  const token = authHeader.slice('Bearer '.length)
  const isServiceRole = token === serviceKey
  if (!isServiceRole) {
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(token)
    if (claimsErr || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const { data: roleRow } = await admin
      .from('user_roles')
      .select('role')
      .eq('user_id', claimsData.claims.sub)
      .eq('role', 'admin')
      .maybeSingle()
    if (!roleRow) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
  }

  // Sends the "order paid" alert to every admin. Never throws.
  const notifyAdmins = async (order: any) => {
    try {
      const { data: roleRows } = await admin
        .from('user_roles')
        .select('user_id')
        .eq('role', 'admin')
      const ids = Array.from(new Set((roleRows ?? []).map((r: any) => r.user_id)))
      const info = (order.customer_info ?? {}) as Record<string, any>
      const items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items
      const address = (info.address ?? {}) as Record<string, any>
      const templateData = {
        orderId: order.id,
        customerName: info.name ?? info.full_name ?? 'Cliente',
        customerEmail: info.email ?? null,
        customerPhone: info.phone ?? null,
        paymentMethod: order.payment_method,
        total: Number(order.total ?? 0),
        creditsApplied: Number(order.credits_applied ?? 0),
        city: address.city ?? info.city ?? null,
        state: address.state ?? info.state ?? null,
        items,
      }
      for (const id of ids) {
        const { data: u } = await admin.auth.admin.getUserById(id as string)
        const adminEmail = u?.user?.email
        if (!adminEmail) continue
        const res = await fetch(`${supabaseUrl}/functions/v1/send-transactional-email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${serviceKey}` },
          body: JSON.stringify({
            templateName: 'admin-order-paid',
            recipientEmail: adminEmail,
            idempotencyKey: `admin-order-paid-${order.id}-${adminEmail}`,
            templateData,
          }),
        })
        if (!res.ok) console.error('admin-order-paid failed', adminEmail, res.status, await res.text())
      }
    } catch (e) {
      console.error('notifyAdmins failed', e)
    }
  }

  try {
    const { orderId, status, trackingCode, note } = await req.json()
    if (!orderId || !status) {
      return new Response(JSON.stringify({ error: 'orderId and status are required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: order, error: orderErr } = await admin
      .from('orders')
      .select('id, user_id, status, items, total, customer_info, payment_method, credits_applied')
      .eq('id', orderId)
      .maybeSingle()

    if (orderErr || !order) {
      return new Response(JSON.stringify({ error: 'Order not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (status === 'payment_confirmed') {
      await notifyAdmins(order)
    }

    if (!order.user_id) {
      // Visitor order — no customer email available
      return new Response(JSON.stringify({ skipped: 'guest_order' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }


    // Email preferences: skip if the customer opted out of order updates
    const { data: profile } = await admin
      .from('customer_profiles')
      .select('email_preferences, display_name')
      .eq('id', order.user_id)
      .maybeSingle()
    const prefs = (profile?.email_preferences ?? {}) as Record<string, boolean>
    if (prefs.order_updates === false) {
      return new Response(JSON.stringify({ skipped: 'opted_out' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: userRes, error: userErr } = await admin.auth.admin.getUserById(order.user_id)
    if (userErr || !userRes?.user?.email) {
      return new Response(JSON.stringify({ skipped: 'no_email' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const email = userRes.user.email
    const meta = userRes.user.user_metadata ?? {}
    const customerName =
      profile?.display_name ?? meta.full_name ?? meta.name ?? email.split('@')[0]
    const items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items

    // Invoke send-transactional-email with service role
    const sendRes = await fetch(`${supabaseUrl}/functions/v1/send-transactional-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({
        templateName: 'order-status-update',
        recipientEmail: email,
        idempotencyKey: `order-status-${orderId}-${status}`,
        templateData: { customerName, orderId, status, trackingCode, note, total: order.total, items },
      }),
    })

    const sendBody = await sendRes.text()
    if (!sendRes.ok) {
      console.error('send-transactional-email failed', sendRes.status, sendBody)
      return new Response(JSON.stringify({ error: 'send_failed', detail: sendBody }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error(err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
