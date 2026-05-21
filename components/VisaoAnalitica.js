"use client";
import React, { useMemo, useState, useEffect } from 'react';

const CAMPOS = [
  { id: 'cnae_principal_descricao', label: 'CNAE', curto: 'CNAE' },
  { id: 'municipio', label: 'Município', curto: 'Município' },
  { id: 'bairro', label: 'Bairro', curto: 'Bairro' },
  { id: 'porte', label: 'Porte', curto: 'Porte' },
  { id: 'uf', label: 'UF', curto: 'UF' },
  { id: 'fonte_lead', label: 'Fonte do Lead', curto: 'Fonte' },
  { id: 'status_lead', label: 'Status do Lead', curto: 'Status' },
  { id: 'status_vendedor', label: 'Status do Vendedor', curto: 'Status Vend.' },
  { id: 'situacao_cadastral', label: 'Situação Cadastral', curto: 'Situação' },
  { id: 'categoria_trr', label: 'Categoria TRR', curto: 'Categoria' },
  { id: 'potencial_consumo', label: 'Potencial Consumo', curto: 'Potencial' }
];

const campoLabel = (id) => CAMPOS.find((c) => c.id === id)?.label || id;
const numeroBR = (valor) => Number(valor || 0).toLocaleString('pt-BR');
const moedaBR = (valor) => Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const percentual = (parte, total) => (!total ? 0 : Math.round((parte / total) * 100));

const texto = (valor, fallback = 'Não informado') => {
  const limpo = String(valor ?? '').trim();
  if (!limpo || limpo.toLowerCase() === 'null' || limpo.toLowerCase() === 'undefined') return fallback;
  return limpo;
};

const capitalLead = (lead) => Number(lead?.capital_social || 0);

const scoreLead = (lead) => {
  let pontos = 0;
  const base = `${texto(lead?.cnae_principal_descricao, '')} ${texto(lead?.cnae_secundario, '')} ${texto(lead?.razao_social, '')}`.toLowerCase();
  if (base.includes('transporte') || base.includes('carga') || base.includes('logística') || base.includes('logistica')) pontos += 30;
  if (base.includes('constru') || base.includes('obra') || base.includes('engenharia') || base.includes('terraplenagem')) pontos += 30;
  if (base.includes('indústria') || base.includes('industria') || base.includes('fabricação') || base.includes('fabricacao')) pontos += 24;
  if (base.includes('energia') || base.includes('gerador') || base.includes('refrigeração') || base.includes('refrigeracao')) pontos += 22;
  if (base.includes('agro') || base.includes('pesca') || base.includes('alimento') || base.includes('pecuária') || base.includes('pecuaria')) pontos += 22;
  const capital = capitalLead(lead);
  if (capital >= 1000000) pontos += 22;
  else if (capital >= 300000) pontos += 14;
  else if (capital >= 100000) pontos += 8;
  if (texto(lead?.situacao_cadastral, '').toUpperCase() === 'ATIVA') pontos += 10;
  if (texto(lead?.municipio, '').toLowerCase().includes('manaus')) pontos += 4;
  return pontos;
};

const agruparPor = (leads, campo, limite = 10) => {
  const mapa = new Map();
  (leads || []).forEach((lead) => {
    const nome = texto(lead?.[campo]);
    const atual = mapa.get(nome) || { nome, total: 0, capital: 0, score: 0, exemplos: [], leads: [] };
    atual.total += 1;
    atual.capital += capitalLead(lead);
    atual.score += scoreLead(lead);
    if (atual.exemplos.length < 3) atual.exemplos.push(texto(lead?.razao_social));
    if (atual.leads.length < 40) atual.leads.push(lead);
    mapa.set(nome, atual);
  });
  return Array.from(mapa.values())
    .sort((a, b) => b.total - a.total || b.score - a.score || b.capital - a.capital || a.nome.localeCompare(b.nome, 'pt-BR'))
    .slice(0, limite);
};

const cruzar = (leads, campoA, campoB, limite = 14) => {
  const mapa = new Map();
  (leads || []).forEach((lead) => {
    const a = texto(lead?.[campoA]);
    const b = texto(lead?.[campoB]);
    const chave = `${a}|||${b}`;
    const atual = mapa.get(chave) || { nome: `${a} → ${b}`, a, b, total: 0, capital: 0, score: 0, exemplos: [], leads: [] };
    atual.total += 1;
    atual.capital += capitalLead(lead);
    atual.score += scoreLead(lead);
    if (atual.exemplos.length < 3) atual.exemplos.push(texto(lead?.razao_social));
    if (atual.leads.length < 40) atual.leads.push(lead);
    mapa.set(chave, atual);
  });
  return Array.from(mapa.values())
    .sort((a, b) => b.total - a.total || b.score - a.score || b.capital - a.capital)
    .slice(0, limite);
};

