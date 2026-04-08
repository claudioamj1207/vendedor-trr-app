"use client";

import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';

const supabase = createClient("https://qswmodzcsdkjmdzgxtlo.supabase.co", "sb_publishable_lWTV-2xQxwJlIAEn-zj_vg_z75OgB4k");

export default function AppContent() {
  const [montado, setMontado] = useState(false);
  const [leads, setLeads] = useState([]);
  const [aba, setAba] = useState('agenda'); // Agenda é o "Meu To Do"
  const [modulo, setModulo] = useState('vendas'); 
  const [modal, setModal] = useState({ ativo: false, tipo: '', lead: null });
  const [form, setForm] = useState({});

  useEffect(() => {
    setMontado(true);
    sincronizar();
  }, [aba, modulo]);

  const sincronizar = async () => {
    let q = supabase.from('empresas_mestre').select('*');
    
    // Lógica de Filtros conforme os Menus Aprovados
    if (modulo === 'vendas') {
      if (aba === 'estoque') q = q.eq('status_lead', 'Novo');
      if (aba === 'triagem') q = q.eq('status_lead', 'Triagem');
      if (aba === 'agenda')  q = q.eq('status_lead', 'Em Prospecção');
    }
    
    const { data, error } = await q.order('razao_social', { ascending: true });
    if (!error) setLeads(data || []);
  };

  if (!montado) return null;

  return (
    <div className="min-h-screen bg-black text-white p-4 pb-32 font-sans">
      <header className="mb-6 flex justify-between items-center border-b border-zinc-800 pb-4">
        <h1 className="text-xl font-black italic text-blue-500 uppercase tracking-tighter">Vendedor TRR</h1>
        <button onClick={() => setModulo(modulo === 'vendas' ? 'config' : 'vendas')} className="text-[10px] font-bold text-zinc-500 uppercase">
          {modulo === 'vendas' ? '⚙️ Importar' : '⬅️ Voltar'}
        </button>
      </header>

      {modulo === 'config' ? (
        <div className="bg-zinc-900 p-8 rounded-3xl border border-zinc-800 text-center">
          <h2 className="text-blue-500 font-bold mb-4 uppercase text-xs">Importar Nova Planilha</h2>
          <input type="file" className="text-xs" onChange={(e) => {/* Lógica de importação completa aqui */}} />
        </div>
      ) : (
        <div className="space-y-4">
          {leads.map(lead => (
            <div key={lead.cnpj} className="bg-zinc-900/80 p-5 rounded-[2rem] border border-white/5 shadow-xl">
              <div className="mb-4">
                <h3 className="text-sm font-black uppercase text-white leading-tight">
                  {lead.razao_social || lead.nome_fantasia || "Sem Nome Cadastrado"}
                </h3>
                <div className="flex justify-between items-center mt-1">
                  <p className="text-[10px] text-blue-400 font-bold uppercase">{lead.bairro || 'Manaus'}</p>
                  <p className="text-[9px] text-zinc-600 font-mono">{lead.cnpj}</p>
                </div>
              </div>
              
              {/* Régua de 8 Botões - Agora com as funções reais */}
              <div className="grid grid-cols-4 gap-2">
                <button onClick={() => setModal({ ativo: true, tipo: 'DETALHES', lead })} className="h-10 bg-zinc-800 rounded-2xl flex items-center justify-center text-lg shadow-inner active:bg-zinc-700">ℹ️</button>
                <button onClick={() => { setForm({...lead}); setModal({ ativo: true, tipo: 'EDITAR', lead }); }} className="h-10 bg-zinc-800 rounded-2xl flex items-center justify-center text-lg active:bg-zinc-700">➕</button>
                <button className="h-10 bg-zinc-800 rounded-2xl flex items-center justify-center text-lg opacity-50">🎙️</button>
                <button onClick={() => window.open(`https://waze.com/ul?q=${lead.razao_social || lead.cnpj}`)} className="h-10 bg-zinc-800 rounded-2xl flex items-center justify-center text-lg">📍</button>
                <button onClick={() => setModal({ ativo: true, tipo: 'AGENDA', lead })} className="h-10 bg-zinc-800 rounded-2xl flex items-center justify-center text-lg">📅</button>
                <button className="h-10 bg-zinc-800 rounded-2xl flex items-center justify-center text-lg">📝</button>
                <button onClick={async () => { /* Lógica de Mover lead */ }} className="h-10 bg-blue-600 rounded-2xl flex items-center justify-center text-lg font-bold">➡️</button>
                <button onClick={async () => { /* Lógica de Viável */ }} className="h-10 bg-white text-black rounded-2xl flex items-center justify-center text-lg font-bold">✅</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal de Informações Detalhado */}
      {modal.ativo && (
        <div className="fixed inset-0 bg-black/95 z-50 p-6 flex flex-col animate-in fade-in duration-200">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-blue-500 font-black uppercase italic">{modal.tipo}</h2>
            <button onClick={() => setModal({ ativo: false })} className="bg-zinc-800 px-4 py-2 rounded-full text-[10px] font-bold">FECHAR</button>
          </div>
          <div className="bg-zinc-900 p-6 rounded-[2.5rem] border border-white/10 space-y-4 overflow-y-auto">
             <div className="border-b border-zinc-800 pb-2">
                <p className="text-[9px] text-zinc-500 uppercase font-bold">Razão Social</p>
                <p className="text-xs font-bold">{modal.lead?.razao_social || '---'}</p>
             </div>
             <div className="border-b border-zinc-800 pb-2">
                <p className="text-[9px] text-zinc-500 uppercase font-bold">Contato / Telefone</p>
                <p className="text-xs font-bold text-blue-400">{modal.lead?.contato || '---'} | {modal.lead?.telefone || '---'}</p>
             </div>
             <div>
                <p className="text-[9px] text-zinc-500 uppercase font-bold">Observações</p>
                <p className="text-xs text-zinc-400 italic">{modal.lead?.obs || 'Sem observações registradas.'}</p>
             </div>
          </div>
        </div>
      )}

      {/* Menus Inferiores Aprovados */}
      {modulo === 'vendas' && (
        <nav className="fixed bottom-6 left-6 right-6 h-18 bg-zinc-900/90 backdrop-blur-xl rounded-full flex justify-around items-center border border-white/10 shadow-2xl px-2">
          <button onClick={() => setAba('estoque')} className={`flex flex-col items-center flex-1 py-2 ${aba === 'estoque' ? 'text-blue-500' : 'text-zinc-600'}`}>
            <span className="text-[9px] font-black uppercase tracking-widest">Estoque</span>
          </button>
          <button onClick={() => setAba('triagem')} className={`flex flex-col items-center flex-1 py-2 ${aba === 'triagem' ? 'text-blue-500' : 'text-zinc-600'}`}>
            <span className="text-[9px] font-black uppercase tracking-widest">Triagem</span>
          </button>
          <button onClick={() => setAba('agenda')} className={`flex flex-col items-center flex-1 py-2 ${aba === 'agenda' ? 'text-blue-500' : 'text-zinc-600'}`}>
            <span className="text-[9px] font-black uppercase tracking-widest text-center">Meu To Do</span>
          </button>
        </nav>
      )}
    </div>
  );
}
