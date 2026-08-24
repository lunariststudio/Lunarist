-- Storage migration for Lunarist v1.2
-- Applied to the production Supabase project.
-- Creates public project-media bucket with authenticated owner-scoped writes.

insert into storage.buckets (id, name, public)
values ('project-media','project-media',true)
on conflict (id) do update set public = true;

drop policy if exists "project_media_public_read" on storage.objects;
create policy "project_media_public_read" on storage.objects
for select to public using (bucket_id = 'project-media');

drop policy if exists "project_media_auth_insert" on storage.objects;
create policy "project_media_auth_insert" on storage.objects
for insert to authenticated
with check (bucket_id = 'project-media' and (storage.foldername(name))[1] = (select auth.uid()::text));

drop policy if exists "project_media_owner_update" on storage.objects;
create policy "project_media_owner_update" on storage.objects
for update to authenticated
using (bucket_id = 'project-media' and owner_id = (select auth.uid()::text))
with check (bucket_id = 'project-media' and owner_id = (select auth.uid()::text));

drop policy if exists "project_media_owner_delete" on storage.objects;
create policy "project_media_owner_delete" on storage.objects
for delete to authenticated
using (bucket_id = 'project-media' and owner_id = (select auth.uid()::text));
