"use client";
import React, { useEffect } from 'react';

function LinhaInfo({ label, value, full = false }) {
  const texto =
    value === null || value === undefined || value === ''
      ? 'Não informado'
      : String(value);

  return (
    <div className={full ? 'md:col-span-2' : ''}>
      <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1">
        {label}
      </p>
      <div className="bg-zinc-900 border border-white/5 rounded-xl px-3 py-3 text-[12px] text-white break-words">
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

  if (!modalAberto || !lead) return null;

  return (
    <div className="fixed inset-0 z-[9999]">
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={handleClose}
      />

      <div className="absolute inset-0 flex items-center justify-center p-4 md:p-6">
        <div className="w-full max-w-5xl max-h-[92vh] overflow-hidden rounded-3xl border border-white/10 bg-zinc-950 shadow-2xl">
          <div className="sticky top-0 z-10 bg-zinc-950/95 backdrop-blur border-b border-white/5 px-5 py-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-widest text-blue-400 mb-2">
                  Visualização do Lead
                </p>

                <h2 className="text-lg md:text-2xl font-black uppercase text-white leading-tight break-words">
                  {lead.razao_social || 'Sem razão social'}
                </h2>

                {lead.nome_fantasia && lead.nome_fantasia !== lead.razao_social && (
                  <p className="text-[12px] text-zinc-400 mt-1 break-words">
                    Fantasia: {lead.nome_fantasia}
                  </p>
                )}
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

          <div className="overflow-y-auto max-h-[calc(92vh-88px)] px-5 py-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <LinhaInfo label="Razão Social" value={lead.razao_social} full />
              <LinhaInfo label="Nome Fantasia" value={lead.nome_fantasia} full />

              <LinhaInfo label="CNPJ" value={lead.cnpj} />
              <LinhaInfo label="Status do Lead" value={lead.status_lead} />

              <LinhaInfo label="Situação Cadastral" value={lead.situacao_cadastral} />
              <LinhaInfo label="Fonte do Lead" value={lead.fonte_lead} />

              <LinhaInfo label="Logradouro" value={lead.logradouro} />
              <LinhaInfo label="Número" value={lead.numero} />

              <LinhaInfo label="Bairro" value={lead.bairro} />
              <LinhaInfo label="Município" value={lead.municipio} />

              <LinhaInfo label="UF" value={lead.uf} />
              <LinhaInfo label="CEP" value={lead.cep} />

              <LinhaInfo label="Telefone" value={lead.telefone} />
              <LinhaInfo label="E-mail" value={lead.email} />

              <LinhaInfo label="Responsável" value={lead.responsavel} />
              <LinhaInfo label="Contato" value={lead.contato} />

              <LinhaInfo label="CNAE Principal Código" value={lead.cnae_principal_codigo} />
              <LinhaInfo label="CNAE Principal Descrição" value={lead.cnae_principal_descricao} full />

              <LinhaInfo label="CNAE Secundário" value={lead.cnae_secundario} full />

              <LinhaInfo label="Observações" value={lead.observacoes} full />
              <LinhaInfo label="Anotações" value={lead.anotacoes} full />

              <LinhaInfo label="Origem" value={lead.origem} />
              <LinhaInfo label="Cidade Operação" value={lead.cidade_operacao} />

              <LinhaInfo label="Responsável Comercial" value={lead.responsavel_comercial} />
              <LinhaInfo label="Último Contato" value={lead.ultimo_contato} />

              <LinhaInfo label="Próxima Ação" value={lead.proxima_acao} />
              <LinhaInfo label="Data Próxima Ação" value={lead.data_proxima_acao} />

              <LinhaInfo label="Volume Estimado" value={lead.volume_estimado} />
              <LinhaInfo label="Consumo Estimado" value={lead.consumo_estimado} />

              <LinhaInfo label="Segmento" value={lead.segmento} />
              <LinhaInfo label="Subsegmento" value={lead.subsegmento} />

              <LinhaInfo label="Tags" value={lead.tags} full />
              <LinhaInfo label="Histórico" value={lead.historico} full />

              <LinhaInfo label="Criado em" value={lead.created_at} />
              <LinhaInfo label="Atualizado em" value={lead.updated_at} />

              <LinhaInfo label="ID" value={lead.id} />
              <LinhaInfo label="UUID" value={lead.uuid} />
            </div>

            <div className="mt-6 flex justify-end">
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
