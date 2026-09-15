CREATE OR REPLACE FUNCTION public.protect_special_order_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF current_setting('role', true) = 'service_role'
     OR auth.role() = 'service_role'
     OR public.is_admin() THEN
    RETURN NEW;
  END IF;

  -- Customers may only change shipping_address, notes and customer_info.
  NEW.user_id                 := OLD.user_id;
  NEW.status                  := OLD.status;
  NEW.status_updated_at       := OLD.status_updated_at;
  NEW.source                  := OLD.source;
  NEW.total                   := OLD.total;
  NEW.shipping_cost           := OLD.shipping_cost;
  NEW.payment_method          := OLD.payment_method;
  NEW.payment_transaction_id  := OLD.payment_transaction_id;
  NEW.payment_invoice_slug    := OLD.payment_invoice_slug;
  NEW.paid_amount             := OLD.paid_amount;
  NEW.paid_at                 := OLD.paid_at;
  NEW.tracking_code           := OLD.tracking_code;
  NEW.shipping_label_url      := OLD.shipping_label_url;
  NEW.superfrete_order_id     := OLD.superfrete_order_id;
  NEW.shipping_label_status   := OLD.shipping_label_status;
  NEW.created_at              := OLD.created_at;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_protect_special_order_fields ON public.special_orders;
CREATE TRIGGER trg_protect_special_order_fields
BEFORE UPDATE ON public.special_orders
FOR EACH ROW EXECUTE FUNCTION public.protect_special_order_fields();

CREATE OR REPLACE FUNCTION public.protect_special_order_quote_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF current_setting('role', true) = 'service_role'
     OR auth.role() = 'service_role'
     OR public.is_admin() THEN
    RETURN NEW;
  END IF;

  -- Customers may only record their response to a quote.
  NEW.special_order_id := OLD.special_order_id;
  NEW.item_id          := OLD.item_id;
  NEW.quoted_price     := OLD.quoted_price;
  NEW.estimated_days   := OLD.estimated_days;
  NEW.expires_at       := OLD.expires_at;
  NEW.admin_notes      := OLD.admin_notes;
  NEW.created_at       := OLD.created_at;

  IF NEW.customer_response IS DISTINCT FROM OLD.customer_response THEN
    NEW.responded_at := now();
  ELSE
    NEW.responded_at := OLD.responded_at;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_protect_special_order_quote_fields ON public.special_order_quotes;
CREATE TRIGGER trg_protect_special_order_quote_fields
BEFORE UPDATE ON public.special_order_quotes
FOR EACH ROW EXECUTE FUNCTION public.protect_special_order_quote_fields();