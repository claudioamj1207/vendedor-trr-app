-- Private customer snapshot; no customer data is committed to the repository.
-- Authorization uses the existing VTRR app session, not Supabase Auth.
create schema if not exists viva_privado;
revoke all on schema viva_privado from public;
grant usage on schema viva_privado to anon, authenticated;
create table if not exists viva_privado.base_clientes (
 id boolean primary key default true check(id),
 registros jsonb not null default '[]',
 pendencias jsonb not null default '[]',
 fonte text not null,
 data_base date not null,
 revisao bigint not null default 1,
 atualizado_em timestamptz not null default now()
);
alter table viva_privado.base_clientes enable row level security;
revoke all on viva_privado.base_clientes from public, anon, authenticated;
create or replace function viva_privado.clientes_operar(p_token text, p_dados jsonb default null)
returns jsonb language plpgsql security definer set search_path = pg_catalog as $$
declare sessao jsonb; resultado jsonb; versao bigint;
begin
 sessao := public.app_validar_sessao(p_token);
 if coalesce((sessao->>'ok')::boolean,false) is not true then
  raise exception 'Entre com seu usuário para acessar a base Viva.' using errcode='42501';
 end if;
 if p_dados is not null then
  if sessao->>'perfil' <> 'proprietario' then
   raise exception 'Somente o proprietário pode atualizar a base Viva.' using errcode='42501';
  end if;
  if jsonb_typeof(p_dados->'registros') is distinct from 'array'
    or jsonb_typeof(p_dados->'pendencias') is distinct from 'array' then
   raise exception 'Arquivo inválido.';
  end if;
  if jsonb_array_length(p_dados->'registros') not between 1 and 20000
    or length(p_dados::text)>10000000 then raise exception 'Quantidade ou tamanho de arquivo inválido.'; end if;
  if exists(select 1 from jsonb_array_elements(p_dados->'registros') r where
    coalesce(r->>'documento','') !~ '^(\d{11}|\d{14})$' or coalesce(btrim(r->>'nome'),'')='') then
   raise exception 'Há documentos ou nomes inválidos.';
  end if;
  if (select count(*) from jsonb_array_elements(p_dados->'registros')) <>
    (select count(distinct r->>'documento') from jsonb_array_elements(p_dados->'registros') r) then
   raise exception 'Há documentos duplicados.';
  end if;
  if coalesce(btrim(p_dados->>'fonte'),'')='' or p_dados->>'data_base' is null then raise exception 'Informe fonte e data da base.'; end if;
  perform pg_advisory_xact_lock(22092026);
  select revisao into versao from viva_privado.base_clientes where id for update;
  if coalesce(versao,0) <> coalesce((p_dados->>'revisao')::bigint,-1) then
   raise exception 'A base foi atualizada em outra sessão. Recarregue e selecione o arquivo novamente.';
  end if;
  insert into viva_privado.base_clientes(id,registros,pendencias,fonte,data_base,revisao)
   values(true,p_dados->'registros',p_dados->'pendencias',left(p_dados->>'fonte',255),(p_dados->>'data_base')::date,coalesce(versao,0)+1)
   on conflict(id) do update set registros=excluded.registros,pendencias=excluded.pendencias,
    fonte=excluded.fonte,data_base=excluded.data_base,revisao=excluded.revisao,atualizado_em=now();
 end if;
 select to_jsonb(b)-'id' into resultado from viva_privado.base_clientes b where id;
 return jsonb_build_object('base',resultado,'perfil',sessao->>'perfil');
end $$;
revoke all on function viva_privado.clientes_operar(text,jsonb) from public;
grant execute on function viva_privado.clientes_operar(text,jsonb) to anon,authenticated;
create or replace function public.viva_clientes_base(p_token text, p_dados jsonb default null)
returns jsonb language sql security invoker set search_path = pg_catalog as $$
 select viva_privado.clientes_operar(p_token,p_dados);
$$;
revoke all on function public.viva_clientes_base(text,jsonb) from public;
grant execute on function public.viva_clientes_base(text,jsonb) to anon,authenticated;
