# Alterações VTRR - identidade visual e categorias

## Aplicado

- Identidade visual oficial do VTRR no cabeçalho.
- Nome do sistema corrigido para VTRR.
- Ícones oficiais adicionados em `public/icon.png`, `public/icon-192.png`, `public/icon-512.png` e `public/adaptive-icon.png`.
- Manifest PWA atualizado para VTRR.
- Estoque passa a carregar todos os leads do banco em uma única aba, sem separar por Triagem e Mesa.
- Aba Categorias criada com os cartões:
  - Transporte / Logística
  - Indústria
  - Material de Construção
  - Construtoras
  - Navegação
  - Agropecuária / Alimentos
  - Combustíveis e Energia
  - Máquinas e Equipamentos
  - Outros
- As ações antigas foram preservadas: visualizar, incrementar, cadastrar, enviar para Triagem, enviar para Mesa, devolver ao Estoque, deletar e enviar ao Meu To Do quando o lead estiver em Mesa de Trabalho.

## Observação

O build local só depende das variáveis Supabase já configuradas no Vercel:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
