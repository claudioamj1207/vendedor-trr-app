# Clientes Viva

O painel Clientes Viva permite consultar a base compartilhada e atualizar a relação por CSV/XLS/XLSX. O proprietário confirma uma prévia antes de substituir a base. Histórico e conteúdo dos leads não são sobrescritos.

A listagem completa do ERP (linhas de documento/nome seguidas de endereço) e tabelas com colunas Documento e Nome são aceitas. CPF/CNPJ são normalizados como texto, sem completar dígitos. CPF tem 11 dígitos e CNPJ 14; isso verifica formato, não dígitos verificadores. Documentos incompletos e nomes ausentes vão para pendências. Duplicados são consolidados pelo documento completo, preservando a última ocorrência. UFs não são restringidas nem deduzidas do DDD.

Após autenticar com o usuário existente do sistema, os leads mostram Cadastrado na Viva, Não cadastrado na base Viva ou A conferir. A classificação considera o documento completo, inclusive filial. Sem base disponível, todos permanecem A conferir. A data da relação aparece no painel e na exportação XLSX. A base reflete cadastro, não histórico de compras.

CPFs são importados e consultados no painel Clientes Viva. A pescaria e a API `/api/importar-cnpj` continuam sendo consultas de empresas; não consultam pessoas físicas em serviços de CNPJ. Elas já aceitavam todas as UFs. CPFs eventualmente existentes no estoque são formatados e classificados; a exclusão de empresas não ativas ignora CPF.

## Armazenamento e acesso

Aplicar `database/clientes_viva.sql` no projeto Vendedor TRR. A tabela `viva_privado.base_clientes` usa RLS, não concede leitura direta e fica fora do schema público. A RPC pública é SECURITY INVOKER; a implementação privada valida a sessão existente `app_validar_sessao`. Leitura exige sessão ativa e escrita exige perfil proprietário. Tokens ficam em sessionStorage, expiram conforme as regras existentes e são revogados ao fechar o acesso. Não há dados reais de clientes ou credenciais no repositório.

Atualizações usam uma revisão para rejeitar sobrescritas concorrentes. Uploads rejeitam relações vazias e acima de 20 mil registros. Dados de clientes não são enviados à BrasilAPI.

## Verificação

- `node --test tests/clientesViva.test.mjs`
- Teste opcional do arquivo real: definir VIVA_CSV_PATH para o CSV autorizado; o teste não envia nem grava dados.
- `tests/clientesViva.database.sql`: sessão e dados sintéticos dentro de transação revertida; verifica leitura/escrita, perfil, token inválido, leitura direta e conflito de revisão.
- `npm run build` com as variáveis Supabase do projeto.

A carga inicial do arquivo real exige autorização específica para envio ao banco do VTRR. A implementação não contém carga automática embutida.
