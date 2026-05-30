-- Trigger to remove the corresponding expense from finance_data.data.expenses
-- whenever a transaction is deleted. Matches by expense.transactionId == transactions.id.

CREATE OR REPLACE FUNCTION public.remove_expense_from_finance_data()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_data jsonb;
  new_expenses jsonb;
BEGIN
  SELECT data INTO current_data
  FROM public.finance_data
  WHERE user_id = OLD.user_id;

  IF current_data IS NULL OR current_data->'expenses' IS NULL THEN
    RETURN OLD;
  END IF;

  SELECT COALESCE(jsonb_agg(e), '[]'::jsonb)
  INTO new_expenses
  FROM jsonb_array_elements(current_data->'expenses') AS e
  WHERE COALESCE(e->>'transactionId', '') <> OLD.id::text;

  UPDATE public.finance_data
  SET data = jsonb_set(current_data, '{expenses}', new_expenses),
      updated_at = now()
  WHERE user_id = OLD.user_id;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_remove_expense_on_transaction_delete ON public.transactions;

CREATE TRIGGER trg_remove_expense_on_transaction_delete
AFTER DELETE ON public.transactions
FOR EACH ROW
EXECUTE FUNCTION public.remove_expense_from_finance_data();