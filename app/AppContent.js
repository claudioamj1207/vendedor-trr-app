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
        .order('razao_social', { ascending: true })
        .range(0, 3000); // Garante que vemos todos os 1800+ leads
        
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

  const processarCNPJ = async (cnpj, dadosAtuais) => {
    const cnpjLimpo = cnpj.replace(/\D/g, '');
    try {
      const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpjLimpo}`);
      const info = await res.json();
      
      if (info.cnpj) {
        await supabase.from('empresas_mestre').upsert({
          ...dadosAtuais, // Mantém os dados que já existem
          cnpj: cnpjLimpo,
          razao_social: info.razao_social,
          nome_fantasia: info.nome_fantasia || info.razao_social,
          logradouro: info.logradouro,
          numero: info.numero,
          bairro: info.bairro,
          municipio: info.municipio,
          uf: info.uf,
          cnae_principal_codigo: String(info.cnae_fiscal),
          cnae_principal_descricao: info.cnae_fiscal_descricao || 'Atividade não descrita',
          data_captacao: dadosAtuais.data_captacao || new Date().toISOString()
        });
        return true;
      }
    } catch (err) { return false; }
  };

  const atualizarApenasFaltantes = async () => {
    // Busca no banco apenas quem não tem descrição de CNAE
    const { data: faltantes } = await supabase
      .from('empresas_mestre')
      .select('*')
      .or('cnae_principal_descricao.is.null,cnae_principal_descricao.eq.""');

    if (!faltantes || faltantes.length === 0) {
      alert("Todos os leads já possuem descrição de CNAE!");
      return;
    }

    if (!confirm(`Encontrados ${faltantes.length} leads sem descrição. Iniciar atualização?`)) return;

    setResultadoBusca('');
    let sucesso = 0;
    for (const lead of faltantes) {
      setStatusProcesso(`Atualizando (${sucesso + 1}/${faltantes.length}): ${lead.razao_social}`);
      const ok = await processarCNPJ(lead.cnpj, lead);
      if (ok) sucesso++;
      await new Promise(r => setTimeout(r, 500)); // Delay para evitar block da API
    }

    setStatusProcesso('');
    setResultadoBusca(`${sucesso} leads foram atualizados com sucesso.`);
    sincronizar();
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
            {aba === 'triagem' ? 'Triagem' : 'Estoque'}
          </h2>
          <div className="flex gap-2">
            <button 
              onClick={atualizarApenasFaltantes}
              className="text-[10px] bg-emerald-600 text-white px-4 py-2 rounded-full font-bold hover:bg-emerald-500 transition-all"
            >
              🔄 SINCRONIZAR CNAES FALTANTES
            </button>
            <button onClick={() => setMostrarFiltros(!mostrarFiltros)} className="text-[10px] bg-blue-600/20 text-blue-400 px-4 py-2 rounded-full font-bold border border-blue-500/30">
              {mostrarFiltros ? 'FECHAR FILTROS' : 'FILTROS AVANÇADOS'}
            </button>
          </div>
        </div>

        {moduloAtivo === 'todo' && (
          <div className="mt-4 space-y-3">
            <input 
              type="text" 
              placeholder="Pesquisa rápida..." 
              className="w-full bg-zinc-900 p-3 rounded-xl text-xs outline-none border border-zinc-800 text-white"
              value={buscaGlobal}
              onChange={(e) => setBuscaGlobal(e.target.value)}
            />
            
            {mostrarFiltros && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 p-4 bg-zinc-900 rounded-2xl border border-white/5">
                {[
                  { label: 'Razão Social', campo: 'razao_social' },
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
                      className="bg-zinc-800 text-[11px] p-2.5 rounded-lg text-white"
                    >
                      {obterOpcoes(filtro.campo).map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            )}
            <div className="flex justify-between items-center px-1">
              <p className="text-[9px] text-zinc-500 font-bold uppercase">{leadsFiltrados.length} Registros</p>
              {statusProcesso && <p className="text-[9px] text-blue-500 animate-pulse font-black uppercase">{statusProcesso}</p>}
            </div>
          </div>
        )}
      </header>

      <main className="px-4 mt-6">
        {resultadoBusca && (
          <div className="bg-emerald-900/30 border border-emerald-500/50 p-4 rounded-2xl mb-6 text-emerald-400 text-xs font-bold">
            {resultadoBusca}
          </div>
        )}

        <div className="bg-zinc-900/30 border border-white/5 rounded-2xl divide-y divide-zinc-800/50">
          {carregando ? (
            <div className="text-center py-20 text-[10px] animate-pulse text-white">CARREGANDO BASE...</div>
          ) : (
            leadsFiltrados.map(lead => (
              <div key={lead.cnpj} className="py-4 px-4 flex justify-between items-center gap-3">
                <div className="flex-1 min-w-0">
                  <h3 className="text-[12px] font-bold uppercase truncate text-white">{lead.razao_social}</h3>
                  <div className="flex gap-1.5 mt-2 flex-wrap">
                    <span className="text-[8px] bg-zinc-800 px-2 py-0.5 rounded text-zinc-400 font-bold border border-white/5">{lead.bairro}</span>
                    <span className="text-[8px] bg-orange-900/20 px-2 py-0.5 rounded text-orange-400 font-bold border border-orange-500/10">
                      {lead.cnae_principal_descricao || 'SEM DESCRIÇÃO'}
                    </span>
                  </div>
                </div>
                <button onClick={async () => { 
                  const n = aba === 'estoque' ? 'Triagem' : 'Em Prospecção';
                  await supabase.from('empresas_mestre').update({status_lead: n}).eq('cnpj', lead.cnpj); 
                  sincronizar(); 
                }} className="h-10 w-10 bg-blue-600 rounded-xl flex items-center justify-center text-white">➡️</button>
              </div>
            ))
          )}
        </div>
      </main>

      <nav className="fixed bottom-6 left-6 right-6 h-16 bg-zinc-900/90 backdrop-blur-md border border-white/10 rounded-full px-8 flex justify-around items-center z-50 shadow-2xl">
        {['estoque', 'triagem'].map(a => (
          <button key={a} onClick={() => setAba(a)} className={`text-[11px] font-black uppercase ${aba === a ? 'text-blue-500' : 'text-zinc-600'}`}>{a}</button>
        ))}
      </nav>
    </div>
  );
}
