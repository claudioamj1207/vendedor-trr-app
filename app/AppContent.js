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
  const [resultadoBusca, setResultadoBusca] = useState('');

  const sincronizar = async () => {
    try {
      setCarregando(true);
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

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { sincronizar(); }, [aba, moduloAtivo]);

  useEffect(() => { setResultadoBusca(''); setStatusProcesso(''); }, [moduloAtivo]);

  const processarCNPJ = async (cnpj, fonteInfo) => {
    const cnpjLimpo = cnpj.replace(/\D/g, '');
    if (cnpjLimpo.length !== 14) return;
    
    try {
      setStatusProcesso(`Consultando na Receita: ${cnpjLimpo}...`);
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
    } catch (err) { console.error("Erro CNPJ:", cnpjLimpo); }
  };

  const extrairEPesquisar = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setResultadoBusca('');
    setStatusProcesso('Lendo arquivo...');
    
    const origemArquivo = `Arquivo: ${file.name}`;
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
      setStatusProcesso(`Encontrados ${cnpjsUnicos.length} CNPJs únicos. Iniciando pesquisa na Receita...`);
      
      for (const cnpj of cnpjsUnicos) {
        await processarCNPJ(cnpj, origemArquivo);
      }
      
      setStatusProcesso('');
      setResultadoBusca(`Sucesso! Foram processados ${cnpjsUnicos.length} CNPJs a partir do documento: ${file.name}`);
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
            className="w-full mt-4 bg-zinc-900 p-3 rounded-xl text-xs outline-none border border-zinc-800 focus:border-blue-500 transition-colors text-white"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        )}
      </header>

      <main className="px-4 mt-6">
        {resultadoBusca && (
          <div className="bg-emerald-900/30 border border-emerald-500/50 p-4 rounded-2xl mb-6 flex items-center gap-3">
            <span className="text-2xl">✅</span>
            <p className="text-emerald-400 text-xs font-bold leading-tight">{resultado
