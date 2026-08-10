drop policy if exists "Admins can upload products" on storage.objects;
drop policy if exists "Admins can update products" on storage.objects;
drop policy if exists "Admins can delete products" on storage.objects;

create policy "Admins can upload products"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'products'
  and public.is_admin()
  and name is not null
  and length(name) between 1 and 300
  and name !~ '(^/|//|\.\./|^\.)'
  and lower(name) ~ '\.(png|jpe?g|webp|avif|gif)$'
);

create policy "Admins can update products"
on storage.objects for update to authenticated
using (bucket_id = 'products' and public.is_admin())
with check (
  bucket_id = 'products'
  and public.is_admin()
  and name is not null
  and length(name) between 1 and 300
  and name !~ '(^/|//|\.\./|^\.)'
  and lower(name) ~ '\.(png|jpe?g|webp|avif|gif)$'
);

create policy "Admins can delete products"
on storage.objects for delete to authenticated
using (bucket_id = 'products' and public.is_admin());