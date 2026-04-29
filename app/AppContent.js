"use client";
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { consultarCNPJNaBrasilAPI } from '../lib/brasilApi';
import * as XLSX from 'xlsx';
import LeadVisualModal from '../components/LeadVisualModal';
import IncrementarLeadModal from '../components/IncrementarLeadModal';
import LeadActionRow from '../components/LeadActionRow';
import VisaoAnalitica from '../components/VisaoAnalitica';

const STATUS_LEAD = {
  NOVO: 'Novo',
  TRIAGEM: 'Triagem',
  MESA_DE_TRABALHO: 'Mesa de Trabalho',
  EM_PROSPECCAO: 'Em Prospecção'
};

const MODULOS = {
  TODO: 'todo',
  PESCARIA: 'pescaria',
  ANALITICA: 'analitica'
};

const ABAS = {
  ESTOQUE: 'estoque',
  TRIAGEM: 'triagem',
  MESA: 'mesa'
};

const FILTROS_INICIAIS = {
  razao_social: 'Todos',
  nome_fantasia: 'Todos',
  cnpj: 'Todos',
  bairro: 'Todos',
  municipio: 'Todos',
  uf: 'Todos',
  fonte_lead: 'Todos',
  cnae_principal_descricao: 'Todos',
  cnae_secundario: 'Todos',
  situacao_cadastral: 'Todos',
  status_vendedor: 'Todos',
  porte: 'Todos',
  categoria_trr: 'Todos',
  potencial_consumo: 'Todos',
  contato_nome: 'Todos',
  inscricao_estadual: 'Todos',
  inscricao_municipal: 'Todos',
  email: 'Todos'
};

const BUSCAS_OPCOES_INICIAIS = Object.keys(FILTROS_INICIAIS).reduce((acc, chave) => {
  acc[chave] = '';
  return acc;
}, {});

const CAMPOS_FILTRO = [
  { label: 'Razão Social', campo: 'razao_social' },
  { label: 'Nome Fantasia', campo: 'nome_fantasia' },
  { label: 'CNPJ', campo: 'cnpj' },
  { label: 'Bairro', campo: 'bairro' },
  { label: 'Município', campo: 'municipio' },
  { label: 'UF', campo: 'uf' },
  { label: 'Fonte', campo: 'fonte_lead' },
  { label: 'CNAE Principal', campo: 'cnae_principal_descricao' },
  { label: 'CNAE Secundário', campo: 'cnae_secundario' },
  { label: 'Situação Cadastral', campo: 'situacao_cadastral' },
  { label: 'Status Vendedor', campo: 'status_vendedor' },
  { label: 'Porte', campo: 'porte' },
  { label: 'Categoria TRR', campo: 'categoria_trr' },
  { label: 'Potencial Consumo', campo: 'potencial_consumo' },
  { label: 'Contato', campo: 'contato_nome' },
  { label: 'Inscrição Estadual', campo: 'inscricao_estadual' },
  { label: 'Inscrição Municipal', campo: 'inscricao_municipal' },
  { label: 'Email', campo: 'email' }
];

const CAMPOS_COM_BUSCA_EXATA = Object.keys(FILTROS_INICIAIS);
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

const limparObjetoParaBanco = (obj = {}) => {
  const { _busca, cnpj_normalizado, ...resto } = obj || {};
  return resto;
};

const converterDataBRparaISO = (valor) => {
  if (!valor) return null;

  const texto = String(valor).trim();

  if (!texto) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(texto)) {
    return texto;
  }

  const match = texto.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (match) {
    const [, dd, mm, yyyy] = match;
    return `${yyyy}-${mm}-${dd}`;
  }

  return null;
};

const converterNumero = (valor) => {
  if (valor === null || valor === undefined || valor === '') return null;
  if (typeof valor === 'number') return valor;

  const texto = String(valor)
    .replace(/\./g, '')
    .replace(',', '.')
    .trim();

  const numero = Number(texto);
  return Number.isNaN(numero) ? null : numero;
};

const montarCNAESecundario = (cnaesSecundarios) => {
  if (!Array.isArray(cnaesSecundarios) || cnaesSecundarios.length === 0) {
    return 'Não informado';
  }

  return cnaesSecundarios
    .map((c) => c?.descricao)
    .filter(Boolean)
    .join(' | ');
};

