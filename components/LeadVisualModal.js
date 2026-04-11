"use client";
import React, { useEffect, useMemo } from 'react';

function formatarCNPJ(cnpj) {
  const limpo = String(cnpj || '').replace(/\D/g, '');
  if (limpo.length !== 14) return cnpj || 'Não informado';
  return limpo.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
}

function formatarMoeda(valor) {
  if (valor === null || valor === undefined || valor === '') return 'Não informado';

  const numero = Number(valor);
  if (Number.isNaN(numero)) return String(valor);

  return numero.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  });
}

function formatarData(valor) {
  if (!valor) return 'Não informado';

  const texto = String(valor).trim();
  if (!texto) return 'Não informado';

  if (/^\d{4}-\d{2}-\d{2}$/.test(texto)) {
    const [yyyy, mm, dd] = texto.split('-');
    return `${dd}/${mm}/${yyyy}`;
  }

  const data = new Date(texto);
  if (!Number.isNaN(data.getTime())) {
    return data.toLocaleString('pt-BR');
  }

  return texto;
}

function montarEndereco(lead) {
  const partes = [
    lead?.logradouro,
    lead?.numero,
    lead?.complemento,
    lead?.bairro,
    lead?.municipio,
    lead?.uf,
    lead?.cep
  ].filter(Boolean);

  return partes.length > 0 ? partes.join(', ') : 'Não informado';
}

function Bloco({ titulo, children }) {
  return (
    <section className="bg-zinc-900/70 border border-white/5 rounded-2xl p-4 md:p-5">
      <h3 className="text-[11px] font-black uppercase tracking-widest text-blue-400 mb-4">
        {titulo}
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {children}
      </div>
    </section>
  );
}

function LinhaInfo({ label, value, full = false }) {
  const texto =
    value === null || value === undefined || value === ''
      ? 'Não informado'
      : String(value);

  return (
    <div className={full ? 'md:col-span-2' : ''}>
      <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1.5">
        {label}
      </p>
      <div className="bg-black/20 border border-white/5 rounded-xl px-3 py-3 text-[12px] text-white break-words min-h-[46px] flex items-center">
        {texto}
      </div>
    </div>
  );
}

