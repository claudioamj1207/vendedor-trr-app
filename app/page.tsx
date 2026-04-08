"use client";
import React, { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';

const supabase = createClient("https://qswmodzcsdkjmdzgxtlo.supabase.co", "sb_publishable_lWTV-2xQxwJlIAEn-zj_vg_z75OgB4k");

export default function VendedorTRR_Master() {
  const [leads, setLeads] = useState([]);
  const [aba, setAba] = useState('agenda'); 
  const [moduloAtivo, setModuloAtivo] = useState('todo'); 
  const [statusProcesso, setStatusProcesso] = useState('');
  const [gravando, setGravando] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const [modal, setModal] = useState({ ativo: false, tipo: '', lead: null }); 
  const [form, setForm] = useState({ contato: '', telefone: '', email: '', ie: '', im: '', endereco_obra: '', obs: '', data_reagendada: '' });

  const sincronizar = async () => {
    let query = supabase.from('empresas_mestre').select('*');
    if (moduloAtivo === 'todo') {
      if (aba === 'estoque') query = query.eq('status_lead', 'Novo');
      if (aba === 'triagem') query = query.eq('status_lead', 'Triagem');
      if (aba === 'agenda')  query = query.eq('status_lead', 'Em Prospecção');
    }
    const { data } = await query.order('razao_social', { ascending: true });
    setLeads(data || []);
  };

  useEffect(() => { sincronizar(); }, [aba, moduloAtivo]);

  const processarCNPJ = async (cnpj) => {
    const cnpjLimpo = cnpj.replace(/\D/g, '');
    if (cnpjLimpo.length !== 14) return;
    try {
      setStatusProcesso(`Pescando: ${cnpjLimpo}...`);
      const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpjLimpo}`);
      const info = await res.json();
      if (info.cnpj) {
        await supabase.from('empresas_mestre').upsert({
          cnpj: cnpjLimpo, razao_social: info.razao_social, logradouro: info.logradouro,
          numero: info.numero, bairro: info.bairro, municipio: info.municipio,
          uf: info.uf, email: info.email, telefone: info.ddd_telefone_1, status_lead: 'Novo'
        });
      }
    } catch (err) { console.error(err); }
  };

  const extrairEPesquisar = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      let texto = "";
      if (file.name.endsWith('.xlsx')) {
        const wb = XLSX.read(evt.target.result, { type: 'binary' });
        texto = JSON.stringify(XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]));
      } else { texto = evt.target.result; }
      const cnpjs = [...new Set(texto.match(/\d{14}/g) || [])];
      for (const c of cnpjs) await processarCNPJ(c);
      setStatusProcesso('Concluído!');
      sincronizar();
    };
    if (file.name.endsWith('.xlsx')) reader.readAsBinaryString(file);
    else reader.readAsText(file);
  };

  const imprimirPDF = (lead) => {
    const win = window.open('', '', 'width=800,height=800');
    win.document.write(`<html><body style="font-family:Arial;padding:40px;"><h2>SOLICITAÇÃO DE CADASTRO TRR</h2><p><strong>RAZÃO:</strong> ${lead.razao_social}</p><p><strong>CNPJ:</strong> ${lead.cnpj}</p><p><strong>OBRA:</strong> ${lead.endereco_obra || '---'}</p><p><strong>CONTATO:</strong> ${lead.contato}</p></body></html>`);
    win.document.close(); win.print();
  };

  const navegarGPS = (lead, app) => {
    const destino = encodeURIComponent(`${lead.razao_social}, ${lead.bairro || ''}, Manaus`);
    window.open(app === 'waze' ? `https://waze.com/ul?q=${destino}` : `https://www.google.com/maps/search/?api=1&query=${destino}`, '_blank');
  };

  return (
    <div className="min-h-screen bg-black text-white pb-40 font-sans antialiased">
      <header className="px-5 pt-8 pb-4 sticky top-0 bg-black z-50 border-b border-white/10">
        <div className="flex justify-between items-center mb-2">
          <h1 className="text-[10px] font-black text-blue-500 uppercase italic">Vendedor TRR System</h1>
          <div className="flex gap-3">
            {['todo', 'arquivo', 'radar'].map(m => (
              <button key={m} onClick={() => setModuloAtivo(m)} className={`text-[9px] font-bold uppercase ${moduloAtivo === m ? 'text-white border-b border-blue-500' : 'text-zinc-600'}`}>{m}</button>
            ))}
          </div>
        </div>
        <h2 className="text-3xl font-black italic uppercase tracking-tighter">
          {moduloAtivo === 'arquivo' ? 'Pescador' : (aba === 'agenda' ? 'Meu To Do' : aba === 'triagem' ? 'Triagem' : 'Estoque')}
        </h2>
      </header>

      <main className="px-4 mt-6">
        {moduloAtivo === 'arquivo' ? (
          <div className="bg-zinc-900 p-8 rounded-3xl border border-dashed border-zinc-800 text-center">
            <input type="file" onChange={extrairEPesquisar} className="text-xs mb-4" />
            {statusProcesso && <p className="text-blue-500 text-[10px] font-bold animate-pulse">{statusProcesso}</p>}
          </div>
        ) : (
          <div className="space-y-3">
            {leads.map(lead => (
              <div key={lead.cnpj} className="bg-zinc-900/40 border border-zinc-800/50 p-4 rounded-[1.5rem]">
                <h3 className="text-[13px] font-bold uppercase truncate">{lead.razao_social}</h3>
                <p className="text-zinc-500 text-[9px] mb-3 uppercase tracking-tighter">{lead.bairro} • {lead.cnpj}</p>
                <div className="grid grid-cols-4 gap-1.5">
                  <button onClick={() => { setForm({...lead}); setModal({ ativo: true, tipo: 'info', lead }); }} className="h-8 bg-zinc-800 rounded flex items-center justify-center text-xs">ℹ️</button>
                  <button onClick={() => { setForm({...lead}); setModal({ ativo: true, tipo: 'incrementar', lead }); }} className="h-8 bg-zinc-800 rounded flex items-center justify-center text-xs">➕</button>
                  <button onClick={() => setModal({ ativo: true, tipo: 'audio', lead })} className="h-8 bg-zinc-800 rounded flex items-center justify-center text-xs">🎙️</button>
                  <button onClick={() => setModal({ ativo: true, tipo: 'gps', lead })} className="h-8 bg-zinc-800 rounded flex items-center justify-center text-xs">📍</button>
                  <button onClick={() => setModal({ ativo: true, tipo: 'reagendar', lead })} className="h-8 bg-zinc-800 rounded flex items-center justify-center text-xs">📅</button>
                  <button onClick={() => imprimirPDF(lead)} className="h-8 bg-zinc-800 rounded flex items-center justify-center text-xs">📝</button>
                  {aba === 'estoque' && <button onClick={async () => { await supabase.from('empresas_mestre').update({status_lead: 'Triagem'}).eq('cnpj', lead.cnpj); sincronizar(); }} className="h-8 bg-blue-600 rounded flex items-center justify-center text-xs text-white">➡️</button>}
                  {aba === 'triagem' && <button onClick={async () => { await supabase.from('empresas_mestre').update({status_lead: 'Em Prospecção'}).eq('cnpj', lead.cnpj); sincronizar(); }} className="h-8 bg-orange-600 rounded flex items-center justify-center text-xs text-white">➡️</button>}
                  {aba === 'agenda' && <div className="h-8 bg-zinc-900/50 rounded flex items-center justify-center text-[10px] text-zinc-700 font-bold italic">PROSP</div>}
                  <button onClick={async () => { await supabase.from('empresas_mestre').update({status_lead: 'Viável'}).eq('cnpj', lead.cnpj); sincronizar(); }} className="h-8 bg-white rounded flex items-center justify-center text-xs text-black font-black">✅</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {modal.ativo && (
        <div className="fixed inset-0 bg-black/95 z-[100] flex flex-col p-6 overflow-y-auto">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-black uppercase text-blue-500 italic">{modal.tipo}</h3>
            <button onClick={() => setModal({ ativo: false })} className="text-[10px] font-bold uppercase tracking-widest bg-zinc-800 px-3 py-1 rounded-full">Sair</button>
          </div>
          <div className="space-y-4">
            {modal.tipo === 'info' && (
              <div className="bg-zinc-900 p-5 rounded-2xl text-sm space-y-3 border border-zinc-800">
                <p><strong className="text-blue-500 block text-[10px] uppercase">Razão:</strong> {modal.lead.razao_social}</p>
                <p><strong className="text-blue-500 block text-[10px] uppercase">Endereço:</strong> {modal.lead.logradouro}, {modal.lead.numero} - {modal.lead.bairro}</p>
                <p><strong className="text-blue-500 block text-[10px] uppercase">Contato/Tel:</strong> {modal.lead.contato || '---'} / {modal.lead.telefone || '---'}</p>
                <div className="mt-4 p-3 bg-black/50 rounded-lg text-xs whitespace-pre-wrap text-zinc-400 border border-white/5 italic">{modal.lead.obs || 'Sem notas.'}</div>
              </div>
            )}
            {modal.tipo === 'incrementar' && (
              <div className="space-y-3 pb-20">
                <input type="text" placeholder="Contato" className="w-full bg-zinc-800 p-4 rounded-xl text-sm" value={form.contato} onChange={e => setForm({...form, contato: e.target.value})} />
                <input type="text" placeholder="I.E." className="w-full bg-zinc-800 p-4 rounded-xl text-sm" value={form.ie} onChange={e => setForm({...form, ie: e.target.value})} />
                <input type="text" placeholder="I.M." className="w-full bg-zinc-800 p-4 rounded-xl text-sm" value={form.im} onChange={e => setForm({...form, im: e.target.value})} />
                <input type="text" placeholder="Local da Obra" className="w-full bg-zinc-800 p-4 rounded-xl text-sm" value={form.endereco_obra} onChange={e => setForm({...form, endereco_obra: e.target.value})} />
                <textarea placeholder="Observações..." className="w-full bg-zinc-800 p-4 rounded-xl text-sm h-32" value={form.obs} onChange={e => setForm({...form, obs: e.target.value})} />
                <button onClick={async () => { await supabase.from('empresas_mestre').update({...form}).eq('cnpj', modal.lead.cnpj); setModal({ ativo: false }); sincronizar(); }} className="w-full bg-blue-600 py-5 rounded-2xl font-black uppercase shadow-lg shadow-blue-900/20">Salvar Dados</button>
              </div>
            )}
            {modal.tipo === 'gps' && (
              <div className="grid grid-cols-2 gap-4 mt-10">
                <button onClick={() => navegarGPS(modal.lead, 'maps')} className="bg-zinc-800 p-8 rounded-3xl flex flex-col items-center gap-2 font-bold uppercase text-[10px]">🗺️ Maps</button>
                <button onClick={() => navegarGPS(modal.lead, 'waze')} className="bg-zinc-800 p-8 rounded-3xl flex flex-col items-center gap-2 font-bold uppercase text-[10px]">🚙 Waze</button>
              </div>
            )}
            {modal.tipo === 'reagendar' && (
              <div className="bg-zinc-900 p-6 rounded-2xl border border-zinc-800">
                <input type="date" className="w-full bg-black p-4 rounded-xl text-white outline-none border border-zinc-800" value={form.data_reagendada} onChange={e => setForm({...form, data_reagendada: e.target.value})} />
                <button onClick={async () => { if(!form.data_reagendada) return; await supabase.from('empresas_mestre').update({ obs: (modal.lead.obs || '') + `\n[📅 Reagendado para: ${form.data_reagendada}]` }).eq('cnpj', modal.lead.cnpj); setModal({ ativo: false }); sincronizar(); }} className="w-full bg-yellow-600 py-5 rounded-2xl font-black uppercase mt-4 text-black italic">Confirmar</button>
              </div>
            )}
          </div>
        </div>
      )}

      {moduloAtivo === 'todo' && (
        <nav className="fixed bottom-6 left-6 right-6 h-20 bg-zinc-900 border border-white/10 rounded-[2.5rem] px-8 flex justify-between items-center z-50">
          {['estoque', 'triagem', 'agenda'].map(a => (
            <button key={a} onClick={() => setAba(a)} className={`text-[10px] font-black uppercase tracking-tighter ${aba === a ? 'text-blue-500 border-b border-blue-500' : 'text-zinc-600'}`}>{a === 'agenda' ? 'Meu To Do' : a}</button>
          ))}
        </nav>
      )}
    </div>
  );
}