const montarPayloadReceita = (leadExistente = {}, info = {}, fontePadrao = 'Busca Manual') => {
  const leadBase = limparObjetoParaBanco(leadExistente);

  return {
    ...leadBase,
    cnpj: normalizarCNPJ(info.cnpj || leadBase.cnpj || ''),
    razao_social: valorTexto(info.razao_social, leadBase.razao_social || ''),
    nome_fantasia: valorTexto(info.nome_fantasia, leadBase.nome_fantasia || info.razao_social || ''),
    situacao_cadastral: valorTexto(
      info.descricao_situacao_cadastral,
      leadBase.situacao_cadastral || 'ATIVA'
    ),
    data_abertura: converterDataBRparaISO(info.data_inicio_atividade) || leadBase.data_abertura || null,
    cnae_principal_codigo: info.cnae_fiscal ? String(info.cnae_fiscal) : (leadBase.cnae_principal_codigo || ''),
    cnae_principal_descricao: valorTexto(
      info.cnae_fiscal_descricao,
      leadBase.cnae_principal_descricao || 'Não informado'
    ),
    capital_social: converterNumero(info.capital_social) ?? leadBase.capital_social ?? null,
    logradouro: valorTexto(info.logradouro, leadBase.logradouro || ''),
    numero: valorTexto(info.numero, leadBase.numero || ''),
    bairro: valorTexto(info.bairro, leadBase.bairro || ''),
    municipio: valorTexto(info.municipio, leadBase.municipio || ''),
    uf: valorTexto(info.uf, leadBase.uf || ''),
    cep: valorTexto(info.cep, leadBase.cep || ''),
    telefone_1: valorTexto(info.telefone_1, leadBase.telefone_1 || ''),
    telefone_2: valorTexto(info.telefone_2, leadBase.telefone_2 || ''),
    email: valorTexto(info.email, leadBase.email || ''),
    data_inicio_atividade: valorTexto(info.data_inicio_atividade, leadBase.data_inicio_atividade || ''),
    complemento: valorTexto(info.complemento, leadBase.complemento || ''),
    porte: valorTexto(info.porte, leadBase.porte || ''),
    status_lead: leadBase.status_lead || STATUS_LEAD.NOVO,
    observacoes: leadBase.observacoes || '',
    acoes_prospeccao: leadBase.acoes_prospeccao || '',
    resultado_campo: leadBase.resultado_campo || '',
    notas_campo: leadBase.notas_campo || '',
    contato_nome: leadBase.contato_nome || '',
    inscricao_estadual: leadBase.inscricao_estadual || '',
    inscricao_municipal: leadBase.inscricao_municipal || '',
    endereco_obra: leadBase.endereco_obra || '',
    classificacao_fornecedor: leadBase.classificacao_fornecedor || '',
    historico_visitas: leadBase.historico_visitas || [],
    registro_visita: leadBase.registro_visita || '',
    data_reagendada: leadBase.data_reagendada || null,
    fonte_lead: leadBase.fonte_lead || fontePadrao,
    data_captacao: leadBase.data_captacao || null,
    cnae_secundario: montarCNAESecundario(info.cnaes_secundarios),
    categoria_trr: leadBase.categoria_trr || '',
    potencial_consumo: leadBase.potencial_consumo || 'Nao Avaliado',
    status_vendedor: leadBase.status_vendedor || 'Lead Bruto',
    ultima_interacao: leadBase.ultima_interacao || null,
    observacoes_venda: leadBase.observacoes_venda || '',
    criado_em: leadBase.criado_em || undefined,
    lat: leadBase.lat ?? null,
    lng: leadBase.lng ?? null,
    descricao_cnae: valorTexto(info.cnae_fiscal_descricao, leadBase.descricao_cnae || '')
  };
};

