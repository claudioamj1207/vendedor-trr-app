"use client";
import React, { useMemo } from 'react';

const normalizarTexto = (valor) => String(valor || '').trim();

const numeroBR = (valor) => {
  const numero = Number(valor || 0);
  return numero.toLocaleString('pt-BR');
};

const percentualBR = (parte, total) => {
  if (!total) return '0%';
  return `${Math.round((parte / total) * 100)}%`;
};

const temValor = (valor) => {
  const texto = normalizarTexto(valor).toLowerCase();
  return texto && texto !== 'não informado' && texto !== 'nao informado' && texto !== 'null' && texto !== 'undefined';
};

const temTelefone = (lead) => temValor(lead.telefone_1) || temValor(lead.telefone_2);
const temEmail = (lead) => temValor(lead.email);
const temEndereco = (lead) =>
  temValor(lead.logradouro) &&
  temValor(lead.bairro) &&
  temValor(lead.municipio) &&
  temValor(lead.uf);
const estaAtivo = (lead) => normalizarTexto(lead.situacao_cadastral).toUpperCase().includes('ATIVA');

const contarPorCampo = (leads, campo, limite = 10) => {
  const mapa = new Map();

  leads.forEach((lead) => {
    const valor = normalizarTexto(lead[campo]) || 'Não informado';
    mapa.set(valor, (mapa.get(valor) || 0) + 1);
  });

  return Array.from(mapa.entries())
    .map(([nome, total]) => ({ nome, total }))
    .sort((a, b) => b.total - a.total || a.nome.localeCompare(b.nome, 'pt-BR'))
    .slice(0, limite);
};

const calcularPontuacao = (lead) => {
  let pontos = 0;

  if (estaAtivo(lead)) pontos += 3;
  if (temTelefone(lead)) pontos += 2;
  if (temEmail(lead)) pontos += 1;
  if (temEndereco(lead)) pontos += 2;
  if (temValor(lead.contato_nome)) pontos += 2;
  if (temValor(lead.cnae_principal_descricao)) pontos += 1;
  if (Number(lead.capital_social || 0) > 0) pontos += 1;
  if (temValor(lead.categoria_trr)) pontos += 1;
  if (temValor(lead.potencial_consumo) && lead.potencial_consumo !== 'Nao Avaliado') pontos += 1;

  return pontos;
};

const CardIndicador = ({ titulo, valor, subtitulo, destaque = false }) => (
  <div className={`rounded-3xl border p-5 ${destaque ? 'bg-blue-950/30 border-blue-500/20' : 'bg-zinc-900/60 border-white/5'}`}>
    <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">{titulo}</p>
    <p className="text-3xl font-black tracking-tighter text-white">{valor}</p>
    {subtitulo && <p className="text-[11px] text-zinc-400 mt-2">{subtitulo}</p>}
  </div>
);

const BarraRanking = ({ item, total }) => {
  const largura = total ? Math.max(6, Math.round((item.total / total) * 100)) : 0;

  return (
    <div className="space-y-1">
      <div className="flex justify-between gap-3 text-[11px]">
        <span className="text-zinc-300 font-bold truncate">{item.nome}</span>
        <span className="text-zinc-500 font-black shrink-0">{numeroBR(item.total)}</span>
      </div>
      <div className="h-2 rounded-full bg-zinc-800 overflow-hidden">
        <div className="h-full rounded-full bg-blue-600" style={{ width: `${largura}%` }} />
      </div>
    </div>
  );
};

const BlocoRanking = ({ titulo, itens, totalBase }) => (
  <div className="bg-zinc-900/60 border border-white/5 rounded-3xl p-5">
    <h3 className="text-sm font-black uppercase tracking-widest text-white mb-4">{titulo}</h3>
    {itens.length === 0 ? (
      <p className="text-[11px] text-zinc-500">Sem dados suficientes.</p>
    ) : (
      <div className="space-y-4">
        {itens.map((item) => (
          <BarraRanking key={item.nome} item={item} total={totalBase || itens[0]?.total || 1} />
        ))}
      </div>
    )}
  </div>
);

