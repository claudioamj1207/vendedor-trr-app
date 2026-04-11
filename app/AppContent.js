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

const ITENS_POR_PAGINA = 50;

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

const valorTexto = (valor, fallback = '') => {
  if (valor === null || valor === undefined) return fallback;
  const texto = String(valor).trim();
  return texto === '' ? fallback : texto;
};

const valorNumeroTexto = (valor, fallback = '') => {
  if (valor === null || valor === undefined) return fallback;
  return String(valor).trim();
};

const formatarNaturezaJuridica = (codigo, descricao) => {
  const cod = valorNumeroTexto(codigo, '');
  const desc = valorTexto(descricao, '');

  if (cod && desc) return `${cod} - ${desc}`;
  return desc || cod || '';
};

const formatarCapitalSocial = (valor) => {
  if (valor === null || valor === undefined || valor === '') return '';
  return String(valor);
};

const montarPayloadReceitaSeguro = (leadExistente = {}, info = {}, fontePadrao = 'Busca Manual') => {
  const descSec = Array.isArray(info.cnaes_secundarios) && info.cnaes_secundarios.length > 0
    ? info.cnaes_secundarios
        .map((c) => c?.descricao)
        .filter(Boolean)
        .join(' | ')
    : 'Não informado';

  const payloadBase = {
    ...leadExistente,
    cnpj: valorNumeroTexto(info.cnpj, normalizarCNPJ(leadExistente.cnpj)),
    razao_social: valorTexto(info.razao_social, leadExistente.razao_social || ''),
    nome_fantasia: valorTexto(
      info.nome_fantasia,
      leadExistente.nome_fantasia || info.razao_social || ''
    ),
    logradouro: valorTexto(info.logradouro, leadExistente.logradouro || ''),
    numero: valorTexto(info.numero, leadExistente.numero || ''),
    bairro: valorTexto(info.bairro, leadExistente.bairro || ''),
    municipio: valorTexto(info.municipio, leadExistente.municipio || ''),
    uf: valorTexto(info.uf, leadExistente.uf || ''),
    cnae_principal_codigo: info.cnae_fiscal ? String(info.cnae_fiscal) : (leadExistente.cnae_principal_codigo || ''),
    cnae_principal_descricao: valorTexto(
      info.cnae_fiscal_descricao,
      leadExistente.cnae_principal_descricao || 'Não informado'
    ),
    cnae_secundario: descSec,
    situacao_cadastral: valorTexto(
      info.descricao_situacao_cadastral,
      leadExistente.situacao_cadastral || 'ATIVA'
    ),
    status_lead: leadExistente.status_lead || STATUS_LEAD.NOVO,
    fonte_lead: leadExistente.fonte_lead || fontePadrao
  };

  const colunasExistentesNoLead = new Set(Object.keys(leadExistente || {}));

  const mapaOpcionalReceita = {
    descricao_tipo_de_logradouro: info.descricao_tipo_de_logradouro,
    complemento: info.complemento,
    cep: info.cep,
    ddd_telefone_1: info.ddd_telefone_1,
    telefone_1: info.telefone_1,
    ddd_telefone_2: info.ddd_telefone_2,
    telefone_2: info.telefone_2,
    ddd_fax: info.ddd_fax,
    fax: info.fax,
    email: info.email,
    porte: info.porte,
    porte_empresa: info.porte,
    natureza_juridica: formatarNaturezaJuridica(
      info.codigo_natureza_juridica,
      info.natureza_juridica
    ),
    codigo_natureza_juridica: info.codigo_natureza_juridica,
    data_inicio_atividade: info.data_inicio_atividade,
    capital_social: formatarCapitalSocial(info.capital_social),
    descricao_identificador_matriz_filial: info.descricao_identificador_matriz_filial,
    identificador_matriz_filial: info.identificador_matriz_filial,
    razao_social_responsavel_federativo: info.razao_social_responsavel_federativo,
    codigo_municipio_ibge: info.codigo_municipio_ibge,
    codigo_pais: info.codigo_pais,
    pais: info.pais,
    qsa: Array.isArray(info.qsa) ? JSON.stringify(info.qsa) : info.qsa,
    socios: Array.isArray(info.qsa) ? JSON.stringify(info.qsa) : info.qsa,
    simples: info.simples ? JSON.stringify(info.simples) : info.simples,
    mei: info.simei ? JSON.stringify(info.simei) : info.mei,
    simei: info.simei ? JSON.stringify(info.simei) : info.simei,
    data_situacao_cadastral: info.data_situacao_cadastral,
    motivo_situacao_cadastral: info.motivo_situacao_cadastral,
    cnae_fiscal: info.cnae_fiscal ? String(info.cnae_fiscal) : '',
    cnaes_secundarios_raw: Array.isArray(info.cnaes_secundarios)
      ? JSON.stringify(info.cnaes_secundarios)
      : info.cnaes_secundarios
  };

  Object.entries(mapaOpcionalReceita).forEach(([coluna, valor]) => {
    if (colunasExistentesNoLead.has(coluna)) {
      payloadBase[coluna] = valor === undefined || valor === null
        ? (leadExistente[coluna] ?? '')
        : valor;
    }
  });

  if (colunasExistentesNoLead.has('telefone')) {
    const ddd1 = valorNumeroTexto(info.ddd_telefone_1, '');
    const tel1 = valorNumeroTexto(info.telefone_1, '');
    payloadBase.telefone =
      ddd1 && tel1
        ? `(${ddd1}) ${tel1}`
        : (leadExistente.telefone || '');
  }

  if (colunasExistentesNoLead.has('endereco_completo')) {
    const partesEndereco = [
      valorTexto(info.logradouro, ''),
      valorTexto(info.numero, ''),
      valorTexto(info.complemento, ''),
      valorTexto(info.bairro, ''),
      valorTexto(info.municipio, ''),
      valorTexto(info.uf, ''),
      valorTexto(info.cep, '')
    ].filter(Boolean);

    payloadBase.endereco_completo = partesEndereco.join(', ') || (leadExistente.endereco_completo || '');
  }

  if (colunasExistentesNoLead.has('dados_receita_json')) {
    payloadBase.dados_receita_json = info;
  }

  if (colunasExistentesNoLead.has('dados_receita_texto')) {
    payloadBase.dados_receita_texto = JSON.stringify(info);
  }

  return payloadBase;
};

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
  const [exportandoBackup, setExportandoBackup] = useState(false);
  const [exportandoFiltrados, setExportandoFiltrados] = useState(false);
  const [totalAbsoluto, setTotalAbsoluto] = useState(0);
  const [ultimosCnpjsProcessados, setUltimosCnpjsProcessados] = useState([]);
  const [ultimosCnpjsFalhados, setUltimosCnpjsFalhados] = useState([]);
  const [paginaAtual, setPaginaAtual] = useState(1);
  const [filtrosAtivos, setFiltrosAtivos] = useState(FILTROS_INICIAIS);
  const [buscaDebounced, setBuscaDebounced] = useState('');
  const [leadVisualSelecionado, setLeadVisualSelecionado] = useState(null);
  const [visualModalAberto, setVisualModalAberto] = useState(false);

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

  const abrirVisualizacaoLead = useCallback((lead) => {
    setLeadVisualSelecionado(lead);
    setVisualModalAberto(true);
  }, []);

  const fecharVisualizacaoLead = useCallback(() => {
    setVisualModalAberto(false);
    setLeadVisualSelecionado(null);
  }, []);

  const prepararDadosPlanilha = useCallback((dados) => {
    return dados.map((lead) => ({
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

  const exportarBackupBancoCompleto = useCallback(async () => {
    try {
      setExportandoBackup(true);
      limparMensagens();

      const dados = await buscarTodosDoBanco();

      if (!dados || dados.length === 0) {
        setErroBusca('Nenhum registro encontrado para gerar o backup.');
        return;
      }

      const ws = XLSX.utils.json_to_sheet(prepararDadosPlanilha(dados));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Backup');
      XLSX.writeFile(wb, 'backup-banco-completo.xlsx');

      setResultadoBusca(`${dados.length} registro(s) exportado(s) no backup com sucesso.`);
      setMostrarExportacao(false);
    } catch (e) {
      console.error('Erro no backup:', e);
      setErroBusca(`Erro no backup: ${e.message || 'falha na exportação.'}`);
    } finally {
      setExportandoBackup(false);
    }
  }, [buscarTodosDoBanco, limparMensagens, prepararDadosPlanilha]);

  const leadsFiltrados = useMemo(() => {
    return leads.filter((lead) => {
      if (buscaDebounced && !(lead._busca && lead._busca.includes(buscaDebounced))) {
        return false;
      }

      for (const campo of CAMPOS_COM_BUSCA_EXATA) {
        if (filtrosAtivos[campo] !== 'Todos' && lead[campo] !== filtrosAtivos[campo]) {
          return false;
        }
      }

      if (
        filtrosAtivos.cnae_secundario !== 'Todos' &&
        !(lead.cnae_secundario && String(lead.cnae_secundario).includes(filtrosAtivos.cnae_secundario))
      ) {
        return false;
      }

      return true;
    });
  }, [leads, buscaDebounced, filtrosAtivos]);

  const exportarFiltrados = useCallback(async () => {
    try {
      setExportandoFiltrados(true);
      limparMensagens();

      if (!leadsFiltrados || leadsFiltrados.length === 0) {
        setErroBusca('Nenhum lead filtrado encontrado para exportar.');
        return;
      }

      const ws = XLSX.utils.json_to_sheet(prepararDadosPlanilha(leadsFiltrados));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Filtrados');

      const nomeAba = aba === ABAS.ESTOQUE ? 'estoque' : 'triagem';
      XLSX.writeFile(wb, `leads-filtrados-${nomeAba}.xlsx`);

      setResultadoBusca(`${leadsFiltrados.length} lead(s) filtrado(s) exportado(s) com sucesso.`);
      setMostrarExportacao(false);
    } catch (e) {
      console.error('Erro ao exportar filtrados:', e);
      setErroBusca(`Erro ao exportar filtrados: ${e.message || 'falha na exportação.'}`);
    } finally {
      setExportandoFiltrados(false);
    }
  }, [aba, leadsFiltrados, limparMensagens, prepararDadosPlanilha]);

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

  const processarCNPJ = useCallback(async (cnpj, leadExistente = {}, opcoes = {}) => {
    const cnpjLimpo = normalizarCNPJ(cnpj);

    if (cnpjLimpo.length !== 14) {
      return { ok: false, erro: 'CNPJ inválido' };
    }

    const consulta = await consultarCNPJNaBrasilAPI(cnpjLimpo);

    if (!consulta.ok) {
      return { ok: false, erro: consulta.erro };
    }

    const info = consulta.dados || {};
    const payload = montarPayloadReceitaSeguro(
      leadExistente,
      info,
      opcoes.fontePadrao || 'Busca Manual'
    );

    const { error } = await supabase
      .from('empresas_mestre')
      .upsert(payload, { onConflict: 'cnpj' });

    if (error) {
      return { ok: false, erro: `Erro ao salvar no banco: ${error.message}` };
    }

    return {
      ok: true,
      situacao: info.descricao_situacao_cadastral,
      payloadSalvo: payload
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
          .eq('status_lead', aba === ABAS.ESTOQUE ? STATUS_LEAD.NOVO : STATUS_LEAD.TRIAGEM)
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

  const totalPaginas = useMemo(
    () => Math.max(1, Math.ceil(leadsFiltrados.length / ITENS_POR_PAGINA)),
    [leadsFiltrados.length]
  );

  const leadsPaginados = useMemo(() => {
    const inicio = (paginaAtual - 1) * ITENS_POR_PAGINA;
    const fim = inicio + ITENS_POR_PAGINA;
    return leadsFiltrados.slice(inicio, fim);
  }, [leadsFiltrados, paginaAtual]);

  const paginaInicial = useMemo(() => {
    if (leadsFiltrados.length === 0) return 0;
    return (paginaAtual - 1) * ITENS_POR_PAGINA + 1;
  }, [paginaAtual, leadsFiltrados.length]);

  const paginaFinal = useMemo(
    () => Math.min(paginaAtual * ITENS_POR_PAGINA, leadsFiltrados.length),
    [paginaAtual, leadsFiltrados.length]
  );

  useEffect(() => {
    setPaginaAtual(1);
  }, [buscaDebounced, filtrosAtivos, aba, moduloAtivo]);

  useEffect(() => {
    if (paginaAtual > totalPaginas) {
      setPaginaAtual(totalPaginas);
    }
  }, [paginaAtual, totalPaginas]);

  const moverLead = useCallback(async (lead) => {
    try {
      limparMensagens();

      const proximoStatus =
        aba === ABAS.ESTOQUE ? STATUS_LEAD.TRIAGEM : STATUS_LEAD.EM_PROSPECCAO;

      const { error } = await supabase
        .from('empresas_mestre')
        .update({ status_lead: proximoStatus })
        .eq('cnpj', lead.cnpj);

      if (error) throw error;

      setResultadoBusca(
        aba === ABAS.ESTOQUE
          ? 'Lead enviado para Triagem com sucesso.'
          : 'Lead enviado para Em Prospecção com sucesso.'
      );

      await sincronizar();
    } catch (error) {
      console.error('Erro ao mover lead:', error);
      setErroBusca(`Erro ao mover lead: ${error.message || 'falha ao atualizar status.'}`);
    }
  }, [aba, limparMensagens, sincronizar]);

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

        const resultado = await processarCNPJ(lead.cnpj, lead, {
          fontePadrao: lead.fonte_lead || 'Busca Manual'
        });

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

      if (erroBuscaDuplicados) throw erroBuscaDuplicados;

      if (!todosRegistros || todosRegistros.length === 0) {
        setStatusProcesso('');
        setResultadoBusca(`Limpeza concluída: ${excluidosInativos} inativo(s) removido(s) e 0 duplicado(s) removido(s).`);
        await sincronizar();
        return;
      }

      const semId = todosRegistros.some((item) => item.id === undefined || item.id === null);
      if (semId) throw new Error('A tabela empresas_mestre precisa ter a coluna id para limpar duplicados com segurança.');

      const mapa = new Map();
      const idsParaExcluir = [];

      for (const registro of todosRegistros) {
        const cnpjNormalizado = normalizarCNPJ(registro.cnpj);

        if (!cnpjNormalizado || cnpjNormalizado.length !== 14) continue;

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

          if (erroDeleteDuplicados) throw erroDeleteDuplicados;
        }

        excluidosDuplicados = idsParaExcluir.length;
      }

      setStatusProcesso('');
      setResultadoBusca(`Limpeza concluída: ${excluidosInativos} inativo(s) removido(s) e ${excluidosDuplicados} duplicado(s) removido(s).`);
      await sincronizar();
    } catch (err) {
      console.error('Erro na limpeza:', err);
      setStatusProcesso('');
      setErroBusca(`Erro na limpeza: ${err.message || 'falha ao limpar registros.'}`);
    }
  }, [leadsFiltrados, limparMensagens, processarCNPJ, sincronizar]);

  const atualizarFaltantes = useCallback(async () => {
    limparMensagens();
    setUltimosCnpjsFalhados([]);
    setUltimosCnpjsProcessados([]);

    try {
      const todosLeads = await buscarTodosDoBanco();

      if (!todosLeads || todosLeads.length === 0) {
        setErroBusca('Nenhum lead encontrado no banco para enriquecer.');
        return;
      }

      if (!confirm(`Enriquecer TODOS os ${todosLeads.length} leads do banco? Isso vai reconsultar a Receita e atualizar os dados faltantes.`)) {
        return;
      }

      setUltimosCnpjsProcessados(todosLeads.map((lead) => normalizarCNPJ(lead.cnpj)).filter(Boolean));

      const { sucesso, ultimoErro, falhados } = await processarEmLotes({
        itens: todosLeads,
        tamanhoLote: 5,
        pausaMs: 450,
        mensagemProgresso: (processados, total) => `Enriquecendo ${processados} de ${total} leads do banco...`,
        processador: async (lead) =>
          processarCNPJ(lead.cnpj, lead, {
            fontePadrao: lead.fonte_lead || 'Busca Manual'
          })
      });

      setUltimosCnpjsFalhados(falhados);

      if (sucesso === 0 && ultimoErro) {
        setErroBusca(`Nenhum lead foi enriquecido. Motivo: ${ultimoErro}`);
        setStatusProcesso('');
        return;
      }

      if (falhados.length > 0) {
        setResultadoBusca(`Enriquecimento concluído: ${sucesso} lead(s) atualizado(s) e ${falhados.length} falha(s).`);
      } else {
        setResultadoBusca(`Enriquecimento concluído: ${sucesso} lead(s) atualizado(s).`);
      }

      setStatusProcesso('');
      await sincronizar();
    } catch (error) {
      console.error('Erro ao enriquecer leads:', error);
      setStatusProcesso('');
      setErroBusca(`Erro ao enriquecer leads: ${error.message || 'falha no reprocessamento.'}`);
    }
  }, [buscarTodosDoBanco, limparMensagens, processarCNPJ, processarEmLotes, sincronizar]);

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
        mensagemProgresso: (processados, total) => `Processando arquivo: ${processados} de ${total}...`,
        processador: async (cnpj) =>
          processarCNPJ(cnpj, { fonte_lead: `Arquivo: ${file.name}` }, { fontePadrao: `Arquivo: ${file.name}` })
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
      mensagemProgresso: (processados, total) => `Processando ${processados} de ${total}...`,
      processador: async (cnpj) =>
        processarCNPJ(cnpj, { fonte_lead: 'Busca Manual' }, { fontePadrao: 'Busca Manual' })
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

  const renderLinhaEstoque = useCallback((lead) => {
    return (
      <div
        key={lead.cnpj}
        className="py-4 px-4 flex justify-between items-center gap-3 hover:bg-zinc-800/40 transition-colors"
      >
        <div className="flex-1 min-w-0">
          <h3 className="text-[12px] font-bold uppercase truncate text-white leading-tight">
            {lead.razao_social}
          </h3>

          <div className="flex gap-2 mt-2 flex-wrap">
            <span className="text-[8px] bg-zinc-800 px-2 py-0.5 rounded text-zinc-400 font-bold border border-white/5 uppercase">
              {lead.bairro || 'SEM BAIRRO'}
            </span>

            <span className="text-[8px] bg-blue-900/20 px-2 py-0.5 rounded text-blue-400 font-bold border border-blue-500/10 uppercase">
              {formatarCNPJ(lead.cnpj)}
            </span>

            <span className="text-[8px] bg-orange-900/20 px-2 py-0.5 rounded text-orange-400 font-bold border border-orange-500/10 truncate max-w-[200px]">
              {lead.cnae_principal_descricao || 'SEM CNAE'}
            </span>

            {lead.cnae_secundario && (
              <span className="text-[8px] bg-zinc-900/50 px-2 py-0.5 rounded text-zinc-300 font-medium truncate max-w-[200px] italic">
                Sec: {lead.cnae_secundario}
              </span>
            )}
          </div>
        </div>

        <button
          onClick={() => moverLead(lead)}
          className="h-10 w-10 bg-blue-600 rounded-xl flex items-center justify-center text-white active:scale-95 transition-all"
          title="Enviar para triagem"
        >
          ➡️
        </button>
      </div>
    );
  }, [moverLead]);

  const renderLinhaTriagem = useCallback((lead) => {
    return (
      <TriagemLeadRow
        key={lead.cnpj}
        lead={lead}
        onVisualizar={() => abrirVisualizacaoLead(lead)}
        onMover={() => moverLead(lead)}
        onAvancar={() => moverLead(lead)}
        onEnviar={() => moverLead(lead)}
        onProspeccao={() => moverLead(lead)}
        formatarCNPJ={formatarCNPJ}
        abrirVisualizacaoLead={() => abrirVisualizacaoLead(lead)}
      />
    );
  }, [abrirVisualizacaoLead, moverLead]);

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
                className={moduloAtivo === m ? 'text-white border-b border-blue-500' : 'text-zinc-600'}
              >
                {m === MODULOS.TODO ? 'LISTA' : 'PESCARIA DE CNPJ'}
              </button>
            ))}
          </div>
        </div>

        <div className="flex justify-between items-center gap-3">
          <h2 className="text-3xl font-black italic uppercase tracking-tighter text-white">
            {moduloAtivo === MODULOS.TODO
              ? (aba === ABAS.TRIAGEM ? 'Triagem' : 'Estoque')
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

                <button
                  onClick={() => setMostrarExportacao(!mostrarExportacao)}
                  className="text-[9px] bg-blue-700 px-4 py-2 rounded-full font-bold border border-blue-400/20"
                >
                  EXPORTAR XLSX
                </button>
              </>
            )}

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

            {mostrarExportacao && (
              <div className="p-4 bg-zinc-900 rounded-2xl border border-blue-500/10 space-y-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-blue-400 mb-2">
                    Exportação XLSX
                  </p>
                  <p className="text-[11px] text-zinc-400">
                    Você pode gerar um backup do banco inteiro ou exportar todos os leads filtrados da tela atual.
                  </p>
                </div>

                <div className="flex gap-2 flex-wrap">
                  <button
                    onClick={exportarBackupBancoCompleto}
                    disabled={exportandoBackup || exportandoFiltrados}
                    className="text-[10px] bg-emerald-600 px-4 py-2 rounded-full font-bold disabled:opacity-50"
                  >
                    {exportandoBackup ? 'GERANDO BACKUP...' : 'BACKUP DO BANCO'}
                  </button>

                  <button
                    onClick={exportarFiltrados}
                    disabled={exportandoBackup || exportandoFiltrados}
                    className="text-[10px] bg-blue-600 px-4 py-2 rounded-full font-bold disabled:opacity-50"
                  >
                    {exportandoFiltrados ? 'EXPORTANDO FILTRADOS...' : 'EXPORTAR FILTRADOS'}
                  </button>

                  <button
                    onClick={() => setMostrarExportacao(false)}
                    disabled={exportandoBackup || exportandoFiltrados}
                    className="text-[10px] bg-zinc-800 px-4 py-2 rounded-full font-bold border border-white/10 disabled:opacity-50"
                  >
                    FECHAR
                  </button>
                </div>
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
                  <p className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">
                    Mostrando {paginaInicial}-{paginaFinal}
                  </p>
                )}
              </div>

              {statusProcesso && (
                <p className="text-[9px] text-blue-500 animate-pulse font-black uppercase italic">
                  {statusProcesso}
                </p>
              )}
            </div>
          </div>
        )}
      </header>

      <main className="px-4 mt-6">
        {resultadoBusca && (
          <div className="bg-emerald-900/30 border border-emerald-500/50 p-4 rounded-2xl mb-6 flex justify-between items-center text-emerald-400 text-xs font-bold animate-pulse gap-3">
            <span>✅ {resultadoBusca}</span>
            <button
              onClick={() => setResultadoBusca('')}
              className="bg-emerald-500/20 px-3 py-1 rounded-full text-[10px]"
            >
              OK
            </button>
          </div>
        )}

        {erroBusca && (
          <div className="bg-red-900/30 border border-red-500/50 p-4 rounded-2xl mb-6 flex justify-between items-center text-red-400 text-xs font-bold animate-pulse gap-3">
            <span>❌ {erroBusca}</span>
            <button
              onClick={() => setErroBusca('')}
              className="bg-red-500/20 px-3 py-1 rounded-full text-[10px]"
            >
              OK
            </button>
          </div>
        )}

        {moduloAtivo === MODULOS.TODO && (
          <>
            <div className="bg-zinc-900/30 border border-white/5 rounded-2xl divide-y divide-zinc-800/50 overflow-hidden">
              {carregando ? (
                <div className="text-center py-20 text-[10px] animate-pulse text-zinc-600 font-black uppercase tracking-widest">
                  Sincronizando...
                </div>
              ) : leadsFiltrados.length === 0 ? (
                <div className="text-center py-20 text-[10px] text-zinc-600 font-black uppercase tracking-widest">
                  Nenhum lead encontrado
                </div>
              ) : aba === ABAS.TRIAGEM ? (
                <div className="divide-y divide-zinc-800/50">
                  {leadsPaginados.map((lead) => renderLinhaTriagem(lead))}
                </div>
              ) : (
                <div className="divide-y divide-zinc-800/50">
                  {leadsPaginados.map((lead) => renderLinhaEstoque(lead))}
                </div>
              )}
            </div>

            {!carregando && leadsFiltrados.length > 0 && totalPaginas > 1 && (
              <div className="mt-6 bg-zinc-900/50 border border-white/5 rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="text-[10px] text-zinc-400 font-black uppercase tracking-widest">
                  Página {paginaAtual} de {totalPaginas}
                </div>

                <div className="flex items-center gap-2 flex-wrap justify-center">
                  <button
                    onClick={() => irParaPagina(1)}
                    disabled={paginaAtual === 1}
                    className="px-3 py-2 rounded-xl text-[10px] font-black bg-zinc-800 border border-white/10 text-white disabled:opacity-30"
                  >
                    Primeira
                  </button>

                  <button
                    onClick={() => irParaPagina(paginaAtual - 1)}
                    disabled={paginaAtual === 1}
                    className="px-3 py-2 rounded-xl text-[10px] font-black bg-zinc-800 border border-white/10 text-white disabled:opacity-30"
                  >
                    Anterior
                  </button>

                  <button
                    onClick={() => irParaPagina(paginaAtual + 1)}
                    disabled={paginaAtual === totalPaginas}
                    className="px-3 py-2 rounded-xl text-[10px] font-black bg-zinc-800 border border-white/10 text-white disabled:opacity-30"
                  >
                    Próxima
                  </button>

                  <button
                    onClick={() => irParaPagina(totalPaginas)}
                    disabled={paginaAtual === totalPaginas}
                    className="px-3 py-2 rounded-xl text-[10px] font-black bg-zinc-800 border border-white/10 text-white disabled:opacity-30"
                  >
                    Última
                  </button>
                </div>
              </div>
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
                  <h3 className="text-lg font-black uppercase text-white">Última pesquisa</h3>
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
                  <h3 className="text-lg font-black uppercase text-red-300">CNPJs com falha</h3>
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
                      <p className="text-[10px] text-red-300/80 mt-1">{item.erro}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {visualModalAberto && (
        <LeadVisualModal
          lead={leadVisualSelecionado}
          isOpen={visualModalAberto}
          open={visualModalAberto}
          visible={visualModalAberto}
          onClose={fecharVisualizacaoLead}
          fechar={fecharVisualizacaoLead}
        />
      )}

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
