-- Policy names that need quoting (Supabase-style names with spaces)
CREATE POLICY "Users can view own data" ON public.todos FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY "Users can view own data" ON public.todos;
DROP POLICY IF EXISTS "Users can view own data" ON todos;
COMMENT ON POLICY "Users can view own data" ON public.todos IS 'owner read';
COMMENT ON POLICY "Users can view own data" ON todos IS 'owner read';
ALTER POLICY "Users can view own data" ON public.todos RENAME TO "Owners read";
