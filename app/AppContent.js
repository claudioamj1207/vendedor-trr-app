"use client";
import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';

const supabase = createClient("https://qswmodzcsdkjmdzgxtlo.supabase.co", "sb_publishable_lWTV-2xQxwJlIAEn-zj_vg_z75OgB4k");

export default function VendedorTRR_Master() {
  const [leads, setLeads] = useState([]);
  const [aba, setAba] = useState('estoque'); 
  const [moduloAtivo, setModuloAtivo] = useState('todo'); 
  const [busca, setBusca] = useState('');
  const [cnpjBusca, setCnpjBusca] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [statusProcesso, setStatusProcesso] = useState('');

  const sincronizar = async () => {
    try {
      setCarregando(true);
      // Ajuste: Inclusão do nome_fantasia na busca do banco
      let query = supabase.from('empresas_mestre').select('cnpj, razao_social, nome_fantasia, bairro');
      
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

  useEffect(() => { sincronizar(); }, [aba, moduloAtivo]);

  // --- MOTOR PESCADOR: CONSULTA RECEITA COMPLETA ---
  const processarCNPJ = async (cnpj) => {
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
          status_lead: 'Novo'
        });
      }
    } catch (err) { console.error("Erro CNPJ:", cnpjLimpo); }
  };

  // --- BUSCAR EM ARQUIVO (PDF/EXCEL/TEXTO) ---
  const extrairEPesquisar = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setStatusProcesso('Lendo arquivo...');
    
    const reader = new FileReader();
    reader.onload = async (evt) => {
      let textoBruto = "";
      if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        const wb = XLSX.read(evt.target.result, { type: 'binary' });
        textoBruto = JSON.stringify(XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]));
      } else {
        textoBruto = evt.target.result;
      }

      const cnpjsEncontrados = textoBruto.match(/\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/g) || 
                               textoBruto.match(/\d{14}/g) || [];
      
      const cnpjsUnicos = [...new Set(cnpjsEncontrados)];
      setStatusProcesso(`Encontrados ${cnpjsUnicos.length} empresas. Iniciando pesquisa...`);
      
      for (const cnpj of cnpjsUnicos) {
        await processarCNPJ(cnpj);
      }
      setStatusProcesso('Processamento concluído!');
      sincronizar();
    };
    
    if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) reader.readAsBinaryString(file);
    else reader.readAsText(file);
  };

  return (
    <div className="min-h-screen bg-black text-white pb-40 font-sans antialiased">
      <header className="px-5 pt-8 pb-4 sticky top-0 bg-black/95 border-b border-white/5 z-50">
        <div className="flex justify-between items-center mb-2">
          <h1 className="text-[10px] font-black text-blue-500 uppercase italic">Vendedor TRR - Triagem</h1>
          <div className="flex gap-3">
            {['todo', 'arquivo', 'cnpj'].map(m => (
              <button key={m} onClick={() => setModuloAtivo(m)} className={`text-[9px] font-bold uppercase ${moduloAtivo === m ? 'text-white border-b-2 border-blue-500 pb-1' : 'text-zinc-600'}`}>
                {m === 'todo' ? 'PROCESSAR' : m}
              </button>
            ))}
          </div>
        </div>
        <h2 className="text-3xl font-black italic uppercase tracking-tighter">
          {moduloAtivo === 'arquivo' ? 'Busca em Arquivo' : (moduloAtivo === 'cnpj' ? 'Busca de CNPJ' : (aba === 'triagem' ? 'Triagem' : 'Estoque'))}
        </h2>
        
        {moduloAtivo === 'todo' && (
          <input 
            type="text" 
            placeholder="Filtrar por nome..." 
            className="w-full mt-4 bg-zinc-900 p-3 rounded-xl text-xs outline-none border border-zinc-800 focus:border-blue-500 transition-colors"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        )}
      </header>

      <main className="px-4 mt-6">
        {moduloAtivo === 'arquivo' && (
          <div className="bg-zinc-900 p-8 rounded-3xl border border-dashed border-zinc-800 text-center">
            <input type="file" onChange={extrairEPesquisar} className="text-xs mb-4" />
            <p className="text-xs text-zinc-500">Selecione PDF, Excel ou TXT para extrair e processar leads</p>
            {statusProcesso && <p className="mt-4 text-blue-500 text-[10px] animate-pulse font-bold">{statusProcesso}</p>}
          </div>
        )}

        {moduloAtivo === 'cnpj' && (
          <div className="space-y-4">
            <textarea placeholder="Cole um ou vários CNPJs aqui..." className="w-full bg-zinc-900 p-4 rounded-2xl text-sm h-32 outline-none border border-zinc-800 focus:border-blue-500 transition-colors" onChange={(e) => setCnpjBusca(e.target.value)} />
            <button onClick={() => {
              const lista = cnpjBusca.match(/\d{14}/g) || cnpjBusca.match(/\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/g) || [];
              lista.forEach(processarCNPJ);
              sincronizar();
            }} className="w-full bg-blue-600 hover:bg-blue-500 transition-colors py-4 rounded-2xl font-black uppercase">Pesquisar e Salvar</button>
          </div>
        )}

        {moduloAtivo === 'todo' && (
          <div className="bg-zinc-900/30 border border-white/5 rounded-2xl divide-y divide-zinc-800/50">
            {carregando ? <div className="text-center py-20 text-[10px] animate-pulse">PROCESSANDO...</div> :
            leads.filter(l => (l.razao_social?.toLowerCase() || "").includes(busca.toLowerCase())).map(lead => (
              
              /* Formato de Lista */
              <div key={lead.cnpj} className="py-3 px-4 flex justify-between items-center gap-3 hover:bg-zinc-900/50 transition-colors">
                <div className="flex-1 overflow-hidden">
                  <h3 className="text-[12px] font-bold uppercase truncate leading-tight text-white">{lead.razao_social}</h3>
                  <p className="text-[10px] text-zinc-400 uppercase truncate leading-tight mt-0.5">{lead.nome_fantasia || '---'}</p>
                  <p className="text-zinc-500 text-[10px] mt-1.5">{lead.cnpj} • {lead.bairro}</p>
                </div>
                
                <div className="shrink-0">
                  {aba === 'estoque' && (
                    <button onClick={async () => { await supabase.from('empresas_mestre').update({status_lead: 'Triagem'}).eq('cnpj', lead.cnpj); sincronizar(); }} className="h-9 w-12 bg-blue-600 rounded-xl flex items-center justify-center text-sm active:scale-95 transition-transform">➡️</button>
                  )}
                  {aba === 'triagem' && (
                    <button onClick={async () => { await supabase.from('empresas_mestre').update({status_lead: 'Em Prospecção'}).eq('cnpj', lead.cnpj); sincronizar(); }} className="h-9 w-12 bg-orange-600 rounded-xl flex items-center justify-center text-sm active:scale-95 transition-transform" title="Enviar para App de Campo">➡️</button>
                  )}
                </div>
              </div>

            ))}
          </div>
        )}
      </main>

      {moduloAtivo === 'todo' && (
        <nav className="fixed bottom-6 left-6 right-6 h-16 bg-zinc-900 border border-white/10 rounded-full px-8 flex justify-around items-center z-50 shadow-2xl">
          {['estoque', 'triagem'].map(a => (
            <button key={a} onClick={() => setAba(a)} className={`text-[11px] font-black uppercase tracking-widest ${aba === a ? 'text-blue-500' : 'text-zinc-600'}`}>{a}</button>
          ))}
        </nav>
      )}
    </div>
  );
}
