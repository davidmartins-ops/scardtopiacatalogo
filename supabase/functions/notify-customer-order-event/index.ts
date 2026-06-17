import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Customer-triggered notification (verify_jwt = true). The caller must own the order.
// Used by the storefront to send "order received" and "PIX receipt received" emails.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
  const admin = createClient(supabaseUrl, serviceKey)

  const authHeader = req.headers.get('Authorization') ?? ''
  if (!authHeader.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
  const token = authHeader.slice('Bearer '.length)
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(token)
  if (claimsErr || !claimsData?.claims?.sub) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
  const callerId = claimsData.claims.sub as string

  try {
    const { orderId, event } = await req.json()
    if (!orderId || !event) {
      return new Response(JSON.stringify({ error: 'orderId and event are required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    if (event !== 'order_received' && event !== 'pix_receipt_received') {
      return new Response(JSON.stringify({ error: 'Invalid event' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Fetch the order and confirm caller ownership (admins also allowed)
    const { data: order, error: orderErr } = await admin
      .from('orders')
      .select('id, user_id, items, total, payment_method, status')
      .eq('id', orderId)
      .maybeSingle()
    if (orderErr || !order) {
      return new Response(JSON.stringify({ error: 'Order not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    if (!order.user_id) {
      return new Response(JSON.stringify({ skipped: 'guest_order' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    if (order.user_id !== callerId) {
      const { data: roleRow } = await admin
        .from('user_roles')
        .select('role')
        .eq('user_id', callerId)
        .eq('role', 'admin')
        .maybeSingle()
      if (!roleRow) {
        return new Response(JSON.stringify({ error: 'Forbidden' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    // Email preferences check
    const { data: profile } = await admin
      .from('customer_profiles')
      .select('email_preferences, display_name')
      .eq('id', order.user_id)
      .maybeSingle()
    const prefs = (profile?.email_preferences ?? {}) as Record<string, boolean>
    const prefKey = event === 'order_received' ? 'order_received' : 'pix_receipt'
    if (prefs[prefKey] === false) {
      return new Response(JSON.stringify({ skipped: 'opted_out' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Recipient email
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

    const templateName =
      event === 'order_received' ? 'order-received' : 'pix-receipt-received'

    const templateData =
      event === 'order_received'
        ? {
            customerName,
            orderId,
            total: order.total,
            paymentMethod: order.payment_method,
            items,
          }
        : { customerName, orderId, total: order.total }

    const sendRes = await fetch(`${supabaseUrl}/functions/v1/send-transactional-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({
        templateName,
        recipientEmail: email,
        idempotencyKey: `${event}-${orderId}`,
        templateData,
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
