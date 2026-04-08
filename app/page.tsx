"use client";
import React, { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';

const supabase = createClient("https://qswmodzcsdkjmdzgxtlo.supabase.co", "sb_publishable_lWTV-2xQxwJlIAEn-zj_vg_z75OgB4k");

export default function VendedorTRR_Master() {
  const [leads, setLeads] = useState([]);
  const [aba, setAba] = useState('agenda'); 
  const [moduloAtivo, setModuloAtivo] = useState('todo'); 
  const [busca, setBusca] = useState('');
  const [cnpjBusca, setCnpjBusca] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [statusProcesso, setStatusProcesso] = useState('');

  const [gravando, setGravando] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  const [modal, setModal] = useState({ ativo: false, tipo: '', lead: null }); 
  const [form, setForm] = useState({ 
    contato: '', telefone: '', email: '', ie: '', im: '', endereco_obra: '', obs: '', data_reagendada: '' 
  });

  const sincronizar = async () => {
    try {
      setCarregando(true);
      let query = supabase.from('empresas_mestre').select('*');
      if (moduloAtivo === 'todo') {
        if (aba === 'estoque') query = query.eq('status_lead', 'Novo');
        if (aba === 'triagem') query = query.eq('status_lead', 'Triagem');
        if (aba === 'agenda')  query = query.eq('status_lead', 'Em Prospecção');
      } else if (moduloAtivo === 'cnpj' && cnpjBusca) {
        query = query.eq('cnpj', cnpjBusca.replace(/\D/g, ''));
      }
      const { data } = await query.order('razao_social', { ascending: true });
      setLeads(data || []);
    } finally { setCarregando(false); }
  };

  useEffect(() => { sincronizar(); }, [aba, moduloAtivo]);

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
      } else { textoBruto = evt.target.result; }
      const cnpjsEncontrados = textoBruto.match(/\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/g) || textoBruto.match(/\d{14}/g) || [];
      const cnpjsUnicos = [...new Set(cnpjsEncontrados)];
      setStatusProcesso(`Pescando ${cnpjsUnicos.length} empresas...`);
      for (const cnpj of cnpjsUnicos) { await processarCNPJ(cnpj); }
      setStatusProcesso('Concluído!');
      sincronizar();
    };
    if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) reader.readAsBinaryString(file);
    else reader.readAsText(file);
  };

  const abrirModal = (tipo, lead) => {
    setForm({ 
      contato: lead.contato || '', telefone: lead.telefone || '', email: lead.email || '', 
      ie: lead.ie || '', im: lead.im || '', endereco_obra: lead.endereco_obra || '', 
      obs: lead.obs || '', data_reagendada: '' 
    });
    setModal({ ativo: true, tipo, lead });
  };

  const alternarGravacao = async (lead) => {
    if (!gravando) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorderRef.current = new MediaRecorder(stream);
        audioChunksRef.current = [];
        mediaRecorderRef.current.ondataavailable = (e) => audioChunksRef.current.push(e.data);
        mediaRecorderRef.current.onstop = async () => {
          const blob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
          const formData = new FormData();
          formData.append('file', blob, 'audio.wav');
          formData.append('model', 'whisper-1');
          const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${process.env.NEXT_PUBLIC_OPENAI_API_KEY}` },
            body: formData
          });
          const data = await res.json();
          if (data.text) {
            await supabase.from('empresas_mestre').update({ obs: (lead.obs || '') + `\n[🎙️ ${new Date().toLocaleString()}]: ${data.text}` }).eq('cnpj', lead.cnpj);
            sincronizar();
          }
        };
        mediaRecorderRef.current.start();
        setGravando(true);
      } catch (err) { alert("Microfone erro"); }
    } else { mediaRecorderRef.current.stop(); setGravando(false); }
  };

  const imprimirPDF = (lead) => {
    const win = window.open('', '', 'width=800,height=800');
    win.document.write(`<html><body style="font-family:Arial;padding:40px;"><h2>CADASTRO TRR</h2><p><strong>RAZÃO:</strong> ${lead.razao_social}</p><p><strong>CNPJ:</strong> ${lead.cnpj}</p><p><strong>CONTATO:</strong> ${lead.contato}</p><p><strong>OBRA:</strong> ${lead.endereco_obra}</p></body></html>`);
    win.document.close(); win.print();
  };

  return (
    <div className="min-h-screen bg-black text-white pb-40 font-sans antialiased">
      <header className="px-5 pt-8 pb-4 sticky top-0 bg-black/95 border-b border-white/5 z-50">
        <div className="flex justify-between items-center mb-2">
          <h1 className="text-[10px] font-black text-blue-500 uppercase italic">Vendedor TRR System</h1>
          <div className="flex gap-3">
            {['radar', 'todo', 'arquivo', 'cnpj'].map(m => (
              <button key={m} onClick={() => setModuloAtivo(m)} className={`text-[9px] font-bold uppercase ${moduloAtivo === m ? 'text-white border-b-2 border-blue-500 pb-1' : 'text-zinc-600'}`}>{m}</button>
            ))}
          </div>
        </div>
        <h2 className="text-3xl font-black italic uppercase tracking-tighter">
          {moduloAtivo === 'arquivo' ? 'Pescador' : (moduloAtivo === 'cnpj' ? 'Buscar' : (aba === 'agenda' ? 'Meu To Do' : aba === 'triagem' ? 'Triagem' : 'Estoque'))}
        </h2>
      </header>

      <main className="px-4 mt-6">
        {moduloAtivo === 'arquivo' && (
          <div className="bg-zinc-900 p-8 rounded-3xl border border-dashed border-zinc-800 text-center">
            <input type="file" onChange={extrairEPesquisar} className="text-xs mb-4" />
            {statusProcesso && <p className="mt-4 text-blue-500 text-[10px] animate-pulse font-bold">{statusProcesso}</p>}
          </div>
        )}

        {moduloAtivo === 'cnpj' && (
          <div className="space-y-4">
            <textarea placeholder="Cole CNPJs..." className="w-full bg-zinc-900 p-4 rounded-2xl text-sm h-32 outline-none border border-zinc-800" onChange={(e) => setCnpjBusca(e.target.value)} />
            <button onClick={() => { (cnpjBusca.match(/\d{14}/g) || []).forEach(processarCNPJ); sincronizar(); }} className="w-full bg-blue-600 py-4 rounded-2xl font-black uppercase">Processar</button>
          </div>
        )}

        {(moduloAtivo === 'todo' || moduloAtivo === 'radar') && (
          <div className="space-y-3">
            {leads.filter(l => (l.razao_social?.toLowerCase() || "").includes(busca.toLowerCase())).map(lead => (
              <div key={lead.cnpj} className="bg-zinc-900/40 border border-zinc-800/50 p-4 rounded-[1.5rem]">
                <h3 className="text-[13px] font-bold uppercase truncate">{lead.razao_social}</h3>
                <p className="text-zinc-500 text-[9px] mb-3">{lead.bairro} • {lead.cnpj}</p>
                <div className="flex flex-wrap gap-1.5">
                  <button onClick={() => abrirModal('info', lead)} className="h-6 w-8 bg-zinc-800 rounded flex items-center justify-center text-[10px]">ℹ️</button>
                  <button onClick={() => abrirModal('incrementar', lead)} className="h-6 w-8 bg-zinc-800 rounded flex items-center justify-center text-[10px]">➕</button>
                  <button onClick={() => abrirModal('audio', lead)} className="h-6 w-8 bg-zinc-800 rounded flex items-center justify-center text-[10px]">🎙️</button>
                  <button onClick={() => imprimirPDF(lead)} className="h-6 w-8 bg-zinc-800 rounded flex items-center justify-center text-[10px]">📝</button>
                  {aba === 'estoque' && moduloAtivo === 'todo' && <button onClick={async () => { await supabase.from('empresas_mestre').update({status_lead: 'Triagem'}).eq('cnpj', lead.cnpj); sincronizar(); }} className="h-6 w-8 bg-blue-600 rounded flex items-center justify-center text-[10px]">➡️</button>}
                  {aba === 'triagem' && moduloAtivo === 'todo' && <button onClick={async () => { await supabase.from('empresas_mestre').update({status_lead: 'Em Prospecção'}).eq('cnpj', lead.cnpj); sincronizar(); }} className="h-6 w-8 bg-orange-600 rounded flex items-center justify-center text-[10px]">➡️</button>}
                  <button onClick={async () => { await supabase.from('empresas_mestre').update({status_lead: 'Viável'}).eq('cnpj', lead.cnpj); sincronizar(); }} className="h-6 w-8 bg-white rounded flex items-center justify-center text-[10px] text-black shadow-sm">✅</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {modal.ativo && (
        <div className="fixed inset-0 bg-black/95 z-[100] flex flex-col p-6 overflow-y-auto">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-black uppercase text-blue-500">{modal.tipo}</h3>
            <button onClick={() => setModal({ ativo: false })} className="text-[10px]">FECHAR [X]</button>
          </div>
          <div className="space-y-4">
            {modal.tipo === 'info' && (
              <div className="bg-zinc-900 p-5 rounded-2xl text-sm space-y-3">
                <p><strong className="text-blue-500 block text-[10px] uppercase">Razão:</strong> {modal.lead.razao_social}</p>
                <p><strong className="text-blue-500 block text-[10px] uppercase">CNPJ:</strong> {modal.lead.cnpj}</p>
                <p><strong className="text-blue-500 block text-[10px] uppercase">Insc. Est / Mun:</strong> {modal.lead.ie || '---'} / {modal.lead.im || '---'}</p>
                <p><strong className="text-blue-500 block text-[10px] uppercase">Contato / Tel:</strong> {modal.lead.contato || '---'} / {modal.lead.telefone || '---'}</p>
                <p><strong className="text-blue-500 block text-[10px] uppercase">E-mail:</strong> {modal.lead.email || '---'}</p>
                <p><strong className="text-blue-500 block text-[10px] uppercase">Obra:</strong> {modal.lead.endereco_obra || '---'}</p>
                <div className="mt-4 p-3 bg-black/50 rounded-lg text-xs whitespace-pre-wrap">{modal.lead.obs || 'Sem notas.'}</div>
              </div>
            )}
            {modal.tipo === 'incrementar' && (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <input type="text" placeholder="I.E." className="bg-zinc-900 p-4 rounded-xl" value={form.ie} onChange={e => setForm({...form, ie: e.target.value})} />
                  <input type="text" placeholder="I.M." className="bg-zinc-900 p-4 rounded-xl" value={form.im} onChange={e => setForm({...form, im: e.target.value})} />
                </div>
                <input type="text" placeholder="Contato" className="w-full bg-zinc-900 p-4 rounded-xl" value={form.contato} onChange={e => setForm({...form, contato: e.target.value})} />
                <div className="grid grid-cols-2 gap-2">
                  <input type="text" placeholder="Telefone" className="bg-zinc-900 p-4 rounded-xl" value={form.telefone} onChange={e => setForm({...form, telefone: e.target.value})} />
                  <input type="text" placeholder="E-mail" className="bg-zinc-900 p-4 rounded-xl" value={form.email} onChange={e => setForm({...form, email: e.target.value})} />
                </div>
                <input type="text" placeholder="Local da Obra" className="w-full bg-zinc-900 p-4 rounded-xl" value={form.endereco_obra} onChange={e => setForm({...form, endereco_obra: e.target.value})} />
                <textarea placeholder="Obs..." className="w-full bg-zinc-900 p-4 rounded-xl h-32" value={form.obs} onChange={e => setForm({...form, obs: e.target.value})} />
                <button onClick={async () => { await supabase.from('empresas_mestre').update({...form}).eq('cnpj', modal.lead.cnpj); setModal({ ativo: false }); sincronizar(); }} className="w-full bg-blue-600 py-5 rounded-2xl font-black">SALVAR</button>
              </>
            )}
            {modal.tipo === 'audio' && (
              <div className="flex flex-col items-center py-12 bg-zinc-900 rounded-2xl">
                <button onClick={() => alternarGravacao(modal.lead)} className={`w-24 h-24 rounded-full text-4xl ${gravando ? 'bg-red-600 animate-pulse' : 'bg-zinc-700'}`}>{gravando ? '⏹️' : '🎙️'}</button>
              </div>
            )}
          </div>
        </div>
      )}

      {moduloAtivo === 'todo' && (
        <nav className="fixed bottom-6 left-6 right-6 h-20 bg-zinc-900 border border-white/10 rounded-[2.5rem] px-8 flex justify-between items-center z-50">
          {['estoque', 'triagem', 'agenda'].map(a => (
            <button key={a} onClick={() => setAba(a)} className={`text-[10px] font-black uppercase ${aba === a ? 'text-blue-500' : 'text-zinc-600'}`}>{a === 'agenda' ? 'Meu To Do' : a}</button>
          ))}
        </nav>
      )}
    </div>
  );
}
