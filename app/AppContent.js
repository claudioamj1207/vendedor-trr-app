"use client";
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { consultarCNPJNaBrasilAPI } from '../lib/brasilApi';
import * as XLSX from 'xlsx';

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

const FILTROS_INICIAIS = {
  razao_social: 'Todos',
  nome_fantasia: 'Todos',
  cnpj: 'Todos',
  bairro: 'Todos',
  fonte_lead: 'Todos',
  cnae_principal_descricao: 'Todos',
  cnae_secundario: 'Todos'
};

const CAMPOS_FILTRO = [
  { label: 'Razão Social', campo: 'razao_social' },
  { label: 'Nome Fantasia', campo: 'nome_fantasia' },
  { label: 'CNPJ', campo: 'cnpj' },
  { label: 'Bairro', campo: 'bairro' },
  { label: 'Fonte', campo: 'fonte_lead' },
  { label: 'CNAE Principal', campo: 'cnae_principal_descricao' }
];

const CAMPOS_COM_BUSCA_EXATA = [
  'razao_social',
  'nome_fantasia',
  'cnpj',
  'bairro',
  'fonte_lead',
  'cnae_principal_descricao'
];

const CAMPOS_COMPARACAO_POR_INCLUDES = [
  'cnae_secundario'
];

const ITENS_POR_PAGINA = 50;

const MODOS_EXPORTACAO = {
  FILTRADOS: 'filtrados',
  ESTOQUE: 'estoque',
  TRIAGEM: 'triagem',
  BANCO_COMPLETO: 'banco_completo'
};

const normalizarCNPJ = (cnpj) => String(cnpj || '').replace(/\D/g, '');

const formatarCNPJ = (cnpj) => {
  const limpo = normalizarCNPJ(cnpj);
  if (limpo.length !== 14) return cnpj;
  return limpo.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
};

const extrairCNPJsDoTexto = (texto) => {
  if (!texto) return [];

  const regex = /\d{2}[.\s,/-]?\d{3}[.\s,/-]?\d{3}[\/\s-]?\d{4}[-\s]?\d{2}|\d{14}/g;
  const encontrados = texto.match(regex) || [];

  return [
    ...new Set(
      encontrados
        .map((item) => normalizarCNPJ(item))
        .filter((cnpj) => cnpj.length === 14)
    )
  ];
};

const gerarIndiceBusca = (lead) => {
  return Object.entries(lead)
    .filter(([chave]) => chave !== '_busca')
    .map(([, valor]) => String(valor || '').toLowerCase())
    .join(' ');
};

const enriquecerLeadParaBusca = (lead) => {
  const leadBase = {
    ...lead,
    cnpj_normalizado: normalizarCNPJ(lead.cnpj)
  };

  return {
    ...leadBase,
    _busca: gerarIndiceBusca(leadBase)
  };
};

const lerArquivoComoTexto = async (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (evt) => {
      try {
        let textoBruto = '';

        if (file.name.toLowerCase().endsWith('.xlsx')) {
          const workbook = XLSX.read(evt.target.result, { type: 'binary' });
          const primeiraAba = workbook.Sheets[workbook.SheetNames[0]];
          textoBruto = JSON.stringify(XLSX.utils.sheet_to_json(primeiraAba));
        } else {
          textoBruto = evt.target.result;
        }

        resolve(textoBruto);
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => reject(new Error('Erro ao ler arquivo.'));

    if (file.name.toLowerCase().endsWith('.xlsx')) {
      reader.readAsBinaryString(file);
    } else {
      reader.readAsText(file);
    }
  });
};

function AvisoResultado({ tipo, mensagem, onFechar }) {
  if (!mensagem) return null;

  const estilos = {
    sucesso: {
      caixa: 'bg-emerald-900/30 border border-emerald-500/50 text-emerald-400',
      botao: 'bg-emerald-500/20',
      icone: '✅'
    },
    erro: {
      caixa: 'bg-red-900/30 border border-red-500/50 text-red-400',
      botao: 'bg-red-500/20',
      icone: '❌'
    }
  };

  const estilo = estilos[tipo] || estilos.sucesso;

  return (
    <div className={`${estilo.caixa} p-4 rounded-2xl mb-6 flex justify-between items-center text-xs font-bold animate-pulse gap-3`}>
      <span>{estilo.icone} {mensagem}</span>
      <button
        onClick={onFechar}
        className={`${estilo.botao} px-3 py-1 rounded-full text-[10px]`}
      >
        OK
      </button>
    </div>
  );
}

