CREATE OR REPLACE FUNCTION public.delete_user_data()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = ''
AS $function$
BEGIN
  DELETE FROM public.transactions WHERE user_id = OLD.id;
  DELETE FROM public.plaid_connections WHERE user_id = OLD.id;
  DELETE FROM public.finance_data WHERE user_id = OLD.id;
  DELETE FROM public.sync_locks WHERE user_id = OLD.id;
  RETURN OLD;
END;
$function$;