
UPDATE inventory
SET id = id || '-' ||
  CASE WHEN description = 'Foil' THEN 'F' ELSE 'NF' END ||
  '-' || condition
WHERE product_type = 'single'
  AND id !~ '-(F|NF)-(NM|SP|HP|D)$';
