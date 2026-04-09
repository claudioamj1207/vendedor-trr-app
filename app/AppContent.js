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

  // Estados dos Filtros Dinâmicos (Estilo Excel)
  const [filtrosAtivos, setFiltrosAtivos] = useState({
    bairro: 'Todos',
    fonte_lead: 'Todos',
    cnae_principal: 'Todos',
    municipio: 'Todos',
    data_captacao: 'Todos'
  });

  const sincronizar = async () => {
    try {
      setCarregando(true);
      const { data } = await supabase
        .from('empresas_mestre')
        .select('*')
        .eq('status_lead', aba === 'estoque' ? 'Novo' : 'Triagem')
        .order('razao_social', { ascending: true });
      setLeads(data || []);
    } finally { setCarregando(false); }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { sincronizar(); }, [aba, moduloAtivo]);

  // Lógica de Filtro Multivariável Estilo Excel
  const leadsFiltrados = useMemo(() => {
    return leads.filter(lead => {
      const matchBairro = filtrosAtivos.bairro === 'Todos' || lead.bairro === filtrosAtivos.bairro;
      const matchFonte = filtrosAtivos.fonte_lead === 'Todos' || lead.fonte_lead === filtrosAtivos.fonte_lead;
      const matchCnae = filtrosAtivos.cnae_principal === 'Todos' || lead.cnae_principal === filtrosAtivos.cnae_principal;
      const matchMuni = filtrosAtivos.municipio === 'Todos' || lead.municipio === filtrosAtivos.municipio;
      
      let matchData = true;
      if (filtrosAtivos.data_captacao === 'Hoje') {
        matchData = lead.data_captacao?.startsWith(new Date().toISOString().split('T')[0]);
      }

      const texto = buscaGlobal.toLowerCase();
      const matchBusca = !buscaGlobal || 
        Object.values(lead).some(val => String(val).toLowerCase().includes(texto));

      return matchBairro && matchFonte && matchCnae && matchMuni && matchData && matchBusca;
    });
  }, [leads, filtrosAtivos, buscaGlobal]);

  // Gerador de Opções Únicas para os Filtros (O que aparece no "dropdown" do Excel)
  const obterOpcoes = (campo) => {
    const opcoes = [...new Set(leads.map(l => l[campo]).filter(Boolean))].sort();
    return ['Todos', ...opcoes];
  };

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
    setResultadoBusca(''); setStatusProcesso('Lendo arquivo...');
    const reader = new FileReader();
    reader.onload = async (evt) => {
      let textoBruto = "";
      if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        const wb = XLSX.read(evt.target.result, { type: 'binary' });
        textoBruto = JSON.stringify(XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]));
      } else { textoBruto = evt.target.result; }
      const cnpjs = textoBruto.match(/\d{14}/g) || textoBruto.match(/\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/g) || [];
      const unicos = [...new Set(cnpjs)];
      for (const c of unicos) { await processarCNPJ(c, `Arquivo: ${file.name}`); }
      setResultadoBusca(`Sucesso: ${unicos.length} CNPJs de ${file.name}`);
      setStatusProcesso(''); sincronizar();
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
        
        <div className="flex justify-between items-center">
          <h2 className="text-3xl font-black italic uppercase tracking-tighter">
            {moduloAtivo === 'todo' ? (aba === 'triagem' ? 'Triagem' : 'Estoque') : 'Busca'}
          </h2>
          {moduloAtivo === 'todo' && (
            <button onClick={() => setMostrarFiltros(!mostrarFiltros)} className="text-[10px] bg-blue-600/20 text-blue-400 px-4 py-2 rounded-full font-bold border border-blue-500/30 active:scale-95 transition-all">
              {mostrarFiltros ? 'OCULTAR FILTROS' : 'FILTROS ESTILO EXCEL'}
            </button>
          )}
        </div>

        {moduloAtivo === 'todo' && (
          <div className="mt-4 space-y-3">
            <input 
              type="text" 
              placeholder="Pesquisa rápida..." 
              className="w-full bg-zinc-900 p-3 rounded-xl text-xs outline-none border border-zinc-800 focus:border-blue-500 transition-colors"
              value={buscaGlobal}
              onChange={(e) => setBuscaGlobal(e.target.value)}
            />
            
            {mostrarFiltros && (
              <div className="grid grid-cols-1 gap-2 p-3 bg-zinc-900/50 rounded-2xl border border-white/5 animate-in slide-in-from-top-4 duration-300">
                {[
                  { label: 'Bairro', campo: 'bairro' },
                  { label: 'Fonte', campo: 'fonte_lead' },
                  { label: 'CNAE', campo: 'cnae_principal' },
                  { label: 'Cidade', campo: 'municipio' }
                ].map(filtro => (
                  <div key={filtro.campo} className="flex flex-col gap-1">
                    <label className="text-[9px] font-black text-zinc-500 uppercase ml-1">{filtro.label}</label>
                    <select 
                      value={filtrosAtivos[filtro.campo]}
                      onChange={(e) => setFiltrosAtivos({...filtrosAtivos, [filtro.campo]: e.target.value})}
                      className="bg-zinc-800 text-[11px] p-2.5 rounded-lg outline-none border border-white/5 appearance-none"
                    >
                      {obterOpcoes(filtro.campo).map(opt => (
                        <option key={opt} value={opt}>{opt === 'Todos' ? `Todos (${filtro.label}s)` : opt}</option>
                      ))}
                    </select>
                  </div>
                ))}
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] font-black text-zinc-500 uppercase ml-1">Data</label>
                  <select 
                    onChange={(e) => setFiltrosAtivos({...filtrosAtivos, data_captacao: e.target.value})}
                    className="bg-zinc-800 text-[11px] p-2.5 rounded-lg border border-white/5"
                  >
                    <option value="Todos">Todo o período</option>
                    <option value="Hoje">Captados Hoje</option>
                  </select>
                </div>
                <button 
                  onClick={() => setFiltrosAtivos({bairro:'Todos', fonte_lead:'Todos', cnae_principal:'Todos', municipio:'Todos', data_captacao:'Todos'})}
                  className="mt-2 text-[9px] font-bold text-red-500 uppercase py-2 bg-red-500/10 rounded-lg"
                >
                  Limpar todos os filtros
                </button>
              </div>
            )}
            <div className="flex justify-between px-1">
               <p className="text-[9px] text-zinc-500 font-bold uppercase">{leadsFiltrados.length} leads selecionados</p>
            </div>
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
            <textarea placeholder="Cole CNPJs aqui..." className="w-full bg-zinc-900 p-4 rounded-2xl text-sm h-32 outline-none border border-zinc-800 focus:border-blue-500 text-white" value={cnpjBusca} onChange={(e) => setCnpjBusca(e.target.value)} />
            <button 
              onClick={async () => {
                const lista = cnpjBusca.match(/\d{14}/g) || [];
                for (const c of lista) { await processarCNPJ(c, "Busca Manual"); }
                setCnpjBusca(''); sincronizar();
              }} 
              className="w-full bg-blue-600 py-4 rounded-2xl font-black uppercase text-sm"
            >
              Pesquisar e Salvar
            </button>
          </div>
        )}

        {moduloAtivo === 'todo' && (
          <div className="bg-zinc-900/30 border border-white/5 rounded-2xl divide-y divide-zinc-800/50 overflow-hidden">
            {carregando ? <div className="text-center py-20 text-[10px] animate-pulse tracking-[0.3em]">RECALCULANDO...</div> :
            leadsFiltrados.map(lead => (
              <div key={lead.cnpj} className="py-4 px-4 flex justify-between items-center gap-3 hover:bg-zinc-800/50 transition-colors">
                <div className="flex-1 min-w-0">
                  <h3 className="text-[12px] font-bold uppercase truncate text-white leading-tight">{lead.razao_social}</h3>
                  <p className="text-[9px] text-zinc-500 uppercase truncate mt-0.5 font-medium">{lead.nome_fantasia || '---'}</p>
                  <div className="flex gap-1.5 mt-2.5 flex-wrap">
                    <span className="text-[8px] bg-zinc-800 px-2 py-0.5 rounded text-zinc-400 font-bold uppercase">{lead.bairro}</span>
                    <span className="text-[8px] bg-blue-900/30 px-2 py-0.5 rounded text-blue-400 font-bold uppercase">{lead.cnpj}</span>
                    <span className="text-[8px] bg-orange-900/20 px-2 py-0.5 rounded text-orange-400 font-bold">CNAE: {lead.cnae_principal}</span>
                  </div>
                </div>
                <div className="shrink-0">
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
            {!carregando && leadsFiltrados.length === 0 && (
               <div className="py-20 text-center text-[10px] text-zinc-600 font-bold uppercase tracking-widest">Nenhum lead encontrado com estes filtros</div>
            )}
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
