-- Fix RLS on admin_invites (admin-only, no public policies needed but RLS must be enabled)
ALTER TABLE public.admin_invites ENABLE ROW LEVEL SECURITY;

-- Add RLS policy for user_entitlements so authenticated users can read their own
CREATE POLICY "Users can view their own entitlements"
ON public.user_entitlements
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);