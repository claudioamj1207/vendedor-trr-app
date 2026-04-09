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
      if (resultado && resultado.ok && resultado.situacao !== 'ATIVA') {
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
      const cnpjs = [...new Set(textoBruto.match(/\d{14}/g) || [])];
      for (const c of cnpjs) { await processarCNPJ(c, {fonte_lead: `Arquivo: ${file.name}`}); }
      sincronizar();
    };
    file.name.endsWith('.xlsx') ? reader.readAsBinaryString(file) : reader.readAsText(file);
  };

  return (
    <div className="min-h-screen bg-black text-white pb-40 font-sans antialiased">
      <header className="px-5 pt-8 pb-4 sticky top-0 bg-black/95 border-b border-white/5 z-50">
        <div className="flex justify-between items-center mb-2">
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
          <h2 className="text-3xl font-black italic uppercase tracking-tighter">
            {moduloAtivo === 'todo' ? (aba === 'triagem' ? 'Triagem' : 'Estoque') : 'Módulo Busca'}
          </h2>
          <div className="flex gap-2">
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

      <main className="px-4 mt-6 text-white">
        {moduloAtivo === 'todo' && (
          <div className="bg-zinc-900/30 border border-white/5 rounded-2xl divide-y divide-zinc-800/50 text-white">
            {carregando ? <div className="text-center py-20 text-[10px] animate-pulse text-zinc-600 font-black uppercase tracking-widest">Sincronizando...</div> :
            leadsFiltrados.map(lead => (
              <div key={lead.cnpj} className="py-4 px-4 flex justify-between items-center gap-3 hover:bg-zinc-800/40 transition-colors">
                <div className="flex-1 min-w-0">
                  <h3 className="text-[12px] font-bold uppercase truncate text-white leading-tight">{lead.razao_social}</h3>
                  <div className="flex gap-2 mt-2 flex-wrap">
                    <span className="text-[8px] bg-zinc-800 px-2 py-0.5 rounded text-zinc-400 font-bold border border-white/5 uppercase">{lead.bairro}</span>
                    <span className="text-[8px] bg-blue-900/20 px-2 py-0.5 rounded text-blue-400 font-bold border border-blue-500/10 uppercase">{lead.cnpj}</span>
                    <span className="text-[8px] bg-orange-900/20 px-2 py-0.5 rounded text-orange-400 font-bold border border-orange-500/10 truncate max-w-[200px]">{lead.cnae_principal_descricao || 'SEM CNAE'}</span>
                    {lead.cnae_secundario && <span className="text-[8px] bg-zinc-900/50 px-2 py-0.5 rounded text-zinc-500 font-medium truncate max-w-[200px] italic">Sec: {lead.cnae_secundario}</span>}
                  </div>
                </div>
                <button onClick={async () => { await supabase.from('empresas_mestre').update({status_lead: aba === 'estoque' ? 'Triagem' : 'Em Prospecção'}).eq('cnpj', lead.cnpj); sincronizar(); }} className="h-10 w-10 bg-blue-600 rounded-xl flex items-center justify-center text-white active:scale-95 transition-all">➡️</button>
              </div>
            ))}
          </div>
        )}
        {moduloAtivo === 'arquivo' && <div className="bg-zinc-900 p-12 rounded-3xl border border-dashed border-zinc-800 text-center max-w-2xl mx-auto"><input type="file" onChange={extrairEPesquisar} className="text-xs mb-4 w-full text-zinc-400" /></div>}
        {moduloAtivo === 'cnpj' && <div className="max-w-2xl mx-auto space-y-4 text-white"><textarea placeholder="Cole CNPJs..." className="w-full bg-zinc-900 p-4 rounded-2xl text-sm h-40 outline-none border border-zinc-800 text-white" value={cnpjBusca} onChange={(e) => setCnpjBusca(e.target.value)} /><button onClick={async () => { const lista = cnpjBusca.match(/\d{14}/g) || []; for (const c of lista) { await processarCNPJ(c, {fonte_lead: "Busca Manual"}); } setCnpjBusca(''); sincronizar(); }} className="w-full bg-blue-600 py-4 rounded-2xl font-black uppercase text-sm text-white">PESQUISAR E SALVAR</button></div>}
      </main>
      <nav className="fixed bottom-6 left-6 right-6 h-16 bg-zinc-900/90 backdrop-blur-md border border-white/10 rounded-full px-8 flex justify-around items-center z-50 shadow-2xl">
        {['estoque', 'triagem'].map(a => <button key={a} onClick={() => setAba(a)} className={`text-[11px] font-black uppercase tracking-widest ${aba === a ? 'text-blue-500' : 'text-zinc-600'}`}>{a}</button>)}
      </nav>
    </div>
  );
}
