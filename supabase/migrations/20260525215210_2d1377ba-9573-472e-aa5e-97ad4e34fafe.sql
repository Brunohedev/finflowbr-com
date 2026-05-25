ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plaid_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own transactions" ON public.transactions
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own transactions" ON public.transactions
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own transactions" ON public.transactions
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own transactions" ON public.transactions
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users view own plaid connections" ON public.plaid_connections
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own plaid connections" ON public.plaid_connections
  FOR INSERT WITH CHECK (auth.uid() = user_id);