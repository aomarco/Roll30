-- Existing authenticated users created before the profile trigger was added
-- need a safe way to create their own, and only their own, profile row.
create policy "insert own profile"
on public.profiles
for insert
to authenticated
with check ((select auth.uid()) = id);
