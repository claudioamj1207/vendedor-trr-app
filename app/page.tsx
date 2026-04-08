"use client";
import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';

const supabase = createClient("https://qswmodzcsdkjmdzgxtlo.supabase.co", "sb_publishable_lWTV-2xQxwJlIAEn-zj_vg_z75OgB4k");

export default function VendedorTRR() {
  const [leads, setLeads] = useState([]);
  const [aba, setAba] = useState('agenda');
  const [modulo, setModulo] = useState('todo');
  const [statusProc, setStatusProc] = useState('');
  const [modal, setModal] = useState({ ativo: false, tipo: '', lead: null });
  const [form, setForm] = useState({ contato: '', telefone: '', ie: '', im: '', endereco_obra: '', obs: '' });

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
      const cnpjs = JSON.stringify(XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]])).match(/\d{14}/g) || [];
      for (const c of [...new Set(cnpjs)]) {
        setStatusProc(`Pescando: ${c}`);
        const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${c}`);
        const info = await res.json();
        if (info.cnpj) await supabase.from('empresas_mestre').upsert({ cnpj: c, razao_social: info.razao_social, bairro: info.bairro, municipio: info.municipio, status_lead: 'Novo' });
      }
      setStatusProc('Concluído!'); sincronizar();
    };
    reader.readAsBinaryString(file);
  };

  const mover = async (lead, novoStatus) => {
    await supabase.from('empresas_mestre').update({ status_lead: novoStatus }).eq('cnpj', lead.cnpj);
    sincronizar();
  };

  return (
    <div className="min-h-screen bg-black text-white p-4 pb-32 font-sans">
      <header className="mb-6 flex justify-between items-center">
        <h1 className="text-xl font-black italic text-blue-500 uppercase">Vendedor TRR</h1>
        <div className="flex gap-2">
          {['todo', 'arquivo'].map(m => (
            <button key={m} onClick={() => setModulo(m)} className={`text-[10px] font-bold uppercase ${modulo === m ? 'text-white border-b-2 border-blue-500' : 'text-zinc-600'}`}>{m}</button>
          ))}
        </div>
      </header>

      {modulo === 'arquivo' ? (
        <div className="bg-zinc-900 p-10 rounded-3xl border-2 border-dashed border-zinc-800 text-center">
          <input type="file" onChange={pescar} className="text-xs" />
          <p className="mt-4 text-blue-500 font-bold text-xs">{statusProc}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {leads.map(lead => (
            <div key={lead.cnpj} className="bg-zinc-900 p-4 rounded-3xl border border-white/5">
              <h3 className="text-xs font-bold uppercase truncate">{lead.razao_social}</h3>
              <p className="text-[9px] text-zinc-500 mb-3">{lead.bairro} • {lead.cnpj}</p>
              <div className="grid grid-cols-4 gap-2">
                <button onClick={() => setModal({ ativo: true, tipo: 'INFO', lead })} className="h-8 bg-zinc-800 rounded-lg text-xs">ℹ️</button>
                <button onClick={() => { setForm({...lead}); setModal({ ativo: true, tipo: 'EDITAR', lead }); }} className="h-8 bg-zinc-800 rounded-lg text-xs">➕</button>
                <button className="h-8 bg-zinc-800 rounded-lg text-xs">🎙️</button>
                <button onClick={() => window.open(`https://waze.com/ul?q=${lead.razao_social}, Manaus`)} className="h-8 bg-zinc-800 rounded-lg text-xs">📍</button>
                <button onClick={() => setModal({ ativo: true, tipo: 'AGENDA', lead })} className="h-8 bg-zinc-800 rounded-lg text-xs">📅</button>
                <button onClick={() => window.print()} className="h-8 bg-zinc-800 rounded-lg text-xs">📝</button>
                <button onClick={() => mover(lead, aba === 'estoque' ? 'Triagem' : 'Em Prospecção')} className="h-8 bg-blue-600 rounded-lg text-xs">➡️</button>
                <button onClick={() => mover(lead, 'Viável')} className="h-8 bg-white text-black font-bold rounded-lg text-xs">✅</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal.ativo && (
        <div className="fixed inset-0 bg-black/95 z-50 p-6 flex flex-col">
          <div className="flex justify-between items-center mb-8">
            <h2 className="text-xl font-black text-blue-500 italic">{modal.tipo}</h2>
            <button onClick={() => setModal({ ativo: false })} className="bg-zinc-800 px-4 py-2 rounded-full text-[10px] font-bold uppercase">Fechar</button>
          </div>
          {modal.tipo === 'EDITAR' ? (
            <div className="space-y-3">
              <input type="text" placeholder="Contato" className="w-full bg-zinc-800 p-4 rounded-xl" value={form.contato} onChange={e => setForm({...form, contato: e.target.value})} />
              <input type="text" placeholder="I.E." className="w-full bg-zinc-800 p-4 rounded-xl" value={form.ie} onChange={e => setForm({...form, ie: e.target.value})} />
              <textarea placeholder="Obs..." className="w-full bg-zinc-800 p-4 rounded-xl h-32" value={form.obs} onChange={e => setForm({...form, obs: e.target.value})} />
              <button onClick={async () => { await supabase.from('empresas_mestre').update({...form}).eq('cnpj', modal.lead.cnpj); setModal({ ativo: false }); sincronizar(); }} className="w-full bg-blue-600 py-5 rounded-2xl font-black">SALVAR</button>
            </div>
          ) : (
            <div className="bg-zinc-900 p-6 rounded-2xl text-sm leading-relaxed">
              <p><strong>RAZÃO:</strong> {modal.lead.razao_social}</p>
              <p className="mt-4"><strong>OBS:</strong> {modal.lead.obs || 'Nenhuma.'}</p>
            </div>
          )}
        </div>
      )}

      {modulo === 'todo' && (
        <nav className="fixed bottom-6 left-6 right-6 h-16 bg-zinc-900 rounded-full flex justify-around items-center border border-white/10">
          {['estoque', 'triagem', 'agenda'].map(a => (
            <button key={a} onClick={() => setAba(a)} className={`text-[10px] font-black uppercase ${aba === a ? 'text-blue-500' : 'text-zinc-600'}`}>{a}</button>
          ))}
        </nav>
      )}
    </div>
  );
}
