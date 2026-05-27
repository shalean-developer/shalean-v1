-- Canonical customer identity: merge duplicate customer rows and prevent new
-- duplicates from booking/profile writes.

create or replace function public.normalize_customer_email(p_email text)
returns text
language sql
immutable
as $$
  select nullif(lower(btrim(p_email)), '')
$$;

create or replace function public.normalize_customer_phone(p_phone text)
returns text
language plpgsql
immutable
as $$
declare
  v_digits text;
begin
  v_digits := regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g');

  if v_digits = '' then
    return null;
  end if;

  if length(v_digits) = 10 and left(v_digits, 1) = '0' then
    return '+27' || substr(v_digits, 2);
  end if;

  if length(v_digits) = 11 and left(v_digits, 2) = '27' then
    return '+' || v_digits;
  end if;

  return v_digits;
end;
$$;

alter table public.customers
  add column if not exists email_normalized text,
  add column if not exists phone_normalized text;

create or replace function public.set_customer_identity_normalized_fields()
returns trigger
language plpgsql
as $$
begin
  new.email_normalized := public.normalize_customer_email(new.email);
  new.phone_normalized := public.normalize_customer_phone(new.phone);

  return new;
end;
$$;

drop trigger if exists customers_set_identity_normalized_fields on public.customers;
create trigger customers_set_identity_normalized_fields
  before insert or update of email, phone on public.customers
  for each row
  execute function public.set_customer_identity_normalized_fields();

update public.customers
set
  email_normalized = public.normalize_customer_email(email),
  phone_normalized = public.normalize_customer_phone(phone)
where email_normalized is distinct from public.normalize_customer_email(email)
   or phone_normalized is distinct from public.normalize_customer_phone(phone);

create temp table tmp_customer_duplicate_map on commit drop as
with ranked as (
  select
    id,
    first_value(id) over (
      partition by email_normalized
      order by
        (auth_user_id is not null) desc,
        created_at asc,
        id asc
    ) as keep_id,
    row_number() over (
      partition by email_normalized
      order by
        (auth_user_id is not null) desc,
        created_at asc,
        id asc
    ) as row_number
  from public.customers
  where email_normalized is not null
)
select id as duplicate_id, keep_id
from ranked
where row_number > 1;

do $$
declare
  v_fk record;
begin
  for v_fk in
    select
      conrelid::regclass::text as table_name,
      att.attname as column_name
    from pg_constraint con
    join pg_attribute att
      on att.attrelid = con.conrelid
     and att.attnum = con.conkey[1]
    where con.contype = 'f'
      and con.confrelid = 'public.customers'::regclass
      and array_length(con.conkey, 1) = 1
  loop
    execute format(
      'update %s as target set %I = duplicates.keep_id from pg_temp.tmp_customer_duplicate_map duplicates where target.%I = duplicates.duplicate_id',
      v_fk.table_name,
      v_fk.column_name,
      v_fk.column_name
    );
  end loop;
end $$;

delete from public.customers c
using pg_temp.tmp_customer_duplicate_map duplicates
where c.id = duplicates.duplicate_id;

create unique index if not exists customers_email_normalized_unique_idx
  on public.customers (email_normalized)
  where email_normalized is not null;

create index if not exists customers_phone_normalized_idx
  on public.customers (phone_normalized)
  where phone_normalized is not null;

create or replace function public.upsert_customer_identity(
  p_auth_user_id uuid,
  p_full_name text,
  p_email text,
  p_phone text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email_normalized text := public.normalize_customer_email(p_email);
  v_phone_normalized text := public.normalize_customer_phone(p_phone);
  v_customer_id uuid;
  v_auth_customer_id uuid;
  v_email_customer_id uuid;
  v_existing_auth_user_id uuid;
  v_fk record;
begin
  if v_email_normalized is null then
    raise exception 'customer email is required'
      using errcode = '23502';
  end if;

  perform pg_advisory_xact_lock(741201, hashtext(v_email_normalized));

  if p_auth_user_id is not null then
    select c.id, c.auth_user_id
    into v_auth_customer_id, v_existing_auth_user_id
    from public.customers c
    where c.auth_user_id = p_auth_user_id
    limit 1;
  end if;

  select c.id, c.auth_user_id
  into v_email_customer_id, v_existing_auth_user_id
  from public.customers c
  where c.email_normalized = v_email_normalized
  order by
    (c.auth_user_id is not null) desc,
    c.created_at asc,
    c.id asc
  limit 1;

  if v_email_customer_id is not null then
    if p_auth_user_id is not null
       and v_existing_auth_user_id is not null
       and v_existing_auth_user_id <> p_auth_user_id then
      raise exception 'customer email is already linked to another account'
        using errcode = '23505';
    end if;

    if v_auth_customer_id is not null and v_auth_customer_id <> v_email_customer_id then
      for v_fk in
        select
          conrelid::regclass::text as table_name,
          att.attname as column_name
        from pg_constraint con
        join pg_attribute att
          on att.attrelid = con.conrelid
         and att.attnum = con.conkey[1]
        where con.contype = 'f'
          and con.confrelid = 'public.customers'::regclass
          and array_length(con.conkey, 1) = 1
      loop
        execute format(
          'update %s set %I = $1 where %I = $2',
          v_fk.table_name,
          v_fk.column_name,
          v_fk.column_name
        )
        using v_email_customer_id, v_auth_customer_id;
      end loop;

      delete from public.customers
      where id = v_auth_customer_id;
    end if;

    v_customer_id := v_email_customer_id;
  elsif v_auth_customer_id is not null then
    v_customer_id := v_auth_customer_id;
  end if;

  if v_customer_id is not null then
    if p_auth_user_id is not null
       and v_existing_auth_user_id is not null
       and v_existing_auth_user_id <> p_auth_user_id then
      raise exception 'customer email is already linked to another account'
        using errcode = '23505';
    end if;

    update public.customers
    set
      auth_user_id = coalesce(auth_user_id, p_auth_user_id),
      full_name = coalesce(nullif(btrim(p_full_name), ''), full_name),
      email = p_email,
      email_normalized = v_email_normalized,
      phone = p_phone,
      phone_normalized = v_phone_normalized,
      updated_at = now()
    where id = v_customer_id
    returning id into v_customer_id;

    return v_customer_id;
  end if;

  insert into public.customers (
    auth_user_id,
    full_name,
    email,
    email_normalized,
    phone,
    phone_normalized
  )
  values (
    p_auth_user_id,
    coalesce(nullif(btrim(p_full_name), ''), 'Customer'),
    p_email,
    v_email_normalized,
    p_phone,
    v_phone_normalized
  )
  returning id into v_customer_id;

  return v_customer_id;
exception
  when unique_violation then
    select c.id
    into v_customer_id
    from public.customers c
    where c.email_normalized = v_email_normalized
       or (p_auth_user_id is not null and c.auth_user_id = p_auth_user_id)
    order by
      (c.auth_user_id is not null) desc,
      c.created_at asc,
      c.id asc
    limit 1;

    if v_customer_id is null then
      raise;
    end if;

    return v_customer_id;
end;
$$;

comment on function public.upsert_customer_identity(uuid, text, text, text) is
  'Transactionally finds or creates one canonical customers row by normalized email, linking auth_user_id when present.';

revoke all on function public.upsert_customer_identity(uuid, text, text, text) from public;
grant execute on function public.upsert_customer_identity(uuid, text, text, text) to service_role;
