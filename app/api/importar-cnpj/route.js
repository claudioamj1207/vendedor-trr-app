import { NextResponse } from 'next/server';
import { supabase } from '../../../../lib/supabase';
import { consultarCNPJNaBrasilAPI } from '../../../../lib/brasilApi';

const STATUS_LEAD = {
  NOVO: 'Novo',
};

const normalizarCNPJ = (cnpj) => String(cnpj || '').replace(/\D/g, '');

const valorTexto = (valor, fallback = '') => {
  if (valor === null || valor === undefined) return fallback;
  const texto = String(valor).trim();
  return texto === '' ? fallback : texto;
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

const montarPayloadReceita = (leadExistente = {}, info = {}, fontePadrao = 'Meu To Do - aba CNPJ') => {
  return {
    ...leadExistente,
    cnpj: normalizarCNPJ(info.cnpj || leadExistente.cnpj || ''),
    razao_social: valorTexto(info.razao_social, leadExistente.razao_social || ''),
    nome_fantasia: valorTexto(
      info.nome_fantasia,
      leadExistente.nome_fantasia || info.razao_social || ''
    ),
    situacao_cadastral: valorTexto(
      info.descricao_situacao_cadastral,
      leadExistente.situacao_cadastral || 'ATIVA'
    ),
    data_abertura:
      converterDataBRparaISO(info.data_inicio_atividade) ||
      leadExistente.data_abertura ||
      null,
    cnae_principal_codigo: info.cnae_fiscal
      ? String(info.cnae_fiscal)
      : (leadExistente.cnae_principal_codigo || ''),
    cnae_principal_descricao: valorTexto(
      info.cnae_fiscal_descricao,
      leadExistente.cnae_principal_descricao || 'Não informado'
    ),
    capital_social:
      converterNumero(info.capital_social) ??
      leadExistente.capital_social ??
      null,
    logradouro: valorTexto(info.logradouro, leadExistente.logradouro || ''),
    numero: valorTexto(info.numero, leadExistente.numero || ''),
    bairro: valorTexto(info.bairro, leadExistente.bairro || ''),
    municipio: valorTexto(info.municipio, leadExistente.municipio || ''),
    uf: valorTexto(info.uf, leadExistente.uf || ''),
    cep: valorTexto(info.cep, leadExistente.cep || ''),
    telefone_1: valorTexto(info.telefone_1, leadExistente.telefone_1 || ''),
    telefone_2: valorTexto(info.telefone_2, leadExistente.telefone_2 || ''),
    email: valorTexto(info.email, leadExistente.email || ''),
    data_inicio_atividade: valorTexto(
      info.data_inicio_atividade,
      leadExistente.data_inicio_atividade || ''
    ),
    complemento: valorTexto(info.complemento, leadExistente.complemento || ''),
    porte: valorTexto(info.porte, leadExistente.porte || ''),
    status_lead: leadExistente.status_lead || STATUS_LEAD.NOVO,
    observacoes: leadExistente.observacoes || '',
    acoes_prospeccao: leadExistente.acoes_prospeccao || '',
    resultado_campo: leadExistente.resultado_campo || '',
    notas_campo: leadExistente.notas_campo || '',
    contato_nome: leadExistente.contato_nome || '',
    inscricao_estadual: leadExistente.inscricao_estadual || '',
    inscricao_municipal: leadExistente.inscricao_municipal || '',
    endereco_obra: leadExistente.endereco_obra || '',
    classificacao_fornecedor: leadExistente.classificacao_fornecedor || '',
    historico_visitas: leadExistente.historico_visitas || [],
    registro_visita: leadExistente.registro_visita || '',
    data_reagendada: leadExistente.data_reagendada || null,
    fonte_lead: leadExistente.fonte_lead || fontePadrao,
    data_captacao: leadExistente.data_captacao || null,
    cnae_secundario: montarCNAESecundario(info.cnaes_secundarios),
    categoria_trr: leadExistente.categoria_trr || '',
    potencial_consumo: leadExistente.potencial_consumo || 'Nao Avaliado',
    status_vendedor: leadExistente.status_vendedor || 'Lead Bruto',
    ultima_interacao: new Date().toISOString(),
    observacoes_venda: leadExistente.observacoes_venda || '',
    lat: leadExistente.lat ?? null,
    lng: leadExistente.lng ?? null,
    descricao_cnae: valorTexto(
      info.cnae_fiscal_descricao,
      leadExistente.descricao_cnae || ''
    ),
  };
};

async function processarCNPJViaAPI(cnpj, origem = 'Meu To Do - aba CNPJ') {
  const cnpjLimpo = normalizarCNPJ(cnpj);

  if (cnpjLimpo.length !== 14) {
    throw new Error('CNPJ inválido.');
  }

  const consulta = await consultarCNPJNaBrasilAPI(cnpjLimpo);

  if (!consulta.ok) {
    throw new Error(consulta.erro || 'Falha ao consultar CNPJ.');
  }

  const info = consulta.dados || {};

  const { data: existente, error: erroExistente } = await supabase
    .from('empresas_mestre')
    .select('*')
    .eq('cnpj', cnpjLimpo)
    .maybeSingle();

  if (erroExistente) {
    throw new Error(`Erro ao consultar banco: ${erroExistente.message}`);
  }

  const payload = montarPayloadReceita(existente || {}, info, origem);

  const { error: erroUpsert } = await supabase
    .from('empresas_mestre')
    .upsert(payload, { onConflict: 'cnpj' });

  if (erroUpsert) {
    throw new Error(`Erro ao salvar no estoque: ${erroUpsert.message}`);
  }

  return payload;
}

export async function POST(req) {
  try {
    const body = await req.json();
    const cnpj = normalizarCNPJ(body?.cnpj || '');
    const origem = valorTexto(body?.origem, 'Meu To Do - aba CNPJ');

    if (!cnpj || cnpj.length !== 14) {
      return NextResponse.json(
        { ok: false, error: 'CNPJ inválido. Envie 14 números.' },
        { status: 400 }
      );
    }

    const payloadSalvo = await processarCNPJViaAPI(cnpj, origem);

    return NextResponse.json({
      ok: true,
      message: 'CNPJ recebido, consultado e salvo no estoque do VTRR.',
      empresa: {
        cnpj: payloadSalvo.cnpj,
        razao_social: payloadSalvo.razao_social,
        nome_fantasia: payloadSalvo.nome_fantasia,
        status_lead: payloadSalvo.status_lead,
        fonte_lead: payloadSalvo.fonte_lead,
      },
    });
  } catch (error) {
    console.error('Erro na rota /api/importar-cnpj:', error);

    return NextResponse.json(
      {
        ok: false,
        error: error?.message || 'Erro interno ao importar CNPJ.',
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    message: 'Rota /api/importar-cnpj online.',
  });
}
