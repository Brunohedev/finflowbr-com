-- Only for isolated tests or a separately authorized migration while billing is inactive.
-- Before any production execution: export all three billing tables and verify
-- that no newly activated caller, pending Checkout or new trial depends on them.
BEGIN;
CREATE OR REPLACE FUNCTION public.delete_user_data()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  DELETE FROM public.transactions WHERE user_id = OLD.id;
  DELETE FROM public.plaid_connections WHERE user_id = OLD.id;
  DELETE FROM public.finance_data WHERE user_id = OLD.id;
  DELETE FROM public.sync_locks WHERE user_id = OLD.id;
  RETURN OLD;
END;
$$;
DROP FUNCTION public.reserve_trial(uuid,text);
DROP FUNCTION public.claim_stripe_event(text,text,timestamptz,uuid,text,text,text,uuid,bigint,integer);
DROP FUNCTION public.complete_stripe_event(text,uuid,bigint);
DROP FUNCTION public.release_stripe_event(text,uuid,bigint,text,integer);
DROP TABLE public.stripe_events;
DROP TABLE public.trial_reservations;
DROP TABLE public.subscriptions;
DROP FUNCTION public.validate_trial_reservation();
COMMIT;