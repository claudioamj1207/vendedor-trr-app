"use client";
import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';

const supabase = createClient("https://qswmodzcsdkjmdzgxtlo.supabase.co", "sb_publishable_lWTV-2xQxwJlIAEn-zj_vg_z75OgB4k");

export default function VendedorTRR() {
  const [leads, setLeads] = useState([]);
  const [aba, setAba] = useState('agenda');
  const [modulo, setModulo] = useState('todo');
  const [modal, setModal] = useState({ ativo: false, tipo: '', lead: null });
  const [form, setForm] = useState({ contato: '', telefone: '', obs: '' });

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

  useEffect(() => { sincronizar(); }, [aba, modulo]);

  const pescar = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const wb = XLSX.read(evt.target.result, { type: 'binary' });
      const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
      const cnpjs = JSON.stringify(data).match(/\d{14}/g) || [];
      for (const c of [...new Set(cnpjs)]) {
        await supabase.from('empresas_mestre').upsert({ cnpj: c, status_lead: 'Novo' });
      }
      sincronizar();
    };
    reader.readAsBinaryString(file);
  };

  return (
    <div className="min-h-screen bg-black text-white p-4 font-sans">
      <header className="flex justify-between items-center mb-6">
        <h1 className="text-xl font-black italic text-blue-500 uppercase italic">Vendedor TRR</h1>
        <div className="flex gap-4">
          <button onClick={() => setModulo('todo')} className={modulo === 'todo' ? 'text-blue-500 underline' : 'text-zinc-500'}>TODO</button>
          <button onClick={() => setModulo('arquivo')} className={modulo === 'arquivo' ? 'text-blue-500 underline' : 'text-zinc-500'}>PESCADOR</button>
        </div>
      </header>

      {modulo === 'arquivo' ? (
        <div className="p-10 bg-zinc-900 rounded-3xl text-center border-2 border-dashed border-zinc-800">
          <input type="file" onChange={pescar} className="text-xs" />
        </div>
      ) : (
        <div className="space-y-4">
          {leads.map(lead => (
            <div key={lead.cnpj} className="bg-zinc-900 p-5 rounded-3xl border border-white/5">
              <h3 className="text-xs font-bold uppercase truncate">{lead.razao_social || lead.cnpj}</h3>
              <div className="grid grid-cols-4 gap-2 mt-4">
                <button onClick={() => setModal({ ativo: true, tipo: 'INFO', lead })} className="h-10 bg-zinc-800 rounded-xl">ℹ️</button>
                <button onClick={() => setModal({ ativo: true, tipo: 'EDITAR', lead })} className="h-10 bg-zinc-800 rounded-xl">➕</button>
                <button className="h-10 bg-zinc-800 rounded-xl">🎙️</button>
                <button onClick={() => window.open(`https://waze.com/ul?q=${lead.razao_social || lead.cnpj}`)} className="h-10 bg-zinc-800 rounded-xl">📍</button>
                <button className="h-10 bg-zinc-800 rounded-xl">📅</button>
                <button className="h-10 bg-zinc-800 rounded-xl">📝</button>
                <button onClick={async () => { await supabase.from('empresas_mestre').update({status_lead: aba === 'estoque' ? 'Triagem' : 'Em Prospecção'}).eq('cnpj', lead.cnpj); sincronizar(); }} className="h-10 bg-blue-600 rounded-xl">➡️</button>
                <button onClick={async () => { await supabase.from('empresas_mestre').update({status_lead: 'Viável'}).eq('cnpj', lead.cnpj); sincronizar(); }} className="h-10 bg-white text-black font-black rounded-xl">✅</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {modulo === 'todo' && (
        <nav className="fixed bottom-6 left-6 right-6 h-16 bg-zinc-900 rounded-full flex justify-around items-center border border-white/10 shadow-2xl">
          {['estoque', 'triagem', 'agenda'].map(a => (
            <button key={a} onClick={() => setAba(a)} className={`text-[10px] font-black uppercase ${aba === a ? 'text-blue-500' : 'text-zinc-600'}`}>{a}</button>
          ))}
        </nav>
      )}
    </div>
  );
}