const topLeads = (leads, limite = 12) => {
  return [...(leads || [])]
    .map((lead) => ({ ...lead, scoreAnalitico: scoreLead(lead) }))
    .sort((a, b) => b.scoreAnalitico - a.scoreAnalitico || capitalLead(b) - capitalLead(a))
    .slice(0, limite);
};

const MiniBarra = ({ valor, total }) => {
  const pct = percentual(valor, total);
  return (
    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden mt-1.5">
      <div className="h-full bg-blue-500 rounded-full" style={{ width: `${Math.min(100, pct)}%` }} />
    </div>
  );
};

const RankingCompacto = ({ itens, total, max = 6 }) => (
  <div className="space-y-1.5">
    {itens.slice(0, max).map((item, index) => (
      <div key={`${item.nome}-${index}`} className="rounded-xl border border-slate-100 bg-slate-50/70 px-2.5 py-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[10px] font-black text-slate-800 truncate leading-tight">{index + 1}. {item.nome}</p>
            <p className="text-[9px] text-slate-400 truncate mt-0.5">{item.exemplos?.join(' • ')}</p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-[12px] font-black text-slate-900">{numeroBR(item.total)}</p>
            <p className="text-[8px] text-slate-400 font-black">{percentual(item.total, total)}%</p>
          </div>
        </div>
        <MiniBarra valor={item.total} total={total} />
      </div>
    ))}
  </div>
);

const CardKpi = ({ titulo, valor, detalhe, cor = 'blue' }) => {
  const cores = {
    blue: 'from-blue-500 to-cyan-500',
    emerald: 'from-emerald-500 to-teal-500',
    violet: 'from-violet-500 to-fuchsia-500',
    amber: 'from-amber-400 to-orange-500',
    rose: 'from-rose-500 to-red-500'
  };
  return (
    <div className="rounded-2xl bg-white border border-slate-100 shadow-sm p-3 overflow-hidden relative min-h-[82px]">
      <div className={`absolute right-0 top-0 w-20 h-20 bg-gradient-to-br ${cores[cor] || cores.blue} opacity-10 rounded-bl-[36px]`} />
      <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 relative">{titulo}</p>
      <p className="text-xl font-black text-slate-900 tracking-tight mt-1 relative">{valor}</p>
      <p className="text-[9px] text-slate-500 mt-1 relative leading-snug">{detalhe}</p>
    </div>
  );
};

const Quadrante = ({ titulo, subtitulo, children, onZoom, badge }) => (
  <button
    type="button"
    onClick={onZoom}
    className="text-left rounded-2xl bg-white border border-slate-100 shadow-sm hover:shadow-md hover:border-blue-200 transition-all p-3 min-h-[250px] flex flex-col"
  >
    <div className="flex items-start justify-between gap-3 mb-2">
      <div className="min-w-0">
        <p className="text-[10px] font-black uppercase tracking-wide text-slate-900 truncate">{titulo}</p>
        {subtitulo && <p className="text-[9px] text-slate-400 mt-0.5 truncate">{subtitulo}</p>}
      </div>
      <span className="shrink-0 rounded-full bg-blue-50 text-blue-700 border border-blue-100 px-2 py-1 text-[8px] font-black uppercase">
        {badge || 'Zoom'}
      </span>
    </div>
    <div className="flex-1 overflow-hidden">{children}</div>
  </button>
);

