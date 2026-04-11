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
    <div className="px-4 py-4 hover:bg-zinc-800/40 transition-colors">
      <div className="flex flex-col gap-4">
        <div className="min-w-0">
          <div className="flex flex-col gap-2">
            <h3 className="text-[12px] md:text-[13px] font-bold uppercase text-white leading-tight break-words">
              {lead?.razao_social || 'SEM RAZÃO SOCIAL'}
            </h3>

            <div className="flex flex-wrap gap-2">
              <span className="text-[9px] bg-blue-900/20 px-2.5 py-1 rounded-lg text-blue-300 font-bold border border-blue-500/10">
                {cnpjFormatado}
              </span>

              <span className="text-[9px] bg-zinc-800 px-2.5 py-1 rounded-lg text-zinc-300 font-bold border border-white/5 uppercase">
                {lead?.bairro || 'SEM BAIRRO'}
              </span>

              <span className="text-[9px] bg-emerald-900/20 px-2.5 py-1 rounded-lg text-emerald-300 font-bold border border-emerald-500/10 uppercase">
                {lead?.municipio || 'SEM MUNICÍPIO'}{lead?.uf ? ` - ${lead.uf}` : ''}
              </span>

              <span className="text-[9px] bg-orange-900/20 px-2.5 py-1 rounded-lg text-orange-300 font-bold border border-orange-500/10 max-w-full truncate">
                {lead?.cnae_principal_descricao || 'SEM CNAE'}
              </span>

              <span className="text-[9px] bg-violet-900/20 px-2.5 py-1 rounded-lg text-violet-300 font-bold border border-violet-500/10">
                {lead?.status_vendedor || 'Sem status vendedor'}
              </span>
            </div>

            {lead?.nome_fantasia && lead.nome_fantasia !== lead.razao_social && (
              <p className="text-[10px] text-zinc-400 break-words">
                Fantasia: {lead.nome_fantasia}
              </p>
            )}

            {lead?.contato_nome && (
              <p className="text-[10px] text-zinc-400 break-words">
                Contato: {lead.contato_nome}
              </p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2">
          <button
            type="button"
            onClick={onVisualizar}
            className="h-10 px-3 rounded-xl bg-zinc-800 text-white text-[10px] font-black uppercase tracking-wide border border-white/10 hover:bg-zinc-700 active:scale-95 transition-all"
          >
            Visualizar
          </button>

          <button
            type="button"
            onClick={onIncrementar}
            className="h-10 px-3 rounded-xl bg-blue-700 text-white text-[10px] font-black uppercase tracking-wide hover:bg-blue-600 active:scale-95 transition-all"
          >
            Incrementar
          </button>

          <button
            type="button"
            onClick={onCadastrar}
            className="h-10 px-3 rounded-xl bg-emerald-700 text-white text-[10px] font-black uppercase tracking-wide hover:bg-emerald-600 active:scale-95 transition-all"
          >
            Cadastrar
          </button>

          <button
            type="button"
            onClick={onMesaDeTrabalho}
            className="h-10 px-3 rounded-xl bg-violet-700 text-white text-[10px] font-black uppercase tracking-wide hover:bg-violet-600 active:scale-95 transition-all"
          >
            Mesa de Trabalho
          </button>

          <button
            type="button"
            onClick={onEstoque}
            className="h-10 px-3 rounded-xl bg-yellow-600 text-black text-[10px] font-black uppercase tracking-wide hover:bg-yellow-500 active:scale-95 transition-all"
          >
            Estoque
          </button>

          <button
            type="button"
            onClick={onDeletar}
            className="h-10 px-3 rounded-xl bg-red-700 text-white text-[10px] font-black uppercase tracking-wide hover:bg-red-600 active:scale-95 transition-all"
          >
            Deletar
          </button>
        </div>
      </div>
    </div>
  );
}
