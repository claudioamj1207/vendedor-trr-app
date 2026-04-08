"use client";

// Chaves mestras para evitar erro de build na Vercel
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';

// Sua conexão direta com o Supabase
const supabase = createClient("https://qswmodzcsdkjmdzgxtlo.supabase.co", "sb_publishable_lWTV-2xQxwJlIAEn-zj_vg_z75OgB4k");

export default function VendedorTRR() {
  const [montado, setMontado] = useState(false);
  const [leads, setLeads] = useState([]);
  const [aba, setAba] = useState('agenda');
  const [modulo, setModulo] = useState('todo');
  const [statusProc, setStatusProc] = useState('');
  const [modal, setModal] = useState({ ativo: false, tipo: '', lead: null });
  const [form, setForm] = useState({ contato: '', telefone: '', ie: '', im: '', endereco_obra: '', obs: '' });

  // Só carrega o conteúdo quando o navegador estiver pronto
  useEffect(() => {
    setMontado(true);
    sincronizar();
  }, [aba, modulo]);

  const sincronizar = async () => {
    let q = supabase.from('empresas_mestre').select('*');
    if (modulo === 'todo') {
      if (aba === 'estoque') q = q.eq('status_lead', 'Novo');
      if (aba === 'triagem') q = q.eq('status_lead', 'Triagem');
      if (aba === 'agenda')  q = q.eq('status_lead', 'Em Prospecção');
    }
    const { data } = await q.order('razao_social', { ascending: true });
    setLeads(data || []);
  };

  const pescar = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setStatusProc('Lendo arquivo...');
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const wb = XLSX.read(evt.target.result, { type: 'binary' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(ws);
      const cnpjs = JSON.stringify(data).match(/\d{14}/g) || [];
      
      for (const c of [...new Set(cnpjs)]) {
        setStatusProc(`Pescando: ${c}`);
        await supabase.from('empresas_mestre').upsert({ 
          cnpj: c, 
          status_lead: 'Novo' 
        });
      }
      setStatusProc('Concluído!');
      sincronizar();
    };
    reader.readAsBinaryString(file);
  };

  const mover = async (lead, novoStatus) => {
    await supabase.from('empresas_mestre').update({ status_lead: novoStatus }).eq('cnpj', lead.cnpj);
    sincronizar();
  };

  if (!montado) return <div className="min-h-screen bg-black" />;

  return (
    <div className="min-h-screen bg-black text-white p-4 pb-32 font-sans antialiased">
      {/* Cabeçalho Profissional */}
      <header className="mb-6 flex justify-between items-center">
        <h1 className="text-xl font-black italic text-blue-500 uppercase">Vendedor TRR</h1>
        <div className="flex gap-3">
          <button onClick={() => setModulo('todo')} className={`text-[10px] font-bold uppercase ${modulo === 'todo' ? 'text-white border-b-2 border-blue-500' : 'text-zinc-600'}`}>Leads</button>
          <button onClick={() => setModulo('arquivo')} className={`text-[10px] font-bold uppercase ${modulo === 'arquivo' ? 'text-white border-b-2 border-blue-500' : 'text-zinc-600'}`}>Pescador</button>
        </div>
      </header>

      {modulo === 'arquivo' ? (
        <div className="bg-zinc-900 p-10 rounded-3xl border-2 border-dashed border-zinc-800 text-center">
          <input type="file" onChange={pescar} className="text-xs mb-4" />
          <p className="text-blue-500 font-bold text-xs">{statusProc}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {leads.map(lead => (
            <div key={lead.cnpj} className="bg-zinc-900/50 p-4 rounded-3xl border border-white/5">
              <h3 className="text-[13px] font-bold uppercase truncate">{lead.razao_social || lead.cnpj}</h3>
              <p className="text-[10px] text-zinc-500 mb-3">{lead.bairro || 'Manaus'} • {lead.
