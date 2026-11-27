BEGIN;

CREATE TABLE public.subscriptions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL,
 stripe_customer_id text NOT NULL, stripe_subscription_id text NOT NULL UNIQUE,
 status text NOT NULL, plan text, price_id text, trial_end timestamptz,
 current_period_end timestamptz, cancel_at_period_end boolean NOT NULL DEFAULT false,
 cancel_at timestamptz, synced_at timestamptz NOT NULL DEFAULT now(),
 sync_generation bigint NOT NULL DEFAULT 0,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own subscription" ON public.subscriptions FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);
CREATE INDEX subscriptions_user_id_idx ON public.subscriptions(user_id);
CREATE INDEX subscriptions_customer_idx ON public.subscriptions(stripe_customer_id);
CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON public.subscriptions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.trial_reservations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL UNIQUE,
 email_normalized text NOT NULL UNIQUE, stripe_customer_id text,
 checkout_session_id text UNIQUE, stripe_subscription_id text,
 status text NOT NULL DEFAULT 'reserved', generation bigint NOT NULL DEFAULT 1,
 reserved_at timestamptz NOT NULL DEFAULT now(), consumed_at timestamptz,
 released_at timestamptz, checkout_expires_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.trial_reservations TO service_role;
ALTER TABLE public.trial_reservations ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER update_trial_reservations_updated_at BEFORE UPDATE ON public.trial_reservations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.stripe_events (
 event_id text PRIMARY KEY, type text NOT NULL, event_created timestamptz NOT NULL,
 stripe_customer_id text, stripe_subscription_id text, checkout_session_id text,
 reservation_id uuid, reservation_generation bigint,
 received_at timestamptz NOT NULL DEFAULT now(), processed_at timestamptz,
 lease_owner uuid, lease_until timestamptz, fencing_token bigint NOT NULL DEFAULT 0,
 attempts integer NOT NULL DEFAULT 0, next_attempt_at timestamptz NOT NULL DEFAULT now(),
 last_error_code text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.stripe_events TO service_role;
ALTER TABLE public.stripe_events ENABLE ROW LEVEL SECURITY;
CREATE INDEX stripe_events_pending_idx ON public.stripe_events(next_attempt_at) WHERE processed_at IS NULL;
CREATE TRIGGER update_stripe_events_updated_at BEFORE UPDATE ON public.stripe_events FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE FUNCTION public.validate_trial_reservation() RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
 IF NEW.status NOT IN ('reserved','consumed','released') OR NEW.generation < 1 OR NEW.email_normalized = '' OR NEW.email_normalized <> lower(btrim(NEW.email_normalized)) THEN
  RAISE EXCEPTION 'Invalid trial reservation';
 END IF;
 IF TG_OP = 'UPDATE' THEN
  IF OLD.status = 'consumed' AND (NEW.status <> 'consumed' OR NEW.user_id <> OLD.user_id OR NEW.email_normalized <> OLD.email_normalized OR NEW.generation <> OLD.generation) THEN
   RAISE EXCEPTION 'Consumed trial history is immutable';
  END IF;
  IF NEW.user_id <> OLD.user_id OR NEW.email_normalized <> OLD.email_normalized OR NEW.generation < OLD.generation THEN
   RAISE EXCEPTION 'Trial identity and generation cannot be replaced';
  END IF;
  IF OLD.status = 'released' AND NEW.status = 'reserved' THEN
   IF NEW.generation <> OLD.generation + 1 OR NEW.checkout_session_id IS NOT NULL OR NEW.stripe_subscription_id IS NOT NULL THEN
    RAISE EXCEPTION 'Trial retry requires a new generation and cleared session';
   END IF;
  ELSIF NEW.generation <> OLD.generation THEN
   RAISE EXCEPTION 'Generation may only advance on a released retry';
  END IF;
 END IF;
 RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.validate_trial_reservation() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.validate_trial_reservation() TO service_role;
CREATE TRIGGER validate_trial_reservation BEFORE INSERT OR UPDATE ON public.trial_reservations FOR EACH ROW EXECUTE FUNCTION public.validate_trial_reservation();

CREATE FUNCTION public.reserve_trial(_user_id uuid, _email text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
 v_email text := lower(btrim(_email)); v_row public.trial_reservations%ROWTYPE;
 v_user_lock bigint; v_email_lock bigint;
BEGIN
 IF _user_id IS NULL OR v_email IS NULL OR v_email = '' THEN RAISE EXCEPTION 'User and email required'; END IF;
 v_user_lock := hashtextextended('trial:user:' || _user_id::text,0);
 v_email_lock := hashtextextended('trial:email:' || v_email,0);
 PERFORM pg_advisory_xact_lock(LEAST(v_user_lock,v_email_lock));
 PERFORM pg_advisory_xact_lock(GREATEST(v_user_lock,v_email_lock));
 IF EXISTS (SELECT 1 FROM public.trial_reservations WHERE (user_id = _user_id OR email_normalized = v_email) AND (status = 'consumed' OR user_id <> _user_id OR email_normalized <> v_email)) THEN
  RETURN jsonb_build_object('decision','used');
 END IF;
 SELECT * INTO v_row FROM public.trial_reservations WHERE user_id = _user_id AND email_normalized = v_email FOR UPDATE;
 IF FOUND AND v_row.status = 'reserved' THEN
  RETURN jsonb_build_object('decision','own_pending','reservation_id',v_row.id,'generation',v_row.generation);
 ELSIF FOUND AND v_row.status = 'released' THEN
  UPDATE public.trial_reservations SET status='reserved', generation=generation+1, checkout_session_id=NULL, stripe_subscription_id=NULL, checkout_expires_at=NULL, reserved_at=now(), released_at=NULL, consumed_at=NULL WHERE id=v_row.id RETURNING * INTO v_row;
 ELSE
  INSERT INTO public.trial_reservations(user_id,email_normalized) VALUES (_user_id,v_email) RETURNING * INTO v_row;
 END IF;
 RETURN jsonb_build_object('decision','granted','reservation_id',v_row.id,'generation',v_row.generation);
END;
$$;
REVOKE ALL ON FUNCTION public.reserve_trial(uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_trial(uuid,text) TO service_role;

CREATE FUNCTION public.claim_stripe_event(_event_id text, _type text, _event_created timestamptz, _owner uuid, _customer_id text DEFAULT NULL, _subscription_id text DEFAULT NULL, _session_id text DEFAULT NULL, _reservation_id uuid DEFAULT NULL, _reservation_generation bigint DEFAULT NULL, _lease_seconds integer DEFAULT 120) RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_token bigint;
BEGIN
 IF _event_id IS NULL OR btrim(_event_id)='' OR _type IS NULL OR btrim(_type)='' OR _event_created IS NULL OR _owner IS NULL OR _lease_seconds IS NULL OR _lease_seconds < 1 OR _lease_seconds > 300 THEN RAISE EXCEPTION 'Invalid event claim'; END IF;
 INSERT INTO public.stripe_events(event_id,type,event_created,stripe_customer_id,stripe_subscription_id,checkout_session_id,reservation_id,reservation_generation)
 VALUES (_event_id,_type,_event_created,_customer_id,_subscription_id,_session_id,_reservation_id,_reservation_generation) ON CONFLICT(event_id) DO NOTHING;
 UPDATE public.stripe_events SET lease_owner=_owner, lease_until=clock_timestamp()+make_interval(secs=>_lease_seconds), fencing_token=fencing_token+1, attempts=attempts+1
 WHERE event_id=_event_id AND type=_type AND event_created=_event_created AND stripe_customer_id IS NOT DISTINCT FROM _customer_id AND stripe_subscription_id IS NOT DISTINCT FROM _subscription_id AND checkout_session_id IS NOT DISTINCT FROM _session_id AND reservation_id IS NOT DISTINCT FROM _reservation_id AND reservation_generation IS NOT DISTINCT FROM _reservation_generation
 AND processed_at IS NULL AND (lease_until IS NULL OR lease_until <= clock_timestamp()) AND next_attempt_at <= clock_timestamp()
 RETURNING fencing_token INTO v_token;
 RETURN v_token;
END;
$$;
REVOKE ALL ON FUNCTION public.claim_stripe_event(text,text,timestamptz,uuid,text,text,text,uuid,bigint,integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_stripe_event(text,text,timestamptz,uuid,text,text,text,uuid,bigint,integer) TO service_role;

CREATE FUNCTION public.complete_stripe_event(_event_id text, _owner uuid, _token bigint) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
 UPDATE public.stripe_events SET processed_at=clock_timestamp(), lease_owner=NULL, lease_until=NULL, last_error_code=NULL
 WHERE event_id=_event_id AND lease_owner=_owner AND fencing_token=_token AND lease_until > clock_timestamp() AND processed_at IS NULL;
 RETURN FOUND;
END;
$$;
REVOKE ALL ON FUNCTION public.complete_stripe_event(text,uuid,bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_stripe_event(text,uuid,bigint) TO service_role;

CREATE FUNCTION public.release_stripe_event(_event_id text, _owner uuid, _token bigint, _error_code text DEFAULT 'retry', _retry_seconds integer DEFAULT 30) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
 IF _retry_seconds IS NULL OR _retry_seconds < 0 OR _retry_seconds > 3600 OR _error_code IS NULL OR _error_code !~ '^[a-z0-9_]{1,64}$' THEN RAISE EXCEPTION 'Invalid retry parameters'; END IF;
 UPDATE public.stripe_events SET lease_owner=NULL, lease_until=NULL, next_attempt_at=clock_timestamp()+make_interval(secs=>_retry_seconds), last_error_code=_error_code
 WHERE event_id=_event_id AND lease_owner=_owner AND fencing_token=_token AND lease_until > clock_timestamp() AND processed_at IS NULL;
 RETURN FOUND;
END;
$$;
REVOKE ALL ON FUNCTION public.release_stripe_event(text,uuid,bigint,text,integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.release_stripe_event(text,uuid,bigint,text,integer) TO service_role;

CREATE OR REPLACE FUNCTION public.delete_user_data() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
 DELETE FROM public.transactions WHERE user_id = OLD.id;
 DELETE FROM public.plaid_connections WHERE user_id = OLD.id;
 DELETE FROM public.finance_data WHERE user_id = OLD.id;
 DELETE FROM public.sync_locks WHERE user_id = OLD.id;
 DELETE FROM public.subscriptions WHERE user_id = OLD.id;
 DELETE FROM public.trial_reservations WHERE user_id = OLD.id AND status <> 'consumed';
 RETURN OLD;
END;
$$;

-- PRODUCTION BACKFILL: verified read-only against Stripe on 2026-11-27.
DO $$
DECLARE v_count integer;
BEGIN
 SELECT count(*) INTO v_count FROM auth.users u JOIN (VALUES
 ('762f8b89-d7f5-4604-b0fe-fe0036403d1f'::uuid,'cus_ULxtMyHy0m099e'),
 ('c8fef9f1-f8ca-4641-8594-4b948fc47879'::uuid,'cus_UJTSh4Kxafef1o'),
 ('91e0f93b-d004-460a-9378-2a160c11dd38'::uuid,'cus_VQe31fM8oi9cyf'),
 ('27063021-8e9b-4bc5-b5a9-c1ea4fd7c21c'::uuid,'cus_Vgs1ESlf4mpdty')
 ) AS expected(user_id,customer_id) ON expected.user_id=u.id AND expected.customer_id=u.raw_app_meta_data->>'stripe_customer_id'
 WHERE u.email IS NOT NULL AND btrim(u.email)<>'';
 IF v_count<>4 THEN RAISE EXCEPTION 'Legacy billing ownership changed; migration aborted'; END IF;
END;
$$;

INSERT INTO public.subscriptions(user_id,stripe_customer_id,stripe_subscription_id,status,plan,price_id,current_period_end,cancel_at_period_end)
VALUES
 ('762f8b89-d7f5-4604-b0fe-fe0036403d1f','cus_ULxtMyHy0m099e','sub_1TNFy3ETsKMFlYgfn8oY6sjr','canceled','mensal','price_1TFJCqETsKMFlYgf17AWyncm',to_timestamp(1781716448),false),
 ('c8fef9f1-f8ca-4641-8594-4b948fc47879','cus_UJTSh4Kxafef1o','sub_1TKqVRETsKMFlYgfxX6MRFqm','canceled','mensal','price_1TFJCqETsKMFlYgf17AWyncm',to_timestamp(1778463518),false),
 ('91e0f93b-d004-460a-9378-2a160c11dd38','cus_VQe31fM8oi9cyf','sub_1UPn50ETsKMFlYgfNena1aPk','active','mensal','price_1TFJCqETsKMFlYgf17AWyncm',to_timestamp(1797096722),false),
 ('27063021-8e9b-4bc5-b5a9-c1ea4fd7c21c','cus_Vgs1ESlf4mpdty','sub_1UfUHjETsKMFlYgfqGANGzkx','active','mensal','price_1TFJCqETsKMFlYgf17AWyncm',to_timestamp(1798159324),false);

-- consumed here means ineligible due to an existing subscription, not a claim
-- that these legacy customers actually received a free trial.
INSERT INTO public.trial_reservations(user_id,email_normalized,stripe_customer_id,stripe_subscription_id,status,consumed_at)
SELECT s.user_id,lower(btrim(u.email)),s.stripe_customer_id,s.stripe_subscription_id,'consumed',now()
FROM public.subscriptions s JOIN auth.users u ON u.id=s.user_id;

DO $$
BEGIN
 IF (SELECT count(*) FROM public.subscriptions)<>4 OR (SELECT count(*) FROM public.subscriptions WHERE status='active')<>2 OR (SELECT count(*) FROM public.subscriptions WHERE status='canceled')<>2 OR (SELECT count(*) FROM public.trial_reservations WHERE status='consumed')<>4 THEN
  RAISE EXCEPTION 'Legacy billing backfill incomplete; migration aborted';
 END IF;
END;
$$;
COMMIT;