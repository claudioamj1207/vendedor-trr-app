import React from 'react';

const formatarCampo = (valor, fallback = 'Não informado') => {
  if (valor === null || valor === undefined) return fallback;
  const texto = String(valor).trim();
  return texto ? texto : fallback;
};

export default function LeadVisualModal({ lead, onClose }) {
  if (!lead) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl bg-zinc-950 border border-white/10 rounded-3xl shadow-2xl overflow-hidden">

        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-blue-400">
              Visualizar Lead
            </p>
            <h2 className="text-lg font-black uppercase text-white mt-1">
              {formatarCampo(lead.razao_social, 'Sem nome')}
            </h2>
          </div>

          <button
            onClick={onClose}
            className="bg-zinc-800 px-4 py-2 rounded-full text-[10px] font-bold"
          >
            FECHAR
          </button>
        </div>

        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">

          <Campo label="CNPJ" valor={lead.cnpj} />
          <Campo label="Nome Fantasia" valor={lead.nome_fantasia} />
          <Campo label="Situação" valor={lead.situacao_cadastral} />

          <Campo label="Contato" valor={lead.contato_nome} />
          <Campo label="Telefone 1" valor={lead.telefone_1} />
          <Campo label="Telefone 2" valor={lead.telefone_2} />

          <Campo label="Email" valor={lead.email} full />
          <Campo label="IE" valor={lead.inscricao_estadual} />
          <Campo label="IM" valor={lead.inscricao_municipal} />

          <Campo label="Bairro" valor={lead.bairro} />
          <Campo label="Cidade" valor={lead.municipio} />
          <Campo label="UF" valor={lead.uf} />

          <Campo
            label="Endereço"
            valor={`${lead.logradouro || ''}${lead.numero ? `, ${lead.numero}` : ''}`}
            full
          />

          <Campo label="Endereço de Obra" valor={lead.endereco_obra} full />
          <Campo label="CNAE Principal" valor={lead.cnae_principal_descricao} full />
          <Campo label="CNAE Secundário" valor={lead.cnae_secundario} full />

          <Campo label="Observações" valor={lead.observacoes} full />
          <Campo label="Fonte" valor={lead.fonte_lead} full />

        </div>
      </div>
    </div>
  );
}

function Campo({ label, valor, full }) {
  return (
    <div className={`bg-zinc-900/70 p-3 rounded-xl border border-white/5 ${full ? 'md:col-span-2' : ''}`}>
      <p className="text-[9px] uppercase text-zinc-500 font-black">{label}</p>
      <p className="text-white mt-1 break-words">
        {valor || 'Não informado'}
      </p>
    </div>
  );
}
