-- Exploration and reveal history can be read through RLS, but every mutation
-- must pass through the validated security-definer functions.
revoke insert, update, delete
on public.session_exploration, public.session_reveals
from authenticated;
