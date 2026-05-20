"use client";
import React, { useMemo, useState } from 'react';

const texto = (valor, fallback = 'Não informado') => {
  const limpo = String(valor || '').trim();
  if (!limpo || limpo.toLowerCase() === 'null' || limpo.toLowerCase() === 'undefined') return fallback;
  return limpo;
};

const numeroBR = (valor) => Number(valor || 0).toLocaleString('pt-BR');
const percentual = (parte, total) => (!total ? 0 : Math.round((parte / total) * 100));
const moedaBR = (valor) => {
  const numero = Number(valor || 0);
  if (!numero) return 'R$ 0';
  return numero.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
};

const normalizar = (valor) => texto(valor, '').toLowerCase();

const SEGMENTOS_ESTRATEGICOS = [
  {
    nome: 'Transporte, logística e frota',
    icone: '🚛',
    cor: 'blue',
    peso: 5,
    termos: ['transporte', 'carga', 'cargas', 'logística', 'logistica', 'rodoviário', 'rodoviario', 'fretamento', 'coletivo', 'passageiros', 'armazém', 'armazem', 'depósito', 'deposito', 'entrega', 'mudança', 'locação de veículos', 'locacao de veiculos']
  },
  {
    nome: 'Construção, obras e infraestrutura',
    icone: '🏗️',
    cor: 'amber',
    peso: 5,
    termos: ['construção', 'construcao', 'obras', 'engenharia', 'terraplenagem', 'pavimentação', 'pavimentacao', 'instalações', 'instalacoes', 'edifícios', 'edificios', 'rodovia', 'empreiteira', 'construtora']
  },
  {
    nome: 'Indústria e produção',
    icone: '🏭',
    cor: 'violet',
    peso: 4,
    termos: ['fabricação', 'fabricacao', 'indústria', 'industria', 'produção', 'producao', 'metal', 'plástico', 'plastico', 'madeira', 'máquinas', 'maquinas', 'equipamentos', 'transformação', 'transformacao']
  },
  {
    nome: 'Agro, pesca e alimentos',
    icone: '🌾',
    cor: 'emerald',
    peso: 4,
    termos: ['agro', 'agricultura', 'pecuária', 'pecuaria', 'pesca', 'aquicultura', 'alimentos', 'frigorífico', 'frigorifico', 'abate', 'grãos', 'graos', 'fazenda', 'cultivo', 'horticultura']
  },
  {
    nome: 'Energia, geradores e utilidades',
    icone: '⚡',
    cor: 'cyan',
    peso: 4,
    termos: ['energia', 'eletricidade', 'geração', 'geracao', 'gerador', 'manutenção elétrica', 'manutencao eletrica', 'climatização', 'climatizacao', 'refrigeração', 'refrigeracao', 'água', 'agua', 'saneamento']
  },
  {
    nome: 'Comércio atacadista',
    icone: '📦',
    cor: 'orange',
    peso: 3,
    termos: ['comércio atacadista', 'comercio atacadista', 'atacadista', 'distribuição', 'distribuicao', 'distribuidora', 'representantes comerciais']
  },
  {
    nome: 'Serviços operacionais',
    icone: '🧰',
    cor: 'pink',
    peso: 2,
    termos: ['limpeza', 'segurança', 'seguranca', 'manutenção', 'manutencao', 'serviços combinados', 'servicos combinados', 'apoio administrativo', 'locação', 'locacao']
  }
];

const classes = {
  blue: 'bg-blue-50 border-blue-100 text-blue-950',
  amber: 'bg-amber-50 border-amber-100 text-amber-950',
  violet: 'bg-violet-50 border-violet-100 text-violet-950',
  emerald: 'bg-emerald-50 border-emerald-100 text-emerald-950',
  cyan: 'bg-cyan-50 border-cyan-100 text-cyan-950',
  orange: 'bg-orange-50 border-orange-100 text-orange-950',
  pink: 'bg-pink-50 border-pink-100 text-pink-950',
  red: 'bg-red-50 border-red-100 text-red-950',
  slate: 'bg-slate-50 border-slate-200 text-slate-950'
};

const pillClasses = {
  blue: 'bg-blue-100 text-blue-700',
  amber: 'bg-amber-100 text-amber-700',
  violet: 'bg-violet-100 text-violet-700',
  emerald: 'bg-emerald-100 text-emerald-700',
  cyan: 'bg-cyan-100 text-cyan-700',
  orange: 'bg-orange-100 text-orange-700',
  pink: 'bg-pink-100 text-pink-700',
  red: 'bg-red-100 text-red-700',
  slate: 'bg-slate-100 text-slate-600'
};

