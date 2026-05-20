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
    window.alert('Lead sem endereço suficiente para abrir rota.');
    return;
  }

  const destino = encodeURIComponent(endereco);
  const url = `https://www.waze.com/ul?q=${destino}&navigate=yes`;

  window.open(url, '_blank', 'noopener,noreferrer');
}

export default function LeadActionRow({
  lead,
  formatarCNPJ,
  actions = [],
  onEnviarParaMeuToDo
}) {
  const cnpjLimpo = String(lead?.cnpj || '').replace(/\D/g, '');
  const cnpjFormatado = formatarCNPJ
    ? formatarCNPJ(lead?.cnpj || '')
    : (lead?.cnpj || 'SEM CNPJ');

  function handleEnviarParaMeuToDo() {
    if (!onEnviarParaMeuToDo) {
      window.alert('A função de envio para o Meu To Do ainda não foi ligada nesta tela.');
      return;
    }

    onEnviarParaMeuToDo(lead);
  }

  return (
    <div className="px-4 py-3 border-b border-slate-200 bg-white hover:bg-slate-50 transition-colors">
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-[12px] md:text-[13px] font-black uppercase text-slate-900 truncate tracking-wide">
            {lead?.razao_social || 'SEM RAZÃO SOCIAL'}
          </h3>

          <div className="flex flex-wrap items-center gap-2 mt-1.5">
            <span className="text-[10px] font-black text-blue-700">
              {cnpjFormatado}
            </span>

            <button
              type="button"
              onClick={() => copiarTexto(cnpjLimpo)}
              title="Copiar CNPJ"
              className="px-2.5 py-1 text-[9px] rounded-lg bg-blue-50 text-blue-700 font-black border border-blue-200 hover:bg-blue-100 transition-colors"
            >
              COPIAR
            </button>

            <span className="text-[10px] text-slate-600 uppercase">
              {lead?.bairro || 'SEM BAIRRO'}
            </span>

            <span className="text-[10px] text-slate-500 uppercase">
              {lead?.municipio || 'SEM MUNICÍPIO'}
              {lead?.uf ? ` - ${lead.uf}` : ''}
            </span>

            <span className="text-[10px] text-slate-500 truncate max-w-[260px]">
              {lead?.cnae_principal_descricao || 'SEM CNAE'}
            </span>

            {lead?.status_vendedor && (
              <span className="px-2.5 py-1 text-[9px] rounded-lg bg-violet-50 text-violet-700 font-black border border-violet-200 uppercase">
                {lead.status_vendedor}
              </span>
            )}

            {lead?.situacao_cadastral && (
              <span className="px-2.5 py-1 text-[9px] rounded-lg bg-emerald-50 text-emerald-700 font-black border border-emerald-200 uppercase">
                {lead.situacao_cadastral}
              </span>
            )}
          </div>
        </div>

        <div className="flex gap-1.5 flex-wrap justify-start xl:justify-end shrink-0">
          <button
            type="button"
            onClick={handleEnviarParaMeuToDo}
            title="Enviar para Meu To Do"
            className="px-3 py-1.5 text-[10px] rounded-lg font-black uppercase tracking-wide bg-violet-600 text-white hover:bg-violet-500 active:scale-95 transition-all shadow-sm"
          >
            MEU TO DO
          </button>

          <button
            type="button"
            onClick={() => abrirRota(lead)}
            title="Abrir rota"
            className="px-3 py-1.5 text-[10px] rounded-lg font-black uppercase tracking-wide bg-emerald-600 text-white hover:bg-emerald-500 active:scale-95 transition-all shadow-sm"
          >
            ROTA
          </button>

          {actions.map((action) => (
            <button
              key={action.key}
              type="button"
              onClick={action.onClick}
              title={action.label}
              className={`px-3 py-1.5 text-[10px] rounded-lg font-black uppercase tracking-wide transition-all active:scale-95 shadow-sm ${action.className}`}
            >
              {action.shortLabel || action.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