const TabelaExpandida = ({ itens, total, tipo = 'ranking' }) => (
  <div className="overflow-x-auto">
    <table className="w-full text-left border-collapse">
      <thead>
        <tr className="text-[10px] uppercase tracking-widest text-slate-400 border-b border-slate-100">
          <th className="py-2 pr-3">#</th>
          <th className="py-2 pr-3">Grupo</th>
          <th className="py-2 pr-3 text-right">Leads</th>
          <th className="py-2 pr-3 text-right">%</th>
          <th className="py-2 pr-3 text-right">Score</th>
          <th className="py-2 pr-3 text-right">Capital</th>
          <th className="py-2 pr-3">Exemplos</th>
        </tr>
      </thead>
      <tbody>
        {(itens || []).map((item, index) => (
          <tr key={`${tipo}-${item.nome}-${index}`} className="border-b border-slate-100 text-[11px]">
            <td className="py-2 pr-3 font-black text-slate-400">{index + 1}</td>
            <td className="py-2 pr-3 font-black text-slate-900 min-w-[220px]">{item.nome}</td>
            <td className="py-2 pr-3 text-right font-black text-slate-900">{numeroBR(item.total)}</td>
            <td className="py-2 pr-3 text-right text-slate-500">{percentual(item.total, total)}%</td>
            <td className="py-2 pr-3 text-right text-blue-700 font-black">{numeroBR(item.score)}</td>
            <td className="py-2 pr-3 text-right text-emerald-700 font-black">{moedaBR(item.capital)}</td>
            <td className="py-2 pr-3 text-slate-500 min-w-[280px]">{item.exemplos?.join(' • ')}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const ListaLeadsExpandida = ({ leads }) => (
  <div className="space-y-2">
    {(leads || []).map((lead, index) => (
      <div key={`${lead.cnpj || lead.razao_social}-${index}`} className="rounded-2xl border border-slate-100 bg-slate-50 px-3 py-2 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-black text-slate-900 truncate">{index + 1}. {texto(lead.razao_social)}</p>
          <p className="text-[10px] text-slate-500 truncate mt-1">{texto(lead.cnae_principal_descricao)} • {texto(lead.municipio)} / {texto(lead.uf, '')} • {texto(lead.porte)}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-sm font-black text-blue-700">{lead.scoreAnalitico}</p>
          <p className="text-[8px] uppercase text-slate-400 font-black">score</p>
        </div>
      </div>
    ))}
  </div>
);

export default function VisaoAnalitica({ leads = [], totalAbsoluto = 0, carregando = false }) {
  const [camada1, setCamada1] = useState('cnae_principal_descricao');
  const [camada2, setCamada2] = useState('municipio');
  const [camada3, setCamada3] = useState('porte');
  const [zoom, setZoom] = useState(null);
  const [analisesSalvas, setAnalisesSalvas] = useState([]);

  useEffect(() => {
    try {
      const salvas = JSON.parse(localStorage.getItem('vtrr_analises_salvas') || '[]');
      setAnalisesSalvas(Array.isArray(salvas) ? salvas : []);
    } catch {
      setAnalisesSalvas([]);
    }
  }, []);

  const dados = useMemo(() => {
    const total = leads.length;
    const capitalTotal = leads.reduce((acc, lead) => acc + capitalLead(lead), 0);
    const ativos = leads.filter((lead) => texto(lead.situacao_cadastral, '').toUpperCase() === 'ATIVA').length;
    const municipios = new Set(leads.map((lead) => texto(lead.municipio, '')).filter(Boolean)).size;
    const cnaes = new Set(leads.map((lead) => texto(lead.cnae_principal_descricao, '')).filter(Boolean)).size;

    const r1 = agruparPor(leads, camada1, 20);
    const r2 = agruparPor(leads, camada2, 20);
    const r3 = agruparPor(leads, camada3, 20);
    const c12 = cruzar(leads, camada1, camada2, 24);
    const c23 = cruzar(leads, camada2, camada3, 24);
    const c13 = cruzar(leads, camada1, camada3, 24);
    const oportunidades = topLeads(leads, 20);
    const fontes = agruparPor(leads, 'fonte_lead', 12);
    const status = agruparPor(leads, 'status_lead', 12);

    return { total, capitalTotal, ativos, municipios, cnaes, r1, r2, r3, c12, c23, c13, oportunidades, fontes, status };
  }, [leads, camada1, camada2, camada3]);

  const nomeAnalise = `${campoLabel(camada1)} → ${campoLabel(camada2)} → ${campoLabel(camada3)}`;

  const salvarAnalise = () => {
    const nova = {
      id: Date.now(),
      nome: nomeAnalise,
      camada1,
      camada2,
      camada3,
      criadoEm: new Date().toISOString()
    };
    const atualizadas = [nova, ...analisesSalvas.filter((item) => item.nome !== nova.nome)].slice(0, 8);
    setAnalisesSalvas(atualizadas);
    localStorage.setItem('vtrr_analises_salvas', JSON.stringify(atualizadas));
  };

  const carregarAnalise = (item) => {
    setCamada1(item.camada1);
    setCamada2(item.camada2);
    setCamada3(item.camada3);
  };

  const imprimirTela = () => window.print();

  const zooms = {
    camada1: { titulo: `Ranking por ${campoLabel(camada1)}`, corpo: <TabelaExpandida itens={dados.r1} total={dados.total} tipo="camada1" /> },
    camada2: { titulo: `Ranking por ${campoLabel(camada2)}`, corpo: <TabelaExpandida itens={dados.r2} total={dados.total} tipo="camada2" /> },
    camada3: { titulo: `Ranking por ${campoLabel(camada3)}`, corpo: <TabelaExpandida itens={dados.r3} total={dados.total} tipo="camada3" /> },
    c12: { titulo: `${campoLabel(camada1)} x ${campoLabel(camada2)}`, corpo: <TabelaExpandida itens={dados.c12} total={dados.total} tipo="c12" /> },
    c23: { titulo: `${campoLabel(camada2)} x ${campoLabel(camada3)}`, corpo: <TabelaExpandida itens={dados.c23} total={dados.total} tipo="c23" /> },
    c13: { titulo: `${campoLabel(camada1)} x ${campoLabel(camada3)}`, corpo: <TabelaExpandida itens={dados.c13} total={dados.total} tipo="c13" /> },
    oportunidades: { titulo: 'Top oportunidades comerciais', corpo: <ListaLeadsExpandida leads={dados.oportunidades} /> },
    fontes: { titulo: 'Fontes do banco', corpo: <TabelaExpandida itens={dados.fontes} total={dados.total} tipo="fontes" /> },
    status: { titulo: 'Funil por status', corpo: <TabelaExpandida itens={dados.status} total={dados.total} tipo="status" /> }
  };

  if (carregando) {
    return <div className="rounded-3xl bg-white border border-slate-100 p-10 text-center text-slate-400 text-[11px] font-black uppercase tracking-widest animate-pulse">Montando painel analítico...</div>;
  }

  if (!dados.total) {
    return <div className="rounded-3xl bg-white border border-slate-100 p-10 text-center text-slate-500 text-sm font-bold">Nenhum lead carregado para análise.</div>;
  }

  return (
    <section className="space-y-4 print:bg-white">
      <style>{`
        @media print {
          body { background: white !important; }
          .no-print { display: none !important; }
          .print-card { break-inside: avoid; box-shadow: none !important; }
        }
      `}</style>

      <div className="no-print rounded-3xl bg-white border border-slate-100 shadow-sm p-4">
        <div className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-blue-600">Central Analítica por Camadas</p>
            <h2 className="text-2xl md:text-3xl font-black tracking-tight text-slate-950 mt-1">Painel compacto com zoom</h2>
            <p className="text-xs text-slate-500 mt-1">Tela principal cheia para leitura rápida. Clique em qualquer quadrante para ampliar, salvar ou imprimir.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 flex-1 max-w-4xl">
            {[{ label: 'Camada 1', value: camada1, set: setCamada1 }, { label: 'Camada 2', value: camada2, set: setCamada2 }, { label: 'Camada 3', value: camada3, set: setCamada3 }].map((ctrl) => (
              <div key={ctrl.label}>
                <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-1">{ctrl.label}</label>
                <select
                  value={ctrl.value}
                  onChange={(e) => ctrl.set(e.target.value)}
                  className="w-full h-10 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-[11px] font-bold px-3 outline-none"
                >
                  {CAMPOS.map((campo) => <option key={campo.id} value={campo.id}>{campo.label}</option>)}
                </select>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2 items-center justify-between">
          <div className="flex flex-wrap gap-2">
            <button onClick={salvarAnalise} className="h-9 px-4 rounded-xl bg-blue-600 text-white text-[10px] font-black uppercase hover:bg-blue-500">Salvar análise</button>
            <button onClick={imprimirTela} className="h-9 px-4 rounded-xl bg-slate-900 text-white text-[10px] font-black uppercase hover:bg-slate-700">Imprimir painel</button>
          </div>

          {analisesSalvas.length > 0 && (
            <div className="flex flex-wrap gap-1.5 items-center">
              <span className="text-[9px] font-black uppercase text-slate-400">Salvas:</span>
              {analisesSalvas.slice(0, 5).map((item) => (
                <button key={item.id} onClick={() => carregarAnalise(item)} className="px-2.5 py-1.5 rounded-full bg-slate-100 text-slate-700 text-[9px] font-black hover:bg-blue-50 hover:text-blue-700">
                  {item.nome}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
        <CardKpi titulo="Leads na análise" valor={numeroBR(dados.total)} detalhe={`Banco: ${numeroBR(totalAbsoluto || dados.total)}`} cor="blue" />
        <CardKpi titulo="Ativos" valor={`${percentual(dados.ativos, dados.total)}%`} detalhe={`${numeroBR(dados.ativos)} CNPJs ativos`} cor="emerald" />
        <CardKpi titulo="CNAEs distintos" valor={numeroBR(dados.cnaes)} detalhe="Variedade econômica" cor="violet" />
        <CardKpi titulo="Municípios" valor={numeroBR(dados.municipios)} detalhe="Distribuição territorial" cor="amber" />
        <CardKpi titulo="Capital somado" valor={moedaBR(dados.capitalTotal)} detalhe="Capital social informado" cor="rose" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3">
        <Quadrante titulo={`1ª camada: ${campoLabel(camada1)}`} subtitulo={nomeAnalise} onZoom={() => setZoom('camada1')}>
          <RankingCompacto itens={dados.r1} total={dados.total} />
        </Quadrante>

        <Quadrante titulo={`2ª camada: ${campoLabel(camada2)}`} subtitulo="Ranking secundário" onZoom={() => setZoom('camada2')}>
          <RankingCompacto itens={dados.r2} total={dados.total} />
        </Quadrante>

        <Quadrante titulo={`3ª camada: ${campoLabel(camada3)}`} subtitulo="Detalhamento final" onZoom={() => setZoom('camada3')}>
          <RankingCompacto itens={dados.r3} total={dados.total} />
        </Quadrante>

        <Quadrante titulo={`${campoLabel(camada1)} x ${campoLabel(camada2)}`} subtitulo="Cruzamento principal" onZoom={() => setZoom('c12')} badge="Abrir">
          <RankingCompacto itens={dados.c12} total={dados.total} />
        </Quadrante>

        <Quadrante titulo={`${campoLabel(camada2)} x ${campoLabel(camada3)}`} subtitulo="Cruzamento operacional" onZoom={() => setZoom('c23')} badge="Abrir">
          <RankingCompacto itens={dados.c23} total={dados.total} />
        </Quadrante>

        <Quadrante titulo={`${campoLabel(camada1)} x ${campoLabel(camada3)}`} subtitulo="Cruzamento estratégico" onZoom={() => setZoom('c13')} badge="Abrir">
          <RankingCompacto itens={dados.c13} total={dados.total} />
        </Quadrante>

        <Quadrante titulo="Top oportunidades" subtitulo="Score comercial automático" onZoom={() => setZoom('oportunidades')} badge="Zoom">
          <div className="space-y-1.5">
            {dados.oportunidades.slice(0, 7).map((lead, index) => (
              <div key={`${lead.cnpj}-${index}`} className="rounded-xl bg-emerald-50 border border-emerald-100 px-2.5 py-2 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[10px] font-black text-slate-900 truncate">{index + 1}. {texto(lead.razao_social)}</p>
                  <p className="text-[9px] text-slate-500 truncate mt-0.5">{texto(lead.municipio)} • {texto(lead.cnae_principal_descricao)}</p>
                </div>
                <span className="text-[11px] font-black text-emerald-700">{lead.scoreAnalitico}</span>
              </div>
            ))}
          </div>
        </Quadrante>

        <Quadrante titulo="Fontes e status" subtitulo="Origem e funil" onZoom={() => setZoom('fontes')} badge="Fontes">
          <RankingCompacto itens={dados.fontes} total={dados.total} max={3} />
          <div className="mt-2 pt-2 border-t border-slate-100">
            <RankingCompacto itens={dados.status} total={dados.total} max={3} />
          </div>
        </Quadrante>
      </div>

      {zoom && zooms[zoom] && (
        <div className="fixed inset-0 z-[9999] no-print">
          <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={() => setZoom(null)} />
          <div className="absolute inset-0 flex items-center justify-center p-4 md:p-6">
            <div className="w-full max-w-6xl max-h-[92vh] overflow-hidden rounded-3xl bg-white border border-slate-200 shadow-2xl">
              <div className="sticky top-0 z-10 bg-white/95 backdrop-blur border-b border-slate-100 px-5 py-4 flex items-center justify-between gap-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.22em] text-blue-600">Zoom analítico</p>
                  <h3 className="text-xl font-black text-slate-950 tracking-tight mt-1">{zooms[zoom].titulo}</h3>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => window.print()} className="h-10 px-4 rounded-xl bg-slate-900 text-white text-[10px] font-black uppercase">Imprimir</button>
                  <button onClick={() => setZoom(null)} className="h-10 px-4 rounded-xl bg-red-600 text-white text-[10px] font-black uppercase">Fechar</button>
                </div>
              </div>
              <div className="overflow-y-auto max-h-[calc(92vh-82px)] p-5">
                {zooms[zoom].corpo}
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
