"use client";
import React from 'react';

export default function LeadActionRow({
  lead,
  formatarCNPJ,
  actions = []
}) {
  const cnpjFormatado = formatarCNPJ
    ? formatarCNPJ(lead?.cnpj || '')
    : (lead?.cnpj || 'SEM CNPJ');

  return (
    <div className="px-4 py-3 hover:bg-zinc-800/40 transition-colors border-b border-zinc-800/50">
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h3 className="text-[12px] md:text-[13px] font-bold uppercase text-white truncate">
            {lead?.razao_social || 'SEM RAZÃO SOCIAL'}
          </h3>

          <div className="flex gap-2 mt-1.5 flex-wrap items-center">
            <span className="text-[10px] text-blue-400 font-bold">
              {cnpjFormatado}
            </span>

            <span className="text-[10px] text-zinc-400 uppercase">
              {lead?.bairro || 'SEM BAIRRO'}
            </span>

            <span className="text-[10px] text-zinc-500 uppercase">
              {lead?.municipio || 'SEM MUNICÍPIO'}{lead?.uf ? ` - ${lead.uf}` : ''}
            </span>

            <span className="text-[10px] text-zinc-500 truncate max-w-[240px]">
              {lead?.cnae_principal_descricao || 'SEM CNAE'}
            </span>

            {lead?.status_vendedor && (
              <span className="text-[10px] bg-violet-900/20 px-2.5 py-1 rounded-lg text-violet-300 font-bold border border-violet-500/10">
                {lead.status_vendedor}
              </span>
            )}
          </div>
        </div>

        <div className="flex gap-1.5 flex-wrap justify-end shrink-0">
          {actions.map((action) => (
            <button
              key={action.key}
              type="button"
              onClick={action.onClick}
              title={action.label}
              className={`px-3 py-1.5 text-[10px] rounded-md font-black uppercase tracking-wide transition-all active:scale-95 ${action.className}`}
            >
              {action.shortLabel || action.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
