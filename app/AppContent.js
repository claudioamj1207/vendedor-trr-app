"use client";
import React, { useState, useEffect, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';

const supabase = createClient("https://qswmodzcsdkjmdzgxtlo.supabase.co", "sb_publishable_lWTV-2xQxwJlIAEn-zj_vg_z75OgB4k");

export default function VendedorTRR_Master() {
  const [leads, setLeads] = useState([]);
  const [aba, setAba] = useState('estoque'); 
  const [moduloAtivo, setModuloAtivo] = useState('todo'); 
  const [buscaGlobal, setBuscaGlobal] = useState('');
  const [cnpjBusca, setCnpjBusca] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [statusProcesso, setStatusProcesso] = useState('');
  const [mostrarFiltros, setMostrarFiltros] = useState(false);
  const [totalAbsoluto, setTotalAbsoluto] = useState(0);

  // RESTAURADO: FILTROS COM AMPLITUDE TOTAL
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
      
      // 1. CONTAGEM REAL: Conta todos os CNPJs da tabela, independente do status
      const { count: totalBanco } = await supabase
        .from('empresas_mestre')
        .select('*', { count: 'exact', head: true });
      setTotalAbsoluto(totalBanco || 0);

      // 2. BUSCA EM LOTES: Traz os leads da aba atual (Estoque ou Triagem)
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
      console.error("Erro:", e);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => { sincronizar(); }, [aba, moduloAtivo]);

  const leadsFiltrados = useMemo(() => {
    return leads.filter(lead => {
      const matchRazao = filtrosAtivos.razao_social === 'Todos' || lead.razao_social === filtrosAtivos.razao_social;
      const matchFantasia = filtrosAtivos.nome_fantasia === 'Todos' || lead.nome_fantasia === filtrosAtivos.nome_fantasia;
      const matchCNPJ = filtrosAtivos.cnpj === 'Todos' || lead.cnpj === filtrosAtivos.cnpj;
      const matchBairro = filtrosAtivos.bairro === 'Todos' || lead.bairro === filtrosAtivos.bairro;
      const matchFonte = filtrosAtivos.fonte_lead === 'Todos' || lead.fonte_lead === filtrosAtivos.fonte_lead;
      const matchCnaeP = filtrosAtivos.cnae_principal_descricao === 'Todos' || lead.cnae_principal_descricao === filtrosAtivos.cnae_principal_descricao;
      const matchCnaeS = filtrosAtivos.cnae_secundario === 'Todos' || (lead.cnae_secundario && lead.cnae_secundario.includes(filtrosAtivos.cnae_secundario));
      
      const texto = buscaGlobal.toLowerCase();
      const matchBusca = !buscaGlobal || Object.values(lead).some(val => String(val).toLowerCase().includes(texto));

      return matchRazao && matchFantasia && matchCNPJ && matchBairro && matchFonte && matchCnaeP && matchCnaeS && matchBusca;
    });
  }, [leads, filtrosAtivos, buscaGlobal]);

  const obterOpcoes = (campo) => {
    const opcoes = [...new Set(leads.map(l => l[campo]).filter(Boolean))].sort();
    return ['Todos', ...opcoes];
  };

  const processarCNPJ = async (cnpj, leadExistente = {}) => {
    const cnpjLimpo = cnpj.replace(/\D/g, '');
    if (cnpjLimpo.length !== 14) return false;
    try {
      const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpjLimpo}`);
      const info = await res.json();
      if (info.cnpj) {
        const descSec = info.cnaes_secundarios ? info.cnaes_secundarios.map(c => c.descricao).join(' | ') : 'Não informado';
        const { error } = await supabase.from('empresas_mestre').upsert({
          ...leadExistente,
          cnpj: cnpjLimpo,
          razao_social: info.razao_social,
          nome_fantasia: info.nome_fantasia || info.razao_social,
          logradouro: info.logradouro,
          numero: info.numero,
          bairro: info.bairro,
          municipio: info.municipio,
          uf: info.uf,
          cnae_principal_codigo: String(info.cnae_fiscal),
          cnae_principal_descricao: info.cnae_fiscal_descricao || 'Não informado',
          cnae_secundario: descSec,
          situacao_cadastral: info.descricao_situacao_cadastral || 'ATIVA',
          status_lead: leadExistente.status_lead || 'Novo'
        });
        return { ok: !error, situacao: info.descricao_situacao_cadastral };
      }
    } catch (err) { return false; }
  };

  const limparInativos = async () => {
    if (!confirm(`Limpar inativos dos ${leadsFiltrados.length} leads atuais?`)) return;
    let excluidos = 0;
    for (const lead of leadsFiltrados) {
      setStatusProcesso(`Verificando: ${lead.razao_social}`);
      const resultado = await processarCNPJ(lead.cnpj, lead);
      if (resultado.ok && resultado.situacao !== 'ATIVA') {
        await supabase.from('empresas_mestre').delete().eq('cnpj', lead.cnpj);
        excluidos++;
      }
      await new Promise(r => setTimeout(r, 450));
    }
    setStatusProcesso(''); sincronizar();
  };

  const atualizarFaltantes = async () => {
    const { data: faltantes } = await supabase.from('empresas_mestre').select('*').or('cnae_principal_descricao.is.null,cnae_secundario.is.null,cnae_principal_descricao.eq.""');
    if (!faltantes || faltantes.length === 0) return alert("Dados completos!");
    if (!confirm(`Atualizar ${faltantes.length} leads?`)) return;
    let sucesso = 0;
    for (const lead of faltantes) {
      sucesso++;
      setStatusProcesso(`${sucesso}/${faltantes.length}`);
      await processarCNPJ(lead.cnpj, lead);
      await new Promise(r => setTimeout(r, 450));
    }
    setStatusProcesso(''); sincronizar();
  };

  const extrairEPesquisar = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      let textoBruto = file.name.endsWith('.xlsx') ? JSON.stringify(XLSX.utils.sheet_to_json(XLSX.read(evt.target.result, { type: 'binary' }).Sheets[XLSX.read(evt.target.result, { type: 'binary' }).SheetNames[0]])) : evt.target.result;
      const cnpjs = [...new Set(textoBruto.match(/\d{14}/g) || textoBruto.match(/\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/g) || [])];
      for (const c of cnpjs) { await processarCNPJ(c, {fonte_lead: `Arquivo: ${file.name}`}); }
      sincronizar();
    };
    file.name.endsWith('.xlsx') ? reader.readAsBinaryString(file) : reader.readAsText(file);
  };

  return (
    <div className="min-h-screen bg-black text-white pb-40 font-sans antialiased">
      <header className="px-5 pt-8 pb-4 sticky top-0 bg-black/95 border-b border-white/5 z-50">
        <div className="flex justify-between items-center mb-2 text-white">
          <h1 className="text-[10px] font-black text-blue-500 uppercase italic tracking-widest">Vendedor TRR</h1>
          <div className="flex gap-3 text-[9px] font-bold uppercase">
             {['todo', 'arquivo', 'cnpj'].map(m => (
               <button key={m} onClick={() => setModuloAtivo(m)} className={moduloAtivo === m ? 'text-white border-b border-blue-500' : 'text-zinc-600'}>
                 {m === 'todo' ? 'LISTA' : m === 'arquivo' ? 'ARQUIVO' : 'BUSCA CNPJ'}
               </button>
             ))}
          </div>
        </div>
        
        <div className="flex justify-between items-center">
          <h2 className="text-3xl font-black italic uppercase tracking-tighter text-white">
            {moduloAtivo === 'todo' ? (aba === 'triagem' ? 'Triagem' : 'Estoque') : 'Módulo Busca'}
          </h2>
          <div className="flex gap-2 text-white">
            {moduloAtivo === 'todo' && (
              <>
                <button onClick={limparInativos} className="text-[9px] bg-red-600 px-4 py-2 rounded-full font-bold">🗑️ LIMPAR</button>
                <button onClick={atualizarFaltantes} className="text-[9px] bg-emerald-600 px-4 py-2 rounded-full font-bold">🔄 ENRIQUECER</button>
              </>
            )}
            <button onClick={() => setMostrarFiltros(!mostrarFiltros)} className="text-[9px] bg-zinc-800 px-4 py-2 rounded-full font-bold border border-white/10">FILTROS</button>
          </div>
        </div>

        {moduloAtivo === 'todo' && (
          <div className="mt-4 space-y-3">
            <input type="text" placeholder="Busca rápida..." className="w-full bg-zinc-900 p-3 rounded-xl text-xs outline-none border border-zinc-800 text-white" value={buscaGlobal} onChange={(e) => setBuscaGlobal(e.target.value)} />
            {mostrarFiltros && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 p-4 bg-zinc-900 rounded-2xl border border-white/5">
                {[
                  { label: 'Razão Social', campo: 'razao_social' }, { label: 'Nome Fantasia', campo: 'nome_fantasia' },
                  { label: 'CNPJ', campo: 'cnpj' }, { label: 'Bairro', campo: 'bairro' },
                  { label: 'Fonte', campo: 'fonte_lead' }, { label: 'CNAE Principal', campo: 'cnae_principal_descricao' }
                ].map(filtro => (
                  <div key={filtro.campo} className="flex flex-col gap-1">
                    <label className="text-[9px] font-black text-zinc-500 uppercase ml-1">{filtro.label}</label>
                    <select value={filtrosAtivos[filtro.campo]} onChange={(e) => setFiltrosAtivos({...filtrosAtivos, [filtro.campo]: e.target.value})} className="bg-zinc-800 text-[11px] p-2.5 rounded-lg text-white outline-none">
                      {obterOpcoes(filtro.campo).map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                  </div>
                ))}
                <button onClick={() => setFiltrosAtivos({razao_social:'Todos', nome_fantasia:'Todos', cnpj:'Todos', bairro:'Todos', fonte_lead:'Todos', cnae_principal_descricao:'Todos', cnae_secundario:'Todos'})} className="lg:col-span-3 text-[9px] font-bold text-red-500 uppercase py-2 bg-red-500/10 rounded-lg">Limpar Filtros</button>
              </div>
            )}
            <div className="flex justify-between items-center px-1">
              <p className="text-[10px] text-zinc-400 font-black uppercase tracking-widest">
                {leadsFiltrados.length} Filtrados de {totalAbsoluto} CNPJs no Banco
              </p>
              {statusProcesso && <p className="text-[9px] text-blue-500 animate-pulse font-black uppercase italic">{statusProcesso}</p>}
            </div>
          </div>
        )}
      </header>

      <main className="px-4 mt-6">
        {moduloAtivo === 'todo' && (
          <div className="bg-zinc-900/30 border border-white/5 rounded-2xl divide-y divide-zinc-800/50">
            {carregando ? <div className="text-center py-20 text-[10px] animate-pulse text-zinc-600 font-black uppercase">Sincronizando...</div> :
            leadsFiltrados.map(lead => (
              <div key={lead.cnpj} className="py
