-- Qualify crew invitation columns that conflict with RETURNS TABLE output names.

create or replace function public.create_crew_invitation(p_crew_id uuid, p_token_hash text)
returns table(id uuid, expires_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare new_id uuid; new_expiry timestamptz := now() + interval '7 days';
begin
  if not public.is_adult_research_participant() then raise exception 'Adult consent is required'; end if;
  if not private.is_current_crew_member(p_crew_id) then raise exception 'Crew membership required'; end if;
  if p_token_hash !~ '^[0-9a-f]{64}$' then raise exception 'Invalid invitation token'; end if;
  if (select count(*) from public.crew_invitations as ci
      where ci.inviter_id = (select auth.uid()) and ci.created_at > now() - interval '1 hour') >= 20 then
    raise exception 'Invitation limit reached. Try again later';
  end if;

  update public.crew_invitations as ci set status = 'expired', responded_at = now()
    where ci.status = 'pending' and ci.expires_at <= now();
  insert into public.crew_invitations(crew_id, inviter_id, token_hash, expires_at)
    values (p_crew_id, (select auth.uid()), p_token_hash, new_expiry)
    returning crew_invitations.id into new_id;
  return query select new_id, new_expiry;
end;
$$;
revoke all on function public.create_crew_invitation(uuid, text) from public;
grant execute on function public.create_crew_invitation(uuid, text) to authenticated;
