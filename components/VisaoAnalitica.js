"use client";
import React, { useMemo, useState, useEffect } from 'react';

const CAMPOS_ANALISE = [
  { id: 'cnae_principal_descricao', label: 'CNAE', curto: 'CNAE' },
  { id: 'municipio', label: 'Município', curto: 'Município' },
  { id: 'bairro', label: 'Bairro', curto: 'Bairro' },
  { id: 'porte', label: 'Porte', curto: 'Porte' },
  { id: 'fonte_lead', label: 'Fonte do lead', curto: 'Fonte' },
  { id: 'status_lead', label: 'Status do lead', curto: 'Status' },
  { id: 'status_vendedor', label: 'Status do vendedor', curto: 'Status vendedor' },
  { id: 'situacao_cadastral', label: 'Situação cadastral', curto: 'Situação' },
  { id: 'uf', label: 'UF', curto: 'UF' },
  { id: 'potencial_consumo', label: 'Potencial de consumo', curto: 'Potencial' },
  { id: 'categoria_trr', label: 'Categoria TRR', curto: 'Categoria' }
];

const STORAGE_KEY = 'vtrr_visao_analitica_camadas_salvas_v1';

function texto(valor, fallback = 'Não informado') {
  const limpo = String(valor ?? '').trim();
  if (!limpo || limpo.toLowerCase() === 'null' || limpo.toLowerCase() === 'undefined') return fallback;
  return limpo;
}

function numeroBR(valor) {
  return Number(valor || 0).toLocaleString('pt-BR');
}

function moedaBR(valor) {
  const numero = Number(valor || 0);
  return numero.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
}

function percentual(parte, total) {
  if (!total) return 0;
  return Math.round((Number(parte || 0) / Number(total || 1)) * 100);
}

function nomeCampo(campo) {
  return CAMPOS_ANALISE.find((item) => item.id === campo)?.label || campo;
}

function obterValor(lead, campo) {
  if (!campo) return 'Não informado';
  const valor = lead?.[campo];
  if (campo === 'uf') return texto(valor, 'Sem UF').toUpperCase();
  return texto(valor);
}

function scoreLead(lead) {
  let pontos = 0;
  const capital = Number(lead?.capital_social || 0);
  const cnae = texto(lead?.cnae_principal_descricao, '').toLowerCase();
  const cnaeSec = texto(lead?.cnae_secundario, '').toLowerCase();
  const base = `${cnae} ${cnaeSec} ${texto(lead?.razao_social, '').toLowerCase()} ${texto(lead?.nome_fantasia, '').toLowerCase()}`;

  if (texto(lead?.situacao_cadastral, '').toUpperCase().includes('ATIVA')) pontos += 20;
  if (capital >= 1000000) pontos += 25;
  else if (capital >= 300000) pontos += 15;
  else if (capital >= 100000) pontos += 8;
  if (texto(lead?.municipio, '').toLowerCase().includes('manaus')) pontos += 8;
  if (['AM', 'RR'].includes(texto(lead?.uf, '').toUpperCase())) pontos += 8;
  if (lead?.telefone_1 || lead?.telefone_2) pontos += 5;
  if (lead?.email) pontos += 3;

  const termosQuentes = [
    'transporte', 'carga', 'logística', 'logistica', 'construção', 'construcao', 'obras',
    'terraplenagem', 'pavimentação', 'pavimentacao', 'fabricação', 'fabricacao', 'indústria',
    'industria', 'energia', 'gerador', 'agro', 'pesca', 'alimentos', 'atacadista', 'distribuição', 'distribuicao'
  ];
  if (termosQuentes.some((termo) => base.includes(termo))) pontos += 14;
  return pontos;
}

function agrupar(leads, campo, limite = 12) {
  const mapa = new Map();
  leads.forEach((lead) => {
    const nome = obterValor(lead, campo);
    const atual = mapa.get(nome) || { nome, total: 0, capital: 0, score: 0, exemplos: [], leads: [] };
    atual.total += 1;
    atual.capital += Number(lead?.capital_social || 0);
    atual.score += scoreLead(lead);
    if (atual.exemplos.length < 4) atual.exemplos.push(texto(lead?.razao_social));
    if (atual.leads.length < 20) atual.leads.push(lead);
    mapa.set(nome, atual);
  });
  return Array.from(mapa.values())
    .sort((a, b) => b.total - a.total || b.score - a.score || b.capital - a.capital || a.nome.localeCompare(b.nome, 'pt-BR'))
    .slice(0, limite);
}