export default function VisaoAnalitica({ leads = [], totalAbsoluto = 0, carregando = false }) {
  const analise = useMemo(() => {
    const total = leads.length;
    const ativos = leads.filter(estaAtivo).length;
    const comTelefone = leads.filter(temTelefone).length;
    const comEmail = leads.filter(temEmail).length;
    const comEndereco = leads.filter(temEndereco).length;
    const comContato = leads.filter((lead) => temValor(lead.contato_nome)).length;
    const semTelefone = total - comTelefone;
    const semEmail = total - comEmail;
    const semEndereco = total - comEndereco;
    const semCnae = leads.filter((lead) => !temValor(lead.cnae_principal_descricao)).length;

    const completos = leads.filter((lead) =>
      estaAtivo(lead) && temTelefone(lead) && temEmail(lead) && temEndereco(lead)
    ).length;

    const topOportunidades = [...leads]
      .map((lead) => ({
        ...lead,
        pontuacao_analitica: calcularPontuacao(lead)
      }))
      .sort((a, b) => b.pontuacao_analitica - a.pontuacao_analitica || normalizarTexto(a.razao_social).localeCompare(normalizarTexto(b.razao_social), 'pt-BR'))
      .slice(0, 12);

    return {
      total,
      ativos,
      comTelefone,
      comEmail,
      comEndereco,
      comContato,
      semTelefone,
      semEmail,
      semEndereco,
      semCnae,
      completos,
      porStatusLead: contarPorCampo(leads, 'status_lead', 8),
      porStatusVendedor: contarPorCampo(leads, 'status_vendedor', 8),
      porMunicipio: contarPorCampo(leads, 'municipio', 10),
      porBairro: contarPorCampo(leads, 'bairro', 10),
      porCnae: contarPorCampo(leads, 'cnae_principal_descricao', 10),
      porSituacao: contarPorCampo(leads, 'situacao_cadastral', 8),
      topOportunidades
    };
  }, [leads]);

  if (carregando) {
    return (
      <div className="text-center py-20 text-[10px] animate-pulse text-zinc-600 font-black uppercase tracking-widest">
        Montando visão analítica...
      </div>
    );
  }

  if (!analise.total) {
    return (
      <div className="bg-zinc-900/40 border border-white/5 rounded-3xl p-8 text-center">
        <p className="text-sm font-black uppercase tracking-widest text-zinc-400">Nenhum lead encontrado para análise</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-zinc-900/50 border border-white/5 rounded-3xl p-5">
        <p className="text-[10px] font-black uppercase tracking-widest text-blue-400 mb-2">Radar do Banco</p>
        <p className="text-[12px] text-zinc-400 leading-relaxed">
          Esta tela é somente analítica. Ela lê os leads carregados do Supabase e mostra qualidade, distribuição e prioridade de trabalho sem alterar nenhum registro.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <CardIndicador titulo="Total no banco" valor={numeroBR(totalAbsoluto || analise.total)} subtitulo={`${numeroBR(analise.total)} carregados na análise`} destaque />
        <CardIndicador titulo="Ativos" valor={numeroBR(analise.ativos)} subtitulo={percentualBR(analise.ativos, analise.total)} />
        <CardIndicador titulo="Com telefone" valor={numeroBR(analise.comTelefone)} subtitulo={percentualBR(analise.comTelefone, analise.total)} />
        <CardIndicador titulo="Com endereço" valor={numeroBR(analise.comEndereco)} subtitulo={percentualBR(analise.comEndereco, analise.total)} />
        <CardIndicador titulo="Com e-mail" valor={numeroBR(analise.comEmail)} subtitulo={percentualBR(analise.comEmail, analise.total)} />
        <CardIndicador titulo="Com contato" valor={numeroBR(analise.comContato)} subtitulo={percentualBR(analise.comContato, analise.total)} />
        <CardIndicador titulo="Leads completos" valor={numeroBR(analise.completos)} subtitulo="Ativo + telefone + e-mail + endereço" />
        <CardIndicador titulo="Sem telefone" valor={numeroBR(analise.semTelefone)} subtitulo="Prioridade para enriquecimento" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <CardIndicador titulo="Sem e-mail" valor={numeroBR(analise.semEmail)} subtitulo="Pode exigir pesquisa manual" />
        <CardIndicador titulo="Sem endereço completo" valor={numeroBR(analise.semEndereco)} subtitulo="Afeta rota e análise territorial" />
        <CardIndicador titulo="Sem CNAE" valor={numeroBR(analise.semCnae)} subtitulo="Afeta segmentação" />
        <CardIndicador titulo="Taxa de completude" valor={percentualBR(analise.completos, analise.total)} subtitulo="Base dos melhores leads" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <BlocoRanking titulo="Funil por Status do Lead" itens={analise.porStatusLead} totalBase={analise.total} />
        <BlocoRanking titulo="Status do Vendedor" itens={analise.porStatusVendedor} totalBase={analise.total} />
        <BlocoRanking titulo="Municípios com mais leads" itens={analise.porMunicipio} totalBase={analise.total} />
        <BlocoRanking titulo="Bairros com mais leads" itens={analise.porBairro} totalBase={analise.total} />
        <BlocoRanking titulo="Situação cadastral" itens={analise.porSituacao} totalBase={analise.total} />
        <BlocoRanking titulo="CNAEs mais frequentes" itens={analise.porCnae} totalBase={analise.total} />
      </div>

      <div className="bg-zinc-900/60 border border-white/5 rounded-3xl p-5">
        <div className="flex justify-between items-center gap-3 mb-4 flex-wrap">
          <div>
            <h3 className="text-sm font-black uppercase tracking-widest text-white">Ranking de melhores oportunidades</h3>
            <p className="text-[11px] text-zinc-500 mt-1">Pontuação simples baseada em ativo, telefone, e-mail, endereço, contato, CNAE e capital social.</p>
          </div>
          <span className="text-[10px] font-black uppercase text-blue-400 tracking-widest">Top 12</span>
        </div>

        <div className="overflow-hidden rounded-2xl border border-white/5">
          <div className="grid grid-cols-12 gap-2 bg-black/30 px-4 py-3 text-[9px] font-black uppercase tracking-widest text-zinc-500">
            <div className="col-span-6">Lead</div>
            <div className="col-span-2">Cidade</div>
            <div className="col-span-2">Telefone</div>
            <div className="col-span-2 text-right">Pontos</div>
          </div>

          <div className="divide-y divide-white/5">
            {analise.topOportunidades.map((lead) => (
              <div key={lead.cnpj || lead.id} className="grid grid-cols-12 gap-2 px-4 py-3 text-[11px] items-center">
                <div className="col-span-6 min-w-0">
                  <p className="font-bold text-white truncate">{lead.razao_social || lead.nome_fantasia || 'Sem nome'}</p>
                  <p className="text-zinc-500 truncate">{lead.cnae_principal_descricao || 'CNAE não informado'}</p>
                </div>
                <div className="col-span-2 text-zinc-400 truncate">{lead.municipio || '—'}</div>
                <div className="col-span-2 text-zinc-400 truncate">{lead.telefone_1 || lead.telefone_2 || '—'}</div>
                <div className="col-span-2 text-right font-black text-blue-400">{lead.pontuacao_analitica}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

