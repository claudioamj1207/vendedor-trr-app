begin;
insert into public.app_usuarios(id,nome,usuario,senha_hash,perfil,ativo,created_at) values
('00000000-0000-4000-8000-000000092201','Teste transacional','viva_teste_transacional','nao_utilizavel','proprietario',true,now());
insert into public.app_sessoes(id,usuario_id,token_hash,persistente,revogada,created_at,expires_at) values
('00000000-0000-4000-8000-000000092202','00000000-0000-4000-8000-000000092201',encode(extensions.digest('token-sintetico-transacional-viva','sha256'),'hex'),false,false,now(),now()+interval '1 minute');
set local role anon;
do $$
declare r jsonb; v bigint;
begin
 begin
  perform public.viva_clientes_base('invalido');
  raise exception 'FALHA: aceitou token inválido';
 exception when insufficient_privilege then null;
 end;
 begin
  perform registros from viva_privado.base_clientes;
  raise exception 'FALHA: permitiu ler tabela diretamente';
 exception when insufficient_privilege then null;
 end;
 r := public.viva_clientes_base('token-sintetico-transacional-viva');
 v := coalesce((r->'base'->>'revisao')::bigint,0);
 r := public.viva_clientes_base('token-sintetico-transacional-viva',jsonb_build_object(
  'registros',jsonb_build_array(jsonb_build_object('documento','01234567890','nome','Pessoa fictícia','uf','SP'),jsonb_build_object('documento','01234567000189','nome','Empresa fictícia','uf','SC')),
  'pendencias','[]'::jsonb,'fonte','teste.csv','data_base','2026-09-22','revisao',v));
 if jsonb_array_length(r->'base'->'registros')<>2 then raise exception 'FALHA: salvamento'; end if;
 begin
  perform public.viva_clientes_base('token-sintetico-transacional-viva',jsonb_build_object(
   'registros',r->'base'->'registros','pendencias','[]'::jsonb,'fonte','teste.csv','data_base','2026-09-22','revisao',v));
  raise exception 'FALHA: aceitou versão desatualizada';
 exception when raise_exception then
  if SQLERRM like 'FALHA:%' then raise; end if;
 end;
end $$;
reset role;
update public.app_usuarios set perfil='usuario' where id='00000000-0000-4000-8000-000000092201';
set local role anon;
do $$
begin
 perform public.viva_clientes_base('token-sintetico-transacional-viva');
 begin
  perform public.viva_clientes_base('token-sintetico-transacional-viva','{}'::jsonb);
  raise exception 'FALHA: vendedor atualizou base';
 exception when insufficient_privilege then null;
 end;
end $$;
reset role;
rollback;
select 'OK: token inválido, leitura direta, CPF, UF, upload, concorrência e perfil; nenhum dado de teste persistido' as teste;
