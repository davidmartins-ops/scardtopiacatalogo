-- Atualiza gatilho para remover qualquer caractere não alfanumérico
CREATE OR REPLACE FUNCTION public.normalize_inventory_id()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.id IS NOT NULL THEN
    NEW.id := upper(regexp_replace(NEW.id, '[^A-Za-z0-9]+', '', 'g'));
  END IF;
  RETURN NEW;
END;
$$;

-- Normaliza IDs remanescentes com caracteres especiais e propaga nas tabelas dependentes
UPDATE public.inventory_audit
   SET inventory_item_id = upper(regexp_replace(inventory_item_id, '[^A-Za-z0-9]+', '', 'g'))
 WHERE inventory_item_id ~ '[^A-Za-z0-9]' OR inventory_item_id <> upper(inventory_item_id);

UPDATE public.stock_notifications
   SET inventory_item_id = upper(regexp_replace(inventory_item_id, '[^A-Za-z0-9]+', '', 'g'))
 WHERE inventory_item_id ~ '[^A-Za-z0-9]' OR inventory_item_id <> upper(inventory_item_id);

UPDATE public.drop_singles_images
   SET inventory_item_id = upper(regexp_replace(inventory_item_id, '[^A-Za-z0-9]+', '', 'g'))
 WHERE inventory_item_id ~ '[^A-Za-z0-9]' OR inventory_item_id <> upper(inventory_item_id);

UPDATE public.inventory
   SET id = upper(regexp_replace(id, '[^A-Za-z0-9]+', '', 'g'))
 WHERE id ~ '[^A-Za-z0-9]' OR id <> upper(id);

-- Constraint de formato compacto
ALTER TABLE public.inventory DROP CONSTRAINT IF EXISTS inventory_id_compact_format;
ALTER TABLE public.inventory
  ADD CONSTRAINT inventory_id_compact_format
  CHECK (id ~ '^[A-Z0-9]{3,}$');