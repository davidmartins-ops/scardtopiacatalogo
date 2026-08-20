CREATE TYPE public.special_order_status AS ENUM (
  'requested',
  'quoted',
  'approved',
  'paid',
  'ordered',
  'received',
  'shipped',
  'delivered',
  'cancelled'
);

CREATE TYPE public.special_order_item_type AS ENUM (
  'fixed_price',
  'quotation'
);

CREATE TABLE public.special_order_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  category text NOT NULL,
  price numeric NOT NULL,
  price_pix numeric NOT NULL DEFAULT 0,
  image_url text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT ON public.special_order_products TO anon;
GRANT SELECT ON public.special_order_products TO authenticated;
GRANT ALL ON public.special_order_products TO service_role;

ALTER TABLE public.special_order_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Produtos de encomenda ativos são públicos"
  ON public.special_order_products
  FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

CREATE POLICY "Apenas admins gerenciam produtos de encomenda"
  ON public.special_order_products
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE TABLE public.special_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status public.special_order_status NOT NULL DEFAULT 'requested',
  source text NOT NULL DEFAULT 'customer_request',
  customer_info jsonb NOT NULL DEFAULT '{}',
  shipping_address jsonb,
  shipping_cost numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  payment_method public.payment_method,
  payment_transaction_id text,
  payment_invoice_slug text,
  paid_amount numeric,
  paid_at timestamp with time zone,
  tracking_code text,
  shipping_label_url text,
  superfrete_order_id text,
  shipping_label_status text NOT NULL DEFAULT 'not_issued',
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  status_updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.special_orders TO authenticated;
GRANT ALL ON public.special_orders TO service_role;

ALTER TABLE public.special_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clientes veem suas próprias encomendas"
  ON public.special_orders
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "Clientes criam encomendas para si mesmos"
  ON public.special_orders
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Clientes atualizam suas próprias encomendas (limitado)"
  ON public.special_orders
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() OR public.is_admin())
  WITH CHECK (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "Apenas admins excluem encomendas"
  ON public.special_orders
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

CREATE TABLE public.special_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  special_order_id uuid NOT NULL REFERENCES public.special_orders(id) ON DELETE CASCADE,
  item_type public.special_order_item_type NOT NULL DEFAULT 'quotation',
  product_id uuid REFERENCES public.special_order_products(id) ON DELETE SET NULL,
  name text NOT NULL,
  description text,
  quantity integer NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL DEFAULT 0,
  total_price numeric NOT NULL DEFAULT 0,
  reference_links text[],
  reference_image_url text,
  admin_notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.special_order_items TO authenticated;
GRANT ALL ON public.special_order_items TO service_role;

ALTER TABLE public.special_order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clientes veem itens de suas encomendas"
  ON public.special_order_items
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.special_orders so
      WHERE so.id = special_order_items.special_order_id
        AND (so.user_id = auth.uid() OR public.is_admin())
    )
  );

CREATE POLICY "Clientes criam itens em suas encomendas"
  ON public.special_order_items
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.special_orders so
      WHERE so.id = special_order_items.special_order_id
        AND so.user_id = auth.uid()
    )
  );

CREATE POLICY "Apenas admins atualizam/excluem itens de encomenda"
  ON public.special_order_items
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE TABLE public.special_order_quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  special_order_id uuid NOT NULL REFERENCES public.special_orders(id) ON DELETE CASCADE,
  item_id uuid REFERENCES public.special_order_items(id) ON DELETE CASCADE,
  quoted_price numeric NOT NULL,
  estimated_days integer,
  expires_at timestamp with time zone,
  admin_notes text,
  customer_response text,
  responded_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.special_order_quotes TO authenticated;
GRANT ALL ON public.special_order_quotes TO service_role;

ALTER TABLE public.special_order_quotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clientes veem cotações de suas encomendas"
  ON public.special_order_quotes
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.special_orders so
      WHERE so.id = special_order_quotes.special_order_id
        AND (so.user_id = auth.uid() OR public.is_admin())
    )
  );