function cruzar(leads, campoA, campoB, limite = 14) {
  const mapa = new Map();
  leads.forEach((lead) => {
    const a = obterValor(lead, campoA);
    const b = obterValor(lead, campoB);
    const chave = `${a}|||${b}`;
    const atual = mapa.get(chave) || { nome: a, subnome: b, total: 0, capital: 0, score: 0, exemplos: [] };
    atual.total += 1;
    atual.capital += Number(lead?.capital_social || 0);
    atual.score += scoreLead(lead);
    if (atual.exemplos.length < 3) atual.exemplos.push(texto(lead?.razao_social));
    mapa.set(chave, atual);
  });
  return Array.from(mapa.values())
    .sort((a, b) => b.total - a.total || b.score - a.score || b.capital - a.capital)
    .slice(0, limite);
}

function triplaCamada(leads, campoA, campoB, campoC, limite = 16) {
  const mapa = new Map();
  leads.forEach((lead) => {
    const a = obterValor(lead, campoA);
    const b = obterValor(lead, campoB);
    const c = obterValor(lead, campoC);
    const chave = `${a}|||${b}|||${c}`;
    const atual = mapa.get(chave) || { nome: a, subnome: b, detalhe: c, total: 0, capital: 0, score: 0, exemplos: [] };
    atual.total += 1;
    atual.capital += Number(lead?.capital_social || 0);
    atual.score += scoreLead(lead);
    if (atual.exemplos.length < 3) atual.exemplos.push(texto(lead?.razao_social));
    mapa.set(chave, atual);
  });
  return Array.from(mapa.values())
    .sort((a, b) => b.total - a.total || b.score - a.score || b.capital - a.capital)
    .slice(0, limite);
}

