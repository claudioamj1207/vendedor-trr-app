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
  const [ultimosCnpjsProcessados, setUltimosCnpjsProcessados] = useState([]);
  const [ultimosCnpjsFalhados, setUltimosCnpjsFalhados] = useState([]);

  const [filtrosAtivos, setFiltrosAtivos] = useState({
    razao_social: 'Todos',
    nome_fantasia: 'Todos',
    cnpj: 'Todos',
    bairro: 'Todos',
    fonte_lead: 'Todos',
    cnae_principal_descricao: 'Todos',
    cnae_secundario: 'Todos'
  });

  const gerarIndiceBusca = (lead) => {
    return Object.values(lead)
      .map((v) => String(v || '').toLowerCase())
      .join(' ');
  };

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

  const formatarCNPJ = (cnpj) => {
    const limpo = String(cnpj || '').replace(/\D/g, '');
    if (limpo.length !== 14) return cnpj;
    return limpo.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
  };

  const normalizarCNPJ = (cnpj) => String(cnpj || '').replace(/\D/g, '');

  const processarEmLotes = async ({
    itens,
    tamanhoLote = 5,
    pausaMs = 300,
    mensagemProgresso,
    processador
  }) => {
    let sucesso = 0;
    let ultimoErro = '';
    const falhados = [];

    for (let i = 0; i < itens.length; i += tamanhoLote) {
      const lote = itens.slice(i, i + tamanhoLote);

      if (mensagemProgresso) {
        setStatusProcesso(
          mensagemProgresso(Math.min(i + lote.length, itens.length), itens.length)
        );
      }

      const resultados = await Promise.all(lote.map((item) => processador(item)));

      resultados.forEach((resultado, index) => {
        if (resultado && resultado.ok) {
          sucesso++;
        } else {
          const cnpjDoItem = lote[index];
          if (resultado && resultado.erro) {
            ultimoErro = resultado.erro;
          }
          falhados.push({
            cnpj: cnpjDoItem,
            erro: resultado?.erro || 'Falha desconhecida'
          });
        }
      });

      if (i + tamanhoLote < itens.length) {
        await new Promise((resolve) => setTimeout(resolve, pausaMs));
      }
    }

    setStatusProcesso('');
    return { sucesso, ultimoErro, falhados };
  };

  const sincronizar = async () => {
    try {
      setCarregando(true);

      const { count: totalBanco, error: erroCount } = await supabase
        .from('empresas_mestre')
        .select('*', { count: 'exact', head: true });

      if (erroCount) throw erroCount;

      setTotalAbsoluto(totalBanco || 0);

      let todosLeads = [];
      let de = 0;
      let ate = 999;
      let continua = true;

      while (continua) {
        const { data, error } = await supabase
          .from('empresas_mestre')
          .select('*')
          .eq('status_lead', aba === 'estoque' ? 'Novo' : 'Triagem')
          .order('razao_social', { ascending: true })
          .range(de, ate);

        if (error) throw error;

        const enriquecidos = (data || []).map((lead) => ({
          ...lead,
          _busca: gerarIndiceBusca(lead)
        }));

        todosLeads = [...todosLeads, ...enriquecidos];

        if (!data || data.length < 1000) {
          continua = false;
        } else {
          de += 1000;
          ate += 1000;
        }
      }

      setLeads(todosLeads);
    } catch (e) {
      console.error("Erro na sincronização:", e);
      setErroBusca(`Erro na sincronização: ${e.message || 'falha ao carregar dados.'}`);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    sincronizar();
  }, [aba]);

  const leadsFiltrados = useMemo(() => {
    const texto = buscaGlobal.toLowerCase();

    return leads.filter((lead) => {
      const matchBusca =
        !buscaGlobal ||
        (lead._busca && lead._busca.includes(texto));

      return matchBusca;
    });
  }, [leads, buscaGlobal]);

  // RESTANTE DO CÓDIGO PERMANECE IGUAL...
