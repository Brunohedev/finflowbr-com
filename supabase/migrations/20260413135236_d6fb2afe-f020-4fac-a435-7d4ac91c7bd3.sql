CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
begin
  if exists (
    select 1 from admin_invites
    where email = new.email
  ) then
    insert into user_entitlements (user_id, access_type, source)
    values (new.id, 'unlimited', 'admin_invite');
  else
    insert into user_entitlements (user_id, access_type, source)
    values (new.id, 'pro', 'stripe_default');
  end if;
  return new;
end;
$function$;