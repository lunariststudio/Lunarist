-- Optional production migration for project media. Run in Supabase SQL Editor once.
insert into storage.buckets (id,name,public) values ('project-media','project-media',true) on conflict (id) do update set public=true;

drop policy if exists "project media public read" on storage.objects;
create policy "project media public read" on storage.objects for select using (bucket_id='project-media');

drop policy if exists "members upload project media" on storage.objects;
create policy "members upload project media" on storage.objects for insert to authenticated with check (bucket_id='project-media' and (storage.foldername(name))[1]=auth.uid()::text);

drop policy if exists "members update project media" on storage.objects;
create policy "members update project media" on storage.objects for update to authenticated using (bucket_id='project-media' and (storage.foldername(name))[1]=auth.uid()::text) with check (bucket_id='project-media' and (storage.foldername(name))[1]=auth.uid()::text);

drop policy if exists "members delete project media" on storage.objects;
create policy "members delete project media" on storage.objects for delete to authenticated using (bucket_id='project-media' and (storage.foldername(name))[1]=auth.uid()::text);
