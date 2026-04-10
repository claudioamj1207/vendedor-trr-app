"use client";
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { consultarCNPJNaBrasilAPI } from '../lib/brasilApi';
import * as XLSX from 'xlsx';
import LeadVisualModal from '../components/LeadVisualModal';
import TriagemLeadRow from '../components/TriagemLeadRow';

const STATUS_LEAD = {
  NOVO: 'Novo',
  TRIAGEM: 'Triagem',
  EM_PROSPECCAO: 'Em Prospecção'
};

const MODULOS = {
  TODO: 'todo',
  PESCARIA: 'pescaria'
};

const ABAS = {
  ESTOQUE: 'estoque',
  TRIAGEM: 'triagem'
};

const ITENS_POR_PAGINA = 50;

const normalizarCNPJ = (cnpj) => String(cnpj || '').replace(/\D/g, '');

const formatarCNPJ = (cnpj) => {
  const limpo = normalizarCNPJ(cnpj);
  if (limpo.length !== 14) return cnpj;
  return limpo.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
};
export default function VendedorTRR_Master() {
  const [leads, setLeads] = useState([]);
  const [aba, setAba] = useState(ABAS.ESTOQUE);
  const [moduloAtivo, setModuloAtivo] = useState(MODULOS.TODO);
  const [buscaGlobal, setBuscaGlobal] = useState('');
  const [paginaAtual, setPaginaAtual] = useState(1);
  const [leadVisualizando, setLeadVisualizando] = useState(null);

  const sincronizar = useCallback(async () => {
    const { data } = await supabase
      .from('empresas_mestre')
      .select('*')
      .order('razao_social', { ascending: true });

    setLeads(data || []);
  }, []);

  useEffect(() => {
    sincronizar();
  }, [sincronizar]);

  const leadsFiltrados = useMemo(() => {
    if (!buscaGlobal) return leads;
    return leads.filter(l =>
      JSON.stringify(l).toLowerCase().includes(buscaGlobal.toLowerCase())
    );
  }, [leads, buscaGlobal]);

  const totalPaginas = Math.ceil(leadsFiltrados.length / ITENS_POR_PAGINA);

  const leadsPaginados = useMemo(() => {
    const inicio = (paginaAtual - 1) * ITENS_POR_PAGINA;
    return leadsFiltrados.slice(inicio, inicio + ITENS_POR_PAGINA);
  }, [leadsFiltrados, paginaAtual]);

  const moverLead = async (lead) => {
    await supabase
      .from('empresas_mestre')
      .update({ status_lead: STATUS_LEAD.TRIAGEM })
      .eq('cnpj', lead.cnpj);

    sincronizar();
  };
    return (
    <div className="min-h-screen bg-black text-white p-4">

      <input
        value={buscaGlobal}
        onChange={(e) => setBuscaGlobal(e.target.value)}
        placeholder="Buscar..."
        className="w-full p-3 bg-zinc-900 rounded-xl mb-4"
      />

      {leadVisualizando && (
        <LeadVisualModal
          lead={leadVisualizando}
          onClose={() => setLeadVisualizando(null)}
        />
      )}

      <div className="space-y-2">
        {leadsPaginados.map((lead) => (
          aba === ABAS.TRIAGEM ? (
            <TriagemLeadRow
              key={lead.cnpj}
              lead={lead}
              onVisualizar={setLeadVisualizando}
              onIncrementar={() => alert('incrementar')}
              onCadastrar={() => alert('pdf')}
              onMesaDeTrabalho={moverLead}
              onEstoque={() => alert('estoque')}
              onDeletar={() => alert('deletar')}
            />
          ) : (
            <div key={lead.cnpj} className="bg-zinc-900 p-3 rounded-xl flex justify-between">
              <span>{lead.razao_social}</span>
              <button onClick={() => moverLead(lead)}>➡️</button>
            </div>
          )
        ))}
      </div>

    </div>
  );
}
