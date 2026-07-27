ALTER TABLE public.banners DROP CONSTRAINT IF EXISTS banners_inventory_item_id_fkey;
ALTER TABLE public.banners
  ADD CONSTRAINT banners_inventory_item_id_fkey
  FOREIGN KEY (inventory_item_id) REFERENCES public.inventory(id)
  ON UPDATE CASCADE ON DELETE SET NULL;

UPDATE public.inventory_audit
   SET inventory_item_id = upper(regexp_replace(inventory_item_id, '[-[:space:]]+', '', 'g'))
 WHERE inventory_item_id ~ '[-[:space:]]' OR inventory_item_id <> upper(inventory_item_id);

UPDATE public.stock_notifications
   SET inventory_item_id = upper(regexp_replace(inventory_item_id, '[-[:space:]]+', '', 'g'))
 WHERE inventory_item_id ~ '[-[:space:]]' OR inventory_item_id <> upper(inventory_item_id);

UPDATE public.drop_singles_images
   SET inventory_item_id = upper(regexp_replace(inventory_item_id, '[-[:space:]]+', '', 'g'))
 WHERE inventory_item_id ~ '[-[:space:]]' OR inventory_item_id <> upper(inventory_item_id);

UPDATE public.inventory
   SET id = upper(regexp_replace(id, '[-[:space:]]+', '', 'g'))
 WHERE id ~ '[-[:space:]]' OR id <> upper(id);