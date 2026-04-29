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
const temContato = (lead) => temValor(lead.contato_nome);
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
  if (temContato(lead)) pontos += 2;
  if (temValor(lead.cnae_principal_descricao)) pontos += 1;
  if (Number(lead.capital_social || 0) > 0) pontos += 1;
  if (temValor(lead.categoria_trr)) pontos += 1;
  if (temValor(lead.potencial_consumo) && lead.potencial_consumo !== 'Nao Avaliado') pontos += 1;

  return pontos;
};

const corPorPercentual = (percentual) => {
  if (percentual >= 75) return 'emerald';
  if (percentual >= 45) return 'blue';
  if (percentual >= 20) return 'yellow';
  return 'red';
};

const classesCor = {
  blue: {
    card: 'bg-blue-950/40 border-blue-500/30 shadow-blue-950/30',
    texto: 'text-blue-300',
    numero: 'text-blue-100',
    barra: 'bg-blue-500',
    badge: 'bg-blue-500/15 text-blue-200 border-blue-400/20'
  },
  emerald: {
    card: 'bg-emerald-950/40 border-emerald-500/30 shadow-emerald-950/30',
    texto: 'text-emerald-300',
    numero: 'text-emerald-100',
    barra: 'bg-emerald-500',
    badge: 'bg-emerald-500/15 text-emerald-200 border-emerald-400/20'
  },
  yellow: {
    card: 'bg-yellow-950/35 border-yellow-500/30 shadow-yellow-950/30',
    texto: 'text-yellow-300',
    numero: 'text-yellow-100',
    barra: 'bg-yellow-500',
    badge: 'bg-yellow-500/15 text-yellow-200 border-yellow-400/20'
  },
  red: {
    card: 'bg-red-950/35 border-red-500/30 shadow-red-950/30',
    texto: 'text-red-300',
    numero: 'text-red-100',
    barra: 'bg-red-500',
    badge: 'bg-red-500/15 text-red-200 border-red-400/20'
  },
  violet: {
    card: 'bg-violet-950/40 border-violet-500/30 shadow-violet-950/30',
    texto: 'text-violet-300',
    numero: 'text-violet-100',
    barra: 'bg-violet-500',
    badge: 'bg-violet-500/15 text-violet-200 border-violet-400/20'
  },
  cyan: {
    card: 'bg-cyan-950/40 border-cyan-500/30 shadow-cyan-950/30',
    texto: 'text-cyan-300',
    numero: 'text-cyan-100',
    barra: 'bg-cyan-500',
    badge: 'bg-cyan-500/15 text-cyan-200 border-cyan-400/20'
  },
  zinc: {
    card: 'bg-zinc-900/60 border-white/5 shadow-black/20',
    texto: 'text-zinc-400',
    numero: 'text-white',
    barra: 'bg-zinc-500',
    badge: 'bg-zinc-500/15 text-zinc-200 border-white/10'
  }
};

