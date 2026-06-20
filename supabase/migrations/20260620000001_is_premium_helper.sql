-- Fuente de verdad server-side de "es premium". Espeja isPremiumFromProfile en el cliente.
create or replace function public.is_premium(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = uid and (
      p.role = 'admin'
      or p.plan = 'founding'
      or (p.plan = 'paid'  and (p.premium_expires_at is null or p.premium_expires_at > now()))
      or (p.plan = 'trial' and p.premium_expires_at is not null and p.premium_expires_at > now())
    )
  );
$$;