const montarHtmlCadastroLead = (lead) => {
  const telefone = lead.telefone_1 || lead.telefone_2 || '';
  const linhas = [
    ['Razão social', lead.razao_social || ''],
    ['CNPJ', formatarCNPJ(lead.cnpj || '')],
    ['IE', lead.inscricao_estadual || ''],
    ['IM', lead.inscricao_municipal || ''],
    ['Contato', lead.contato_nome || ''],
    ['Telefone', telefone],
    ['Email', lead.email || ''],
    ['Endereço de obra', lead.endereco_obra || '']
  ];

  return `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8" />
      <title>Cadastro - ${lead.razao_social || 'Lead'}</title>
      <style>
        body {
          font-family: Arial, Helvetica, sans-serif;
          padding: 32px;
          color: #111827;
        }
        h1 {
          font-size: 22px;
          margin: 0 0 8px;
        }
        p.sub {
          color: #4b5563;
          margin: 0 0 24px;
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 1px;
          font-weight: bold;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 12px;
        }
        th, td {
          border: 1px solid #d1d5db;
          padding: 12px;
          text-align: left;
          vertical-align: top;
          font-size: 13px;
        }
        th {
          width: 220px;
          background: #f3f4f6;
          font-weight: 700;
        }
      </style>
    </head>
    <body>
      <h1>Ficha de Cadastro</h1>
      <p class="sub">Vendedor TRR</p>
      <table>
        <tbody>
          ${linhas
            .map(
              ([label, value]) => `
                <tr>
                  <th>${label}</th>
                  <td>${String(value || '').replace(/\n/g, '<br />') || 'Não informado'}</td>
                </tr>
              `
            )
            .join('')}
        </tbody>
      </table>
    </body>
    </html>
  `;
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
  const [buscaOpcoesFiltro, setBuscaOpcoesFiltro] = useState(BUSCAS_OPCOES_INICIAIS);
  const [buscaDebounced, setBuscaDebounced] = useState('');
  const [leadVisualSelecionado, setLeadVisualSelecionado] = useState(null);
  const [visualModalAberto, setVisualModalAberto] = useState(false);
  const [leadIncrementoSelecionado, setLeadIncrementoSelecionado] = useState(null);
  const [incrementarModalAberto, setIncrementarModalAberto] = useState(false);
  const [salvandoIncremento, setSalvandoIncremento] = useState(false);

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

  const atualizarBuscaOpcaoFiltro = useCallback((campo, valor) => {
    setBuscaOpcoesFiltro((prev) => ({
      ...prev,
      [campo]: valor
    }));
  }, []);

  const limparFiltros = useCallback(() => {
    setFiltrosAtivos(FILTROS_INICIAIS);
    setBuscaOpcoesFiltro(BUSCAS_OPCOES_INICIAIS);
  }, []);

  const abrirVisualizacaoLead = useCallback((lead) => {
    setLeadVisualSelecionado(lead);
    setVisualModalAberto(true);
  }, []);

  const fecharVisualizacaoLead = useCallback(() => {
    setVisualModalAberto(false);
    setLeadVisualSelecionado(null);
  }, []);

  const abrirIncrementarLead = useCallback((lead) => {
    setLeadIncrementoSelecionado(lead);
    setIncrementarModalAberto(true);
  }, []);

  const fecharIncrementarLead = useCallback(() => {
    setIncrementarModalAberto(false);
    setLeadIncrementoSelecionado(null);
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
      'CEP': lead.cep || '',
      'Telefone 1': lead.telefone_1 || '',
      'Telefone 2': lead.telefone_2 || '',
      'Email': lead.email || '',
      'IE': lead.inscricao_estadual || '',
      'IM': lead.inscricao_municipal || '',
      'Contato': lead.contato_nome || '',
      'Endereço de obra': lead.endereco_obra || '',
      'Observações': lead.observacoes || '',
      'Fonte do Lead': lead.fonte_lead || '',
      'CNAE Principal': lead.cnae_principal_descricao || '',
      'CNAE Secundário': lead.cnae_secundario || '',
      'Situação Cadastral': lead.situacao_cadastral || '',
      'Status do Lead': lead.status_lead || '',
      'Status do Vendedor': lead.status_vendedor || ''
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
        const filtro = filtrosAtivos[campo];
        if (filtro !== 'Todos') {
          const valorLead = String(lead[campo] || '');
          if (valorLead !== filtro) {
            return false;
          }
        }
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

      let nomeAba = 'estoque';
      if (aba === ABAS.TRIAGEM) nomeAba = 'triagem';
      if (aba === ABAS.MESA) nomeAba = 'mesa-de-trabalho';

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
          const itemAtual = lote[index];
          const cnpjDoItem =
            typeof itemAtual === 'string'
              ? itemAtual
              : itemAtual?.cnpj || 'Sem CNPJ';

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
    const payload = montarPayloadReceita(
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

      let query = supabase
        .from('empresas_mestre')
        .select('*')
        .order('razao_social', { ascending: true });

      if (moduloAtivo === MODULOS.TODO) {
        if (aba === ABAS.ESTOQUE) {
          query = query.eq('status_lead', STATUS_LEAD.NOVO);
        } else if (aba === ABAS.TRIAGEM) {
          query = query.eq('status_lead', STATUS_LEAD.TRIAGEM);
        } else if (aba === ABAS.MESA) {
          query = query.eq('status_lead', STATUS_LEAD.MESA_DE_TRABALHO);
        }
      }

      let todosLeads = [];
      let de = 0;
      let ate = 999;
      let continua = true;

      while (continua) {
        const { data, error } = await query.range(de, ate);

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
  }, [aba, moduloAtivo]);

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
      const termo = String(buscaOpcoesFiltro[campo] || '').toLowerCase();

      const valores = [
        'Todos',
        ...new Set(
          leads
            .map((lead) => String(lead[campo] || '').trim())
            .filter(Boolean)
        )
      ].sort((a, b) => a.localeCompare(b, 'pt-BR'));

      opcoes[campo] = valores.filter((valor) => {
        if (valor === 'Todos') return true;
        if (!termo) return true;
        return valor.toLowerCase().includes(termo);
      });
    });

    return opcoes;
  }, [leads, buscaOpcoesFiltro]);

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

  const incrementarLead = useCallback(async (lead) => {
    try {
      limparMensagens();
      setStatusProcesso(`Incrementando ${lead.razao_social}...`);

      const resultado = await processarCNPJ(lead.cnpj, lead, {
        fontePadrao: lead.fonte_lead || 'Busca Manual'
      });

      if (!resultado.ok) {
        throw new Error(resultado.erro || 'Falha ao incrementar lead.');
      }

      setStatusProcesso('');
      abrirIncrementarLead({
        ...lead,
        ...(resultado.payloadSalvo || {})
      });
    } catch (error) {
      console.error('Erro ao incrementar lead:', error);
      setStatusProcesso('');
      setErroBusca(`Erro ao incrementar lead: ${error.message || 'falha ao atualizar.'}`);
    }
  }, [abrirIncrementarLead, limparMensagens, processarCNPJ]);

  const salvarIncrementoLead = useCallback(async (dadosFormulario) => {
    try {
      if (!leadIncrementoSelecionado?.cnpj) return;

      setSalvandoIncremento(true);
      limparMensagens();

      const payload = {
        inscricao_estadual: valorTexto(dadosFormulario.inscricao_estadual),
        inscricao_municipal: valorTexto(dadosFormulario.inscricao_municipal),
        contato_nome: valorTexto(dadosFormulario.contato_nome),
        telefone_1: valorTexto(dadosFormulario.telefone_1),
        email: valorTexto(dadosFormulario.email),
        endereco_obra: valorTexto(dadosFormulario.endereco_obra),
        observacoes: valorTexto(dadosFormulario.observacoes),
        ultima_interacao: new Date().toISOString()
      };

      const { error } = await supabase
        .from('empresas_mestre')
        .update(payload)
        .eq('cnpj', leadIncrementoSelecionado.cnpj);

      if (error) throw error;

      setResultadoBusca('Informações incrementadas com sucesso.');
      fecharIncrementarLead();
      await sincronizar();
    } catch (error) {
      console.error('Erro ao salvar incremento:', error);
      setErroBusca(`Erro ao salvar incremento: ${error.message || 'falha ao atualizar.'}`);
    } finally {
      setSalvandoIncremento(false);
    }
  }, [fecharIncrementarLead, leadIncrementoSelecionado, limparMensagens, sincronizar]);

  const gerarPdfCadastroLead = useCallback(async (lead) => {
    try {
      limparMensagens();

      const nomeArquivo = `cadastro-${normalizarCNPJ(lead.cnpj || 'lead')}.pdf`;

      try {
        const mod = await import('jspdf');
        const jsPDF = mod.jsPDF || mod.default?.jsPDF || mod.default;

        if (jsPDF) {
          const doc = new jsPDF({
            unit: 'mm',
            format: 'a4'
          });

          const telefone = lead.telefone_1 || lead.telefone_2 || '';
          const linhas = [
            ['Razão social', lead.razao_social || 'Não informado'],
            ['CNPJ', formatarCNPJ(lead.cnpj || '') || 'Não informado'],
            ['IE', lead.inscricao_estadual || 'Não informado'],
            ['IM', lead.inscricao_municipal || 'Não informado'],
            ['Contato', lead.contato_nome || 'Não informado'],
            ['Telefone', telefone || 'Não informado'],
            ['Email', lead.email || 'Não informado'],
            ['Endereço de obra', lead.endereco_obra || 'Não informado']
          ];

          doc.setFont('helvetica', 'bold');
          doc.setFontSize(18);
          doc.text('Ficha de Cadastro', 20, 20);

          doc.setFont('helvetica', 'normal');
          doc.setFontSize(10);
          doc.text('Vendedor TRR', 20, 27);

          let y = 38;

          linhas.forEach(([label, valor]) => {
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(11);
            doc.text(`${label}:`, 20, y);

            doc.setFont('helvetica', 'normal');
            const valorQuebrado = doc.splitTextToSize(String(valor), 120);
            doc.text(valorQuebrado, 60, y);

            y += Math.max(10, valorQuebrado.length * 6 + 2);
          });

          doc.save(nomeArquivo);
          setResultadoBusca('PDF gerado com sucesso.');
          return;
        }
      } catch (erroJspdf) {
        console.warn('jsPDF não disponível. Usando impressão do navegador.', erroJspdf);
      }

      const popup = window.open('', '_blank', 'width=900,height=700');
      if (!popup) {
        throw new Error('O navegador bloqueou a abertura da janela do PDF.');
      }

      popup.document.open();
      popup.document.write(montarHtmlCadastroLead(lead));
      popup.document.close();
      popup.focus();

      setTimeout(() => {
        popup.print();
      }, 500);

      setResultadoBusca('Ficha aberta para salvar como PDF.');
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      setErroBusca(`Erro ao gerar PDF: ${error.message || 'falha na geração.'}`);
    }
  }, [limparMensagens]);

  const enviarParaTriagem = useCallback(async (lead) => {
    try {
      limparMensagens();

      const { error } = await supabase
        .from('empresas_mestre')
        .update({
          status_lead: STATUS_LEAD.TRIAGEM,
          ultima_interacao: new Date().toISOString()
        })
        .eq('cnpj', lead.cnpj);

      if (error) throw error;

      setResultadoBusca('Lead enviado para Triagem com sucesso.');
      await sincronizar();
    } catch (error) {
      console.error('Erro ao enviar para triagem:', error);
      setErroBusca(`Erro ao enviar para Triagem: ${error.message || 'falha ao atualizar.'}`);
    }
  }, [limparMensagens, sincronizar]);

  const enviarParaMesaDeTrabalho = useCallback(async (lead) => {
    try {
      limparMensagens();

      const { error } = await supabase
        .from('empresas_mestre')
        .update({
          status_lead: STATUS_LEAD.MESA_DE_TRABALHO,
          status_vendedor: 'Mesa de Trabalho',
          ultima_interacao: new Date().toISOString()
        })
        .eq('cnpj', lead.cnpj);

      if (error) throw error;

      setResultadoBusca('Lead enviado para Mesa de Trabalho com sucesso.');
      await sincronizar();
    } catch (error) {
      console.error('Erro ao enviar para mesa de trabalho:', error);
      setErroBusca(`Erro ao enviar para Mesa de Trabalho: ${error.message || 'falha ao atualizar.'}`);
    }
  }, [limparMensagens, sincronizar]);

  const enviarParaEstoque = useCallback(async (lead) => {
    try {
      limparMensagens();

      const { error } = await supabase
        .from('empresas_mestre')
        .update({
          status_lead: STATUS_LEAD.NOVO
        })
        .eq('cnpj', lead.cnpj);

      if (error) throw error;

      setResultadoBusca('Lead devolvido para Estoque com sucesso.');
      await sincronizar();
    } catch (error) {
      console.error('Erro ao enviar para estoque:', error);
      setErroBusca(`Erro ao devolver lead para estoque: ${error.message || 'falha ao atualizar.'}`);
    }
  }, [limparMensagens, sincronizar]);

  const enviarLeadParaMeuToDo = useCallback(async (lead) => {
    try {
      limparMensagens();

      const payload = {
        lead_id: lead.id ? String(lead.id) : normalizarCNPJ(lead.cnpj || ''),
        cnpj: normalizarCNPJ(lead.cnpj || ''),
        razao_social: valorTexto(lead.razao_social),
        nome_fantasia: valorTexto(lead.nome_fantasia),
        logradouro: valorTexto(lead.logradouro),
        numero: valorTexto(lead.numero),
        bairro: valorTexto(lead.bairro),
        municipio: valorTexto(lead.municipio),
        uf: valorTexto(lead.uf),
        cep: valorTexto(lead.cep),
        contato_nome: valorTexto(lead.contato_nome),
        telefone_1: valorTexto(lead.telefone_1),
        email: valorTexto(lead.email),
        observacoes: valorTexto(lead.observacoes),
        status_origem: valorTexto(lead.status_lead || STATUS_LEAD.MESA_DE_TRABALHO),
        processado: false,
        processado_em: null
      };

      const { error } = await supabase
        .from('fila_meu_todo')
        .insert(payload);

      if (error) throw error;

      setResultadoBusca('Lead enviado para o Meu To Do com sucesso.');
    } catch (error) {
      console.error('Erro ao enviar lead para o Meu To Do:', error);
      setErroBusca(`Erro ao enviar para o Meu To Do: ${error.message || 'falha ao gravar na fila.'}`);
    }
  }, [limparMensagens]);

  const deletarLead = useCallback(async (lead) => {
    try {
      const confirmar = window.confirm(
        `Deletar o lead "${lead.razao_social}"?\n\nEssa ação não pode ser desfeita.`
      );

      if (!confirmar) return;

      limparMensagens();

      const { error } = await supabase
        .from('empresas_mestre')
        .delete()
        .eq('cnpj', lead.cnpj);

      if (error) throw error;

      setResultadoBusca('Lead deletado com sucesso.');
      await sincronizar();
    } catch (error) {
      console.error('Erro ao deletar lead:', error);
      setErroBusca(`Erro ao deletar lead: ${error.message || 'falha ao excluir.'}`);
    }
  }, [limparMensagens, sincronizar]);

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

      if (!confirm(`Enriquecer TODOS os ${todosLeads.length} leads do banco? Isso vai reconsultar a Receita e completar os dados faltantes.`)) {
        return;
      }

      setUltimosCnpjsProcessados(
        todosLeads.map((lead) => normalizarCNPJ(lead.cnpj)).filter(Boolean)
      );

      const { sucesso, ultimoErro, falhados } = await processarEmLotes({
        itens: todosLeads,
        tamanhoLote: 5,
        pausaMs: 450,
        mensagemProgresso: (processados, total) =>
          `Enriquecendo ${processados} de ${total} leads do banco...`,
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
          processarCNPJ(
            cnpj,
            { fonte_lead: `Arquivo: ${file.name}` },
            { fontePadrao: `Arquivo: ${file.name}` }
          )
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
        processarCNPJ(
          cnpj,
          { fonte_lead: 'Busca Manual' },
          { fontePadrao: 'Busca Manual' }
        )
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

  const montarAcoesEstoque = useCallback((lead) => ([
    {
      key: 'visualizar',
      label: 'Visualizar',
      shortLabel: 'VER',
      onClick: () => abrirVisualizacaoLead(lead),
      className: 'bg-zinc-800 text-white hover:bg-zinc-700 border border-white/10'
    },
    {
      key: 'incrementar',
      label: 'Incrementar',
      shortLabel: '+',
      onClick: () => incrementarLead(lead),
      className: 'bg-blue-700 text-white hover:bg-blue-600'
    },
    {
      key: 'cadastrar',
      label: 'Cadastrar',
      shortLabel: 'CAD',
      onClick: () => gerarPdfCadastroLead(lead),
      className: 'bg-emerald-700 text-white hover:bg-emerald-600'
    },
    {
      key: 'triagem',
      label: 'Triagem',
      shortLabel: 'TRI',
      onClick: () => enviarParaTriagem(lead),
      className: 'bg-cyan-700 text-white hover:bg-cyan-600'
    },
    {
      key: 'mesa',
      label: 'Mesa de Trabalho',
      shortLabel: 'MESA',
      onClick: () => enviarParaMesaDeTrabalho(lead),
      className: 'bg-violet-700 text-white hover:bg-violet-600'
    },
    {
      key: 'deletar',
      label: 'Deletar',
      shortLabel: 'DEL',
      onClick: () => deletarLead(lead),
      className: 'bg-red-700 text-white hover:bg-red-600'
    }
  ]), [
    abrirVisualizacaoLead,
    incrementarLead,
    gerarPdfCadastroLead,
    enviarParaTriagem,
    enviarParaMesaDeTrabalho,
    deletarLead
  ]);

  const montarAcoesTriagem = useCallback((lead) => ([
    {
      key: 'visualizar',
      label: 'Visualizar',
      shortLabel: 'VER',
      onClick: () => abrirVisualizacaoLead(lead),
      className: 'bg-zinc-800 text-white hover:bg-zinc-700 border border-white/10'
    },
    {
      key: 'incrementar',
      label: 'Incrementar',
      shortLabel: '+',
      onClick: () => incrementarLead(lead),
      className: 'bg-blue-700 text-white hover:bg-blue-600'
    },
    {
      key: 'cadastrar',
      label: 'Cadastrar',
      shortLabel: 'CAD',
      onClick: () => gerarPdfCadastroLead(lead),
      className: 'bg-emerald-700 text-white hover:bg-emerald-600'
    },
    {
      key: 'mesa',
      label: 'Mesa de Trabalho',
      shortLabel: 'MESA',
      onClick: () => enviarParaMesaDeTrabalho(lead),
      className: 'bg-violet-700 text-white hover:bg-violet-600'
    },
    {
      key: 'estoque',
      label: 'Estoque',
      shortLabel: 'EST',
      onClick: () => enviarParaEstoque(lead),
      className: 'bg-yellow-600 text-black hover:bg-yellow-500'
    },
    {
      key: 'deletar',
      label: 'Deletar',
      shortLabel: 'DEL',
      onClick: () => deletarLead(lead),
      className: 'bg-red-700 text-white hover:bg-red-600'
    }
  ]), [
    abrirVisualizacaoLead,
    incrementarLead,
    gerarPdfCadastroLead,
    enviarParaMesaDeTrabalho,
    enviarParaEstoque,
    deletarLead
  ]);

  const montarAcoesMesa = useCallback((lead) => ([
    {
      key: 'visualizar',
      label: 'Visualizar',
      shortLabel: 'VER',
      onClick: () => abrirVisualizacaoLead(lead),
      className: 'bg-zinc-800 text-white hover:bg-zinc-700 border border-white/10'
    },
    {
      key: 'incrementar',
      label: 'Incrementar',
      shortLabel: '+',
      onClick: () => incrementarLead(lead),
      className: 'bg-blue-700 text-white hover:bg-blue-600'
    },
    {
      key: 'cadastrar',
      label: 'Cadastrar',
      shortLabel: 'CAD',
      onClick: () => gerarPdfCadastroLead(lead),
      className: 'bg-emerald-700 text-white hover:bg-emerald-600'
    },
    {
      key: 'triagem',
      label: 'Triagem',
      shortLabel: 'TRI',
      onClick: () => enviarParaTriagem(lead),
      className: 'bg-cyan-700 text-white hover:bg-cyan-600'
    },
    {
      key: 'estoque',
      label: 'Estoque',
      shortLabel: 'EST',
      onClick: () => enviarParaEstoque(lead),
      className: 'bg-yellow-600 text-black hover:bg-yellow-500'
    },
    {
      key: 'deletar',
      label: 'Deletar',
      shortLabel: 'DEL',
      onClick: () => deletarLead(lead),
      className: 'bg-red-700 text-white hover:bg-red-600'
    }
  ]), [
    abrirVisualizacaoLead,
    incrementarLead,
    gerarPdfCadastroLead,
    enviarParaTriagem,
    enviarParaEstoque,
    deletarLead
  ]);

  const renderLinha = useCallback((lead) => {
    let actions = [];
    if (aba === ABAS.ESTOQUE) actions = montarAcoesEstoque(lead);
    if (aba === ABAS.TRIAGEM) actions = montarAcoesTriagem(lead);
    if (aba === ABAS.MESA) actions = montarAcoesMesa(lead);

    return (
      <LeadActionRow
        key={lead.cnpj}
        lead={lead}
        formatarCNPJ={formatarCNPJ}
        actions={actions}
        onEnviarParaMeuToDo={aba === ABAS.MESA ? enviarLeadParaMeuToDo : undefined}
      />
    );
  }, [aba, montarAcoesEstoque, montarAcoesMesa, montarAcoesTriagem, enviarLeadParaMeuToDo]);

  const tituloPrincipal = useMemo(() => {
    if (moduloAtivo === MODULOS.PESCARIA) return 'Pescaria de CNPJ';
    if (moduloAtivo === MODULOS.ANALITICA) return 'Visão Analítica';
    if (aba === ABAS.TRIAGEM) return 'Triagem';
    if (aba === ABAS.MESA) return 'Mesa de Trabalho';
    return 'Estoque';
  }, [aba, moduloAtivo]);

  return (
    <div className="min-h-screen bg-black text-white pb-40 font-sans antialiased">
      <header className="px-5 pt-8 pb-4 sticky top-0 bg-black/95 border-b border-white/5 z-50">
        <div className="flex justify-between items-center mb-3 gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <img
              src="/icon.png"
              alt="Ícone Vendedor TRR"
              className="w-12 h-12 rounded-2xl object-cover border border-white/10 shadow-lg shrink-0"
            />

            <div className="min-w-0">
              <h1 className="text-sm md:text-base font-black text-white uppercase tracking-wide truncate">
                Vendedor TRR
              </h1>
              <p className="text-[10px] md:text-[11px] text-zinc-500 uppercase tracking-widest truncate">
                Sistema de Prospecção
              </p>
            </div>
          </div>

          <div className="flex gap-3 text-[9px] font-bold uppercase shrink-0">
            {[MODULOS.TODO, MODULOS.PESCARIA, MODULOS.ANALITICA].map((m) => (
              <button
                key={m}
                onClick={() => trocarModulo(m)}
                className={moduloAtivo === m ? 'text-white border-b border-blue-500' : 'text-zinc-600'}
              >
                {m === MODULOS.TODO ? 'LISTA' : m === MODULOS.PESCARIA ? 'PESCARIA DE CNPJ' : 'VISÃO ANALÍTICA'}
              </button>
            ))}
          </div>
        </div>

        <div className="flex justify-between items-center gap-3">
          <h2 className="text-3xl font-black italic uppercase tracking-tighter text-white">
            {tituloPrincipal}
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

            {moduloAtivo !== MODULOS.ANALITICA && (
              <button
                onClick={() => setMostrarFiltros(!mostrarFiltros)}
                className="text-[9px] bg-zinc-800 px-4 py-2 rounded-full font-bold border border-white/10"
              >
                FILTROS
              </button>
            )}
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
              <div className="bg-zinc-900 rounded-2xl border border-white/5 p-4 space-y-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-blue-400">
                      Filtros estilo Excel
                    </p>
                    <p className="text-[11px] text-zinc-500 mt-1">
                      Cada campo tem busca de opções e seleção individual.
                    </p>
                  </div>

                  <button
                    onClick={limparFiltros}
                    className="text-[10px] font-black uppercase px-4 py-2 rounded-xl bg-red-500/10 text-red-400 border border-red-500/20"
                  >
                    Limpar Tudo
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {CAMPOS_FILTRO.map((filtro) => (
                    <div
                      key={filtro.campo}
                      className="bg-black/20 border border-white/5 rounded-2xl p-3"
                    >
                      <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest block mb-2">
                        {filtro.label}
                      </label>

                      <input
                        type="text"
                        value={buscaOpcoesFiltro[filtro.campo] || ''}
                        onChange={(e) => atualizarBuscaOpcaoFiltro(filtro.campo, e.target.value)}
                        placeholder="Buscar opção..."
                        className="w-full mb-2 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-[11px] text-white outline-none"
                      />

                      <select
                        value={filtrosAtivos[filtro.campo]}
                        onChange={(e) => atualizarFiltro(filtro.campo, e.target.value)}
                        className="w-full bg-zinc-800 text-[11px] p-2.5 rounded-lg text-white outline-none border border-white/5"
                      >
                        {(opcoesFiltros[filtro.campo] || ['Todos']).map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
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
            <div className="bg-zinc-900/30 border border-white/5 rounded-2xl overflow-hidden">
              {carregando ? (
                <div className="text-center py-20 text-[10px] animate-pulse text-zinc-600 font-black uppercase tracking-widest">
                  Sincronizando...
                </div>
              ) : leadsFiltrados.length === 0 ? (
                <div className="text-center py-20 text-[10px] text-zinc-600 font-black uppercase tracking-widest">
                  Nenhum lead encontrado
                </div>
              ) : (
                <div className="divide-y divide-zinc-800/50">
                  {leadsPaginados.map((lead) => renderLinha(lead))}
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

        {moduloAtivo === MODULOS.ANALITICA && (
          <VisaoAnalitica
            leads={leads}
            totalAbsoluto={totalAbsoluto}
            carregando={carregando}
          />
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

      {incrementarModalAberto && (
        <IncrementarLeadModal
          lead={leadIncrementoSelecionado}
          isOpen={incrementarModalAberto}
          onClose={fecharIncrementarLead}
          onSave={salvarIncrementoLead}
          salvando={salvandoIncremento}
        />
      )}

      <nav className="fixed bottom-6 left-6 right-6 h-16 bg-zinc-900/90 backdrop-blur-md border border-white/10 rounded-full px-4 md:px-8 flex justify-around items-center z-50 shadow-2xl">
        {[ABAS.ESTOQUE, ABAS.TRIAGEM, ABAS.MESA].map((a) => (
          <button
            key={a}
            onClick={() => setAba(a)}
            className={`text-[10px] md:text-[11px] font-black uppercase tracking-widest ${
              aba === a ? 'text-blue-500' : 'text-zinc-600'
            }`}
          >
            {a === ABAS.ESTOQUE ? 'Estoque' : a === ABAS.TRIAGEM ? 'Triagem' : 'Mesa'}
          </button>
        ))}
      </nav>
    </div>
  );
}