const detectarSegmento = (lead) => {
  const base = `${normalizar(lead.cnae_principal_descricao)} ${normalizar(lead.cnae_secundario)} ${normalizar(lead.razao_social)} ${normalizar(lead.nome_fantasia)} ${normalizar(lead.categoria_trr)} ${normalizar(lead.potencial_consumo)}`;

  for (const segmento of SEGMENTOS_ESTRATEGICOS) {
    if (segmento.termos.some((termo) => base.includes(termo))) {
      return segmento;
    }
  }

  return { nome: 'Outros / não classificado', icone: '🧩', cor: 'slate', peso: 1, termos: [] };
};

const scoreComercial = (lead) => {
  const segmento = detectarSegmento(lead);
  let pontos = segmento.peso * 10;
  const capital = Number(lead.capital_social || 0);

  if (capital >= 1000000) pontos += 20;
  else if (capital >= 300000) pontos += 12;
  else if (capital >= 100000) pontos += 7;

  if (normalizar(lead.situacao_cadastral).includes('ativa')) pontos += 10;
  if (texto(lead.municipio, '').toLowerCase().includes('manaus')) pontos += 4;
  if (texto(lead.uf, '').toUpperCase() === 'AM' || texto(lead.uf, '').toUpperCase() === 'RR') pontos += 4;
  if (texto(lead.fonte_lead, '').toLowerCase().includes('arquivo')) pontos += 2;

  return pontos;
};

const agrupar = (leads, resolverNome, limite = 12) => {
  const mapa = new Map();

  leads.forEach((lead) => {
    const nome = resolverNome(lead) || 'Não informado';
    const atual = mapa.get(nome) || { nome, total: 0, capital: 0, score: 0, exemplos: [] };
    atual.total += 1;
    atual.capital += Number(lead.capital_social || 0);
    atual.score += scoreComercial(lead);
    if (atual.exemplos.length < 3) atual.exemplos.push(texto(lead.razao_social));
    mapa.set(nome, atual);
  });

  return Array.from(mapa.values())
    .sort((a, b) => b.total - a.total || b.score - a.score || a.nome.localeCompare(b.nome, 'pt-BR'))
    .slice(0, limite);
};

const Barra = ({ valor, total, cor = 'bg-blue-500' }) => {
  const pct = percentual(valor, total);
  return (
    <div className="mt-2 h-2.5 bg-slate-100 rounded-full overflow-hidden">
      <div className={`h-full ${cor}`} style={{ width: `${Math.min(100, pct)}%` }} />
    </div>
  );
};

const CardResumo = ({ titulo, valor, subtitulo, cor = 'slate', icone = '📊' }) => (
  <div className={`rounded-3xl border p-5 shadow-sm ${classes[cor] || classes.slate}`}>
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-[10px] uppercase tracking-[0.18em] font-black opacity-70">{titulo}</p>
        <p className="text-3xl font-black tracking-tighter mt-2">{valor}</p>
      </div>
      <div className={`w-11 h-11 rounded-2xl flex items-center justify-center text-xl shadow-sm ${pillClasses[cor] || pillClasses.slate}`}>
        {icone}
      </div>
    </div>
    {subtitulo && <p className="text-[11px] text-slate-500 mt-3 leading-relaxed">{subtitulo}</p>}
  </div>
);

const ListaRanking = ({ titulo, itens, total, corBarra = 'bg-blue-500', mostrarCapital = false, icone = '📌' }) => (
  <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm">
    <div className="flex items-center justify-between gap-4 mb-4">
      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">{icone} {titulo}</p>
        <h3 className="text-lg font-black text-slate-950 mt-1">Top {itens.length}</h3>
      </div>
      <span className="text-[10px] text-slate-500 font-black uppercase bg-slate-100 rounded-full px-3 py-1">Ranking</span>
    </div>

    <div className="space-y-3">
      {itens.map((item, index) => (
        <div key={`${item.nome}-${index}`} className="bg-slate-50 border border-slate-100 rounded-2xl p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[12px] font-black text-slate-800 leading-snug">{index + 1}. {item.nome}</p>
              <p className="text-[10px] text-slate-400 mt-1 truncate">{item.exemplos.join(' • ')}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-sm font-black text-slate-950">{numeroBR(item.total)}</p>
              <p className="text-[9px] text-slate-400 uppercase font-black">{percentual(item.total, total)}%</p>
            </div>
          </div>
          <Barra valor={item.total} total={total} cor={corBarra} />
          {mostrarCapital && (
            <p className="text-[10px] text-slate-500 mt-2">Capital social somado: <span className="text-slate-800 font-black">{moedaBR(item.capital)}</span></p>
          )}
        </div>
      ))}
    </div>
  </div>
);

