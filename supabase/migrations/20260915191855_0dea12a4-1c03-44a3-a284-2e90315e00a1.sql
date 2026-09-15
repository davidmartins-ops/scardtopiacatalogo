CREATE INDEX IF NOT EXISTS idx_orders_created_at_desc ON public.orders (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_product_type_quantity ON public.inventory (product_type, quantity);
CREATE INDEX IF NOT EXISTS idx_inventory_category ON public.inventory (category);
ANALYZE public.orders;
ANALYZE public.inventory;
ANALYZE public.admin_notifications;