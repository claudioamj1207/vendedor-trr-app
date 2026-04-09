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
  const [resultadoBusca, setResultadoBusca] = useState('');
  const [mostrarFiltros, setMostrarFiltros] = useState(false);

  // Estados dos Filtros Específicos
  const [filtroBairro, setFiltroBairro] = useState('Todos');
  const [filtroFonte, setFiltroFonte] = useState('Todos');
  const [filtroData, setFiltroData] = useState('Todos');

  const sincronizar = async () => {
    try {
      setCarregando(true);
      // Puxamos mais campos para permitir o filtro total
      let query = supabase.from('empresas_mestre').select('*');
      
      if (moduloAtivo === 'todo') {
        if (aba === 'estoque') query = query.eq('status_lead', 'Novo');
        if (aba === 'triagem') query = query.eq('status_lead', 'Triagem');
      } else if (moduloAtivo === 'cnpj' && cnpjBusca) {
        query = query.eq('cnpj', cnpjBusca.replace(/\D/g, ''));
      }
      
      const { data } = await query.order('razao_social', { ascending: true });
      setLeads(data || []);
    } finally { setCarregando(false); }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { sincronizar(); }, [aba, moduloAtivo]);

  // Lógica de Filtro em cascata (Amplitude Total)
  const leadsFiltrados = useMemo(() => {
    return leads.filter(lead => {
      const matchBairro = filtroBairro === 'Todos' || lead.bairro === filtroBairro;
      const matchFonte = filtroFonte === 'Todos' || lead.fonte_lead === filtroFonte;
      
      // Filtro de Data simplificado
      let matchData = true;
      if (filtroData === 'Hoje') {
        matchData = lead.data_captacao?.startsWith(new Date().toISOString().split('T')[0]);
      }

      // Busca Global em todos os campos
      const textoBusca = buscaGlobal.toLowerCase();
      const matchBusca = !buscaGlobal || 
        lead.razao_social?.toLowerCase().includes(textoBusca) ||
        lead.nome_fantasia?.toLowerCase().includes(textoBusca) ||
        lead.cnpj?.includes(textoBusca) ||
        lead.bairro?.toLowerCase().includes(textoBusca) ||
        lead.cnae_principal?.toLowerCase().includes(textoBusca) ||
        lead.logradouro?.toLowerCase().includes(textoBusca);

      return matchBairro && matchFonte && matchData && matchBusca;
    });
  }, [leads, filtroBairro, filtroFonte, filtroData, buscaGlobal]);

  // Listas dinâmicas para os seletores de filtro
  const bairrosUnicos = ['Todos', ...new Set(leads.map(l => l.bairro).filter(Boolean))].sort();
  const fontesUnicas = ['Todos', ...new Set(leads.map(l => l.fonte_lead).filter(Boolean))].sort();

  const processarCNPJ = async (cnpj, fonteInfo) => {
    const cnpjLimpo = cnpj.replace(/\D/g, '');
    if (cnpjLimpo.length !== 14) return;
    try {
      setStatusProcesso(`Consultando: ${cnpjLimpo}...`);
      const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpjLimpo}`);
      const info = await res.json();
      if (info.cnpj) {
        await supabase.from('empresas_mestre').upsert({
          cnpj: cnpjLimpo,
          razao_social: info.razao_social,
          nome_fantasia: info.nome_fantasia,
          logradouro: info.logradouro,
          numero: info.numero,
          complemento: info.complemento,
          bairro: info.bairro,
          cep: info.cep,
          municipio: info.municipio,
          uf: info.uf,
          email: info.email,
          telefone: info.ddd_telefone_1,
          cnae_principal: info.cnae_fiscal,
          status_lead: 'Novo',
          fonte_lead: fonteInfo,
          data_captacao: new Date().toISOString()
        });
      }
    } catch (err) { console.error(err); }
  };

  const extrairEPesquisar = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setResultadoBusca('');
    setStatusProcesso('Lendo arquivo...');
    const reader = new FileReader();
    reader.onload = async (evt) => {
      let textoBruto = "";
      if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        const wb = XLSX.read(evt.target.result, { type: 'binary' });
        textoBruto = JSON.stringify(XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]));
      } else { textoBruto = evt.target.result; }
      const cnpjsEncontrados = textoBruto.match(/\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/g) || textoBruto.match(/\d{14}/g) || [];
      const cnpjsUnicos = [...new Set(cnpjsEncontrados)];
      for (const cnpj of cnpjsUnicos) { await processarCNPJ(cnpj, `Arquivo: ${file.name}`); }
      setResultadoBusca(`Processados ${cnpjsUnicos.length} CNPJs de ${file.name}`);
      setStatusProcesso('');
      sincronizar();
    };
    file.name.endsWith('.xlsx') ? reader.readAsBinaryString(file) : reader.readAsText(file);
  };

  return (
    <div className="min-h-screen bg-black text-white pb-40 font-sans antialiased">
      <header className="px-5 pt-8 pb-4 sticky top-0 bg-black/95 border-b border-white/5 z-50">
        <div className="flex justify-between items-center mb-2">
          <h1 className="text-[10px] font-black text-blue-500 uppercase italic tracking-widest">TRR Intelligence</h1>
          <div className="flex gap-3">
            {['todo', 'arquivo', 'cnpj'].map(m => (
              <button key={m} onClick={() => setModuloAtivo(m)} className={`text-[9px] font-bold uppercase ${moduloAtivo === m ? 'text-white border-b-2 border-blue-500 pb-1' : 'text-zinc-600'}`}>
                {m === 'todo' ? 'FILTRAR' : m}
              </button>
            ))}
          </div>
        </div>
        
        <div className="flex justify-between items-end">
          <h2 className="text-3xl font-black italic uppercase tracking-tighter">
            {moduloAtivo === 'todo' ? (aba === 'triagem' ? 'Triagem' : 'Estoque') : 'Busca'}
          </h2>
          {moduloAtivo === 'todo' && (
            <button onClick={() => setMostrarFiltros(!mostrarFiltros)} className="text-[10px] bg-zinc-800 px-3 py-1 rounded-full font-bold border border-white/10">
              {mostrarFiltros ? 'FECHAR FILTROS' : 'FILTROS AVANÇADOS'}
            </button>
          )}
        </div>

        {moduloAtivo === 'todo' && (
          <div className="mt-4 space-y-3">
            <input 
              type="text" 
              placeholder="Busca total (Nome, CNAE, Bairro, Rua...)" 
              className="w-full bg-zinc-900 p-3 rounded-xl text-xs outline-none border border-zinc-800 focus:border-blue-500 transition-colors"
              value={buscaGlobal}
              onChange={(e) => setBuscaGlobal(e.target.value)}
            />
            
            {mostrarFiltros && (
              <div className="grid grid-cols-2 gap-2 animate-in fade-in slide-in-from-top-2">
                <select onChange={(e) => setFiltroBairro(e.target.value)} className="bg-zinc-800 text-[10px] p-2 rounded-lg outline-none border border-white/5">
                  <option value="Todos">Todos os Bairros</option>
                  {bairrosUnicos.map(b => b !== 'Todos' && <option key={b} value={b}>{b}</option>)}
                </select>
                <select onChange={(e) => setFiltroFonte(e.target.value)} className="bg-zinc-800 text-[10px] p-2 rounded-lg outline-none border border-white/5">
                  <option value="Todos">Todas as Fontes</option>
                  {fontesUnicas.map(f => f !== 'Todos' && <option key={f} value={f}>{f}</option>)}
                </select>
                <select onChange={(e) => setFiltroData(e.target.value)} className="bg-zinc-800 text-[10px] p-2 rounded-lg outline-none border border-white/5 col-span-2">
                  <option value="Todos">Todo o Período</option>
                  <option value="Hoje">Captados Hoje</option>
                </select>
              </div>
            )}
            <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest px-1">
              {leadsFiltrados.length} resultados encontrados
            </p>
          </div>
        )}
      </header>

      <main className="px-4 mt-6">
        {resultadoBusca && (
          <div className="bg-emerald-900/30 border border-emerald-500/50 p-4 rounded-2xl mb-6 flex items-center gap-3">
            <span className="text-2xl">✅</span>
            <p className="text-emerald-400 text-xs font-bold leading-tight">{resultadoBusca}</p>
          </div>
        )}

        {moduloAtivo === 'arquivo' && (
          <div className="bg-zinc-900 p-8 rounded-3xl border border-dashed border-zinc-800 text-center">
            <input type="file" onChange={extrairEPesquisar} className="text-xs mb-4 w-full" />
            {statusProcesso && <p className="mt-4 text-blue-500 text-[10px] animate-pulse font-bold uppercase tracking-widest">{statusProcesso}</p>}
          </div>
        )}

        {moduloAtivo === 'cnpj' && (
          <div className="space-y-4">
            <textarea placeholder="Cole CNPJs aqui..." className="w-full bg-zinc-900 p-4 rounded-2xl text-sm h-32 outline-none border border-zinc-800 focus:border-blue-500 transition-colors" value={cnpjBusca} onChange={(e) => setCnpjBusca(e.target.value)} />
            <button 
              onClick={async () => {
                const lista = cnpjBusca.match(/\d{14}/g) || cnpjBusca.match(/\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/g) || [];
                for (const cnpj of lista) { await processarCNPJ(cnpj, "Busca Manual"); }
                setStatusProcesso(''); setCnpjBusca(''); sincronizar();
              }} 
              className="w-full bg-blue-600 py-4 rounded-2xl font-black uppercase text-sm"
            >
              Pesquisar e Salvar
            </button>
          </div>
        )}

        {moduloAtivo === 'todo' && (
          <div className="bg-zinc-900/30 border border-white/5 rounded-2xl divide-y divide-zinc-800/50">
            {carregando ? <div className="text-center py-20 text-[10px] animate-pulse tracking-[0.3em]">PROCESSANDO BASE...</div> :
            leadsFiltrados.map(lead => (
              <div key={lead.cnpj} className="py-4 px-4 flex justify-between items-center gap-3 hover:bg-zinc-900/50 transition-colors">
                <div className="flex-1 overflow-hidden">
                  <h3 className="text-[12px] font-bold uppercase truncate text-white leading-tight">{lead.razao_social}</h3>
                  <p className="text-[10px] text-zinc-400 uppercase truncate mt-0.5">{lead.nome_fantasia || '---'}</p>
                  <div className="flex gap-2 mt-2 flex-wrap">
                    <span className="text-[8px] bg-zinc-800 px-2 py-0.5 rounded text-zinc-400 font-bold uppercase">{lead.bairro}</span>
                    <span className="text-[8px] bg-blue-900/30 px-2 py-0.5 rounded text-blue-400 font-bold uppercase">{lead.cnpj}</span>
                    <span className="text-[8px] bg-orange-900/20 px-2 py-0.5 rounded text-orange-400 font-bold">CNAE: {lead.cnae_principal}</span>
                  </div>
                </div>
                <div className="shrink-0 flex flex-col gap-2">
                  <button onClick={async () => { 
                    const novoStatus = aba === 'estoque' ? 'Triagem' : 'Em Prospecção';
                    await supabase.from('empresas_mestre').update({status_lead: novoStatus}).eq('cnpj', lead.cnpj); 
                    sincronizar(); 
                  }} className={`h-10 w-12 rounded-xl flex items-center justify-center text-sm active:scale-90 transition-all ${aba === 'estoque' ? 'bg-blue-600 shadow-blue-900/20 shadow-lg' : 'bg-orange-600 shadow-orange-900/20 shadow-lg'}`}>
                    ➡️
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {moduloAtivo === 'todo' && (
        <nav className="fixed bottom-6 left-6 right-6 h-16 bg-zinc-900/90 backdrop-blur-md border border-white/10 rounded-full px-8 flex justify-around items-center z-50 shadow-2xl">
          {['estoque', 'triagem'].map(a => (
            <button key={a} onClick={() => setAba(a)} className={`text-[11px] font-black uppercase tracking-widest transition-colors ${aba === a ? 'text-blue-500' : 'text-zinc-600'}`}>{a}</button>
          ))}
        </nav>
      )}
    </div>
  );
}