export default function AnaliticaVendas({ leads = [], totalAbsoluto = 0, carregando = false }) {
  const [modoOrdenacao, setModoOrdenacao] = useState('volume');

  const dados = useMemo(() => {
    const total = leads.length;
    const classificados = leads.map((lead) => ({
      ...lead,
      segmentoCalculado: detectarSegmento(lead),
      scoreVenda: scoreComercial(lead)
    }));

    const porSegmentoMap = new Map();
    classificados.forEach((lead) => {
      const seg = lead.segmentoCalculado;
      const atual = porSegmentoMap.get(seg.nome) || {
        nome: seg.nome,
        icone: seg.icone,
        cor: seg.cor,
        total: 0,
        capital: 0,
        score: 0,
        exemplos: []
      };
      atual.total += 1;
      atual.capital += Number(lead.capital_social || 0);
      atual.score += lead.scoreVenda;
      if (atual.exemplos.length < 4) atual.exemplos.push(texto(lead.razao_social));
      porSegmentoMap.set(seg.nome, atual);
    });

    let porSegmento = Array.from(porSegmentoMap.values());
    porSegmento = porSegmento.sort((a, b) => {
      if (modoOrdenacao === 'score') return b.score - a.score || b.total - a.total;
      if (modoOrdenacao === 'capital') return b.capital - a.capital || b.total - a.total;
      return b.total - a.total || b.score - a.score;
    });

    const topCnaes = agrupar(classificados, (lead) => texto(lead.cnae_principal_descricao), 15);
    const topMunicipios = agrupar(classificados, (lead) => `${texto(lead.municipio)} / ${texto(lead.uf, '')}`, 10);
    const topPorte = agrupar(classificados, (lead) => texto(lead.porte), 8);
    const topPotenciais = classificados
      .sort((a, b) => b.scoreVenda - a.scoreVenda || texto(a.razao_social).localeCompare(texto(b.razao_social), 'pt-BR'))
      .slice(0, 12);

    const segmentosQuentes = porSegmento.filter((s) => !s.nome.includes('Outros')).reduce((acc, s) => acc + s.total, 0);
    const capitalSomado = classificados.reduce((acc, lead) => acc + Number(lead.capital_social || 0), 0);
    const cnaesDistintos = new Set(classificados.map((lead) => texto(lead.cnae_principal_descricao)).filter((v) => v !== 'Não informado')).size;

    return { total, porSegmento, topCnaes, topMunicipios, topPorte, topPotenciais, segmentosQuentes, capitalSomado, cnaesDistintos };
  }, [leads, modoOrdenacao]);

  if (carregando) {
    return (
      <div className="bg-slate-50 border border-slate-200 rounded-3xl p-10 text-center text-slate-500">
        <p className="text-[10px] uppercase tracking-[0.24em] font-black animate-pulse">Montando analítica de vendas...</p>
      </div>
    );
  }

  if (!dados.total) {
    return (
      <div className="bg-slate-50 border border-slate-200 rounded-3xl p-10 text-center text-slate-500">
        <p className="text-sm font-black uppercase">Nenhum lead carregado para análise comercial.</p>
      </div>
    );
  }

  return (
    <section className="bg-[#f4f7fb] text-slate-950 rounded-[2rem] p-4 md:p-6 space-y-6 shadow-sm">
      <div className="bg-white border border-slate-200 rounded-[2rem] p-6 shadow-sm overflow-hidden relative">
        <div className="absolute -right-16 -top-16 w-56 h-56 bg-blue-100 rounded-full blur-3xl" />
        <div className="absolute right-24 -bottom-20 w-56 h-56 bg-violet-100 rounded-full blur-3xl" />
        <div className="absolute -left-16 -bottom-16 w-56 h-56 bg-emerald-100 rounded-full blur-3xl" />

        <div className="relative flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-600">CRM Moderno • Radar Comercial</p>
            <h2 className="text-2xl md:text-4xl font-black tracking-tighter mt-2 text-slate-950">Onde estão as melhores frentes de venda?</h2>
            <p className="text-sm text-slate-500 mt-3 max-w-3xl leading-relaxed">
              Esta aba não mede qualidade de cadastro. Ela cruza CNAE principal, CNAE secundário, porte, capital social, município e termos estratégicos para mostrar segmentos com maior potencial de consumo contínuo de diesel.
            </p>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 min-w-[240px] shadow-sm">
            <label className="text-[9px] text-slate-400 font-black uppercase tracking-widest block mb-2">Ordenar segmentos por</label>
            <select
              value={modoOrdenacao}
              onChange={(e) => setModoOrdenacao(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-[11px] text-slate-900 outline-none"
            >
              <option value="volume">Volume de leads</option>
              <option value="score">Potencial comercial</option>
              <option value="capital">Capital social somado</option>
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <CardResumo titulo="Leads analisados" valor={numeroBR(dados.total)} subtitulo={`Total no banco: ${numeroBR(totalAbsoluto || dados.total)}`} cor="blue" icone="📊" />
        <CardResumo titulo="CNAEs distintos" valor={numeroBR(dados.cnaesDistintos)} subtitulo="Variedade de atividades econômicas no estoque atual." cor="violet" icone="🧬" />
        <CardResumo titulo="Segmentos estratégicos" valor={`${percentual(dados.segmentosQuentes, dados.total)}%`} subtitulo={`${numeroBR(dados.segmentosQuentes)} leads caíram em grupos comerciais quentes.`} cor="emerald" icone="🔥" />
        <CardResumo titulo="Capital social mapeado" valor={moedaBR(dados.capitalSomado)} subtitulo="Soma dos capitais informados nos leads carregados." cor="amber" icone="💰" />
      </div>

      <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm">
        <div className="flex items-center justify-between gap-4 mb-5 flex-wrap">
          <div>
            <p className="text-[10px] uppercase tracking-[0.18em] font-black text-slate-400">🎯 Segmentação</p>
            <h3 className="text-lg font-black text-slate-950 mt-1">Separação analítica por segmento</h3>
            <p className="text-[11px] text-slate-500 mt-1">Classificação automática por palavras-chave dos CNAEs e descrição da empresa.</p>
          </div>
          <span className="text-[10px] text-slate-500 font-black uppercase bg-slate-100 rounded-full px-3 py-1">{numeroBR(dados.porSegmento.length)} grupos</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {dados.porSegmento.map((segmento) => (
            <div key={segmento.nome} className={`rounded-3xl border p-4 shadow-sm ${classes[segmento.cor] || classes.slate}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`w-10 h-10 rounded-2xl flex items-center justify-center text-lg ${pillClasses[segmento.cor] || pillClasses.slate}`}>{segmento.icone}</span>
                    <p className="text-sm font-black uppercase leading-tight">{segmento.nome}</p>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-3 truncate">{segmento.exemplos.join(' • ')}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-2xl font-black">{numeroBR(segmento.total)}</p>
                  <p className="text-[9px] uppercase opacity-60 font-black">{percentual(segmento.total, dados.total)}%</p>
                </div>
              </div>
              <Barra valor={segmento.total} total={dados.total} cor="bg-slate-900/70" />
              <div className="mt-3 grid grid-cols-2 gap-2 text-[10px] text-slate-600">
                <div className="bg-white/70 rounded-xl p-2 border border-white/60">Score somado: <span className="font-black text-slate-950">{numeroBR(segmento.score)}</span></div>
                <div className="bg-white/70 rounded-xl p-2 border border-white/60">Capital: <span className="font-black text-slate-950">{moedaBR(segmento.capital)}</span></div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <ListaRanking titulo="CNAEs mais frequentes" itens={dados.topCnaes} total={dados.total} corBarra="bg-violet-500" mostrarCapital icone="🧬" />
        <ListaRanking titulo="Municípios com maior volume" itens={dados.topMunicipios} total={dados.total} corBarra="bg-cyan-500" mostrarCapital icone="🗺️" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <ListaRanking titulo="Porte das empresas" itens={dados.topPorte} total={dados.total} corBarra="bg-amber-500" mostrarCapital icone="🏢" />

        <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm">
          <div className="flex items-center justify-between gap-4 mb-4">
            <div>
              <p className="text-[10px] uppercase tracking-[0.18em] font-black text-slate-400">⭐ Score</p>
              <h3 className="text-lg font-black text-slate-950 mt-1">Top oportunidades comerciais</h3>
            </div>
            <span className="text-[10px] text-slate-500 font-black uppercase bg-slate-100 rounded-full px-3 py-1">Score automático</span>
          </div>

          <div className="space-y-3">
            {dados.topPotenciais.map((lead, index) => (
              <div key={`${lead.cnpj || lead.razao_social}-${index}`} className="bg-slate-50 border border-slate-100 rounded-2xl p-3">
                <div className="flex justify-between items-start gap-3">
                  <div className="min-w-0">
                    <p className="text-[12px] font-black text-slate-900 leading-snug">{index + 1}. {texto(lead.razao_social)}</p>
                    <p className="text-[10px] text-blue-600 font-black mt-1 truncate">{lead.segmentoCalculado.icone} {lead.segmentoCalculado.nome}</p>
                    <p className="text-[10px] text-slate-400 mt-1 truncate">{texto(lead.cnae_principal_descricao)}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-lg font-black text-emerald-600">{lead.scoreVenda}</p>
                    <p className="text-[9px] uppercase text-slate-400 font-black">pontos</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
