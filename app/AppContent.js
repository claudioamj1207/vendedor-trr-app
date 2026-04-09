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
    <div className="flex h-screen bg-black text-white font-sans antialiased overflow-hidden">
      
      {/* LADO ESQUERDO: PAINEL DE CONTROLE (FIXO) */}
      <aside className="w-80 border-r border-white/5 bg-zinc-900/50 flex flex-col p-6 overflow-y-auto shrink-0">
        <h1 className="text-[10px] font-black text-blue-500 uppercase italic tracking-widest mb-1">TRR Intelligence</h1>
        <h2 className="text-2xl font-black italic uppercase tracking-tighter mb-6 leading-none">Painel de Triagem</h2>

        <nav className="flex flex-col gap-2 mb-8">
          {['todo', 'arquivo', 'cnpj'].map(m => (
            <button 
              key={m} 
              onClick={() => setModuloAtivo(m)} 
              className={`text-left px-4 py-2 rounded-lg text-[10px] font-bold uppercase transition-all ${moduloAtivo === m ? 'bg-blue-600 text-white shadow-lg' : 'text-zinc-500 hover:bg-white/5'}`}
            >
              {m === 'todo' ? '🎯 Filtrar Base' : m === 'arquivo' ? '📂 Subir Arquivo' : '🔍 Pesquisa CNPJ'}
            </button>
          ))}
        </nav>

        {moduloAtivo === 'todo' && (
          <div className="space-y-6">
            <div className="flex flex-col gap-1">
              <label className="text-[9px] font-black text-zinc-500 uppercase ml-1">Busca Direta</label>
              <input 
                type="text" 
                placeholder="Ex: Razão, CNAE, Rua..." 
                className="bg-zinc-800 p-3 rounded-xl text-xs outline-none border border-white/5 focus:border-blue-500 transition-colors"
                value={buscaGlobal}
                onChange={(e) => setBuscaGlobal(e.target.value)}
              />
            </div>

            <div className="space-y-4">
              {[
                { label: 'Bairro', campo: 'bairro' },
                { label: 'Fonte do Lead', campo: 'fonte_lead' },
                { label: 'Atividade (CNAE)', campo: 'cnae_principal' },
                { label: 'Cidade', campo: 'municipio' }
              ].map(filtro => (
                <div key={filtro.campo} className="flex flex-col gap-1">
                  <label className="text-[9px] font-black text-zinc-500 uppercase ml-1">{filtro.label}</label>
                  <select 
                    value={filtrosAtivos[filtro.campo]}
                    onChange={(e) => setFiltrosAtivos({...filtrosAtivos, [filtro.campo]: e.target.value})}
                    className="bg-zinc-800 text-[11px] p-2.5 rounded-lg outline-none border border-white/5 appearance-none focus:border-blue-500/50"
                  >
                    {obterOpcoes(filtro.campo).map(opt => (
                      <option key={opt} value={opt}>{opt === 'Todos' ? `Ver Todos` : opt}</option>
                    ))}
                  </select>
                </div>
              ))}

              <div className="flex flex-col gap-1">
                <label className="text-[9px] font-black text-zinc-500 uppercase ml-1">Data de Captura</label>
                <select 
                  onChange={(e) => setFiltrosAtivos({...filtrosAtivos, data_captacao: e.target.value})}
                  className="bg-zinc-800 text-[11px] p-2.5 rounded-lg border border-white/5"
                >
                  <option value="Todos">Todo o histórico</option>
                  <option value="Hoje">Captados Hoje</option>
                </select>
              </div>
            </div>

            <button 
              onClick={() => {
                setFiltrosAtivos({bairro:'Todos', fonte_lead:'Todos', cnae_principal:'Todos', municipio:'Todos', data_captacao:'Todos'});
                setBuscaGlobal('');
              }}
              className="w-full text-[9px] font-bold text-red-500 uppercase py-3 bg-red-500/10 rounded-xl hover:bg-red-500/20 transition-colors"
            >
              Limpar Todos os Filtros
            </button>
          </div>
        )}
      </aside>

      {/* LADO DIREITO: RESULTADOS (ROLÁVEL) */}
      <main className="flex-1 flex flex-col relative overflow-hidden bg-black">
        
        {/* Cabeçalho da Lista */}
        <header className="px-8 pt-8 pb-4 flex justify-between items-end border-b border-white/5 bg-black/50 backdrop-blur-sm z-10">
          <div>
            <div className="flex gap-4 mb-2">
              <button onClick={() => setAba('estoque')} className={`text-[10px] font-black uppercase tracking-widest ${aba === 'estoque' ? 'text-blue-500 border-b-2 border-blue-500 pb-1' : 'text-zinc-600'}`}>Estoque</button>
              <button onClick={() => setAba('triagem')} className={`text-[10px] font-black uppercase tracking-widest ${aba === 'triagem' ? 'text-orange-500 border-b-2 border-orange-500 pb-1' : 'text-zinc-600'}`}>Triagem</button>
            </div>
            <h3 className="text-xs text-zinc-500 font-bold uppercase tracking-widest">
              {leadsFiltrados.length} Leads Encontrados
            </h3>
          </div>

          {resultadoBusca && (
            <div className="bg-emerald-500/10 text-emerald-400 text-[10px] font-bold px-4 py-2 rounded-full border border-emerald-500/20 animate-pulse">
              ✅ {resultadoBusca}
            </div>
          )}
        </header>

        {/* Área Principal */}
        <div className="flex-1 overflow-y-auto px-8 py-6 custom-scrollbar">
          
          {moduloAtivo === 'arquivo' && (
            <div className="max-w-xl mx-auto mt-20 bg-zinc-900 p-12 rounded-[2.5rem] border border-dashed border-zinc-800 text-center shadow-2xl">
              <input type="file" onChange={extrairEPesquisar} className="text-xs mb-6 w-full text-zinc-400" />
              <p className="text-[10px] text-zinc-500 uppercase font-black tracking-widest italic">Arraste arquivos PDF ou Excel</p>
              {statusProcesso && <p className="mt-6 text-blue-500 text-[10px] animate-pulse font-black uppercase">{statusProcesso}</p>}
            </div>
          )}

          {moduloAtivo === 'cnpj' && (
            <div className="max-w-2xl mx-auto mt-10 space-y-6">
              <textarea 
                placeholder="Cole uma lista de CNPJs aqui para processamento em massa..." 
                className="w-full bg-zinc-900 p-6 rounded-[2rem] text-sm h-64 outline-none border border-white/5 focus:border-blue-500 text-white transition-all shadow-xl" 
                value={cnpjBusca} 
                onChange={(e) => setCnpjBusca(e.target.value)} 
              />
              <button 
                onClick={async () => {
                  const lista = cnpjBusca.match(/\d{14}/g) || [];
                  for (const c of lista) { await processarCNPJ(c, "Busca Manual"); }
                  setCnpjBusca(''); sincronizar();
                }} 
                className="w-full bg-blue-600 hover:bg-blue-500 py-5 rounded-2xl font-black uppercase text-sm shadow-lg shadow-blue-900/20 transition-all active:scale-[0.98]"
              >
                Processar e Adicionar ao Estoque
              </button>
            </div>
          )}

          {moduloAtivo === 'todo' && (
            <div className="grid grid-cols-1 gap-3 max-w-5xl">
              {carregando ? (
                <div className="py-40 text-center text-[10px] font-black text-zinc-700 animate-pulse tracking-[0.5em] uppercase">Sincronizando Banco de Dados...</div>
              ) : (
                leadsFiltrados.map(lead => (
                  <div key={lead.cnpj} className="group bg-zinc-900/30 border border-white/5 py-4 px-6 rounded-2xl flex justify-between items-center hover:bg-zinc-800/50 hover:border-white/10 transition-all">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="text-[13px] font-bold uppercase truncate text-white leading-tight">{lead.razao_social}</h3>
                        <span className="shrink-0 text-[8px] bg-zinc-800 px-2 py-0.5 rounded text-zinc-500 font-bold uppercase border border-white/5">{lead.cnpj}</span>
                      </div>
                      <p className="text-[10px] text-zinc-500 uppercase truncate font-medium mb-3 italic">{lead.nome_fantasia || 'Sem nome fantasia'}</p>
                      <div className="flex gap-2 flex-wrap">
                        <span className="text-[9px] text-blue-400 font-black uppercase tracking-tighter">{lead.bairro}</span>
                        <span className="text-zinc-700 text-[9px]">•</span>
                        <span className="text-[9px] text-zinc-500 font-bold uppercase truncate max-w-[200px]">{lead.logradouro}, {lead.numero}</span>
                        <span className="text-zinc-700 text-[9px]">•</span>
                        <span className="text-[9px] text-orange-500/80 font-bold">CNAE: {lead.cnae_principal}</span>
                      </div>
                    </div>
                    <div className="ml-6">
                      <button 
                        onClick={async () => { 
                          const novoStatus = aba === 'estoque' ? 'Triagem' : 'Em Prospecção';
                          await supabase.from('empresas_mestre').update({status_lead: novoStatus}).eq('cnpj', lead.cnpj); 
                          sincronizar(); 
                        }} 
                        className={`h-11 w-14 rounded-2xl flex items-center justify-center text-lg active:scale-90 transition-all shadow-lg ${aba === 'estoque' ? 'bg-blue-600 hover:bg-blue-500 shadow-blue-900/30' : 'bg-orange-600 hover:bg-orange-500 shadow-orange-900/30'}`}
                      >
                        ➡️
                      </button>
                    </div>
                  </div>
                ))
              )}
              {!carregando && leadsFiltrados.length === 0 && (
                 <div className="py-40 text-center flex flex-col items-center opacity-20">
                    <span className="text-5xl mb-4">📂</span>
                    <p className="text-[10px] font-black uppercase tracking-[0.3em]">Nenhum lead nesta combinação de filtros</p>
                 </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* CSS Customizado para o Scrollbar (apenas decorativo) */}
      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #27272a; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #3f3f46; }
      `}</style>
    </div>
  );
}
