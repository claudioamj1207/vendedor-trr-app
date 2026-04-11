"use client";
import React from 'react';

export default function TriagemLeadRow({
  lead,
  onVisualizar,
  onIncrementar,
  onCadastrar,
  onMesaDeTrabalho,
  onEstoque,
  onDeletar,
  formatarCNPJ
}) {
  const cnpjFormatado = formatarCNPJ
    ? formatarCNPJ(lead?.cnpj || '')
    : (lead?.cnpj || 'SEM CNPJ');

  return (
    <div className="px-4 py-3 hover:bg-zinc-800/40 transition-colors border-b border-zinc-800/50">

      {/* LINHA PRINCIPAL */}
      <div className="flex items-center justify-between gap-3">

        {/* INFO DO LEAD */}
        <div className="flex-1 min-w-0">
          <h3 className="text-[12px] font-bold uppercase text-white truncate">
            {lead?.razao_social || 'SEM RAZÃO SOCIAL'}
          </h3>

          <div className="flex gap-2 mt-1 flex-wrap">
            <span className="text-[9px] text-blue-400 font-bold">
              {cnpjFormatado}
            </span>

            <span className="text-[9px] text-zinc-400">
              {lead?.bairro || 'SEM BAIRRO'}
            </span>

            <span className="text-[9px] text-zinc-500 truncate max-w-[200px]">
              {lead?.cnae_principal_descricao || 'SEM CNAE'}
            </span>
          </div>
        </div>

        {/* BOTÕES MINI */}
        <div className="flex gap-1 flex-wrap">

          <button
            onClick={onVisualizar}
            className="px-2 py-1 text-[9px] rounded-md bg-zinc-800 text-white hover:bg-zinc-700"
          >
            VER
          </button>

          <button
            onClick={onIncrementar}
            className="px-2 py-1 text-[9px] rounded-md bg-blue-700 text-white hover:bg-blue-600"
          >
            +
          </button>

          <button
            onClick={onCadastrar}
            className="px-2 py-1 text-[9px] rounded-md bg-emerald-700 text-white hover:bg-emerald-600"
          >
            CAD
          </button>

          <button
            onClick={onMesaDeTrabalho}
            className="px-2 py-1 text-[9px] rounded-md bg-violet-700 text-white hover:bg-violet-600"
          >
            MESA
          </button>

          <button
            onClick={onEstoque}
            className="px-2 py-1 text-[9px] rounded-md bg-yellow-600 text-black hover:bg-yellow-500"
          >
            EST
          </button>

          <button
            onClick={onDeletar}
            className="px-2 py-1 text-[9px] rounded-md bg-red-700 text-white hover:bg-red-600"
          >
            DEL
          </button>

        </div>
      </div>
    </div>
  );
}
