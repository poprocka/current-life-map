-- Private storage for client-profile attachments (Supabase Storage). Applied after 0001.
-- Files are encrypted by the server (AES-256-GCM, FIELD_ENCRYPTION_KEY) before upload, so the bucket only ever holds
-- ciphertext. Access uses the signed-in coach's own session: no service-role key is used by the app.
insert into storage.buckets (id, name, public, file_size_limit)
values ('client-files', 'client-files', false, 10485792)
on conflict (id) do nothing;

create policy coach_files_read on storage.objects for select to authenticated
  using (bucket_id = 'client-files' and public.is_coach_mfa());
create policy coach_files_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'client-files' and public.is_coach_mfa());
create policy coach_files_delete on storage.objects for delete to authenticated
  using (bucket_id = 'client-files' and public.is_coach_mfa());
