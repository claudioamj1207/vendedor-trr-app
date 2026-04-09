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

  const [filtrosAtivos, setFiltrosAtivos] = useState({
    razao_social: 'Todos',
    nome_fantasia: 'Todos',
    cnpj: 'Todos',
    bairro: 'Todos',
    fonte_lead: 'Todos',
    cnae_principal_descricao: 'Todos',
    cnae_secundario: 'Todos'
  });

  const sincronizar = async () => {
    try {
      setCarregando(true);
      const { count: totalBanco } = await supabase
        .from('empresas_mestre')
        .select('*', { count: 'exact', head: true });
      setTotalAbsoluto(totalBanco || 0);

      let todosLeads = [];
      let de = 0;
      let ate = 999;
      let continua = true;

      while (continua) {
        const { data, error } = await supabase
          .from('empresas_mestre')
          .select('*')
          .eq('status_lead', aba === 'estoque' ? 'Novo' : 'Triagem')
          .order('razao_social', { ascending: true })
          .range(de, ate);

        if (error) throw error;
        todosLeads = [...todosLeads, ...data];
        if (data.length < 1000) continua = false;
        else { de += 1000; ate += 1000; }
      }
      setLeads(todosLeads);
    } catch (e) {
      console.error("Erro na sincronização:", e);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => { sincronizar(); }, [aba, moduloAtivo]);

  const processarCNPJ = async (cnpj, leadExistente = {}) => {
    const cnpjLimpo = cnpj.replace(/\D/g, '');
    if (cnpjLimpo.length !== 14) return { ok: false };

    try {
      const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpjLimpo}`);
      const info = await res.json();

      if (info.cnpj) {
        const { error } = await supabase.from('empresas_mestre').upsert({
          ...leadExistente,
          cnpj: cnpjLimpo,
          razao_social: info.razao_social,
          nome_fantasia: info.nome_fantasia || info.razao_social,
          bairro: info.bairro,
          municipio: info.municipio,
          uf: info.uf,
          cnae_principal_descricao: info.cnae_fiscal_descricao,
          situacao_cadastral: info.descricao_situacao_cadastral || 'ATIVA',
          status_lead: leadExistente.status_lead || 'Novo'
        }, { onConflict: 'cnpj' });

        if (error) return { ok: false };
        return { ok: true };
      }
      return { ok: false };
    } catch {
      return { ok: false };
    }
  };

  return (
    <div className="min-h-screen bg-black text-white p-4">
      <h1 className="text-xl font-bold">Vendedor TRR</h1>
      <p className="text-sm text-zinc-400">Sistema ativo</p>
    </div>
  );
}
