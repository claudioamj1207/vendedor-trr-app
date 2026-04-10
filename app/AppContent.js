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
  const [mostrarBackup, setMostrarBackup] = useState(false);
  const [exportandoBackup, setExportandoBackup] = useState(false);
  const [totalAbsoluto, setTotalAbsoluto] = useState(0);
  const [ultimosCnpjsProcessados, setUltimosCnpjsProcessados] = useState([]);
  const [ultimosCnpjsFalhados, setUltimosCnpjsFalhados] = useState([]);
  const [paginaAtual, setPaginaAtual] = useState(1);
  const [filtrosAtivos, setFiltrosAtivos] = useState(FILTROS_INICIAIS);
  const [buscaDebounced, setBuscaDebounced] = useState('');

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

  // ================= BACKUP COMPLETO =================

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
        setErroBusca('Nenhum registro encontrado para backup.');
        return;
      }

      const planilha = dados.map((l) => ({
        'Razão Social': l.razao_social || '',
        'Nome Fantasia': l.nome_fantasia || '',
        'CNPJ': formatarCNPJ(l.cnpj || ''),
        'Bairro': l.bairro || '',
        'Cidade': l.municipio || '',
        'UF': l.uf || '',
        'CNAE': l.cnae_principal_descricao || '',
        'Status': l.status_lead || ''
      }));

      const ws = XLSX.utils.json_to_sheet(planilha);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Backup');
      XLSX.writeFile(wb, 'backup-banco-completo.xlsx');

      setResultadoBusca(`${dados.length} registro(s) exportado(s) com sucesso.`);
      setMostrarBackup(false);
    } catch (e) {
      setErroBusca('Erro no backup: ' + e.message);
    } finally {
      setExportandoBackup(false);
    }
  }, [buscarTodosDoBanco, limparMensagens]);

  // ================= RESTANTE DO APP =================

  const sincronizar = useCallback(async () => {
    try {
      setCarregando(true);

      const { count } = await supabase
        .from('empresas_mestre')
        .select('*', { count: 'exact', head: true });

      setTotalAbsoluto(count || 0);

      const { data } = await supabase
        .from('empresas_mestre')
        .select('*')
        .limit(1000);

      setLeads((data || []).map(enriquecerLeadParaBusca));
    } catch (e) {
      setErroBusca('Erro ao carregar dados');
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    sincronizar();
  }, [sincronizar]);

  return (
    <div className="min-h-screen bg-black text-white p-6">
      <h1 className="text-xl font-bold mb-4">Vendedor TRR</h1>

      <button
        onClick={() => setMostrarBackup(!mostrarBackup)}
        className="bg-blue-600 px-4 py-2 rounded"
      >
        BACKUP XLSX
      </button>

      {mostrarBackup && (
        <div className="mt-4 bg-zinc-900 p-4 rounded">
          <p className="text-sm mb-2">Exportar todo banco</p>

          <button
            onClick={exportarBackupBancoCompleto}
            className="bg-emerald-600 px-4 py-2 rounded"
          >
            {exportandoBackup ? 'Gerando...' : 'Confirmar Backup'}
          </button>
        </div>
      )}

      <div className="mt-6">
        {carregando ? (
          <p>Carregando...</p>
        ) : (
          leads.map((l) => (
            <div key={l.cnpj}>{l.razao_social}</div>
          ))
        )}
      </div>
    </div>
  );
}
