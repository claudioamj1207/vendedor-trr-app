"use client";
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { consultarCNPJNaBrasilAPI } from '../lib/brasilApi';
import * as XLSX from 'xlsx';

export default function VendedorTRR_Master() {
  const [leads, setLeads] = useState([]);
  const [aba, setAba] = useState('estoque');
  const [moduloAtivo, setModuloAtivo] = useState('todo');
  const [buscaGlobal, setBuscaGlobal] = useState('');
  const [cnpjBusca, setCnpjBusca] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [statusProcesso, setStatusProcesso] = useState('');
  const [resultadoBusca, setResultadoBusca] = useState('');
  const [erroBusca, setErroBusca] = useState('');
  const [mostrarFiltros, setMostrarFiltros] = useState(false);
  const [totalAbsoluto, setTotalAbsoluto] = useState(0);

  const [filtrosAtivos, setFiltrosAtivos] = useState({
    razao_social: 'Todos',
    nome_fantasia: 'Todos',
    cnpj: 'Todos',
    bairro: 'Todos',
    fonte_lead: 'Todos',
    cnae_principal_descricao: 'Todos',
    cnae_secundario: 'Todos'
  });

  const extrairCNPJsDoTexto = (texto) => {
    if (!texto) return [];

    const regex = /\d{2}[.\s,/-]?\d{3}[.\s,/-]?\d{3}[\/\s-]?\d{4}[-\s]?\d{2}|\d{14}/g;
    const encontrados = texto.match(regex) || [];

    return [
      ...new Set(
        encontrados
          .map((item) => String(item).replace(/\D/g, ''))
          .filter((cnpj) => cnpj.length === 14)
      )
    ];
  };

  const sincronizar = async () => {
    try {
      setCarregando(true);

      const { count } = await supabase
        .from('empresas_mestre')
        .select('*', { count: 'exact', head: true });

      setTotalAbsoluto(count || 0);

      const { data } = await supabase
        .from('empresas_mestre')
        .select('*')
        .eq('status_lead', aba === 'estoque' ? 'Novo' : 'Triagem')
        .order('razao_social', { ascending: true });

      setLeads(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    sincronizar();
  }, [aba]);

  const leadsFiltrados = useMemo(() => {
    return leads.filter((lead) => {
      const texto = buscaGlobal.toLowerCase();
      return !buscaGlobal || Object.values(lead).some(v =>
        String(v || '').toLowerCase().includes(texto)
      );
    });
  }, [leads, buscaGlobal]);

  const processarCNPJ = async (cnpj, leadExistente = {}) => {
    const cnpjLimpo = String(cnpj).replace(/\D/g, '');
    if (cnpjLimpo.length !== 14) return { ok: false };

    const consulta = await consultarCNPJNaBrasilAPI(cnpjLimpo);
    if (!consulta.ok) return { ok: false, erro: consulta.erro };

    const info = consulta.dados;

    const { error } = await supabase.from('empresas_mestre').upsert({
      ...leadExistente,
      cnpj: cnpjLimpo,
      razao_social: info.razao_social,
      nome_fantasia: info.nome_fantasia || info.razao_social,
      bairro: info.bairro,
      municipio: info.municipio,
      uf: info.uf,
      cnae_principal_descricao: info.cnae_fiscal_descricao,
      situacao_cadastral: info.descricao_situacao_cadastral,
      status_lead: 'Novo'
    }, { onConflict: 'cnpj' });

    if (error) return { ok: false };

    return { ok: true };
  };

  // 🚀 NOVA FUNÇÃO OTIMIZADA
  const buscarECadastrarCNPJs = async () => {
    setResultadoBusca('');
    setErroBusca('');

    const cnpjs = extrairCNPJsDoTexto(cnpjBusca);

    if (cnpjs.length === 0) {
      setErroBusca('Nenhum CNPJ válido encontrado.');
      return;
    }

    const TAMANHO_LOTE = 5;
    let sucesso = 0;

    for (let i = 0; i < cnpjs.length; i += TAMANHO_LOTE) {
      const lote = cnpjs.slice(i, i + TAMANHO_LOTE);

      setStatusProcesso(`Processando ${i + lote.length} de ${cnpjs.length}`);

      const resultados = await Promise.all(
        lote.map(cnpj => processarCNPJ(cnpj, { fonte_lead: 'Busca Manual' }))
      );

      resultados.forEach(r => {
        if (r && r.ok) sucesso++;
      });

      await new Promise(r => setTimeout(r, 300));
    }

    setStatusProcesso('');
    setResultadoBusca(`Salvos ${sucesso} CNPJs`);
    setCnpjBusca('');
    sincronizar();
  };

  return (
    <div className="p-6 text-white bg-black min-h-screen">
      <h1 className="text-xl mb-4">Vendedor TRR</h1>

      <textarea
        value={cnpjBusca}
        onChange={(e) => setCnpjBusca(e.target.value)}
        className="w-full p-3 bg-zinc-900 mb-4"
        placeholder="Cole CNPJs"
      />

      <button onClick={buscarECadastrarCNPJs} className="bg-blue-600 px-4 py-2">
        PESCAR
      </button>

      <p className="mt-4">{statusProcesso}</p>
      <p>{resultadoBusca}</p>

      <div className="mt-6">
        {leadsFiltrados.map(l => (
          <div key={l.cnpj}>{l.razao_social}</div>
        ))}
      </div>
    </div>
  );
}
