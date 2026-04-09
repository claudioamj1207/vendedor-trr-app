"use client";
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import * as XLSX from 'xlsx';

export default function VendedorTRR_Master() {

  const [leads, setLeads] = useState([]);
  const [aba, setAba] = useState('estoque'); 
  const [moduloAtivo, setModuloAtivo] = useState('todo'); 
  const [buscaGlobal, setBuscaGlobal] = useState('');
  const [cnpjBusca, setCnpjBusca] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [statusProcesso, setStatusProcesso] = useState('');
  const [resultadoBusca, setResultadoBusca] = useState('');
  const [erroBusca, setErroBusca] = useState('');
  const [mostrarFiltros, setMostrarFiltros] = useState(false);
  const [totalAbsoluto, setTotalAbsoluto] = useState(0);

  const sincronizar = async () => {
    const { data } = await supabase.from('empresas_mestre').select('*');
    setLeads(data || []);
    setCarregando(false);
  };

  useEffect(() => { sincronizar(); }, []);

  const processarCNPJ = async (cnpj) => {
    const cnpjLimpo = cnpj.replace(/\D/g, '');
    if (cnpjLimpo.length !== 14) return;

    const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpjLimpo}`);
    const info = await res.json();

    if (info.cnpj) {
      await supabase.from('empresas_mestre').upsert({
        cnpj: cnpjLimpo,
        razao_social: info.razao_social,
        nome_fantasia: info.nome_fantasia || info.razao_social,
        bairro: info.bairro,
        municipio: info.municipio,
        uf: info.uf,
        cnae_principal_descricao: info.cnae_fiscal_descricao
      }, { onConflict: 'cnpj' });
    }

    sincronizar();
  };

  return (
    <div className="min-h-screen bg-black text-white p-4">
      <h1 className="text-xl font-bold mb-4">Vendedor TRR</h1>

      <textarea
        className="w-full bg-zinc-900 p-3 rounded mb-3"
        placeholder="Cole CNPJs aqui..."
        value={cnpjBusca}
        onChange={(e) => setCnpjBusca(e.target.value)}
      />

      <button
        className="bg-blue-600 px-4 py-2 rounded"
        onClick={() => {
          const regex = /\d{14}/g;
          const cnpjs = cnpjBusca.match(regex) || [];
          cnpjs.forEach(c => processarCNPJ(c));
        }}
      >
        Buscar CNPJs
      </button>

      <div className="mt-6">
        {carregando ? "Carregando..." : leads.map(l => (
          <div key={l.cnpj} className="border-b border-zinc-800 py-2">
            {l.razao_social}
          </div>
        ))}
      </div>
    </div>
  );
}
