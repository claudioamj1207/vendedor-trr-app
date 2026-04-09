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

  const [filtrosAtivos, setFiltrosAtivos] = useState({
    razao_social: 'Todos',
    nome_fantasia: 'Todos',
    cnpj: 'Todos',
    bairro: 'Todos',
    fonte_lead: 'Todos',
    cnae_principal_descricao: 'Todos'
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

  useEffect(() => { sincronizar(); }, [aba, moduloAtivo]);

  const leadsFiltrados = useMemo(() => {
    return leads.filter(lead => {
      const matchRazao = filtrosAtivos.razao_social === 'Todos' || lead.razao_social === filtrosAtivos.razao_social;
      const matchFantasia = filtrosAtivos.nome_fantasia === 'Todos' || lead.nome_fantasia === filtrosAtivos.nome_fantasia;
      const matchCNPJ = filtrosAtivos.cnpj === 'Todos' || lead.cnpj === filtrosAtivos.cnpj;
      const matchBairro = filtrosAtivos.bairro === 'Todos' || lead.bairro === filtrosAtivos.bairro;
      const matchFonte = filtrosAtivos.fonte_lead === 'Todos' || lead.fonte_lead === filtrosAtivos.fonte_lead;
      const matchCnae = filtrosAtivos.cnae_principal_descricao === 'Todos' || lead.cnae_principal_descricao === filtrosAtivos.cnae_principal_descricao;
      
      const texto = buscaGlobal.toLowerCase();
      const matchBusca = !buscaGlobal || 
        Object.values(lead).some(val => String(val).toLowerCase().includes(texto));

      return matchRazao && matchFantasia && matchCNPJ && matchBairro && matchFonte && matchCnae && matchBusca;
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
      const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpjLimpo}`);
      const info = await res.json();
      
      if (info.cnpj) {
        await supabase.from('empresas_mestre').upsert({
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
          status_lead: info.status_lead || 'Novo',
          fonte_lead: info.fonte_lead || fonteInfo,
          data_captacao: info.data_captacao || new Date().toISOString()
        });
      }
    } catch (err) { console.error("Erro no CNPJ:", cnpjLimpo); }
  };

  // NOVA FUNÇÃO: RE-PROCESSAR TUDO PARA PEGAR CNAES
  const atualizarCNAEsEmMassa = async () => {
    if (!confirm(`Deseja atualizar as descrições de CNAE para os ${leadsFiltrados.length} leads filtrados?`)) return;
    
    setResultadoBusca('');
    let cont = 0;
    for (const lead of leadsFiltrados) {
      cont++;
      setStatusProcesso(`Atualizando CNAE ${cont} de ${leadsFiltrados.length}: ${lead.razao_social}`);
      await processarCNPJ(lead.cnpj, lead.fonte_lead || 'Atualização em Massa');
      // Pequena pausa para evitar bloqueio da API
      await new Promise(r => setTimeout(r, 500));
    }
    
    setStatusProcesso('');
    setResultadoBusca(`Sucesso! ${cont} leads foram atualizados com as descrições da Receita.`);
    sincronizar();
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
      for (const c of unicos) { 
        setStatusProcesso(`Processando ${unicos.indexOf(c) + 1} de ${unicos.length}...`);
        await processarCNPJ(c, `Arquivo: ${file.name}`); 
      }
      setResultadoBusca(`${unicos.length} empresas processadas.`);
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
          <div className="flex gap-2">
            {moduloAtivo === 'todo' && leadsFiltrados.length > 0 && (
              <button 
                onClick={atualizarCNAEsEmMassa}
                className="text-[10px] bg-emerald-600 text-white px-4 py-2 rounded-full font-bold hover:bg-emerald-500 transition-all"
              >
                🔄 ATUALIZAR CNAEs
              </button>
            )}
            {moduloAtivo === 'todo' && (
              <button onClick={() => setMostrarFiltros(!mostrarFiltros)} className="text-[10px] bg-blue-600/20 text-blue-400 px-4 py-2 rounded-full font-bold border border-blue-500/30">
                {mostrarFiltros ? 'FECHAR FILTROS' : 'FILTROS AVANÇADOS'}
              </button>
            )}
          </div>
        </div>

        {moduloAtivo === 'todo' && (
          <div className="mt-4 space-y-3">
            <input 
              type="text" 
              placeholder="Pesquisa rápida global..." 
              className="w-full bg-zinc-900 p-3 rounded-xl text-xs outline-none border border-zinc-800 focus:border-blue-500 text-white"
              value={buscaGlobal}
              onChange={(e) => setBuscaGlobal(e.target.value)}
            />
            
            {mostrarFiltros && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 p-4 bg-zinc-900/80 rounded-2xl border border-white/5 animate-in slide-in-from-top-4">
                {[
                  { label: 'Razão Social', campo: 'razao_social' },
                  { label: 'Nome Fantasia', campo: 'nome_fantasia' },
                  { label: 'CNPJ', campo: 'cnpj' },
                  { label: 'Bairro', campo: 'bairro' },
                  { label: 'Fonte', campo: 'fonte_lead' },
                  { label: 'CNAE (Descrição)', campo: 'cnae_principal_descricao' }
                ].map(filtro => (
                  <div key={filtro.campo} className="flex flex-col gap-1">
                    <label className="text-[9px] font-black text-zinc-500 uppercase ml-1">{filtro.label}</label>
                    <select 
                      value={filtrosAtivos[filtro.campo]}
                      onChange={(e) => setFiltrosAtivos({...filtrosAtivos, [filtro.campo]: e.target.value})}
                      className="bg-zinc-800 text-[11px] p-2.5 rounded-lg outline-none border border-white/5 text-white"
                    >
                      {obterOpcoes(filtro.campo).map(opt => (
                        <option key={opt} value={opt}>{opt === 'Todos' ? `Ver Todos` : opt}</option>
                      ))}
                    </select>
                  </div>
                ))}
                <button 
                  onClick={() => setFiltrosAtivos({razao_social:'Todos', nome_fantasia:'Todos', cnpj:'Todos', bairro:'Todos', fonte_lead:'Todos', cnae_principal_descricao:'Todos'})}
                  className="lg:col-span-3 mt-2 text-[9px] font-bold text-red-500 uppercase py-3 bg-red-500/10 rounded-lg"
                >
                  Limpar Todos os Filtros
                </button>
              </div>
            )}
            <div className="flex justify-between items-center">
              <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest">{leadsFiltrados.length} leads selecionados</p>
              {statusProcesso && <p className="text-[9px] text-blue-500 animate-pulse font-black uppercase italic">{statusProcesso}</p>}
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
          <div className="bg-zinc-900 p-8 rounded-3xl border border-dashed border-zinc-800 text-center max-w-2xl mx-auto">
            <input type="file" onChange={extrairEPesquisar} className="text-xs mb-4 w-full text-zinc-400" />
            {statusProcesso && <p className="mt-4 text-blue-500 text-[10px] animate-pulse font-bold uppercase">{statusProcesso}</p>}
          </div>
        )}

        {moduloAtivo === 'cnpj' && (
          <div className="max-w-2xl mx-auto space-y-4">
            <textarea placeholder="Cole CNPJs para processar..." className="w-full bg-zinc-900 p-4 rounded-2xl text-sm h-32 outline-none border border-zinc-800 text-white" value={cnpjBusca} onChange={(e) => setCnpjBusca(e.target.value)} />
            <button onClick={async () => {
              const lista = cnpjBusca.match(/\d{14}/g) || [];
              for (const c of lista) { 
                setStatusProcesso(`Processando ${lista.indexOf(c) + 1} de ${lista.length}...`);
                await processarCNPJ(c, "Busca Manual"); 
              }
              setStatusProcesso(''); setCnpjBusca(''); sincronizar();
            }} className="w-full bg-blue-600 py-4 rounded-2xl font-black uppercase text-sm text-white">Pesquisar e Salvar</button>
          </div>
        )}

        {moduloAtivo === 'todo' && (
          <div className="bg-zinc-900/30 border border-white/5 rounded-2xl divide-y divide-zinc-800/50">
            {carregando ? (
              <div className="text-center py-20 text-[10px] animate-pulse tracking-[0.3em] text-white">SINCRONIZANDO...</div>
            ) : (
              leadsFiltrados.map(lead => (
                <div key={lead.cnpj} className="py-4 px-4 flex justify-between items-center gap-3 hover:bg-zinc-800/40 transition-colors">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-[12px] font-bold uppercase truncate text-white leading-tight">{lead.razao_social}</h3>
                    <p className="text-[9px] text-zinc-500 uppercase truncate mt-0.5 font-medium italic">{lead.nome_fantasia || lead.razao_social}</p>
                    <div className="flex gap-1.5 mt-2.5 flex-wrap">
                      <span className="text-[8px] bg-zinc-800 px-2 py-0.5 rounded text-zinc-400 font-bold uppercase border border-white/5">{lead.bairro}</span>
                      <span className="text-[8px] bg-blue-900/20 px-2 py-0.5 rounded text-blue-400 font-bold uppercase border border-blue-500/10">{lead.cnpj}</span>
                      <span className="text-[8px] bg-orange-900/20 px-2 py-0.5 rounded text-orange-400 font-bold border border-orange-500/10">
                        CNAE: {lead.cnae_principal_descricao || lead.cnae_principal_codigo || 'Não Capturado'}
                      </span>
                    </div>
                  </div>
                  <div className="shrink-0">
                    <button onClick={async () => { 
                      const n = aba === 'estoque' ? 'Triagem' : 'Em Prospecção';
                      await supabase.from('empresas_mestre').update({status_lead: n}).eq('cnpj', lead.cnpj); 
                      sincronizar(); 
                    }} className={`h-10 w-12 rounded-xl flex items-center justify-center text-sm ${aba === 'estoque' ? 'bg-blue-600' : 'bg-orange-600'} text-white`}>
                      ➡️
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </main>

      <nav className="fixed bottom-6 left-6 right-6 h-16 bg-zinc-900/90 backdrop-blur-md border border-white/10 rounded-full px-8 flex justify-around items-center z-50 shadow-2xl">
        {['estoque', 'triagem'].map(a => (
          <button key={a} onClick={() => setAba(a)} className={`text-[11px] font-black uppercase tracking-widest ${aba === a ? 'text-blue-500' : 'text-zinc-600'}`}>{a}</button>
        ))}
      </nav>
    </div>
  );
}