function baixarJson(nome, conteudo) {
  const blob = new Blob([JSON.stringify(conteudo, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function Botao({ children, onClick, variante = 'padrao', type = 'button' }) {
  const estilos = {
    padrao: 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50',
    azul: 'bg-blue-600 border-blue-600 text-white hover:bg-blue-700',
    verde: 'bg-emerald-600 border-emerald-600 text-white hover:bg-emerald-700',
    roxo: 'bg-violet-600 border-violet-600 text-white hover:bg-violet-700',
    vermelho: 'bg-red-600 border-red-600 text-white hover:bg-red-700'
  };
  return (
    <button type={type} onClick={onClick} className={`px-4 py-2 rounded-2xl border text-[11px] font-black uppercase tracking-wide transition-all active:scale-95 shadow-sm ${estilos[variante] || estilos.padrao}`}>
      {children}
    </button>
  );
}

function CardKPI({ titulo, valor, subtitulo, cor = 'blue' }) {
  const estilos = {
    blue: 'from-blue-50 to-white border-blue-100 text-blue-700',
    emerald: 'from-emerald-50 to-white border-emerald-100 text-emerald-700',
    violet: 'from-violet-50 to-white border-violet-100 text-violet-700',
    amber: 'from-amber-50 to-white border-amber-100 text-amber-700',
    rose: 'from-rose-50 to-white border-rose-100 text-rose-700'
  };
  return (
    <div className={`rounded-3xl border bg-gradient-to-br p-5 shadow-sm ${estilos[cor] || estilos.blue}`}>
      <p className="text-[10px] font-black uppercase tracking-widest opacity-75">{titulo}</p>
      <p className="text-3xl font-black tracking-tighter mt-2 text-slate-950">{valor}</p>
      {subtitulo && <p className="text-[11px] text-slate-500 mt-2 leading-relaxed">{subtitulo}</p>}
    </div>
  );
}

function Barra({ valor, total, cor = 'bg-blue-500' }) {
  const pct = percentual(valor, total);
  return (
    <div className="h-2 bg-slate-100 rounded-full overflow-hidden mt-2">
      <div className={`h-full ${cor}`} style={{ width: `${Math.min(100, pct)}%` }} />
    </div>
  );
}

function RankingCompacto({ itens, total, tipo = 'simples' }) {
  return (
    <div className="space-y-2">
      {itens.map((item, index) => (
        <div key={`${item.nome}-${item.subnome || ''}-${item.detalhe || ''}-${index}`} className="bg-white border border-slate-100 rounded-2xl p-3 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-black text-slate-900 leading-snug truncate">
                {index + 1}. {item.nome}
              </p>
              {item.subnome && <p className="text-[10px] text-blue-600 font-bold mt-1 truncate">{item.subnome}</p>}
              {item.detalhe && <p className="text-[10px] text-violet-600 font-bold mt-1 truncate">{item.detalhe}</p>}
              <p className="text-[10px] text-slate-400 mt-1 truncate">{item.exemplos?.join(' • ')}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-lg font-black text-slate-950">{numeroBR(item.total)}</p>
              <p className="text-[9px] text-slate-400 uppercase">{percentual(item.total, total)}%</p>
            </div>
          </div>
          <Barra valor={item.total} total={total} cor={tipo === 'cruzado' ? 'bg-violet-500' : tipo === 'triplo' ? 'bg-emerald-500' : 'bg-blue-500'} />
        </div>
      ))}
    </div>
  );
}

function Quadrante({ titulo, subtitulo, children, onZoom, destaque = 'blue' }) {
  const cores = {
    blue: 'border-blue-100 bg-blue-50/40',
    emerald: 'border-emerald-100 bg-emerald-50/40',
    violet: 'border-violet-100 bg-violet-50/40',
    amber: 'border-amber-100 bg-amber-50/40',
    rose: 'border-rose-100 bg-rose-50/40',
    slate: 'border-slate-100 bg-white'
  };
  return (
    <section className={`rounded-3xl border shadow-sm p-4 min-h-[310px] ${cores[destaque] || cores.slate}`}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <h3 className="text-sm font-black uppercase tracking-tight text-slate-950 truncate">{titulo}</h3>
          {subtitulo && <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">{subtitulo}</p>}
        </div>
        <button onClick={onZoom} className="shrink-0 px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-[10px] font-black text-slate-700 hover:bg-slate-50 shadow-sm">
          ZOOM
        </button>
      </div>
      {children}
    </section>
  );
}

function ModalZoom({ aberto, onClose, titulo, subtitulo, children, onPrint }) {
  useEffect(() => {
    if (!aberto) return;
    const onKey = (event) => { if (event.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = 'auto';
    };
  }, [aberto, onClose]);

  if (!aberto) return null;
  return (
    <div className="fixed inset-0 z-[9999]">
      <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute inset-0 flex items-center justify-center p-4 md:p-6">
        <div className="w-full max-w-6xl max-h-[94vh] overflow-hidden rounded-3xl bg-white border border-slate-200 shadow-2xl">
          <div className="sticky top-0 z-10 bg-white/95 backdrop-blur border-b border-slate-200 px-5 py-4 flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-blue-600">Zoom analítico</p>
              <h2 className="text-xl md:text-3xl font-black uppercase tracking-tight text-slate-950 mt-1">{titulo}</h2>
              {subtitulo && <p className="text-sm text-slate-500 mt-2">{subtitulo}</p>}
            </div>
            <div className="flex gap-2 shrink-0">
              <Botao onClick={onPrint} variante="azul">Imprimir</Botao>
              <Botao onClick={onClose} variante="vermelho">Fechar</Botao>
            </div>
          </div>
          <div className="overflow-y-auto max-h-[calc(94vh-104px)] p-5 bg-slate-50">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

function SelectCamada({ label, value, onChange, desabilitar = [] }) {
  return (
    <div>
      <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-2">{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-3 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-blue-200 shadow-sm">
        {CAMPOS_ANALISE.map((campo) => (
          <option key={campo.id} value={campo.id} disabled={desabilitar.includes(campo.id)}>{campo.label}</option>
        ))}
      </select>
    </div>
  );
}

export default function VisaoAnalitica({ leads = [], totalAbsoluto = 0, carregando = false }) {
  const [camada1, setCamada1] = useState('cnae_principal_descricao');
  const [camada2, setCamada2] = useState('municipio');
  const [camada3, setCamada3] = useState('porte');
  const [zoom, setZoom] = useState(null);
  const [analisesSalvas, setAnalisesSalvas] = useState([]);

  useEffect(() => {
    try {
      const bruto = localStorage.getItem(STORAGE_KEY);
      if (bruto) setAnalisesSalvas(JSON.parse(bruto));
    } catch {}
  }, []);

  const dados = useMemo(() => {
    const total = leads.length;
    const ativos = leads.filter((lead) => texto(lead.situacao_cadastral, '').toUpperCase().includes('ATIVA')).length;
    const capitalSomado = leads.reduce((acc, lead) => acc + Number(lead.capital_social || 0), 0);
    const camadaPrincipal = agrupar(leads, camada1, 14);
    const cruzamento12 = cruzar(leads, camada1, camada2, 16);
    const cruzamento23 = cruzar(leads, camada2, camada3, 16);
    const triplo = triplaCamada(leads, camada1, camada2, camada3, 18);
    const topOportunidades = [...leads]
      .map((lead) => ({ ...lead, scoreAnalitico: scoreLead(lead) }))
      .sort((a, b) => b.scoreAnalitico - a.scoreAnalitico || Number(b.capital_social || 0) - Number(a.capital_social || 0))
      .slice(0, 14);
    const gruposDistintos = new Set(leads.map((lead) => obterValor(lead, camada1))).size;
    return { total, ativos, capitalSomado, camadaPrincipal, cruzamento12, cruzamento23, triplo, topOportunidades, gruposDistintos };
  }, [leads, camada1, camada2, camada3]);

  const configuracaoAtual = useMemo(() => ({
    camada1,
    camada2,
    camada3,
    titulo: `${nomeCampo(camada1)} → ${nomeCampo(camada2)} → ${nomeCampo(camada3)}`,
    criadoEm: new Date().toISOString()
  }), [camada1, camada2, camada3]);

  function salvarAnalise() {
    const nome = window.prompt('Nome para salvar esta análise:', configuracaoAtual.titulo);
    if (!nome) return;
    const nova = { ...configuracaoAtual, id: Date.now(), nome };
    const atualizadas = [nova, ...analisesSalvas].slice(0, 12);
    setAnalisesSalvas(atualizadas);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(atualizadas));
  }

  function carregarAnalise(item) {
    setCamada1(item.camada1);
    setCamada2(item.camada2);
    setCamada3(item.camada3);
  }

  function excluirAnalise(id) {
    const atualizadas = analisesSalvas.filter((item) => item.id !== id);
    setAnalisesSalvas(atualizadas);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(atualizadas));
  }

  function imprimirTela() {
    window.print();
  }

  function exportarConfiguracao() {
    baixarJson(`analise-vtrr-${Date.now()}.json`, {
      configuracao: configuracaoAtual,
      resumo: {
        total: dados.total,
        ativos: dados.ativos,
        capitalSomado: dados.capitalSomado,
        gruposDistintos: dados.gruposDistintos
      },
      rankingCamadaPrincipal: dados.camadaPrincipal,
      cruzamento12: dados.cruzamento12,
      cruzamento23: dados.cruzamento23,
      triplo: dados.triplo
    });
  }

  if (carregando) {
    return <div className="text-center py-20 text-[11px] animate-pulse text-slate-400 font-black uppercase tracking-widest">Montando painel analítico...</div>;
  }

  if (!dados.total) {
    return (
      <div className="bg-white border border-slate-200 rounded-3xl p-8 text-center shadow-sm">
        <p className="text-sm font-black uppercase text-slate-500">Nenhum lead carregado para análise.</p>
      </div>
    );
  }

  const zoomConteudos = {
    principal: {
      titulo: `Ranking por ${nomeCampo(camada1)}`,
      subtitulo: 'Camada principal escolhida para leitura do banco.',
      conteudo: <RankingCompacto itens={dados.camadaPrincipal} total={dados.total} />
    },
    cruzamento12: {
      titulo: `${nomeCampo(camada1)} x ${nomeCampo(camada2)}`,
      subtitulo: 'Cruzamento entre a primeira e a segunda camada.',
      conteudo: <RankingCompacto itens={dados.cruzamento12} total={dados.total} tipo="cruzado" />
    },
    cruzamento23: {
      titulo: `${nomeCampo(camada2)} x ${nomeCampo(camada3)}`,
      subtitulo: 'Cruzamento entre a segunda e a terceira camada.',
      conteudo: <RankingCompacto itens={dados.cruzamento23} total={dados.total} tipo="cruzado" />
    },
    triplo: {
      titulo: `${nomeCampo(camada1)} → ${nomeCampo(camada2)} → ${nomeCampo(camada3)}`,
      subtitulo: 'Recortes combinando as três camadas selecionadas.',
      conteudo: <RankingCompacto itens={dados.triplo} total={dados.total} tipo="triplo" />
    },
    oportunidades: {
      titulo: 'Top oportunidades comerciais',
      subtitulo: 'Ranking automático usando situação cadastral, capital, localização, contato e termos de atividade.',
      conteudo: (
        <div className="space-y-3">
          {dados.topOportunidades.map((lead, index) => (
            <div key={`${lead.cnpj || lead.razao_social}-${index}`} className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-black text-slate-950 leading-snug">{index + 1}. {texto(lead.razao_social)}</p>
                  <p className="text-[11px] text-blue-600 font-bold mt-1 truncate">{texto(lead.cnae_principal_descricao)}</p>
                  <p className="text-[11px] text-slate-500 mt-1">{texto(lead.municipio)} / {texto(lead.uf, '')} • {texto(lead.porte)}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-2xl font-black text-emerald-600">{lead.scoreAnalitico}</p>
                  <p className="text-[9px] uppercase text-slate-400 font-black">pontos</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )
    },
    resumo: {
      titulo: 'Resumo executivo',
      subtitulo: 'Leitura geral do painel atual.',
      conteudo: (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <CardKPI titulo="Leads analisados" valor={numeroBR(dados.total)} subtitulo={`Banco total: ${numeroBR(totalAbsoluto || dados.total)}`} cor="blue" />
          <CardKPI titulo="Ativos" valor={`${percentual(dados.ativos, dados.total)}%`} subtitulo={`${numeroBR(dados.ativos)} leads com situação ativa.`} cor="emerald" />
          <CardKPI titulo="Grupos distintos" valor={numeroBR(dados.gruposDistintos)} subtitulo={`Distintos em ${nomeCampo(camada1)}.`} cor="violet" />
          <CardKPI titulo="Capital social" valor={moedaBR(dados.capitalSomado)} subtitulo="Soma dos capitais informados." cor="amber" />
        </div>
      )
    }
  };

  const zoomAtual = zoom ? zoomConteudos[zoom] : null;

  return (
    <section className="space-y-5 print:bg-white">
      <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm">
        <div className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-5">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.28em] text-blue-600">Central Analítica por Camadas</p>
            <h2 className="text-2xl md:text-4xl font-black uppercase tracking-tight text-slate-950 mt-2">Monte o dashboard do seu jeito</h2>
            <p className="text-sm text-slate-500 mt-2 max-w-3xl leading-relaxed">
              Escolha até três camadas de análise. O VTRR monta um painel ocupado, com quadrantes, rankings, cruzamentos, zoom, impressão e análises salvas no navegador.
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Botao onClick={salvarAnalise} variante="verde">Salvar análise</Botao>
            <Botao onClick={exportarConfiguracao} variante="roxo">Exportar JSON</Botao>
            <Botao onClick={imprimirTela} variante="azul">Imprimir</Botao>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-5">
          <SelectCamada label="Camada 1" value={camada1} onChange={setCamada1} />
          <SelectCamada label="Camada 2" value={camada2} onChange={setCamada2} />
          <SelectCamada label="Camada 3" value={camada3} onChange={setCamada3} />
        </div>

        {analisesSalvas.length > 0 && (
          <div className="mt-5 bg-slate-50 border border-slate-200 rounded-3xl p-4">
            <div className="flex items-center justify-between gap-3 mb-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Análises salvas</p>
              <span className="text-[10px] text-slate-400 font-bold">{analisesSalvas.length} salvas</span>
            </div>
            <div className="flex gap-2 flex-wrap">
              {analisesSalvas.map((item) => (
                <div key={item.id} className="flex items-center gap-1 bg-white border border-slate-200 rounded-2xl p-1 shadow-sm">
                  <button onClick={() => carregarAnalise(item)} className="px-3 py-1.5 text-[10px] font-black text-slate-700 uppercase hover:text-blue-700">
                    {item.nome}
                  </button>
                  <button onClick={() => excluirAnalise(item.id)} className="px-2 py-1.5 text-[10px] font-black text-red-500 hover:text-red-700">×</button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <CardKPI titulo="Leads analisados" valor={numeroBR(dados.total)} subtitulo={`Total no banco: ${numeroBR(totalAbsoluto || dados.total)}`} cor="blue" />
        <CardKPI titulo="Ativos" valor={`${percentual(dados.ativos, dados.total)}%`} subtitulo={`${numeroBR(dados.ativos)} leads ativos.`} cor="emerald" />
        <CardKPI titulo="Grupos da camada 1" valor={numeroBR(dados.gruposDistintos)} subtitulo={nomeCampo(camada1)} cor="violet" />
        <CardKPI titulo="Capital social" valor={moedaBR(dados.capitalSomado)} subtitulo="Total informado nos leads." cor="amber" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <Quadrante titulo={`Camada 1: ${nomeCampo(camada1)}`} subtitulo="Ranking principal do painel." onZoom={() => setZoom('principal')} destaque="blue">
          <RankingCompacto itens={dados.camadaPrincipal.slice(0, 6)} total={dados.total} />
        </Quadrante>

        <Quadrante titulo={`${nomeCampo(camada1)} x ${nomeCampo(camada2)}`} subtitulo="Primeiro cruzamento analítico." onZoom={() => setZoom('cruzamento12')} destaque="violet">
          <RankingCompacto itens={dados.cruzamento12.slice(0, 6)} total={dados.total} tipo="cruzado" />
        </Quadrante>

        <Quadrante titulo={`${nomeCampo(camada2)} x ${nomeCampo(camada3)}`} subtitulo="Segundo cruzamento analítico." onZoom={() => setZoom('cruzamento23')} destaque="emerald">
          <RankingCompacto itens={dados.cruzamento23.slice(0, 6)} total={dados.total} tipo="cruzado" />
        </Quadrante>

        <Quadrante titulo="Recorte em 3 camadas" subtitulo={configuracaoAtual.titulo} onZoom={() => setZoom('triplo')} destaque="amber">
          <RankingCompacto itens={dados.triplo.slice(0, 6)} total={dados.total} tipo="triplo" />
        </Quadrante>

        <Quadrante titulo="Top oportunidades" subtitulo="Ranking automático de potencial." onZoom={() => setZoom('oportunidades')} destaque="rose">
          <div className="space-y-2">
            {dados.topOportunidades.slice(0, 6).map((lead, index) => (
              <div key={`${lead.cnpj || lead.razao_social}-${index}`} className="bg-white border border-slate-100 rounded-2xl p-3 shadow-sm flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-black text-slate-950 truncate">{index + 1}. {texto(lead.razao_social)}</p>
                  <p className="text-[10px] text-slate-500 truncate mt-1">{texto(lead.municipio)} / {texto(lead.uf, '')}</p>
                </div>
                <span className="text-sm font-black text-emerald-600">{lead.scoreAnalitico}</span>
              </div>
            ))}
          </div>
        </Quadrante>

        <Quadrante titulo="Resumo executivo" subtitulo="Números gerais do painel atual." onZoom={() => setZoom('resumo')} destaque="slate">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4"><p className="text-[10px] font-black text-blue-700 uppercase">Leads</p><p className="text-2xl font-black text-slate-950">{numeroBR(dados.total)}</p></div>
            <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4"><p className="text-[10px] font-black text-emerald-700 uppercase">Ativos</p><p className="text-2xl font-black text-slate-950">{percentual(dados.ativos, dados.total)}%</p></div>
            <div className="bg-violet-50 border border-violet-100 rounded-2xl p-4"><p className="text-[10px] font-black text-violet-700 uppercase">Grupos</p><p className="text-2xl font-black text-slate-950">{numeroBR(dados.gruposDistintos)}</p></div>
            <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4"><p className="text-[10px] font-black text-amber-700 uppercase">Capital</p><p className="text-lg font-black text-slate-950">{moedaBR(dados.capitalSomado)}</p></div>
          </div>
        </Quadrante>
      </div>

      <ModalZoom
        aberto={!!zoomAtual}
        onClose={() => setZoom(null)}
        titulo={zoomAtual?.titulo}
        subtitulo={zoomAtual?.subtitulo}
        onPrint={imprimirTela}
      >
        {zoomAtual?.conteudo}
      </ModalZoom>
    </section>
  );
}