CREATE POLICY "Clientes respondem cotações de suas encomendas"
  ON public.special_order_quotes
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.special_orders so
      WHERE so.id = special_order_quotes.special_order_id
        AND so.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.special_orders so
      WHERE so.id = special_order_quotes.special_order_id
        AND so.user_id = auth.uid()
    )
  );

CREATE POLICY "Apenas admins criam cotações"
  ON public.special_order_quotes
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "Apenas admins atualizam cotações (exceto resposta do cliente)"
  ON public.special_order_quotes
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE TABLE public.special_order_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  special_order_id uuid NOT NULL REFERENCES public.special_orders(id) ON DELETE CASCADE,
  from_status public.special_order_status,
  to_status public.special_order_status NOT NULL,
  note text,
  changed_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.special_order_status_history TO authenticated;
GRANT ALL ON public.special_order_status_history TO service_role;

ALTER TABLE public.special_order_status_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clientes veem histórico de suas encomendas"
  ON public.special_order_status_history
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.special_orders so
      WHERE so.id = special_order_status_history.special_order_id
        AND (so.user_id = auth.uid() OR public.is_admin())
    )
  );

CREATE POLICY "Apenas service_role e admins inserem histórico"
  ON public.special_order_status_history
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

CREATE TABLE public.special_order_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid,
  actor_email text,
  action text NOT NULL,
  special_order_id uuid NOT NULL REFERENCES public.special_orders(id) ON DELETE CASCADE,
  metadata jsonb DEFAULT '{}',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.special_order_audit_log TO authenticated;
GRANT ALL ON public.special_order_audit_log TO service_role;

ALTER TABLE public.special_order_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Apenas admins leem auditoria de encomendas"
  ON public.special_order_audit_log
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

CREATE POLICY "Apenas service_role e admins inserem auditoria"
  ON public.special_order_audit_log
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

CREATE OR REPLACE FUNCTION public.update_special_order_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_special_orders_updated_at
  BEFORE UPDATE ON public.special_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_special_order_updated_at();

CREATE TRIGGER trg_special_order_items_updated_at
  BEFORE UPDATE ON public.special_order_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_special_order_updated_at();

CREATE TRIGGER trg_special_order_products_updated_at
  BEFORE UPDATE ON public.special_order_products
  FOR EACH ROW
  EXECUTE FUNCTION public.update_special_order_updated_at();

CREATE TRIGGER trg_special_order_quotes_updated_at
  BEFORE UPDATE ON public.special_order_quotes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_special_order_updated_at();

CREATE OR REPLACE FUNCTION public.log_special_order_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.special_order_status_history (special_order_id, from_status, to_status, changed_by)
    VALUES (NEW.id, NULL, NEW.status, NEW.user_id);
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    NEW.status_updated_at = now();
    INSERT INTO public.special_order_status_history (special_order_id, from_status, to_status, changed_by)
    VALUES (NEW.id, OLD.status, NEW.status, auth.uid());
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_special_orders_status_insert
  AFTER INSERT ON public.special_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.log_special_order_status_change();

CREATE TRIGGER trg_special_orders_status_update
  BEFORE UPDATE ON public.special_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.log_special_order_status_change();

CREATE OR REPLACE FUNCTION public.notify_new_special_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _customer_name text;
  _item_count integer;
BEGIN
  SELECT COALESCE(NEW.customer_info->>'name', 'Cliente') INTO _customer_name;
  SELECT COUNT(*) INTO _item_count FROM public.special_order_items WHERE special_order_id = NEW.id;

  INSERT INTO public.admin_notifications (type, title, message, link, entity_type, entity_id, metadata)
  VALUES (
    'new_order',
    'Nova encomenda especial',
    _customer_name || ' — ' || _item_count || ' item(s)',
    '/admin/encomendas/' || NEW.id::text,
    'special_order',
    NEW.id::text,
    jsonb_build_object(
      'total', NEW.total,
      'status', NEW.status,
      'source', NEW.source,
      'item_count', _item_count
    )
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_new_special_order
  AFTER INSERT ON public.special_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_new_special_order();
