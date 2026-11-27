"""Real PostgreSQL schema tests, restricted to a disposable local database.

Run: python3 supabase/tests/trial_schema_test.py --schema /path/to/migration.sql
Requires a local PostgreSQL on port 55438. Never connects to Supabase/Stripe.
"""
import argparse
import concurrent.futures
import json
import subprocess
import unittest
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
USER = "00000000-0000-0000-0000-000000000001"
OTHER = "00000000-0000-0000-0000-000000000002"
OWNER = "10000000-0000-0000-0000-000000000001"
OTHER_OWNER = "10000000-0000-0000-0000-000000000002"
DATABASE = "trial_schema_" + uuid.uuid4().hex


def sql(query, database=DATABASE, check=True):
    result = subprocess.run(
        ["psql", "-X", "-h", "127.0.0.1", "-p", "55438", "-U", "nobody",
         "-d", database, "-v", "ON_ERROR_STOP=1", "-Atq"],
        input=query, capture_output=True, text=True, check=False,
    )
    if check and result.returncode:
        raise AssertionError(result.stderr)
    return result.stdout.strip() if check else result


class TrialSchemaTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        sql(f'CREATE DATABASE "{DATABASE}";', "postgres")
        sql("""
          DO $$ BEGIN CREATE ROLE authenticated; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
          DO $$ BEGIN CREATE ROLE anon; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
          DO $$ BEGIN CREATE ROLE service_role BYPASSRLS; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
          CREATE SCHEMA auth;
          CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS
          $$ SELECT nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;
          GRANT USAGE ON SCHEMA auth TO authenticated;
          CREATE TABLE auth.users(id uuid PRIMARY KEY);
          CREATE TABLE public.transactions(user_id uuid);
          CREATE TABLE public.plaid_connections(user_id uuid);
          CREATE TABLE public.finance_data(user_id uuid);
          CREATE TABLE public.sync_locks(user_id uuid);
          CREATE TABLE public.admin_access(email text);
          CREATE FUNCTION public.update_updated_at_column() RETURNS trigger LANGUAGE plpgsql AS
          $$ BEGIN NEW.updated_at=now(); RETURN NEW; END $$;
        """)
        # Production backfill is deliberately excluded: fixtures are lab-only.
        source = SCHEMA.read_text().split("-- PRODUCTION BACKFILL")[0]
        sql(source + ("\nCOMMIT;" if source.lstrip().startswith("BEGIN;") else ""))
        sql("CREATE TRIGGER deletion AFTER DELETE ON auth.users FOR EACH ROW EXECUTE FUNCTION public.delete_user_data();")

    @classmethod
    def tearDownClass(cls):
        sql(f'DROP DATABASE "{DATABASE}";', "postgres")

    def setUp(self):
        sql("TRUNCATE public.subscriptions, public.trial_reservations, public.stripe_events, auth.users, public.transactions, public.plaid_connections, public.finance_data, public.sync_locks, public.admin_access;")

    def reserve(self, user=USER, email="lab@example.test"):
        return json.loads(sql(f"SELECT public.reserve_trial('{user}','{email}');"))

    def claim(self, owner=OWNER, event="evt_lab", customer="cus_lab"):
        return sql(f"SELECT public.claim_stripe_event('{event}','checkout.session.completed','2026-01-01T00:00:00Z','{owner}','{customer}');")

    def test_reserved_attempts_reuse_the_same_generation(self):
        first = self.reserve()
        second = self.reserve(email=" LAB@example.test ")
        self.assertEqual(first["decision"], "granted")
        self.assertEqual(first["generation"], 1)
        self.assertEqual(second, {**first, "decision": "own_pending"})

    def test_twenty_concurrent_attempts_grant_once(self):
        with concurrent.futures.ThreadPoolExecutor(max_workers=20) as pool:
            results = list(pool.map(lambda _: self.reserve(), range(20)))
        self.assertEqual(sum(r["decision"] == "granted" for r in results), 1)
        self.assertEqual(len({r["reservation_id"] for r in results}), 1)
        self.assertEqual(sql("SELECT count(*) FROM public.trial_reservations;"), "1")

    def test_released_reservation_reuses_identity_with_new_generation(self):
        first = self.reserve()
        sql("UPDATE public.trial_reservations SET status='released',checkout_session_id='cs_old';")
        retry = self.reserve()
        self.assertEqual(retry["reservation_id"], first["reservation_id"])
        self.assertEqual(retry["generation"], 2)
        self.assertEqual(sql("SELECT count(*) FROM public.trial_reservations WHERE checkout_session_id IS NOT NULL;"), "0")

    def test_consumed_history_blocks_both_user_and_email(self):
        self.reserve()
        sql("UPDATE public.trial_reservations SET status='consumed',consumed_at=now();")
        self.assertEqual(self.reserve(email="new@example.test"), {"decision": "used"})
        self.assertEqual(self.reserve(user=OTHER), {"decision": "used"})

    def test_consumed_history_cannot_be_released(self):
        self.reserve()
        sql("UPDATE public.trial_reservations SET status='consumed';")
        result = sql("UPDATE public.trial_reservations SET status='released';", check=False)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("Consumed trial history is immutable", result.stderr)

    def test_stale_generation_cannot_attach_checkout(self):
        self.reserve()
        sql("UPDATE public.trial_reservations SET status='released';")
        self.reserve()
        self.assertEqual(sql("WITH changed AS (UPDATE public.trial_reservations SET checkout_session_id='cs_stale' WHERE generation=1 AND status='reserved' RETURNING id) SELECT count(*) FROM changed;"), "0")

    def test_twenty_duplicate_events_have_one_claim_owner(self):
        with concurrent.futures.ThreadPoolExecutor(max_workers=20) as pool:
            tokens = list(pool.map(lambda _: self.claim(), range(20)))
        self.assertEqual([t for t in tokens if t], ["1"])
        self.assertEqual(sql("SELECT attempts FROM public.stripe_events;"), "1")

    def test_expired_lease_fences_old_owner(self):
        self.assertEqual(self.claim(), "1")
        sql("UPDATE public.stripe_events SET lease_until=now()-interval '1 second';")
        self.assertEqual(self.claim(owner=OTHER_OWNER), "2")
        self.assertEqual(sql(f"SELECT public.complete_stripe_event('evt_lab','{OWNER}',1);"), "f")
        self.assertEqual(sql(f"SELECT public.complete_stripe_event('evt_lab','{OTHER_OWNER}',2);"), "t")
        self.assertEqual(self.claim(), "")

    def test_failed_event_can_be_retried_without_losing_identifiers(self):
        self.claim()
        self.assertEqual(sql(f"SELECT public.release_stripe_event('evt_lab','{OWNER}',1,'temporary_failure',0);"), "t")
        self.assertEqual(self.claim(owner=OTHER_OWNER), "2")
        self.assertEqual(sql("SELECT stripe_customer_id FROM public.stripe_events;"), "cus_lab")
        self.assertEqual(sql("SELECT count(*) FROM public.stripe_events WHERE processed_at IS NOT NULL;"), "0")

    def test_backoff_prevents_immediate_reclaim(self):
        self.claim()
        self.assertEqual(sql(f"SELECT public.release_stripe_event('evt_lab','{OWNER}',1,'retry',30);"), "t")
        self.assertEqual(self.claim(owner=OTHER_OWNER), "")

    def test_event_identity_cannot_be_replaced_by_duplicate(self):
        self.claim()
        sql("UPDATE public.stripe_events SET lease_until=now()-interval '1 second';")
        self.assertEqual(self.claim(customer="cus_other"), "")
        self.assertEqual(sql("SELECT stripe_customer_id FROM public.stripe_events;"), "cus_lab")

    def test_only_owner_reads_subscription_and_only_service_writes_billing(self):
        sql(f"INSERT INTO public.subscriptions(user_id,stripe_customer_id,stripe_subscription_id,status) VALUES ('{USER}','cus_lab','sub_lab','active'),('{OTHER}','cus_other','sub_other','canceled');")
        count = sql(f"SET ROLE authenticated; SET request.jwt.claim.sub='{USER}'; SELECT count(*) FROM public.subscriptions;")
        self.assertEqual(count, "1")
        self.assertEqual(sql("SELECT has_table_privilege('authenticated','public.subscriptions','UPDATE');"), "f")
        self.assertEqual(sql("SELECT has_table_privilege('anon','public.subscriptions','SELECT');"), "f")
        self.assertEqual(sql("SELECT has_function_privilege('authenticated','public.reserve_trial(uuid,text)','EXECUTE');"), "f")
        self.assertEqual(sql("SELECT has_table_privilege('authenticated','public.trial_reservations','SELECT');"), "f")

    def test_deletion_preserves_consumed_history_and_unrelated_data(self):
        self.reserve()
        sql("UPDATE public.trial_reservations SET status='consumed';")
        self.reserve(user=OTHER, email="other@example.test")
        sql(f"INSERT INTO auth.users VALUES ('{USER}'),('{OTHER}'); INSERT INTO public.admin_access VALUES ('grant@example.test'); INSERT INTO public.subscriptions(user_id,stripe_customer_id,stripe_subscription_id,status) VALUES ('{USER}','cus_lab','sub_lab','active'),('{OTHER}','cus_other','sub_other','active'); DELETE FROM auth.users WHERE id='{USER}';")
        self.assertEqual(sql("SELECT count(*) FROM public.subscriptions;"), "1")
        self.assertEqual(sql("SELECT count(*) FROM public.trial_reservations WHERE status='consumed';"), "1")
        self.assertEqual(sql("SELECT count(*) FROM public.admin_access;"), "1")
        sql(f"DELETE FROM auth.users WHERE id='{OTHER}';")
        self.assertEqual(sql("SELECT count(*) FROM public.trial_reservations WHERE status='reserved';"), "0")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--schema", type=Path)
    args, remaining = parser.parse_known_args()
    candidates = sorted((ROOT / "supabase/migrations").glob("*.sql"))
    SCHEMA = args.schema or next(p for p in reversed(candidates) if "claim_stripe_event" in p.read_text())
    unittest.main(argv=[__file__, *remaining])