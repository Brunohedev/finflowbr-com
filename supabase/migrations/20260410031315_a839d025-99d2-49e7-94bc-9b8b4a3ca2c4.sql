
CREATE TABLE public.finance_data (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.finance_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own finance data"
  ON public.finance_data FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own finance data"
  ON public.finance_data FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own finance data"
  ON public.finance_data FOR UPDATE
  USING (auth.uid() = user_id);

CREATE TRIGGER update_finance_data_updated_at
  BEFORE UPDATE ON public.finance_data
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