export default function LeadVisualModal({
  lead,
  isOpen,
  open,
  visible,
  onClose,
  fechar
}) {
  const modalAberto = isOpen ?? open ?? visible ?? false;
  const handleClose = onClose || fechar || (() => {});

  useEffect(() => {
    if (!modalAberto) return;

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        handleClose();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = 'auto';
    };
  }, [modalAberto, handleClose]);

  const camposPrincipais = useMemo(() => new Set([
    'id',
    'cnpj',
    'razao_social',
    'nome_fantasia',
    'situacao_cadastral',
    'data_abertura',
    'cnae_principal_codigo',
    'cnae_principal_descricao',
    'capital_social',
    'logradouro',
    'numero',
    'bairro',
    'municipio',
    'uf',
    'cep',
    'telefone_1',
    'telefone_2',
    'email',
    'categoria_trr',
    'potencial_consumo',
    'status_vendedor',
    'ultima_interacao',
    'observacoes_venda',
    'criado_em',
    'lat',
    'lng',
    'data_inicio_atividade',
    'descricao_cnae',
    'complemento',
    'porte',
    'status_lead',
    'observacoes',
    'acoes_prospeccao',
    'resultado_campo',
    'notas_campo',
    'contato_nome',
    'inscricao_estadual',
    'inscricao_municipal',
    'endereco_obra',
    'classificacao_fornecedor',
    'historico_visitas',
    'registro_visita',
    'data_reagendada',
    'fonte_lead',
    'data_captacao',
    'cnae_secundario'
  ]), []);

  const camposExtras = useMemo(() => {
    if (!lead) return [];

    return Object.entries(lead)
      .filter(([chave, valor]) => {
        if (camposPrincipais.has(chave)) return false;
        if (chave === '_busca' || chave === 'cnpj_normalizado') return false;
        if (valor === null || valor === undefined || valor === '') return false;
        return true;
      })
      .sort(([a], [b]) => a.localeCompare(b));
  }, [camposPrincipais, lead]);

  if (!modalAberto || !lead) return null;

  return (
    <div className="fixed inset-0 z-[9999]">
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={handleClose}
      />

      <div className="absolute inset-0 flex items-center justify-center p-4 md:p-6">
        <div className="w-full max-w-6xl max-h-[94vh] overflow-hidden rounded-3xl border border-white/10 bg-zinc-950 shadow-2xl">
          <div className="sticky top-0 z-10 bg-zinc-950/95 backdrop-blur border-b border-white/5 px-5 py-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-widest text-blue-400 mb-2">
                  Painel do Lead
                </p>

                <h2 className="text-lg md:text-2xl font-black uppercase text-white leading-tight break-words">
                  {lead.razao_social || 'Sem razão social'}
                </h2>

                <div className="flex flex-wrap gap-2 mt-3">
                  <span className="text-[10px] bg-blue-900/20 px-3 py-1 rounded-full text-blue-300 font-black border border-blue-500/10">
                    {formatarCNPJ(lead.cnpj)}
                  </span>

                  <span className="text-[10px] bg-zinc-800 px-3 py-1 rounded-full text-zinc-300 font-black border border-white/5 uppercase">
                    {lead.status_lead || 'Sem status'}
                  </span>

                  <span className="text-[10px] bg-violet-900/20 px-3 py-1 rounded-full text-violet-300 font-black border border-violet-500/10 uppercase">
                    {lead.status_vendedor || 'Sem status vendedor'}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleClose}
                className="shrink-0 h-11 px-4 rounded-xl bg-red-600 text-white text-[11px] font-black uppercase tracking-wide hover:bg-red-500 active:scale-95 transition-all"
              >
                Fechar
              </button>
            </div>
          </div>

          <div className="overflow-y-auto max-h-[calc(94vh-94px)] px-5 py-5 space-y-5">
            <Bloco titulo="Dados da empresa">
              <LinhaInfo label="Razão Social" value={lead.razao_social} full />
              <LinhaInfo label="Nome Fantasia" value={lead.nome_fantasia} full />
              <LinhaInfo label="CNPJ" value={formatarCNPJ(lead.cnpj)} />
              <LinhaInfo label="Situação Cadastral" value={lead.situacao_cadastral} />
              <LinhaInfo label="Status do Lead" value={lead.status_lead} />
              <LinhaInfo label="Status do Vendedor" value={lead.status_vendedor} />
              <LinhaInfo label="Fonte do Lead" value={lead.fonte_lead} />
              <LinhaInfo label="Categoria TRR" value={lead.categoria_trr} />
              <LinhaInfo label="Porte" value={lead.porte} />
              <LinhaInfo label="Capital Social" value={formatarMoeda(lead.capital_social)} />
              <LinhaInfo label="Data de Abertura" value={formatarData(lead.data_abertura)} />
              <LinhaInfo label="Data Início Atividade" value={formatarData(lead.data_inicio_atividade)} />
            </Bloco>

            <Bloco titulo="Endereço">
              <LinhaInfo label="Endereço Completo" value={montarEndereco(lead)} full />
              <LinhaInfo label="Logradouro" value={lead.logradouro} />
              <LinhaInfo label="Número" value={lead.numero} />
              <LinhaInfo label="Complemento" value={lead.complemento} />
              <LinhaInfo label="Bairro" value={lead.bairro} />
              <LinhaInfo label="Município" value={lead.municipio} />
              <LinhaInfo label="UF" value={lead.uf} />
              <LinhaInfo label="CEP" value={lead.cep} />
              <LinhaInfo label="Endereço de Obra" value={lead.endereco_obra} full />
            </Bloco>

            <Bloco titulo="Contatos e inscrições">
              <LinhaInfo label="Contato" value={lead.contato_nome} />
              <LinhaInfo label="Telefone 1" value={lead.telefone_1} />
              <LinhaInfo label="Telefone 2" value={lead.telefone_2} />
              <LinhaInfo label="Email" value={lead.email} full />
              <LinhaInfo label="Inscrição Estadual" value={lead.inscricao_estadual} />
              <LinhaInfo label="Inscrição Municipal" value={lead.inscricao_municipal} />
            </Bloco>

            <Bloco titulo="CNAE e classificação">
              <LinhaInfo label="CNAE Principal Código" value={lead.cnae_principal_codigo} />
              <LinhaInfo label="Descrição CNAE" value={lead.descricao_cnae || lead.cnae_principal_descricao} />
              <LinhaInfo label="CNAE Principal" value={lead.cnae_principal_descricao} full />
              <LinhaInfo label="CNAE Secundário" value={lead.cnae_secundario} full />
              <LinhaInfo label="Classificação do Fornecedor" value={lead.classificacao_fornecedor} />
              <LinhaInfo label="Potencial de Consumo" value={lead.potencial_consumo} />
            </Bloco>

            <Bloco titulo="Triagem e campo">
              <LinhaInfo label="Observações" value={lead.observacoes} full />
              <LinhaInfo label="Ações de Prospecção" value={lead.acoes_prospeccao} full />
              <LinhaInfo label="Resultado de Campo" value={lead.resultado_campo} />
              <LinhaInfo label="Notas de Campo" value={lead.notas_campo} />
              <LinhaInfo label="Registro de Visita" value={lead.registro_visita} full />
              <LinhaInfo label="Observações de Venda" value={lead.observacoes_venda} full />
            </Bloco>

            <Bloco titulo="Controle interno">
              <LinhaInfo label="Última Interação" value={formatarData(lead.ultima_interacao)} />
              <LinhaInfo label="Data de Captação" value={formatarData(lead.data_captacao)} />
              <LinhaInfo label="Criado em" value={formatarData(lead.criado_em)} />
              <LinhaInfo label="Latitude" value={lead.lat} />
              <LinhaInfo label="Longitude" value={lead.lng} />
              <LinhaInfo label="ID" value={lead.id} full />
            </Bloco>

            {camposExtras.length > 0 && (
              <Bloco titulo="Dados adicionais">
                {camposExtras.map(([chave, valor]) => (
                  <LinhaInfo
                    key={chave}
                    label={chave.replace(/_/g, ' ')}
                    value={typeof valor === 'object' ? JSON.stringify(valor) : String(valor)}
                    full
                  />
                ))}
              </Bloco>
            )}

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={handleClose}
                className="h-11 px-5 rounded-xl bg-zinc-800 border border-white/10 text-white text-[11px] font-black uppercase tracking-wide hover:bg-zinc-700 active:scale-95 transition-all"
              >
                Sair
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