const CardIndicador = ({ titulo, valor, subtitulo, cor = 'zinc', percentual = null, alerta = false }) => {
  const c = classesCor[cor] || classesCor.zinc;

  return (
    <div className={`rounded-3xl border p-5 shadow-lg ${c.card}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={`text-[10px] font-black uppercase tracking-widest mb-2 ${c.texto}`}>{titulo}</p>
          <p className={`text-3xl font-black tracking-tighter ${c.numero}`}>{valor}</p>
        </div>
        {alerta && (
          <span className="text-[10px] font-black bg-red-500/20 border border-red-400/20 text-red-200 px-2 py-1 rounded-full shrink-0">
            ATENÇÃO
          </span>
        )}
      </div>

      {subtitulo && <p className="text-[11px] text-zinc-300/80 mt-2 leading-relaxed">{subtitulo}</p>}

      {percentual !== null && (
        <div className="mt-4">
          <div className="h-2 rounded-full bg-black/35 overflow-hidden border border-white/5">
            <div className={`h-full rounded-full ${c.barra}`} style={{ width: `${Math.max(2, Math.min(100, percentual))}%` }} />
          </div>
          <p className={`text-[10px] font-black mt-2 ${c.texto}`}>{percentual}% da base analisada</p>
        </div>
      )}
    </div>
  );
};

const BarraRanking = ({ item, total, cor = 'blue' }) => {
  const largura = total ? Math.max(6, Math.round((item.total / total) * 100)) : 0;
  const c = classesCor[cor] || classesCor.blue;

  return (
    <div className="space-y-1">
      <div className="flex justify-between gap-3 text-[11px]">
        <span className="text-zinc-200 font-bold truncate">{item.nome}</span>
        <span className={`font-black shrink-0 ${c.texto}`}>{numeroBR(item.total)}</span>
      </div>
      <div className="h-2.5 rounded-full bg-black/40 border border-white/5 overflow-hidden">
        <div className={`h-full rounded-full ${c.barra}`} style={{ width: `${largura}%` }} />
      </div>
    </div>
  );
};

const BlocoRanking = ({ titulo, itens, totalBase, cor = 'blue' }) => {
  const c = classesCor[cor] || classesCor.blue;

  return (
    <div className={`border rounded-3xl p-5 ${c.card}`}>
      <h3 className="text-sm font-black uppercase tracking-widest text-white mb-4">{titulo}</h3>
      {itens.length === 0 ? (
        <p className="text-[11px] text-zinc-500">Sem dados suficientes.</p>
      ) : (
        <div className="space-y-4">
          {itens.map((item) => (
            <BarraRanking key={item.nome} item={item} total={totalBase || itens[0]?.total || 1} cor={cor} />
          ))}
        </div>
      )}
    </div>
  );
};

const Pill = ({ children, cor = 'blue' }) => {
  const c = classesCor[cor] || classesCor.blue;
  return <span className={`text-[10px] font-black uppercase tracking-widest border px-3 py-1.5 rounded-full ${c.badge}`}>{children}</span>;
};

export default function VisaoAnalitica({ leads = [], totalAbsoluto = 0, carregando = false }) {
  const analise = useMemo(() => {
    const total = leads.length;
    const ativos = leads.filter(estaAtivo).length;
    const comTelefone = leads.filter(temTelefone).length;
    const comEmail = leads.filter(temEmail).length;
    const comEndereco = leads.filter(temEndereco).length;
    const comContato = leads.filter(temContato).length;
    const semTelefone = total - comTelefone;
    const semEmail = total - comEmail;
    const semEndereco = total - comEndereco;
    const semCnae = leads.filter((lead) => !temValor(lead.cnae_principal_descricao)).length;

    const completos = leads.filter((lead) =>
      estaAtivo(lead) && temTelefone(lead) && temEmail(lead) && temEndereco(lead)
    ).length;

    const pctAtivos = total ? Math.round((ativos / total) * 100) : 0;
    const pctTelefone = total ? Math.round((comTelefone / total) * 100) : 0;
    const pctEmail = total ? Math.round((comEmail / total) * 100) : 0;
    const pctEndereco = total ? Math.round((comEndereco / total) * 100) : 0;
    const pctContato = total ? Math.round((comContato / total) * 100) : 0;
    const pctCompletos = total ? Math.round((completos / total) * 100) : 0;

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
      pctAtivos,
      pctTelefone,
      pctEmail,
      pctEndereco,
      pctContato,
      pctCompletos,
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
      <div className="bg-gradient-to-r from-blue-950/60 via-violet-950/50 to-emerald-950/50 border border-blue-500/20 rounded-3xl p-5 shadow-lg shadow-blue-950/20">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-blue-300 mb-2">Radar do Banco</p>
            <p className="text-[12px] text-zinc-200/85 leading-relaxed max-w-4xl">
              Esta tela é somente analítica. Ela lê os leads carregados do Supabase e mostra qualidade, distribuição e prioridade de trabalho sem alterar nenhum registro.
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Pill cor="emerald">Base ativa</Pill>
            <Pill cor="blue">Qualidade</Pill>
            <Pill cor="violet">Prioridade</Pill>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <CardIndicador titulo="Total no banco" valor={numeroBR(totalAbsoluto || analise.total)} subtitulo={`${numeroBR(analise.total)} carregados na análise`} cor="blue" percentual={100} />
        <CardIndicador titulo="Ativos" valor={numeroBR(analise.ativos)} subtitulo={percentualBR(analise.ativos, analise.total)} cor={corPorPercentual(analise.pctAtivos)} percentual={analise.pctAtivos} />
        <CardIndicador titulo="Com telefone" valor={numeroBR(analise.comTelefone)} subtitulo={percentualBR(analise.comTelefone, analise.total)} cor={corPorPercentual(analise.pctTelefone)} percentual={analise.pctTelefone} />
        <CardIndicador titulo="Com endereço" valor={numeroBR(analise.comEndereco)} subtitulo={percentualBR(analise.comEndereco, analise.total)} cor={corPorPercentual(analise.pctEndereco)} percentual={analise.pctEndereco} />
        <CardIndicador titulo="Com e-mail" valor={numeroBR(analise.comEmail)} subtitulo={percentualBR(analise.comEmail, analise.total)} cor={corPorPercentual(analise.pctEmail)} percentual={analise.pctEmail} />
        <CardIndicador titulo="Com contato" valor={numeroBR(analise.comContato)} subtitulo={percentualBR(analise.comContato, analise.total)} cor={corPorPercentual(analise.pctContato)} percentual={analise.pctContato} />
        <CardIndicador titulo="Leads completos" valor={numeroBR(analise.completos)} subtitulo="Ativo + telefone + e-mail + endereço" cor={corPorPercentual(analise.pctCompletos)} percentual={analise.pctCompletos} />
        <CardIndicador titulo="Sem telefone" valor={numeroBR(analise.semTelefone)} subtitulo="Prioridade para enriquecimento" cor={analise.semTelefone > 0 ? 'red' : 'emerald'} alerta={analise.semTelefone > 0} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <CardIndicador titulo="Sem e-mail" valor={numeroBR(analise.semEmail)} subtitulo="Pode exigir pesquisa manual" cor={analise.semEmail > 0 ? 'yellow' : 'emerald'} alerta={analise.semEmail > 0} />
        <CardIndicador titulo="Sem endereço completo" valor={numeroBR(analise.semEndereco)} subtitulo="Afeta rota e análise territorial" cor={analise.semEndereco > 0 ? 'red' : 'emerald'} alerta={analise.semEndereco > 0} />
        <CardIndicador titulo="Sem CNAE" valor={numeroBR(analise.semCnae)} subtitulo="Afeta segmentação" cor={analise.semCnae > 0 ? 'yellow' : 'emerald'} alerta={analise.semCnae > 0} />
        <CardIndicador titulo="Taxa de completude" valor={percentualBR(analise.completos, analise.total)} subtitulo="Base dos melhores leads" cor={corPorPercentual(analise.pctCompletos)} percentual={analise.pctCompletos} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <BlocoRanking titulo="Funil por Status do Lead" itens={analise.porStatusLead} totalBase={analise.total} cor="blue" />
        <BlocoRanking titulo="Status do Vendedor" itens={analise.porStatusVendedor} totalBase={analise.total} cor="violet" />
        <BlocoRanking titulo="Municípios com mais leads" itens={analise.porMunicipio} totalBase={analise.total} cor="emerald" />
        <BlocoRanking titulo="Bairros com mais leads" itens={analise.porBairro} totalBase={analise.total} cor="cyan" />
        <BlocoRanking titulo="Situação cadastral" itens={analise.porSituacao} totalBase={analise.total} cor="yellow" />
        <BlocoRanking titulo="CNAEs mais frequentes" itens={analise.porCnae} totalBase={analise.total} cor="red" />
      </div>

      <div className="bg-gradient-to-br from-zinc-900/80 via-blue-950/20 to-violet-950/20 border border-blue-500/20 rounded-3xl p-5 shadow-lg shadow-blue-950/20">
        <div className="flex justify-between items-center gap-3 mb-4 flex-wrap">
          <div>
            <h3 className="text-sm font-black uppercase tracking-widest text-white">Ranking de melhores oportunidades</h3>
            <p className="text-[11px] text-zinc-400 mt-1">Pontuação simples baseada em ativo, telefone, e-mail, endereço, contato, CNAE e capital social.</p>
          </div>
          <Pill cor="blue">Top 12</Pill>
        </div>

        <div className="overflow-hidden rounded-2xl border border-white/5">
          <div className="grid grid-cols-12 gap-2 bg-black/40 px-4 py-3 text-[9px] font-black uppercase tracking-widest text-zinc-400">
            <div className="col-span-6">Lead</div>
            <div className="col-span-2">Cidade</div>
            <div className="col-span-2">Telefone</div>
            <div className="col-span-2 text-right">Pontos</div>
          </div>

          <div className="divide-y divide-white/5">
            {analise.topOportunidades.map((lead, index) => {
              const corLinha = index < 3 ? 'text-emerald-300 bg-emerald-500/5' : index < 6 ? 'text-blue-300 bg-blue-500/5' : 'text-zinc-300 bg-black/10';

              return (
                <div key={lead.cnpj || lead.id} className={`grid grid-cols-12 gap-2 px-4 py-3 text-[11px] items-center ${corLinha}`}>
                  <div className="col-span-6 min-w-0">
                    <p className="font-bold text-white truncate">{index + 1}. {lead.razao_social || lead.nome_fantasia || 'Sem nome'}</p>
                    <p className="text-zinc-500 truncate">{lead.cnae_principal_descricao || 'CNAE não informado'}</p>
                  </div>
                  <div className="col-span-2 text-zinc-300 truncate">{lead.municipio || '—'}</div>
                  <div className="col-span-2 text-zinc-300 truncate">{lead.telefone_1 || lead.telefone_2 || '—'}</div>
                  <div className="col-span-2 text-right font-black text-blue-300">
                    <span className="inline-flex items-center justify-center min-w-8 px-2 py-1 rounded-full bg-blue-500/15 border border-blue-400/20">
                      {lead.pontuacao_analitica}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
