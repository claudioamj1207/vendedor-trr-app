"use client";
import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

// Conexão com o seu banco de dados
const supabase = createClient("https://qswmodzcsdkjmdzgxtlo.supabase.co", "sb_publishable_lWTV-2xQxwJlIAEn-zj_vg_z75OgB4k");

export default function VendedorTRR_Master() {
  const [leads, setLeads] = useState([]);
  const [aba, setAba] = useState('agenda'); 
  const [moduloAtivo, setModuloAtivo] = useState('todo'); 
  const [busca, setBusca] = useState('');
  const [cnpjBusca, setCnpjBusca] = useState('');
  const [carregando, setCarregando] = useState(true);
  
  // Controle de janelas (modais) e formulário de dados
  const [modal, setModal] = useState({ ativo: false, tipo: '', lead: null }); 
  const [form, setForm] = useState({ 
    contato: '', telefone: '', email: '', ie: '', im: '', endereco_obra: '', obs: '', data_reagendada: '' 
  });

  // Função que busca os dados no Supabase
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
      if (data) setLeads(data || []);
    } finally { 
      setCarregando(false); 
    }
  };

  // Sincroniza sempre que você troca de aba
  useEffect(() => { sincronizar(); }, [aba, moduloAtivo]);

  // Prepara a janela flutuante com os dados do cliente
  const abrirModal = (tipo, lead) => {
    setForm({ 
      contato: lead.contato || '', 
      telefone: lead.telefone || '', 
      email: lead.email || '',
      ie: lead.ie || '', 
      im: lead.im || '', 
      endereco_obra: lead.endereco_obra || '', 
      obs: lead.obs || '', 
      data_reagendada: '' 
    });
    setModal({ ativo: true, tipo, lead });
  };

  // Função do Botão 4: Foto (Captura GPS e salva como observação)
  const registrarLogFoto = async (lead) => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(async (pos) => {
        const log = `\n[📸 Foto batida em: ${new Date().toLocaleString('pt-BR')} | Coordenadas: ${pos.coords.latitude.toFixed(4)},${pos.coords.longitude.toFixed(4)}]`;
        const novaObs = (lead.obs || '') + log;
        await supabase.from('empresas_mestre').update({ obs: novaObs }).eq('cnpj', lead.cnpj);
        alert("Registro de foto e localização salvo no banco de dados!");
        sincronizar();
      }, () => {
        alert("Por favor, ative o GPS do celular para registrar o local da foto.");
      });
    } else {
      alert("Seu dispositivo não suporta captura de GPS.");
    }
  };

  // Função do Botão 5: GPS (Abre Google Maps ou Waze)
  const navegarGPS = (lead, app) => {
    const destino = encodeURIComponent(`${lead.razao_social}, ${lead.bairro || ''}, Manaus`);
    const url = app === 'waze' 
      ? `https://waze.com/ul?q=${destino}` 
      : `https://www.google.com/maps/search/?api=1&query=${destino}`;
    window.open(url, '_blank');
  };

  // Função do Botão 7: Gerar PDF de Cadastro
  const imprimirPDF = (lead) => {
    const win = window.open('', '', 'width=800,height=800');
    win.document.write(`
      <html>
        <body style="font-family: Arial, sans-serif; padding: 40px; color: #000;">
          <h2 style="text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px;">SOLICITAÇÃO DE CADASTRO TRR</h2>
          <div style="margin-top: 30px; line-height: 1.8;">
            <p><strong>RAZÃO SOCIAL:</strong> ${lead.razao_social}</p>
            <p><strong>CNPJ:</strong> ${lead.cnpj}</p>
            <p><strong>ENDEREÇO (RECEITA FEDERAL):</strong> ${lead.logradouro ? `${lead.logradouro}, ${lead.numero || 'S/N'} - ${lead.bairro || ''}` : '---'}</p>
            <p><strong>CONTATO:</strong> ${lead.contato || '---'}</p>
            <p><strong>TELEFONE:</strong> ${lead.telefone || '---'}</p>
            <p><strong>E-MAIL:</strong> ${lead.email || '---'}</p>
            <p><strong>INSC. ESTADUAL:</strong> ${lead.ie || '---'}</p>
            <p><strong>INSC. MUNICIPAL:</strong> ${lead.im || '---'}</p>
            <p><strong>ENDEREÇO DE OBRA (LOCAL DE ENTREGA):</strong> ${lead.endereco_obra || '---'}</p>
            <p><strong>OBSERVAÇÕES:</strong> ${lead.obs || '---'}</p>
          </div>
          <p style="margin-top: 50px; font-size: 12px; color: #666;">Gerado em ${new Date().toLocaleString('pt-BR')}</p>
        </body>
      </html>
    `);
    win.document.close(); 
    win.print();
  };

  return (
    <div className="min-h-screen bg-black text-white pb-40 font-sans antialiased">
      
      {/* CABEÇALHO COM NAVEGAÇÃO SUPERIOR */}
      <header className="px-5 pt-8 pb-4 sticky top-0 bg-black/95 border-b border-white/5 z-50">
        <div className="flex justify-between items-center mb-2">
          <h1 className="text-[10px] font-black text-blue-500 uppercase tracking-[0.3em] italic">Vendedor TRR System</h1>
          <div className="flex gap-3">
            {['radar', 'todo', 'arquivo', 'cnpj'].map(m => (
              <button key={m} onClick={() => setModuloAtivo(m)} className={`text-[9px] font-bold uppercase transition-all ${moduloAtivo === m ? 'text-white border-b-2 border-blue-500 pb-1' : 'text-zinc-600'}`}>
                {m}
              </button>
            ))}
          </div>
        </div>
        <h2 className="text-3xl font-black italic uppercase tracking-tighter">
          {moduloAtivo === 'cnpj' ? 'Busca CNPJ' : (aba === 'agenda' ? 'Meu To Do' : aba === 'triagem' ? 'Triagem' : 'Estoque')}
        </h2>
        
        {/* BARRA DE PESQUISA */}
        {moduloAtivo === 'cnpj' ? (
          <div className="flex gap-2 mt-2">
            <input type="text" placeholder="Digite o CNPJ..." className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-sm outline-none text-white" value={cnpjBusca} onChange={e => setCnpjBusca(e.target.value)} />
            <button onClick={sincronizar} className="bg-blue-600 px-4 rounded-xl font-black text-[10px]">BUSCAR</button>
          </div>
        ) : (
          <input type="text" placeholder="Filtrar por nome ou bairro..." className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl py-3 px-4 mt-2 text-sm outline-none text-white focus:ring-1 focus:ring-blue-500 transition-all" value={busca} onChange={e => setBusca(e.target.value)} />
        )}
      </header>

      {/* LISTA DE CLIENTES E MICRO BOTÕES */}
      <main className="px-4 mt-6 space-y-3">
        {carregando ? <div className="text-center py-20 text-zinc-800 text-[10px] font-black animate-pulse uppercase">Sincronizando...</div> :
        leads.filter(l => (l.razao_social?.toLowerCase() || "").includes(busca.toLowerCase())).map(lead => (
          <div key={lead.cnpj} className="bg-zinc-900/40 border border-zinc-800/50 p-4 rounded-[1.5rem]">
            <h3 className="text-[13px] font-bold uppercase truncate">{lead.razao_social}</h3>
            <p className="text-zinc-500 text-[9px] font-black uppercase mb-3 tracking-tighter">{lead.bairro || 'AM'} • {lead.cnpj}</p>
            
            <div className="flex flex-wrap gap-1.5 mt-2">
              <button title="Info" onClick={() => abrirModal('info', lead)} className="h-6 w-8 bg-zinc-800 rounded flex items-center justify-center text-[10px] hover:bg-zinc-700 transition-colors">ℹ️</button>
              <button title="Incrementar" onClick={() => abrirModal('incrementar', lead)} className="h-6 w-8 bg-zinc-800 rounded flex items-center justify-center text-[10px] hover:bg-zinc-700 transition-colors">➕</button>
              <button title="Áudio" onClick={() => abrirModal('audio', lead)} className="h-6 w-8 bg-zinc-800 rounded flex items-center justify-center text-[10px] hover:bg-zinc-700 transition-colors">🎙️</button>
              <label className="h-6 w-8 bg-zinc-800 rounded flex items-center justify-center text-[10px] hover:bg-zinc-700 transition-colors cursor-pointer">
                📸<input type="file" accept="image/*" capture="environment" className="hidden" onChange={() => registrarLogFoto(lead)} />
              </label>
              <button title="GPS" onClick={() => abrirModal('gps', lead)} className="h-6 w-8 bg-zinc-800 rounded flex items-center justify-center text-[10px] hover:bg-zinc-700 transition-colors">📍</button>
              <button title="Reagendar" onClick={() => abrirModal('reagendar', lead)} className="h-6 w-8 bg-zinc-800 rounded flex items-center justify-center text-[10px] hover:bg-zinc-700 transition-colors">📅</button>
              <button title="Cadastro" onClick={() => imprimirPDF(lead)} className="h-6 w-8 bg-zinc-800 rounded flex items-center justify-center text-[10px] hover:bg-zinc-700 transition-colors">📝</button>
              <button title="Concluir" onClick={async () => { await supabase.from('empresas_mestre').update({status_lead: 'Viável'}).eq('cnpj', lead.cnpj); sincronizar(); }} className="h-6 w-8 bg-white rounded flex items-center justify-center text-[10px] text-black shadow-sm hover:bg-gray-200 transition-colors">✅</button>
            </div>
          </div>
        ))}
      </main>

      {/* ÁREA DE JANELAS FLUTUANTES (MODAIS) */}
      {modal.ativo && (
        <div className="fixed inset-0 bg-black/95 z-[100] flex flex-col p-6 overflow-y-auto backdrop-blur-sm font-sans">
          
          <div className="flex justify-between items-center mb-6 border-b border-zinc-800 pb-4">
            <h3 className="text-xl font-black italic uppercase text-blue-500">
              {modal.tipo === 'info' && 'Ficha Rápida'}
              {modal.tipo === 'incrementar' && 'Completar Cadastro'}
              {modal.tipo === 'gps' && 'Navegação GPS'}
              {modal.tipo === 'reagendar' && 'Reagendar Visita'}
              {modal.tipo === 'audio' && 'Registrar Áudio'}
            </h3>
            <button onClick={() => setModal({ ativo: false, tipo: '', lead: null })} className="text-zinc-500 font-bold uppercase text-[10px] p-2">Fechar [X]</button>
          </div>

          <div className="space-y-4 pb-20">
            
            {/* TELA 1: INFORMAÇÕES (AGORA COM ENDEREÇO DA RECEITA E OBRA/ENTREGA) */}
            {modal.tipo === 'info' && (
              <div className="bg-zinc-900 p-5 rounded-2xl border border-zinc-800 text-sm space-y-3">
                <p><strong className="text-blue-500 block text-[10px] uppercase">Razão Social:</strong> {modal.lead.razao_social}</p>
                <p><strong className="text-blue-500 block text-[10px] uppercase">CNPJ:</strong> {modal.lead.cnpj}</p>
                <p><strong className="text-blue-500 block text-[10px] uppercase">Endereço (Receita Federal):</strong> {modal.lead.logradouro ? `${modal.lead.logradouro}, ${modal.lead.numero || 'S/N'} - ${modal.lead.bairro || ''} - ${modal.lead.municipio || 'Manaus'}/${modal.lead.uf || 'AM'}` : 'Não informado na base'}</p>
                <p><strong className="text-blue-500 block text-[10px] uppercase">Endereço de Obra (Local de Entrega):</strong> {modal.lead.endereco_obra || 'Não informado'}</p>
                <p><strong className="text-blue-500 block text-[10px] uppercase">Contato Registrado:</strong> {modal.lead.contato || 'Não informado'}</p>
                <p><strong className="text-blue-500 block text-[10px] uppercase">Telefone:</strong> {modal.lead.telefone || 'Não informado'}</p>
                
                <div className="mt-4 p-3 bg-black/50 rounded-lg">
                  <strong className="text-blue-500 block text-[10px] uppercase mb-1">Histórico de Observações:</strong> 
                  <p className="whitespace-pre-wrap text-zinc-300 text-xs">{modal.lead.obs || 'Nenhuma visita ou anotação registrada ainda.'}</p>
                </div>
              </div>
            )}

            {/* TELA 2: INCREMENTAR DADOS COMPLETOS (LABEL AJUSTADA PARA LOCAL DE ENTREGA) */}
            {modal.tipo === 'incrementar' && (
              <>
                <input type="text" placeholder="Nome do Contato" className="w-full bg-zinc-900 border border-zinc-800 p-4 rounded-xl text-sm text-white outline-none focus:border-blue-500 transition-colors" value={form.contato} onChange={e => setForm({...form, contato: e.target.value})} />
                
                <div className="grid grid-cols-2 gap-2">
                  <input type="text" placeholder="Telefone" className="w-full bg-zinc-900 border border-zinc-800 p-4 rounded-xl text-sm text-white outline-none focus:border-blue-500 transition-colors" value={form.telefone} onChange={e => setForm({...form, telefone: e.target.value})} />
                  <input type="email" placeholder="E-mail" className="w-full bg-zinc-900 border border-zinc-800 p-4 rounded-xl text-sm text-white outline-none focus:border-blue-500 transition-colors" value={form.email} onChange={e => setForm({...form, email: e.target.value})} />
                </div>
                
                <div className="grid grid-cols-2 gap-2">
                  <input type="text" placeholder="Insc. Estadual (I.E.)" className="w-full bg-zinc-900 border border-zinc-800 p-4 rounded-xl text-sm text-white outline-none focus:border-blue-500 transition-colors" value={form.ie} onChange={e => setForm({...form, ie: e.target.value})} />
                  <input type="text" placeholder="Insc. Municipal (I.M.)" className="w-full bg-zinc-900 border border-zinc-800 p-4 rounded-xl text-sm text-white outline-none focus:border-blue-500 transition-colors" value={form.im} onChange={e => setForm({...form, im: e.target.value})} />
                </div>
                
                <input type="text" placeholder="Endereço de Obra (Local de Entrega)" className="w-full bg-zinc-900 border border-zinc-800 p-4 rounded-xl text-sm text-white outline-none focus:border-blue-500 transition-colors" value={form.endereco_obra} onChange={e => setForm({...form, endereco_obra: e.target.value})} />
                
                <textarea placeholder="Observações e notas sobre o cliente..." className="w-full bg-zinc-900 border border-zinc-800 p-4 rounded-xl text-sm text-white h-32 outline-none focus:border-blue-500 transition-colors" value={form.obs} onChange={e => setForm({...form, obs: e.target.value})} />
                
                <button onClick={async () => {
                  await supabase.from('empresas_mestre').update({...form}).eq('cnpj', modal.lead.cnpj);
                  setModal({ ativo: false, tipo: '', lead: null });
                  sincronizar();
                  alert("Dados salvos com sucesso!");
                }} className="w-full bg-blue-600 py-5 rounded-2xl font-black uppercase italic tracking-widest active:bg-blue-700 transition-all">Salvar no Banco de Dados</button>
              </>
            )}

            {/* TELA 5: NAVEGAÇÃO GPS */}
            {modal.tipo === 'gps' && (
              <div className="grid grid-cols-2 gap-4 mt-10">
                <button onClick={() => navegarGPS(modal.lead, 'maps')} className="bg-zinc-900 border border-zinc-800 p-8 rounded-3xl flex flex-col items-center gap-4 active:scale-95 transition-all">
                  <span className="text-4xl">🗺️</span><span className="font-black text-[10px] uppercase text-zinc-300">Google Maps</span>
                </button>
                <button onClick={() => navegarGPS(modal.lead, 'waze')} className="bg-zinc-900 border border-zinc-800 p-8 rounded-3xl flex flex-col items-center gap-4 active:scale-95 transition-all">
                  <span className="text-4xl">🚙</span><span className="font-black text-[10px] uppercase text-zinc-300">Waze</span>
                </button>
              </div>
            )}

            {/* TELA 6: REAGENDAMENTO */}
            {modal.tipo === 'reagendar' && (
              <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl">
                <label className="text-[10px] font-black text-zinc-500 uppercase mb-2 block">Escolha a nova data para visita</label>
                <input type="date" className="w-full bg-black border border-zinc-800 p-4 rounded-xl text-sm text-white outline-none focus:border-yellow-500 transition-colors" value={form.data_reagendada} onChange={e => setForm({...form, data_reagendada: e.target.value})} />
                <button onClick={async () => {
                  if(!form.data_reagendada) return alert("Selecione uma data primeiro.");
                  const log = `\n[📅 Reagendado para: ${form.data_reagendada}]`;
                  await supabase.from('empresas_mestre').update({ obs: (modal.lead.obs || '') + log }).eq('cnpj', modal.lead.cnpj);
                  setModal({ ativo: false, tipo: '', lead: null });
                  sincronizar();
                }} className="w-full bg-yellow-600 py-5 rounded-2xl font-black uppercase italic tracking-widest text-black mt-6 active:bg-yellow-700 transition-colors">Confirmar Data</button>
              </div>
            )}

            {/* TELA 3: ÁUDIO */}
            {modal.tipo === 'audio' && (
              <div className="flex flex-col items-center justify-center py-12 gap-8 bg-zinc-900 border border-zinc-800 rounded-2xl">
                <button onClick={async () => {
                  const log = `\n[🎙️ Visita falada registrada em: ${new Date().toLocaleString('pt-BR')}]`;
                  await supabase.from('empresas_mestre').update({ obs: (modal.lead.obs || '') + log }).eq('cnpj', modal.lead.cnpj);
                  setModal({ ativo: false, tipo: '', lead: null });
                  sincronizar();
                  alert("Registro de áudio salvo no histórico!");
                }} className="w-24 h-24 bg-red-600 rounded-full text-4xl shadow-lg shadow-red-600/30 active:scale-90 transition-all flex items-center justify-center">
                  🎙️
                </button>
                <p className="text-zinc-400 text-xs text-center px-4">Aperte o botão acima para registrar<br/>no sistema que você realizou uma visita.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* RODAPÉ COM ABAS DE NAVEGAÇÃO */}
      <nav className="fixed bottom-6 left-6 right-6 h-20 bg-zinc-900 border border-white/10 rounded-[2.5rem] px-8 flex justify-between items-center z-50 shadow-2xl">
        {['estoque', 'triagem', 'agenda'].map(a => (
          <button key={a} onClick={() => setAba(a)} className={`text-[10px] font-black uppercase tracking-tighter transition-colors ${aba === a ? 'text-blue-500' : 'text-zinc-600'}`}>
            {a === 'agenda' ? 'Meu To Do' : a}
          </button>
        ))}
      </nav>
      
    </div>
  );
}