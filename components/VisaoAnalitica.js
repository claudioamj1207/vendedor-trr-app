"use client";
import React, { useMemo } from 'react';

const texto = (valor, fallback = 'Não informado') => {
  const limpo = String(valor || '').trim();
  if (!limpo || limpo.toLowerCase() === 'null' || limpo.toLowerCase() === 'undefined') return fallback;
  return limpo;
};

const numeroBR = (valor) => Number(valor || 0).toLocaleString('pt-BR');
const percentual = (parte, total) => (!total ? 0 : Math.round((parte / total) * 100));

const temValor = (valor) => {
  const v = String(valor || '').trim();
  return !!v && v.toLowerCase() !== 'não informado' && v.toLowerCase() !== 'nao informado' && v.toLowerCase() !== 'null' && v.toLowerCase() !== 'undefined';
};

const enderecoCompleto = (lead) => (
  temValor(lead.logradouro) &&
  temValor(lead.numero) &&
  temValor(lead.bairro) &&
  temValor(lead.municipio) &&
  temValor(lead.uf)
);

const telefoneLead = (lead) => temValor(lead.telefone_1) || temValor(lead.telefone_2);
const emailLead = (lead) => temValor(lead.email);
const contatoLead = (lead) => temValor(lead.contato_nome);
const ativoLead = (lead) => String(lead.situacao_cadastral || '').toLowerCase().includes('ativa');

const cardClasses = {
  blue: 'bg-blue-50 border-blue-100 text-blue-950',
  emerald: 'bg-emerald-50 border-emerald-100 text-emerald-950',
  amber: 'bg-amber-50 border-amber-100 text-amber-950',
  rose: 'bg-rose-50 border-rose-100 text-rose-950',
  violet: 'bg-violet-50 border-violet-100 text-violet-950',
  cyan: 'bg-cyan-50 border-cyan-100 text-cyan-950',
  slate: 'bg-slate-50 border-slate-200 text-slate-950'
};

const badgeClasses = {
  blue: 'bg-blue-100 text-blue-800',
  emerald: 'bg-emerald-100 text-emerald-800',
  amber: 'bg-amber-100 text-amber-800',
  rose: 'bg-rose-100 text-rose-800',
  violet: 'bg-violet-100 text-violet-800',
  cyan: 'bg-cyan-100 text-cyan-800',
  slate: 'bg-slate-100 text-slate-700'
};

const CardKpi = ({ titulo, valor, subtitulo, cor = 'blue', icone = '📊' }) => (
  <div className={`rounded-3xl border p-5 shadow-sm ${cardClasses[cor] || cardClasses.blue}`}>
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-[10px] uppercase tracking-[0.18em] font-black opacity-70">{titulo}</p>
        <p className="text-3xl md:text-4xl font-black tracking-tighter mt-2">{valor}</p>
      </div>
      <div className={`w-11 h-11 rounded-2xl flex items-center justify-center text-xl shadow-sm ${badgeClasses[cor] || badgeClasses.blue}`}>
        {icone}
      </div>
    </div>
    {subtitulo && <p className="text-[11px] text-slate-500 mt-3 leading-relaxed">{subtitulo}</p>}
  </div>
);

const BarraProgresso = ({ valor, total, cor = 'bg-blue-500' }) => {
  const pct = percentual(valor, total);
  return (
    <div className="mt-2 h-2.5 bg-slate-100 rounded-full overflow-hidden">
      <div className={`h-full ${cor}`} style={{ width: `${Math.min(100, pct)}%` }} />
    </div>
  );
};

const agrupar = (leads, resolverNome, limite = 10) => {
  const mapa = new Map();

  leads.forEach((lead) => {
    const nome = resolverNome(lead) || 'Não informado';
    const atual = mapa.get(nome) || { nome, total: 0 };
    atual.total += 1;
    mapa.set(nome, atual);
  });

  return Array.from(mapa.values())
    .sort((a, b) => b.total - a.total || a.nome.localeCompare(b.nome, 'pt-BR'))
    .slice(0, limite);
};

const ListaResumo = ({ titulo, itens, total, cor = 'bg-blue-500', icone = '📌' }) => (
  <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm">
    <div className="flex items-center justify-between gap-3 mb-4">
      <div>
        <p className="text-[10px] uppercase tracking-[0.18em] font-black text-slate-400">{icone} {titulo}</p>
        <h3 className="text-lg font-black text-slate-950 mt-1">Top {itens.length}</h3>
      </div>
      <span className="text-[10px] font-black uppercase bg-slate-100 text-slate-500 rounded-full px-3 py-1">Ranking</span>
    </div>

    <div className="space-y-3">
      {itens.map((item, index) => (
        <div key={`${item.nome}-${index}`} className="bg-slate-50 border border-slate-100 rounded-2xl p-3">
          <div className="flex justify-between items-start gap-3">
            <p className="text-[12px] font-black text-slate-800 leading-snug min-w-0">{index + 1}. {item.nome}</p>
            <div className="text-right shrink-0">
              <p className="text-sm font-black text-slate-950">{numeroBR(item.total)}</p>
              <p className="text-[9px] font-black uppercase text-slate-400">{percentual(item.total, total)}%</p>
            </div>
          </div>
          <BarraProgresso valor={item.total} total={total} cor={cor} />
        </div>
      ))}
    </div>
  </div>
);

