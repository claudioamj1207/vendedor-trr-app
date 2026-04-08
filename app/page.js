"use client";

import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';

const supabase = createClient("https://qswmodzcsdkjmdzgxtlo.supabase.co", "sb_publishable_lWTV-2xQxwJlIAEn-zj_vg_z75OgB4k");

export default function VendedorTRR() {
  const [montado, setMontado] = useState(false);
  const [leads, setLeads] = useState([]);
  const [aba, setAba] = useState('agenda');
  const [modulo, setModulo] = useState('todo');
  const [statusProc, setStatusProc] = useState('');
  const [modal, setModal] = useState({ ativo: false, tipo: '', lead: null });
  const [form, setForm] = useState({ contato: '', telefone: '', obs: '' });

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
    setStatusProc('Lendo...');
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const wb = XLSX.read(evt.target.result, { type: 'binary' });
      const cnpjs = JSON.stringify(XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]])).match(/\d{14}/g) || [];
      for (const c of [...new Set(cnpjs)]) {
        await supabase.from('empresas_mestre').upsert({ cnpj: c, status_lead: 'Novo' });
      }
      setStatusProc('OK!'); sincronizar();
    };
    reader.readAsBinaryString(file);
  };

  if (!montado) return null;

  return (
    <div className="min-h-screen bg-black text-white p-4 pb-32">
      <header className="mb-6 flex justify-between items-center">
        <h1 className="text-xl font-black italic text-blue-500 uppercase">Vendedor TRR</h1>
        <div className="flex gap-3">
          <button onClick={() => setModulo('todo')} className={`text-[10px] font-bold ${modulo === 'todo' ? 'text-blue-500' : 'text-zinc-600'}`}>LEADS</button>
          <button onClick={() => setModulo('arquivo')} className={`text-[10px] font-bold ${modulo === 'arquivo' ? 'text-blue-500' : 'text-zinc-600'}`}>PESCADOR</button>
        </div>
      </header>

      {modulo === 'arquivo' ? (
        <div className="bg-zinc-900 p-10 rounded-3xl border-2 border-dashed border-zinc-800 text-center">
          <input type="file" onChange={pescar} className="text-xs mb-4" />
          <p className="text-blue-500 text-xs font-bold">{statusProc}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {leads.map(lead => (
            <div key={lead.cnpj} className="bg-zinc-900/50 p-4 rounded-3xl border border-white/5">
              <h3 className="text-[13px] font-bold uppercase truncate">{lead.razao_social || lead.cnpj}</h3>
              <div className="grid grid-cols-4 gap-2 mt-4">
                <button onClick={() => setModal({ ativo: true, tipo: 'INFO', lead })} className="h-9 bg-zinc-800 rounded-xl">ℹ️</button>
                <button onClick={() => { setForm({...lead}); setModal({ ativo: true, tipo: 'EDITAR', lead }); }} className="h-9 bg-zinc-800 rounded-xl">➕</button>
                <button className="h-9 bg-zinc-800 rounded-xl">🎙️</button>
                <button onClick={() => window.open(`https://waze.com/ul?q=${lead.razao_social}`)} className="h-9 bg-zinc-800 rounded-xl">📍</button>
                <button className="h-9 bg-zinc-800 rounded-xl">📅</button>
                <button className="h-9 bg-zinc-800 rounded-xl">📝</button>
                <button onClick={async () => { await supabase.from('empresas_mestre').update({status_lead: aba === 'estoque' ? 'Triagem' : 'Em Prospecção'}).eq('cnpj', lead.cnpj); sincronizar(); }} className="h-9 bg-blue-600 rounded-xl">➡️</button>
                <button onClick={async () => { await supabase.from('empresas_mestre').update({status_lead: 'Viável'}).eq('cnpj', lead.cnpj); sincronizar(); }} className="h-9 bg-white text-black font-black rounded-xl">✅</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal.ativo && (
        <div className="fixed inset-0 bg-black z-50 p-6">
          <button onClick={() => setModal({ ativo: false })} className="mb-8 text-blue-500 font-bold">FECHAR X</button>
          {modal.tipo === 'EDITAR' ? (
            <div className="space-y-4">
              <input className="w-full bg-zinc-900 p-4 rounded-xl" placeholder="Contato" value={form.contato} onChange={e => setForm({...form, contato: e.target.value})} />
              <button onClick={async () => { await supabase.from('empresas_mestre').update({...form}).eq('cnpj', modal.lead.cnpj); setModal({ ativo: false }); sincronizar(); }} className="w-full bg-blue-600 p-4 rounded-xl font-bold">SALVAR</button>
            </div>
          ) : (
            <div className="bg-zinc-900 p-4 rounded-xl text-xs uppercase">{modal.lead.razao_social}</div>
          )}
        </div>
      )}

      {modulo === 'todo' && (
        <nav className="fixed bottom-6 left-6 right-6 h-16 bg-zinc-900 rounded-full flex justify-around items-center border border-white/10">
          <button onClick={() => setAba('estoque')} className={`text-[10px] font-black ${aba === 'estoque' ? 'text-blue-500' : 'text-zinc-600'}`}>ESTOQUE</button>
          <button onClick={() => setAba('triagem')} className={`text-[10px] font-black ${aba === 'triagem' ? 'text-blue-500' : 'text-zinc-600'}`}>TRIAGEM</button>
          <button onClick={() => setAba('agenda')} className={`text-[10px] font-black ${aba === 'agenda' ? 'text-blue-500' : 'text-zinc-600'}`}>MEU TO DO</button>
        </nav>
      )}
    </div>
  );
}