function LeadCard({ lead, onMover }) {
  return (
    <div className="py-4 px-4 flex justify-between items-center gap-3 hover:bg-zinc-800/40 transition-colors">
      <div className="flex-1 min-w-0">
        <h3 className="text-[12px] font-bold uppercase truncate text-white leading-tight">
          {lead.razao_social}
        </h3>

        <div className="flex gap-2 mt-2 flex-wrap">
          <span className="text-[8px] bg-zinc-800 px-2 py-0.5 rounded text-zinc-400 font-bold border border-white/5 uppercase">
            {lead.bairro}
          </span>

          <span className="text-[8px] bg-blue-900/20 px-2 py-0.5 rounded text-blue-400 font-bold border border-blue-500/10 uppercase">
            {lead.cnpj}
          </span>

          <span className="text-[8px] bg-orange-900/20 px-2 py-0.5 rounded text-orange-400 font-bold border border-orange-500/10 truncate max-w-[200px]">
            {lead.cnae_principal_descricao || 'SEM CNAE'}
          </span>

          {lead.cnae_secundario && (
            <span className="text-[8px] bg-zinc-900/50 px-2 py-0.5 rounded text-zinc-500 font-medium truncate max-w-[200px] italic text-white">
              Sec: {lead.cnae_secundario}
            </span>
          )}
        </div>
      </div>

      <button
        onClick={onMover}
        className="h-10 w-10 bg-blue-600 rounded-xl flex items-center justify-center text-white active:scale-95 transition-all"
      >
        ➡️
      </button>
    </div>
  );
}

function ControlesPaginacao({ paginaAtual, totalPaginas, onIrParaPagina }) {
  if (totalPaginas <= 1) return null;

  return (
    <div className="mt-6 bg-zinc-900/50 border border-white/5 rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4">
      <div className="text-[10px] text-zinc-400 font-black uppercase tracking-widest">
        Página {paginaAtual} de {totalPaginas}
      </div>

      <div className="flex items-center gap-2 flex-wrap justify-center">
        <button
          onClick={() => onIrParaPagina(1)}
          disabled={paginaAtual === 1}
          className="px-3 py-2 rounded-xl text-[10px] font-black bg-zinc-800 border border-white/10 text-white disabled:opacity-30"
        >
          Primeira
        </button>

        <button
          onClick={() => onIrParaPagina(paginaAtual - 1)}
          disabled={paginaAtual === 1}
          className="px-3 py-2 rounded-xl text-[10px] font-black bg-zinc-800 border border-white/10 text-white disabled:opacity-30"
        >
          Anterior
        </button>

        <button
          onClick={() => onIrParaPagina(paginaAtual + 1)}
          disabled={paginaAtual === totalPaginas}
          className="px-3 py-2 rounded-xl text-[10px] font-black bg-zinc-800 border border-white/10 text-white disabled:opacity-30"
        >
          Próxima
        </button>

        <button
          onClick={() => onIrParaPagina(totalPaginas)}
          disabled={paginaAtual === totalPaginas}
          className="px-3 py-2 rounded-xl text-[10px] font-black bg-zinc-800 border border-white/10 text-white disabled:opacity-30"
        >
          Última
        </button>
      </div>
    </div>
  );
}

