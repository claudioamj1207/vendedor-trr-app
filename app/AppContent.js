// VERSÃO COM BACKUP XLSX (ESTÁVEL)
// Cole este arquivo inteiro no seu AppContent.js

"use client";
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { consultarCNPJNaBrasilAPI } from '../lib/brasilApi';
import * as XLSX from 'xlsx';

// ================= CONFIG =================

const ITENS_POR_PAGINA = 50;

// ================= HELPERS =================

const normalizarCNPJ = (cnpj) => String(cnpj || '').replace(/\D/g, '');

const formatarCNPJ = (cnpj) => {
  const limpo = normalizarCNPJ(cnpj);
  if (limpo.length !== 14) return cnpj;
  return limpo.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
};

// ================= COMPONENT =================

export default function VendedorTRR_Master() {
  const [leads, setLeads] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [exportando, setExportando] = useState(false);

  // ================= BACKUP =================

  const buscarTodos = useCallback(async () => {
    let todos = [];
    let de = 0;
    let ate = 999;
    let continua = true;

    while (continua) {
      const { data, error } = await supabase
        .from('empresas_mestre')
        .select('*')
        .range(de, ate);

      if (error) throw error;

      todos = [...todos, ...(data || [])];

      if (!data || data.length < 1000) {
        continua = false;
      } else {
        de += 1000;
        ate += 1000;
      }
    }

    return todos;
  }, []);

  const exportarBackup = useCallback(async () => {
    try {
      setExportando(true);

      const dados = await buscarTodos();

      const planilha = dados.map((l) => ({
        'Razão Social': l.razao_social,
        'Nome Fantasia': l.nome_fantasia,
        'CNPJ': formatarCNPJ(l.cnpj),
        'Bairro': l.bairro,
        'Cidade': l.municipio,
        'UF': l.uf,
        'CNAE': l.cnae_principal_descricao,
        'Status': l.status_lead
      }));

      const ws = XLSX.utils.json_to_sheet(planilha);
      const wb = XLSX.utils.book_new();

      XLSX.utils.book_append_sheet(wb, ws, 'Backup');
      XLSX.writeFile(wb, 'backup.xlsx');

      alert(`Backup gerado: ${dados.length} registros`);
    } catch (e) {
      alert('Erro no backup: ' + e.message);
    } finally {
      setExportando(false);
    }
  }, [buscarTodos]);

  // ================= LOAD =================

  useEffect(() => {
    const carregar = async () => {
      const { data } = await supabase
        .from('empresas_mestre')
        .select('*')
        .limit(50);

      setLeads(data || []);
      setCarregando(false);
    };

    carregar();
  }, []);

  // ================= UI =================

  return (
    <div className="p-6 bg-black text-white min-h-screen">
      <h1 className="text-xl font-bold mb-4">Vendedor TRR</h1>

      <button
        onClick={exportarBackup}
        disabled={exportando}
        className="bg-blue-600 px-4 py-2 rounded"
      >
        {exportando ? 'Gerando...' : 'BACKUP XLSX'}
      </button>

      <div className="mt-6">
        {carregando ? (
          <p>Carregando...</p>
        ) : (
          leads.map((l) => (
            <div key={l.cnpj} className="border-b border-zinc-800 py-2">
              {l.razao_social}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
