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
    <div className="bg-zinc-900/60 border border-white/5 rounded-2xl px-4 py-3 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
      <div className="flex-1 min-w-0">
        <div className="flex flex-col lg:flex-row lg:items-center gap-2 lg:gap-4">
          <h3 className="text-[12px] font-bold uppercase text-white truncate">
            {lead.razao_social || 'Sem razão social'}
          </h3>

          <span className="text-[9px] bg-blue-900/20 px-2 py-1 rounded text-blue-300 font-bold border border-blue-500/10 uppercase w-fit">
            {lead.cnpj || 'Sem CNPJ'}
          </span>

          {lead.bairro && (
            <span className="text-[9px] bg-zinc-800 px-2 py-1 rounded text-zinc-400 font-bold border border-white/5 uppercase w-fit">
              {lead.bairro}
            </span>
          )}
        </div>

        <div className="mt-2 flex flex-wrap gap-2">
          <span className="text-[9px] text-zinc-500 uppercase">
            {lead.nome_fantasia || 'Sem nome fantasia'}
          </span>

          <span className="text-[9px] text-orange-400 uppercase truncate max-w-[280px]">
            {lead.cnae_principal_descricao || 'Sem CNAE'}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 lg:justify-end">
        <button
          onClick={() => onVisualizar(lead)}
          className="text-[9px] bg-zinc-800 px-3 py-2 rounded-full font-bold border border-white/10"
        >
          VISUALIZAR
        </button>

        <button
          onClick={() => onIncrementar(lead)}
          className="text-[9px] bg-emerald-700 px-3 py-2 rounded-full font-bold"
        >
          INCREMENTAR
        </button>

        <button
          onClick={() => onCadastrar(lead)}
          className="text-[9px] bg-cyan-700 px-3 py-2 rounded-full font-bold"
        >
          CADASTRAR
        </button>

        <button
          onClick={() => onMesaDeTrabalho(lead)}
          className="text-[9px] bg-blue-700 px-3 py-2 rounded-full font-bold"
        >
          MESA DE TRABALHO
        </button>

        <button
          onClick={() => onEstoque(lead)}
          className="text-[9px] bg-amber-700 px-3 py-2 rounded-full font-bold"
        >
          ESTOQUE
        </button>

        <button
          onClick={() => onDeletar(lead)}
          className="text-[9px] bg-red-700 px-3 py-2 rounded-full font-bold"
        >
          DELETAR
        </button>
      </div>
    </div>
  );
}