export default function VendedorTRR_Master() {
  const [leads, setLeads] = useState([]);
  const [aba, setAba] = useState(ABAS.ESTOQUE);
  const [moduloAtivo, setModuloAtivo] = useState(MODULOS.TODO);
  const [buscaGlobal, setBuscaGlobal] = useState('');
  const [cnpjBusca, setCnpjBusca] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [statusProcesso, setStatusProcesso] = useState('');
  const [resultadoBusca, setResultadoBusca] = useState('');
  const [erroBusca, setErroBusca] = useState('');
  const [mostrarFiltros, setMostrarFiltros] = useState(false);
  const [mostrarExportacao, setMostrarExportacao] = useState(false);
  const [totalAbsoluto, setTotalAbsoluto] = useState(0);
  const [ultimosCnpjsProcessados, setUltimosCnpjsProcessados] = useState([]);
  const [ultimosCnpjsFalhados, setUltimosCnpjsFalhados] = useState([]);
  const [paginaAtual, setPaginaAtual] = useState(1);
  const [filtrosAtivos, setFiltrosAtivos] = useState(FILTROS_INICIAIS);
  const [buscaDebounced, setBuscaDebounced] = useState('');
  const [mostrarPainelExportacao, setMostrarPainelExportacao] = useState(false);
  const [mostrarPainelExportacao, setMostrarPainelExportacao] = useState(false);
  const [modoExportacao, setModoExportacao] = useState(MODOS_EXPORTACAO.FILTRADOS);
  const [exportando, setExportando] = useState(false);

  const limparMensagens = useCallback(() => {
    setResultadoBusca('');
    setErroBusca('');
  }, []);

  const resetarEstadoPescaria = useCallback(() => {
    setStatusProcesso('');
    setUltimosCnpjsProcessados([]);
    setUltimosCnpjsFalhados([]);
  }, []);

  const atualizarFiltro = useCallback((campo, valor) => {
    setFiltrosAtivos((prev) => ({
      ...prev,
      [campo]: valor
    }));
  }, []);

  const limparFiltros = useCallback(() => {
    setFiltrosAtivos(FILTROS_INICIAIS);
  }, []);

  const processarEmLotes = useCallback(async ({
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
  }, []);

  const processarCNPJ = useCallback(async (cnpj, leadExistente = {}) => {
    const cnpjLimpo = normalizarCNPJ(cnpj);

    if (cnpjLimpo.length !== 14) {
      return { ok: false, erro: 'CNPJ inválido' };
    }

    const consulta = await consultarCNPJNaBrasilAPI(cnpjLimpo);

    if (!consulta.ok) {
      return { ok: false, erro: consulta.erro };
    }

    const info = consulta.dados;

    const descSec = info.cnaes_secundarios
      ? info.cnaes_secundarios.map((c) => c.descricao).join(' | ')
      : 'Não informado';

    const { error } = await supabase
      .from('empresas_mestre')
      .upsert(
        {
          ...leadExistente,
          cnpj: cnpjLimpo,
          razao_social: info.razao_social || '',
          nome_fantasia: info.nome_fantasia || info.razao_social || '',
          logradouro: info.logradouro || '',
          numero: info.numero || '',
          bairro: info.bairro || '',
          municipio: info.municipio || '',
          uf: info.uf || '',
          cnae_principal_codigo: info.cnae_fiscal ? String(info.cnae_fiscal) : '',
          cnae_principal_descricao: info.cnae_fiscal_descricao || 'Não informado',
          cnae_secundario: descSec,
          situacao_cadastral: info.descricao_situacao_cadastral || 'ATIVA',
          status_lead: leadExistente.status_lead || STATUS_LEAD.NOVO,
          fonte_lead: leadExistente.fonte_lead || 'Busca Manual'
        },
        { onConflict: 'cnpj' }
      );

    if (error) {
      return { ok: false, erro: `Erro ao salvar no banco: ${error.message}` };
    }

    return {
      ok: true,
      situacao: info.descricao_situacao_cadastral
    };
  }, []);

  const sincronizar = useCallback(async () => {
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
          .eq(
            'status_lead',
            aba === ABAS.ESTOQUE ? STATUS_LEAD.NOVO : STATUS_LEAD.TRIAGEM
          )
          .order('razao_social', { ascending: true })
          .range(de, ate);

        if (error) throw error;

        const enriquecidos = (data || []).map(enriquecerLeadParaBusca);
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
      console.error('Erro na sincronização:', e);
      setErroBusca(`Erro na sincronização: ${e.message || 'falha ao carregar dados.'}`);
    } finally {
      setCarregando(false);
    }
  }, [aba]);

  useEffect(() => {
    sincronizar();
  }, [sincronizar]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setBuscaDebounced(buscaGlobal.trim().toLowerCase());
    }, 250);

    return () => clearTimeout(timeout);
  }, [buscaGlobal]);

  const opcoesFiltros = useMemo(() => {
    const opcoes = {};

    CAMPOS_COM_BUSCA_EXATA.forEach((campo) => {
      opcoes[campo] = ['Todos', ...new Set(leads.map((lead) => lead[campo]).filter(Boolean))].sort();
    });

    return opcoes;
  }, [leads]);

  const filtrosExatosAtivos = useMemo(() => {
    return CAMPOS_COM_BUSCA_EXATA
      .filter((campo) => filtrosAtivos[campo] !== 'Todos')
      .map((campo) => ({
        campo,
        valor: filtrosAtivos[campo]
      }));
  }, [filtrosAtivos]);

  const filtrosParciaisAtivos = useMemo(() => {
    return CAMPOS_COMPARACAO_POR_INCLUDES
      .filter((campo) => filtrosAtivos[campo] !== 'Todos')
      .map((campo) => ({
        campo,
        valor: filtrosAtivos[campo]
      }));
  }, [filtrosAtivos]);

  const leadsFiltrados = useMemo(() => {
    return leads.filter((lead) => {
      if (buscaDebounced && !(lead._busca && lead._busca.includes(buscaDebounced))) {
        return false;
      }

      for (const filtro of filtrosExatosAtivos) {
        if (lead[filtro.campo] !== filtro.valor) {
          return false;
        }
      }

      for (const filtro of filtrosParciaisAtivos) {
        if (!(lead[filtro.campo] && String(lead[filtro.campo]).includes(filtro.valor))) {
          return false;
        }
      }

      return true;
    });
  }, [leads, buscaDebounced, filtrosExatosAtivos, filtrosParciaisAtivos]);

  const totalPaginas = useMemo(() => {
    return Math.max(1, Math.ceil(leadsFiltrados.length / ITENS_POR_PAGINA));
  }, [leadsFiltrados.length]);

  const leadsPaginados = useMemo(() => {
    const inicio = (paginaAtual - 1) * ITENS_POR_PAGINA;
    const fim = inicio + ITENS_POR_PAGINA;
    return leadsFiltrados.slice(inicio, fim);
  }, [leadsFiltrados, paginaAtual]);

  const paginaInicial = useMemo(() => {
    if (leadsFiltrados.length === 0) return 0;
    return (paginaAtual - 1) * ITENS_POR_PAGINA + 1;
  }, [paginaAtual, leadsFiltrados.length]);

  const paginaFinal = useMemo(() => {
    return Math.min(paginaAtual * ITENS_POR_PAGINA, leadsFiltrados.length);
  }, [paginaAtual, leadsFiltrados.length]);

  useEffect(() => {
    setPaginaAtual(1);
  }, [buscaDebounced, filtrosAtivos, aba, moduloAtivo]);

  useEffect(() => {
    if (paginaAtual > totalPaginas) {
      setPaginaAtual(totalPaginas);
    }
  }, [paginaAtual, totalPaginas]);


  const moverLead = useCallback(async (lead) => {
    await supabase
      .from('empresas_mestre')
      .update({
        status_lead:
          aba === ABAS.ESTOQUE ? STATUS_LEAD.TRIAGEM : STATUS_LEAD.EM_PROSPECCAO
      })
      .eq('cnpj', lead.cnpj);

    await sincronizar();
  }, [aba, sincronizar]);

  const limparInativos = useCallback(async () => {
    if (!confirm(`Limpar inativos e duplicados? Isso vai verificar ${leadsFiltrados.length} lead(s) da tela e depois limpar duplicidades no banco.`)) {
      return;
    }

    limparMensagens();

    let excluidosInativos = 0;
    let excluidosDuplicados = 0;

    try {
      for (let i = 0; i < leadsFiltrados.length; i++) {
        const lead = leadsFiltrados[i];
        setStatusProcesso(`Verificando ativos ${i + 1} de ${leadsFiltrados.length}: ${lead.razao_social}`);

        const resultado = await processarCNPJ(lead.cnpj, lead);

        if (resultado && resultado.ok && resultado.situacao !== 'ATIVA') {
          await supabase.from('empresas_mestre').delete().eq('cnpj', lead.cnpj);
          excluidosInativos++;
        }

        await new Promise((r) => setTimeout(r, 450));
      }

      setStatusProcesso('Verificando duplicados no banco...');

      const { data: todosRegistros, error: erroBuscaDuplicados } = await supabase
        .from('empresas_mestre')
        .select('id, cnpj')
        .order('id', { ascending: true });

      if (erroBuscaDuplicados) {
        throw erroBuscaDuplicados;
      }

      if (!todosRegistros || todosRegistros.length === 0) {
        setStatusProcesso('');
        setResultadoBusca(`Limpeza concluída: ${excluidosInativos} inativo(s) removido(s) e 0 duplicado(s) removido(s).`);
        await sincronizar();
        return;
      }

      const semId = todosRegistros.some((item) => item.id === undefined || item.id === null);
      if (semId) {
        throw new Error('A tabela empresas_mestre precisa ter a coluna id para limpar duplicados com segurança.');
      }

      const mapa = new Map();
      const idsParaExcluir = [];

      for (const registro of todosRegistros) {
        const cnpjNormalizado = normalizarCNPJ(registro.cnpj);

        if (!cnpjNormalizado || cnpjNormalizado.length !== 14) {
          continue;
        }

        if (!mapa.has(cnpjNormalizado)) {
          mapa.set(cnpjNormalizado, registro.id);
        } else {
          idsParaExcluir.push(registro.id);
        }
      }

      if (idsParaExcluir.length > 0) {
        for (let i = 0; i < idsParaExcluir.length; i += 100) {
          const loteIds = idsParaExcluir.slice(i, i + 100);

          setStatusProcesso(`Removendo duplicados ${Math.min(i + loteIds.length, idsParaExcluir.length)} de ${idsParaExcluir.length}...`);

          const { error: erroDeleteDuplicados } = await supabase
            .from('empresas_mestre')
            .delete()
            .in('id', loteIds);

          if (erroDeleteDuplicados) {
            throw erroDeleteDuplicados;
          }
        }

        excluidosDuplicados = idsParaExcluir.length;
      }

      setStatusProcesso('');
      setResultadoBusca(
        `Limpeza concluída: ${excluidosInativos} inativo(s) removido(s) e ${excluidosDuplicados} duplicado(s) removido(s).`
      );

      await sincronizar();
    } catch (err) {
      console.error('Erro na limpeza:', err);
      setStatusProcesso('');
      setErroBusca(`Erro na limpeza: ${err.message || 'falha ao limpar registros.'}`);
    }
  }, [leadsFiltrados, limparMensagens, processarCNPJ, sincronizar]);

  const atualizarFaltantes = useCallback(async () => {
    limparMensagens();

    const { data: faltantes, error } = await supabase
      .from('empresas_mestre')
      .select('*')
      .or('cnae_principal_descricao.is.null,cnae_secundario.is.null,cnae_principal_descricao.eq.""');

    if (error) {
      setErroBusca(`Erro ao localizar faltantes: ${error.message}`);
      return;
    }

    if (!faltantes || faltantes.length === 0) {
      alert('Dados completos!');
      return;
    }

    if (!confirm(`Atualizar ${faltantes.length} leads?`)) {
      return;
    }

    for (let i = 0; i < faltantes.length; i++) {
      const lead = faltantes[i];
      setStatusProcesso(`Atualizando ${i + 1} de ${faltantes.length}`);
      await processarCNPJ(lead.cnpj, lead);
      await new Promise((r) => setTimeout(r, 450));
    }

    setStatusProcesso('');
    setResultadoBusca(`${faltantes.length} lead(s) reprocessado(s).`);
    await sincronizar();
  }, [limparMensagens, processarCNPJ, sincronizar]);

  const extrairEPesquisar = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    limparMensagens();
    setUltimosCnpjsProcessados([]);
    setUltimosCnpjsFalhados([]);
    setStatusProcesso('Lendo arquivo...');

    try {
      const textoBruto = await lerArquivoComoTexto(file);
      const cnpjs = extrairCNPJsDoTexto(textoBruto);

      if (cnpjs.length === 0) {
        setStatusProcesso('');
        setErroBusca('Nenhum CNPJ válido foi encontrado no arquivo.');
        return;
      }

      setUltimosCnpjsProcessados(cnpjs);

      const { sucesso, ultimoErro, falhados } = await processarEmLotes({
        itens: cnpjs,
        tamanhoLote: 5,
        pausaMs: 300,
        mensagemProgresso: (processados, total) =>
          `Processando arquivo: ${processados} de ${total}...`,
        processador: async (cnpj) =>
          processarCNPJ(cnpj, { fonte_lead: `Arquivo: ${file.name}` })
      });

      setUltimosCnpjsFalhados(falhados);

      if (sucesso === 0 && ultimoErro) {
        setErroBusca(`Erro no processamento: ${ultimoErro}`);
      } else if (ultimoErro) {
        setResultadoBusca(`Arquivo concluído: ${sucesso} empresa(s) salva(s). Falha em ${falhados.length} CNPJ(s).`);
      } else {
        setResultadoBusca(`Arquivo concluído: ${sucesso} empresa(s) salva(s).`);
      }

      await sincronizar();
    } catch (err) {
      setStatusProcesso('');
      setErroBusca('Erro ao ler o arquivo.');
    } finally {
      e.target.value = '';
    }
  }, [limparMensagens, processarEmLotes, processarCNPJ, sincronizar]);

  const buscarECadastrarCNPJs = useCallback(async () => {
    limparMensagens();
    setUltimosCnpjsFalhados([]);

    const cnpjs = extrairCNPJsDoTexto(cnpjBusca);

    if (cnpjs.length === 0) {
      setErroBusca('Nenhum CNPJ válido foi encontrado no texto digitado.');
      return;
    }

    setUltimosCnpjsProcessados(cnpjs);

    const { sucesso, ultimoErro, falhados } = await processarEmLotes({
      itens: cnpjs,
      tamanhoLote: 5,
      pausaMs: 300,
      mensagemProgresso: (processados, total) =>
        `Processando ${processados} de ${total}...`,
      processador: async (cnpj) =>
        processarCNPJ(cnpj, { fonte_lead: 'Busca Manual' })
    });

    setUltimosCnpjsFalhados(falhados);

    if (sucesso === 0 && ultimoErro) {
      setErroBusca(`Nenhum CNPJ foi salvo. Motivo: ${ultimoErro}`);
      return;
    }

    if (ultimoErro) {
      setResultadoBusca(`Salvos ${sucesso} de ${cnpjs.length}. Falha em ${falhados.length} CNPJ(s).`);
    } else {
      setResultadoBusca(`Sucesso: ${sucesso} CNPJ(s) salvo(s).`);
    }

    setCnpjBusca('');
    await sincronizar();
  }, [cnpjBusca, limparMensagens, processarEmLotes, processarCNPJ, sincronizar]);

  const trocarModulo = useCallback((modulo) => {
    setModuloAtivo(modulo);
    limparMensagens();
    resetarEstadoPescaria();
  }, [limparMensagens, resetarEstadoPescaria]);

  const irParaPagina = useCallback((pagina) => {
    if (pagina < 1 || pagina > totalPaginas) return;
    setPaginaAtual(pagina);
  }, [totalPaginas]);

  const buscarLeadsPorStatus = useCallback(async (statusLead) => {
    let todos = [];
    let de = 0;
    let ate = 999;
    let continua = true;

    while (continua) {
      const { data, error } = await supabase
        .from('empresas_mestre')
        .select('*')
        .eq('status_lead', statusLead)
        .order('razao_social', { ascending: true })
        .range(de, ate);

      if (error) throw error;

      todos = [...todos, ...(data || [])];

      if (!data || data.length < 1000) {
        continua = false;
      } else {
        de += 1000;
        ate += 1000;
      }
    }

    return todos;
  }, []);

  const buscarTodosDoBanco = useCallback(async () => {
    let todos = [];
    let de = 0;
    let ate = 999;
    let continua = true;

    while (continua) {
      const { data, error } = await supabase
        .from('empresas_mestre')
        .select('*')
        .order('razao_social', { ascending: true })
        .range(de, ate);

      if (error) throw error;

      todos = [...todos, ...(data || [])];

      if (!data || data.length < 1000) {
        continua = false;
      } else {
        de += 1000;
        ate += 1000;
      }
    }

    return todos;
  }, []);

  const prepararDadosParaExportacao = useCallback((lista) => {
    return lista.map((lead) => ({
      'Razão Social': lead.razao_social || '',
      'Nome Fantasia': lead.nome_fantasia || '',
      'CNPJ': formatarCNPJ(lead.cnpj || ''),
      'CNPJ Limpo': normalizarCNPJ(lead.cnpj || ''),
      'Logradouro': lead.logradouro || '',
      'Número': lead.numero || '',
      'Bairro': lead.bairro || '',
      'Município': lead.municipio || '',
      'UF': lead.uf || '',
      'Fonte do Lead': lead.fonte_lead || '',
      'CNAE Principal': lead.cnae_principal_descricao || '',
      'CNAE Secundário': lead.cnae_secundario || '',
      'Situação Cadastral': lead.situacao_cadastral || '',
      'Status do Lead': lead.status_lead || ''
    }));
  }, []);

  const exportarLeads = useCallback(async () => {
    try {
      setExportando(true);
      limparMensagens();

      let dadosBrutos = [];
      let nomeArquivo = 'leads';

      if (modoExportacao === MODOS_EXPORTACAO.FILTRADOS) {
        dadosBrutos = leadsFiltrados;
        nomeArquivo = `leads-filtrados-${aba}`;
      }

      if (modoExportacao === MODOS_EXPORTACAO.ESTOQUE) {
        dadosBrutos = await buscarLeadsPorStatus(STATUS_LEAD.NOVO);
        nomeArquivo = 'leads-estoque';
      }

      if (modoExportacao === MODOS_EXPORTACAO.TRIAGEM) {
        dadosBrutos = await buscarLeadsPorStatus(STATUS_LEAD.TRIAGEM);
        nomeArquivo = 'leads-triagem';
      }

      if (modoExportacao === MODOS_EXPORTACAO.BANCO_COMPLETO) {
        dadosBrutos = await buscarTodosDoBanco();
        nomeArquivo = 'leads-banco-completo';
      }

      if (!dadosBrutos || dadosBrutos.length === 0) {
        setErroBusca('Nenhum lead encontrado para exportar.');
        return;
      }

      const dadosPlanilha = prepararDadosParaExportacao(dadosBrutos);
      const worksheet = XLSX.utils.json_to_sheet(dadosPlanilha);
      const workbook = XLSX.utils.book_new();

      XLSX.utils.book_append_sheet(workbook, worksheet, 'Leads');
      XLSX.writeFile(workbook, `${nomeArquivo}.xlsx`);

      setResultadoBusca(`${dadosBrutos.length} lead(s) exportado(s) com sucesso.`);
      setMostrarPainelExportacao(false);
    } catch (error) {
      console.error('Erro ao exportar leads:', error);
      setErroBusca(`Erro ao exportar leads: ${error.message || 'falha na exportação.'}`);
    } finally {
      setExportando(false);
    }
  }, [aba, buscarLeadsPorStatus, buscarTodosDoBanco, leadsFiltrados, limparMensagens, modoExportacao, prepararDadosParaExportacao]);

  return (
    <div className="min-h-screen bg-black text-white pb-40 font-sans antialiased">
      <header className="px-5 pt-8 pb-4 sticky top-0 bg-black/95 border-b border-white/5 z-50">
        <div className="flex justify-between items-center mb-2">
          <h1 className="text-[10px] font-black text-blue-500 uppercase italic tracking-widest">
            Vendedor TRR
          </h1>

          <div className="flex gap-3 text-[9px] font-bold uppercase">
            {[MODULOS.TODO, MODULOS.PESCARIA].map((m) => (
              <button
                key={m}
                onClick={() => trocarModulo(m)}
                className={
                  moduloAtivo === m
                    ? 'text-white border-b border-blue-500'
                    : 'text-zinc-600'
                }
              >
                {m === MODULOS.TODO ? 'LISTA' : 'PESCARIA DE CNPJ'}
              </button>
            ))}
          </div>
        </div>

        <div className="flex justify-between items-center gap-3">
          <h2 className="text-3xl font-black italic uppercase tracking-tighter text-white">
            {moduloAtivo === MODULOS.TODO
              ? aba === ABAS.TRIAGEM
                ? 'Triagem'
                : 'Estoque'
              : 'Pescaria de CNPJ'}
          </h2>

          <div className="flex gap-2 flex-wrap justify-end">
            {moduloAtivo === MODULOS.TODO && (
              <>
                <button
                  onClick={limparInativos}
                  className="text-[9px] bg-red-600 px-4 py-2 rounded-full font-bold"
                >
                  🗑️ LIMPAR
                </button>

                <button
                  onClick={atualizarFaltantes}
                  className="text-[9px] bg-emerald-600 px-4 py-2 rounded-full font-bold"
                >
                  🔄 ENRIQUECER
                </button>
              </>
            )}

            <button
              onClick={() => setMostrarPainelExportacao(!mostrarPainelExportacao)}
              className="text-[9px] bg-blue-700 px-4 py-2 rounded-full font-bold border border-blue-400/20"
            >
              {exportando ? 'EXPORTANDO...' : 'EXPORTAR'}
            </button>

            <button
              onClick={() => setMostrarPainelExportacao(!mostrarPainelExportacao)}
              className="text-[9px] bg-blue-700 px-4 py-2 rounded-full font-bold border border-blue-400/20"
            >
              EXPORTAR
            </button>

            <button
              onClick={() => setMostrarExportacao(!mostrarExportacao)}
              className="text-[9px] bg-blue-700 px-4 py-2 rounded-full font-bold border border-blue-400/20"
            >
              EXPORTAR
            </button>

            <button
              onClick={() => setMostrarFiltros(!mostrarFiltros)}
              className="text-[9px] bg-zinc-800 px-4 py-2 rounded-full font-bold border border-white/10"
            >
              FILTROS
            </button>
          </div>
        </div>

        {moduloAtivo === MODULOS.TODO && (
          <div className="mt-4 space-y-3">
            <input
              type="text"
              placeholder="Busca rápida..."
              className="w-full bg-zinc-900 p-3 rounded-xl text-xs outline-none border border-zinc-800 text-white"
              value={buscaGlobal}
              onChange={(e) => setBuscaGlobal(e.target.value)}
            />

            {mostrarPainelExportacao && (
              <div className="p-4 bg-zinc-900 rounded-2xl border border-blue-500/10 space-y-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-blue-400 mb-3">
                    Exportação de Leads
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <label className="flex items-center gap-2 text-[11px] text-white">
                      <input
                        type="radio"
                        name="modo-exportacao"
                        value={MODOS_EXPORTACAO.FILTRADOS}
                        checked={modoExportacao === MODOS_EXPORTACAO.FILTRADOS}
                        onChange={(e) => setModoExportacao(e.target.value)}
                      />
                      Leads filtrados da tela
                    </label>

                    <label className="flex items-center gap-2 text-[11px] text-white">
                      <input
                        type="radio"
                        name="modo-exportacao"
                        value={MODOS_EXPORTACAO.ESTOQUE}
                        checked={modoExportacao === MODOS_EXPORTACAO.ESTOQUE}
                        onChange={(e) => setModoExportacao(e.target.value)}
                      />
                      Todos do estoque
                    </label>

                    <label className="flex items-center gap-2 text-[11px] text-white">
                      <input
                        type="radio"
                        name="modo-exportacao"
                        value={MODOS_EXPORTACAO.TRIAGEM}
                        checked={modoExportacao === MODOS_EXPORTACAO.TRIAGEM}
                        onChange={(e) => setModoExportacao(e.target.value)}
                      />
                      Todos da triagem
                    </label>

                    <label className="flex items-center gap-2 text-[11px] text-white">
                      <input
                        type="radio"
                        name="modo-exportacao"
                        value={MODOS_EXPORTACAO.BANCO_COMPLETO}
                        checked={modoExportacao === MODOS_EXPORTACAO.BANCO_COMPLETO}
                        onChange={(e) => setModoExportacao(e.target.value)}
                      />
                      Todo o banco de dados
                    </label>
                  </div>
                </div>

                <div className="flex gap-2 flex-wrap">
                  <button
                    onClick={exportarLeads}
                    disabled={exportando}
                    className="text-[10px] bg-emerald-600 px-4 py-2 rounded-full font-bold disabled:opacity-50"
                  >
                    {exportando ? 'GERANDO XLSX...' : 'CONFIRMAR EXPORTAÇÃO'}
                  </button>

                  <button
                    onClick={() => setMostrarPainelExportacao(false)}
                    disabled={exportando}
                    className="text-[10px] bg-zinc-800 px-4 py-2 rounded-full font-bold border border-white/10 disabled:opacity-50"
                  >
                    FECHAR
                  </button>
                </div>
              </div>
            )}

            {mostrarPainelExportacao && (
              <div className="p-4 bg-zinc-900 rounded-2xl border border-blue-500/10">
                <p className="text-[10px] font-black uppercase tracking-widest text-blue-400">
                  Painel de exportação em preparação
                </p>
              </div>
            )}

            {mostrarExportacao && (
              <div className="p-4 bg-zinc-900 rounded-2xl border border-blue-500/10">
                <p className="text-[10px] font-black uppercase tracking-widest text-blue-400">
                  Exportação em breve
                </p>
              </div>
            )}

            {mostrarFiltros && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 p-4 bg-zinc-900 rounded-2xl border border-white/5">
                {CAMPOS_FILTRO.map((filtro) => (
                  <div key={filtro.campo} className="flex flex-col gap-1">
                    <label className="text-[9px] font-black text-zinc-500 uppercase ml-1">
                      {filtro.label}
                    </label>

                    <select
                      value={filtrosAtivos[filtro.campo]}
                      onChange={(e) => atualizarFiltro(filtro.campo, e.target.value)}
                      className="bg-zinc-800 text-[11px] p-2.5 rounded-lg text-white outline-none"
                    >
                      {(opcoesFiltros[filtro.campo] || ['Todos']).map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}

                <button
                  onClick={limparFiltros}
                  className="lg:col-span-3 text-[9px] font-bold text-red-500 uppercase py-2 bg-red-500/10 rounded-lg"
                >
                  Limpar Filtros
                </button>
              </div>
            )}

            <div className="flex justify-between items-center px-1 gap-3 flex-wrap">
              <div className="flex gap-4 items-center flex-wrap">
                <p className="text-[10px] text-zinc-400 font-black uppercase tracking-widest">
                  {totalAbsoluto} CNPJs no banco
                </p>

                <p className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">
                  {leadsFiltrados.length} na tela
                </p>

                {!carregando && buscaGlobal !== buscaDebounced && (
                  <p className="text-[10px] text-blue-500 font-black uppercase tracking-widest animate-pulse">
                    Atualizando busca...
                  </p>
                )}

                {!carregando && leadsFiltrados.length > 0 && (
              <ControlesPaginacao
                paginaAtual={paginaAtual}
                totalPaginas={totalPaginas}
                onIrParaPagina={irParaPagina}
              />
            )}
          </>
        )}

        {moduloAtivo === MODULOS.PESCARIA && (
          <div className="max-w-3xl mx-auto space-y-8">
            <div className="bg-zinc-900 p-8 rounded-3xl border border-dashed border-zinc-800 text-center">
              <h3 className="text-lg font-black uppercase mb-3 text-white">Upload de arquivo</h3>
              <p className="text-[11px] text-zinc-500 mb-4">
                Envie Excel (.xlsx), texto (.txt) ou PDF textual para pescar CNPJs.
              </p>

              <input
                type="file"
                onChange={extrairEPesquisar}
                className="text-xs mb-4 w-full text-zinc-400"
              />

              {statusProcesso && (
                <p className="mt-4 text-blue-500 text-[10px] animate-pulse font-bold uppercase">
                  {statusProcesso}
                </p>
              )}
            </div>

            <div className="max-w-3xl mx-auto space-y-4 text-white">
              <h3 className="text-lg font-black uppercase text-white">Colar texto ou lista</h3>
              <p className="text-[11px] text-zinc-500">
                Cole CNPJs com ou sem máscara, ou até texto misturado.
              </p>

              <textarea
                placeholder="Cole os CNPJs aqui..."
                className="w-full bg-zinc-900 p-4 rounded-2xl text-sm h-40 outline-none border border-zinc-800 text-white"
                value={cnpjBusca}
                onChange={(e) => setCnpjBusca(e.target.value)}
              />

              <button
                onClick={buscarECadastrarCNPJs}
                className="w-full bg-blue-600 py-4 rounded-2xl font-black uppercase text-sm text-white shadow-lg active:scale-95 transition-all"
              >
                PESCAR E SALVAR
              </button>
            </div>

            {ultimosCnpjsProcessados.length > 0 && (
              <div className="bg-zinc-900/70 border border-white/5 rounded-3xl p-6">
                <div className="flex justify-between items-center mb-4 gap-4">
                  <h3 className="text-lg font-black uppercase text-white">
                    Última pesquisa
                  </h3>
                  <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
                    {ultimosCnpjsProcessados.length} CNPJ(s)
                  </span>
                </div>

                <div className="flex flex-wrap gap-2">
                  {ultimosCnpjsProcessados.map((cnpj) => (
                    <span
                      key={cnpj}
                      className="text-[10px] bg-blue-900/20 px-3 py-2 rounded-full text-blue-300 font-bold border border-blue-500/10"
                    >
                      {formatarCNPJ(cnpj)}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {ultimosCnpjsFalhados.length > 0 && (
              <div className="bg-red-900/20 border border-red-500/20 rounded-3xl p-6">
                <div className="flex justify-between items-center mb-4 gap-4">
                  <h3 className="text-lg font-black uppercase text-red-300">
                    CNPJs com falha
                  </h3>
                  <span className="text-[10px] font-black uppercase tracking-widest text-red-200">
                    {ultimosCnpjsFalhados.length} falha(s)
                  </span>
                </div>

                <div className="space-y-2">
                  {ultimosCnpjsFalhados.map((item) => (
                    <div
                      key={`${item.cnpj}-${item.erro}`}
                      className="bg-black/20 border border-red-500/10 rounded-2xl px-4 py-3"
                    >
                      <p className="text-[11px] font-black text-red-200">
                        {formatarCNPJ(item.cnpj)}
                      </p>
                      <p className="text-[10px] text-red-300/80 mt-1">
                        {item.erro}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      <nav className="fixed bottom-6 left-6 right-6 h-16 bg-zinc-900/90 backdrop-blur-md border border-white/10 rounded-full px-8 flex justify-around items-center z-50 shadow-2xl">
        {[ABAS.ESTOQUE, ABAS.TRIAGEM].map((a) => (
          <button
            key={a}
            onClick={() => setAba(a)}
            className={`text-[11px] font-black uppercase tracking-widest ${
              aba === a ? 'text-blue-500' : 'text-zinc-600'
            }`}
          >
            {a}
          </button>
        ))}
      </nav>
    </div>
  );
}