export default function VisaoAnalitica({ leads = [], totalAbsoluto = 0, carregando = false }) {
  const dados = useMemo(() => {
    const total = leads.length;

    const comTelefone = leads.filter(telefoneLead).length;
    const comEmail = leads.filter(emailLead).length;
    const comContato = leads.filter(contatoLead).length;
    const comEndereco = leads.filter(enderecoCompleto).length;
    const ativos = leads.filter(ativoLead).length;

    const completos = leads.filter((lead) =>
      telefoneLead(lead) &&
      emailLead(lead) &&
      contatoLead(lead) &&
      enderecoCompleto(lead)
    ).length;

    const semTelefone = total - comTelefone;
    const semEmail = total - comEmail;

    const porStatus = agrupar(leads, (lead) => texto(lead.status_lead), 8);
    const porMunicipio = agrupar(leads, (lead) => `${texto(lead.municipio)} / ${texto(lead.uf, '')}`, 12);
    const porBairro = agrupar(leads, (lead) => texto(lead.bairro), 12);
    const porFonte = agrupar(leads, (lead) => texto(lead.fonte_lead), 10);
    const porSituacao = agrupar(leads, (lead) => texto(lead.situacao_cadastral), 8);

    return {
      total,
      comTelefone,
      comEmail,
      comContato,
      comEndereco,
      ativos,
      completos,
      semTelefone,
      semEmail,
      porStatus,
      porMunicipio,
      porBairro,
      porFonte,
      porSituacao
    };
  }, [leads]);

  if (carregando) {
    return (
      <div className="bg-slate-50 border border-slate-200 rounded-3xl p-10 text-center text-slate-500">
        <p className="text-[10px] uppercase tracking-[0.24em] font-black animate-pulse">Montando visão analítica...</p>
      </div>
    );
  }

  if (!dados.total) {
    return (
      <div className="bg-slate-50 border border-slate-200 rounded-3xl p-10 text-center text-slate-500">
        <p className="text-sm font-black uppercase">Nenhum lead carregado para análise.</p>
      </div>
    );
  }

  return (
    <section className="bg-[#f4f7fb] text-slate-950 rounded-[2rem] p-4 md:p-6 space-y-6 shadow-sm">
      <div className="bg-white border border-slate-200 rounded-[2rem] p-6 shadow-sm overflow-hidden relative">
        <div className="absolute -right-16 -top-16 w-52 h-52 rounded-full bg-blue-100 blur-3xl" />
        <div className="absolute -left-16 -bottom-16 w-52 h-52 rounded-full bg-emerald-100 blur-3xl" />
        <div className="relative">
          <p className="text-[10px] uppercase tracking-[0.3em] font-black text-blue-600">CRM Moderno • Diagnóstico do Banco</p>
          <h2 className="text-2xl md:text-4xl font-black tracking-tighter mt-2 text-slate-950">Visão analítica dos leads</h2>
          <p className="text-sm text-slate-500 mt-3 max-w-3xl leading-relaxed">
            Painel claro para enxergar a estrutura do banco, distribuição dos leads e pontos que merecem atenção operacional.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <CardKpi titulo="Leads na tela" valor={numeroBR(dados.total)} subtitulo={`Total no banco: ${numeroBR(totalAbsoluto || dados.total)}`} cor="blue" icone="📦" />
        <CardKpi titulo="Completos" valor={`${percentual(dados.completos, dados.total)}%`} subtitulo={`${numeroBR(dados.completos)} leads com contato, telefone, e-mail e endereço.`} cor="emerald" icone="✅" />
        <CardKpi titulo="Atenção" valor={numeroBR(dados.semTelefone + dados.semEmail)} subtitulo="Soma de ausências de telefone e e-mail nos leads carregados." cor="amber" icone="⚠️" />
        <CardKpi titulo="Ativos" valor={`${percentual(dados.ativos, dados.total)}%`} subtitulo={`${numeroBR(dados.ativos)} leads com situação cadastral ativa.`} cor="violet" icone="🟣" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm xl:col-span-1">
          <p className="text-[10px] uppercase tracking-[0.18em] font-black text-slate-400">📋 Qualidade cadastral</p>
          <h3 className="text-lg font-black text-slate-950 mt-1">Leitura rápida</h3>

          <div className="mt-5 space-y-4">
            {[
              ['Telefone', dados.comTelefone, 'bg-emerald-500'],
              ['E-mail', dados.comEmail, 'bg-blue-500'],
              ['Contato', dados.comContato, 'bg-violet-500'],
              ['Endereço completo', dados.comEndereco, 'bg-amber-500']
            ].map(([label, valor, cor]) => (
              <div key={label}>
                <div className="flex justify-between text-[11px] font-black text-slate-700">
                  <span>{label}</span>
                  <span>{numeroBR(valor)} • {percentual(valor, dados.total)}%</span>
                </div>
                <BarraProgresso valor={valor} total={dados.total} cor={cor} />
              </div>
            ))}
          </div>
        </div>

        <ListaResumo titulo="Status dos leads" itens={dados.porStatus} total={dados.total} cor="bg-violet-500" icone="🧭" />
        <ListaResumo titulo="Situação cadastral" itens={dados.porSituacao} total={dados.total} cor="bg-emerald-500" icone="🏛️" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <ListaResumo titulo="Municípios" itens={dados.porMunicipio} total={dados.total} cor="bg-cyan-500" icone="🗺️" />
        <ListaResumo titulo="Bairros" itens={dados.porBairro} total={dados.total} cor="bg-amber-500" icone="📍" />
        <ListaResumo titulo="Fontes de lead" itens={dados.porFonte} total={dados.total} cor="bg-blue-500" icone="📥" />
      </div>
    </section>
  );
}
