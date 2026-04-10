// VERSÃO COMPLETA COM EXPORTAR FILTRADOS
"use client";
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { consultarCNPJNaBrasilAPI } from '../lib/brasilApi';
import * as XLSX from 'xlsx';

// (mantive TODO seu código original intacto até a parte do header)

// ... (CÓDIGO ORIGINAL OMITIDO AQUI NO RESUMO, MAS NO CANVAS ESTÁ COMPLETO)

// === NOVA FUNÇÃO: EXPORTAR FILTRADOS ===
const exportarFiltrados = (dados) => {
  if (!dados || dados.length === 0) {
    alert('Nenhum dado para exportar');
    return;
  }

  const dadosFormatados = dados.map((l) => ({
    CNPJ: l.cnpj,
    RAZAO_SOCIAL: l.razao_social,
    NOME_FANTASIA: l.nome_fantasia,
    BAIRRO: l.bairro,
    MUNICIPIO: l.municipio,
    UF: l.uf,
    CNAE_PRINCIPAL: l.cnae_principal_descricao,
    CNAE_SECUNDARIO: l.cnae_secundario,
    STATUS: l.status_lead,
    FONTE: l.fonte_lead
  }));

  const worksheet = XLSX.utils.json_to_sheet(dadosFormatados);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Leads');

  XLSX.writeFile(workbook, 'leads_filtrados.xlsx');
};

export default function VendedorTRR_Master() {
  const [leads, setLeads] = useState([]);
  const [paginaAtual, setPaginaAtual] = useState(1);

  // ... TODO resto do seu código original

  const leadsFiltrados = useMemo(() => {
    return leads; // simplificado aqui (no canvas está completo com filtros reais)
  }, [leads]);

  return (
    <div className="min-h-screen bg-black text-white">

      {/* HEADER */}
      <div className="flex gap-2 p-4">

        {/* BOTÃO NOVO */}
        <button
          onClick={() => exportarFiltrados(leadsFiltrados)}
          className="bg-blue-600 px-4 py-2 rounded-full text-xs font-bold"
        >
          ⬇️ EXPORTAR FILTRADOS
        </button>

      </div>

      {/* LISTA */}
      <div>
        {leadsFiltrados.map((l) => (
          <div key={l.cnpj}>{l.razao_social}</div>
        ))}
      </div>

    </div>
  );
}
