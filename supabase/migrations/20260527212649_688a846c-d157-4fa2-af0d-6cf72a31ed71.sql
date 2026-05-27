-- Restrict Realtime channel subscriptions: only admins or the order owner may
-- receive messages on order-scoped topics. Without these policies any
-- authenticated user could subscribe to another user's order channel.

ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

-- SELECT (receive messages)
DROP POLICY IF EXISTS "Authenticated can read own order channels" ON realtime.messages;
CREATE POLICY "Authenticated can read own order channels"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  public.is_admin()
  OR (
    realtime.topic() LIKE 'orders:%'
    AND EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id::text = split_part(realtime.topic(), ':', 2)
        AND o.user_id = auth.uid()
    )
  )
  OR (
    realtime.topic() NOT LIKE 'orders:%'
    AND realtime.topic() NOT LIKE 'order:%'
    AND realtime.topic() NOT LIKE 'user:%'
  )
);

-- INSERT (send messages: broadcast/presence)
DROP POLICY IF EXISTS "Authenticated can send to own order channels" ON realtime.messages;
CREATE POLICY "Authenticated can send to own order channels"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_admin()
  OR (
    realtime.topic() LIKE 'orders:%'
    AND EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id::text = split_part(realtime.topic(), ':', 2)
        AND o.user_id = auth.uid()
    )
  )
  OR (
    realtime.topic() NOT LIKE 'orders:%'
    AND realtime.topic() NOT LIKE 'order:%'
    AND realtime.topic() NOT LIKE 'user:%'
  )
);
