import React from 'react';

export default function TriagemLeadRow({
  lead,
  onVisualizar,
  onIncrementar,
  onCadastrar,
  onMesaDeTrabalho,
  onEstoque,
  onDeletar
}) {
  return (
    <div className="rounded-2xl border border-white/5 bg-zinc-900/60 px-4 py-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="min-w-0 flex-1">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:gap-4">
          <h3 className="truncate text-[12px] font-bold uppercase text-white">
            {lead.razao_social || 'Sem razão social'}
          </h3>

          <span className="w-fit rounded bg-blue-900/20 px-2 py-1 text-[9px] font-bold uppercase text-blue-300 border border-blue-500/10">
            {lead.cnpj || 'Sem CNPJ'}
          </span>

          {lead.bairro && (
            <span className="w-fit rounded bg-zinc-800 px-2 py-1 text-[9px] font-bold uppercase text-zinc-400 border border-white/5">
              {lead.bairro}
            </span>
          )}
        </div>

        <div className="mt-2 flex flex-wrap gap-2">
          <span className="text-[9px] uppercase text-zinc-500">
            {lead.nome_fantasia || 'Sem nome fantasia'}
          </span>

          <span className="max-w-[280px] truncate text-[9px] uppercase text-orange-400">
            {lead.cnae_principal_descricao || 'Sem CNAE'}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 lg:justify-end">
        <button
          onClick={() => onVisualizar(lead)}
          className="rounded-full border border-white/10 bg-zinc-800 px-3 py-2 text-[9px] font-bold"
        >
          VISUALIZAR
        </button>

        <button
          onClick={() => onIncrementar(lead)}
          className="rounded-full bg-emerald-700 px-3 py-2 text-[9px] font-bold"
        >
          INCREMENTAR
        </button>

        <button
          onClick={() => onCadastrar(lead)}
          className="rounded-full bg-cyan-700 px-3 py-2 text-[9px] font-bold"
        >
          CADASTRAR
        </button>

        <button
          onClick={() => onMesaDeTrabalho(lead)}
          className="rounded-full bg-blue-700 px-3 py-2 text-[9px] font-bold"
        >
          MESA DE TRABALHO
        </button>

        <button
          onClick={() => onEstoque(lead)}
          className="rounded-full bg-amber-700 px-3 py-2 text-[9px] font-bold"
        >
          ESTOQUE
        </button>

        <button
          onClick={() => onDeletar(lead)}
          className="rounded-full bg-red-700 px-3 py-2 text-[9px] font-bold"
        >
          DELETAR
        </button>
      </div>
    </div>
  );
}
