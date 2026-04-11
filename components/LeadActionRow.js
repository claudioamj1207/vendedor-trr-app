"use client";
import React from 'react';

function montarEnderecoConsulta(lead) {
  const partes = [
    lead?.logradouro,
    lead?.numero,
    lead?.bairro,
    lead?.municipio,
    lead?.uf,
    lead?.cep
  ].filter(Boolean);

  return partes.join(', ');
}

async function copiarTexto(texto) {
  if (!texto) return;

  try {
    await navigator.clipboard.writeText(texto);
  } catch {
    const input = document.createElement('textarea');
    input.value = texto;
    document.body.appendChild(input);
    input.select();
    document.execCommand('copy');
    document.body.removeChild(input);
  }
}

function abrirRota(lead) {
  const endereco = montarEnderecoConsulta(lead);

  if (!endereco) {
    alert('Lead sem endereço suficiente');
    return;
  }

  const destino = encodeURIComponent(endereco);
  const url = `https://www.waze.com/ul?q=${destino}&navigate=yes`;

  window.open(url, '_blank');
}

export default function LeadActionRow({
  lead,
  formatarCNPJ,
  actions = []
}) {
  const cnpjLimpo = String(lead?.cnpj || '').replace(/\D/g, '');
  const cnpjFormatado = formatarCNPJ
    ? formatarCNPJ(lead?.cnpj || '')
    : (lead?.cnpj || 'SEM CNPJ');

  return (
    <div className="px-4 py-3 hover:bg-zinc-800/40 transition-colors border-b border-zinc-800/50">
      <div className="flex items-center justify-between gap-4">

        {/* INFO */}
        <div className="flex-1 min-w-0">
          <h3 className="text-[12px] md:text-[13px] font-bold uppercase text-white truncate">
            {lead?.razao_social || 'SEM RAZÃO SOCIAL'}
          </h3>

          <div className="flex gap-2 mt-1.5 flex-wrap items-center">
            <span className="text-[10px] text-blue-400 font-bold">
              {cnpjFormatado}
            </span>

            <button
              onClick={() => copiarTexto(cnpjLimpo)}
              className="px-2 py-0.5 text-[9px] rounded-md bg-blue-900/20 text-blue-300 font-black border border-blue-500/10 hover:bg-blue-800/30"
            >
              COPIAR
            </button>

            <span className="text-[10px] text-zinc-400 uppercase">
              {lead?.bairro || 'SEM BAIRRO'}
            </span>

            <span className="text-[10px] text-zinc-500 uppercase">
              {lead?.municipio || 'SEM MUNICÍPIO'}{lead?.uf ? ` - ${lead.uf}` : ''}
            </span>
          </div>
        </div>

        {/* BOTÕES */}
        <div className="flex gap-1.5 flex-wrap justify-end shrink-0">

          {/* BOTÃO ROTA AGORA AQUI */}
          <button
            onClick={() => abrirRota(lead)}
            className="px-3 py-1.5 text-[10px] rounded-md font-black uppercase bg-emerald-700 text-white hover:bg-emerald-600"
          >
            ROTA
          </button>

          {actions.map((action) => (
            <button
              key={action.key}
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
