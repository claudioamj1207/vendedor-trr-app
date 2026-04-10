"use client";
import React from 'react';

export default function TriagemLeadRow({
  lead,
  onVisualizar,
  onMover,
  onAvancar,
  onEnviar,
  onProspeccao,
  formatarCNPJ
}) {
  const handleAvancar =
    onProspeccao || onAvancar || onEnviar || onMover || (() => {});

  return (
    <div className="px-4 py-4 hover:bg-zinc-800/40 transition-colors">
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex flex-col gap-2">
            <h3 className="text-[12px] md:text-[13px] font-bold uppercase text-white leading-tight break-words">
              {lead?.razao_social || 'SEM RAZÃO SOCIAL'}
            </h3>

            <div className="flex flex-wrap gap-2">
              <span className="text-[9px] bg-blue-900/20 px-2.5 py-1 rounded-lg text-blue-300 font-bold border border-blue-500/10">
                {formatarCNPJ ? formatarCNPJ(lead?.cnpj || '') : (lead?.cnpj || 'SEM CNPJ')}
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
            </div>

            {lead?.nome_fantasia && lead.nome_fantasia !== lead.razao_social && (
              <p className="text-[10px] text-zinc-400 truncate">
                Fantasia: {lead.nome_fantasia}
              </p>
            )}

            {lead?.fonte_lead && (
              <p className="text-[10px] text-zinc-500 truncate">
                Fonte: {lead.fonte_lead}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-2 shrink-0">
          <button
            type="button"
            onClick={onVisualizar}
            className="min-w-[110px] h-10 px-4 rounded-xl bg-zinc-800 text-white text-[10px] font-black uppercase tracking-wide border border-white/10 hover:bg-zinc-700 active:scale-95 transition-all"
            title="Visualizar lead"
          >
            Visualizar
          </button>

          <button
            type="button"
            onClick={handleAvancar}
            className="min-w-[110px] h-10 px-4 rounded-xl bg-blue-600 text-white text-[10px] font-black uppercase tracking-wide hover:bg-blue-500 active:scale-95 transition-all"
            title="Enviar para prospecção"
          >
            Avançar
          </button>
        </div>
      </div>
    </div>
  );
}
