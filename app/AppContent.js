"use client";
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { consultarCNPJNaBrasilAPI } from '../lib/brasilApi';
import * as XLSX from 'xlsx';

export default function VendedorTRR_Master() {
  const [leads, setLeads] = useState([]);
  const [aba, setAba] = useState('estoque');
  const [moduloAtivo, setModuloAtivo] = useState('todo');
  const [buscaGlobal, setBuscaGlobal] = useState('');
  const [cnpjBusca, setCnpjBusca] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [statusProcesso, setStatusProcesso] = useState('');
  const [resultadoBusca, setResultadoBusca] = useState('');
  const [erroBusca, setErroBusca] = useState('');
  const [mostrarFiltros, setMostrarFiltros] = useState(false);
  const [totalAbsoluto, setTotalAbsoluto] = useState(0);

  const [filtrosAtivos, setFiltrosAtivos] = useState({
    razao_social: 'Todos',
    nome_fantasia: 'Todos',
    cnpj: 'Todos',
    bairro: 'Todos',
    fonte_lead: 'Todos',
    cnae_principal_descricao: 'Todos',
    cnae_secundario: 'Todos'
  });

  const extrairCNPJsDoTexto = (texto) => {
    if (!texto) return [];

    const regex = /\d{2}[.\s,/-]?\d{3}[.\s,/-]?\d{3}[\/\s-]?\d{4}[-\s]?\d{2}|\d{14}/g;
    const encontrados = texto.match(regex) || [];

    return [
      ...new Set(
        encontrados
          .map((item) => String(item).replace(/\D/g, ''))
          .filter((cnpj) => cnpj.length === 14)
      )
    ];
  };

  const processarEmLotes = async ({
    itens,
    tamanhoLote = 5,
    pausaMs = 300,
    mensagemProgresso,
    processador
  }) => {
    let sucesso = 0;
    let ultimoErro = '';

    for (let i = 0; i < itens.length; i += tamanhoLote) {
      const lote = itens.slice(i, i + tamanhoLote);

      if (mensagemProgresso) {
        setStatusProcesso(
          mensagemProgresso(Math.min(i + lote.length, itens.length), itens.length)
        );
      }

      const resultados = await Promise.all(lote.map((item) => processador(item)));

      resultados.forEach((resultado) => {
        if (resultado && resultado.ok) {
          sucesso++;
        } else if (resultado && resultado.erro) {
          ultimoErro = resultado.erro;
        }
      });

      if (i + tamanhoLote < itens.length) {
        await new Promise((resolve) => setTimeout(resolve, pausaMs));
      }
    }

    setStatusProcesso('');
    return { sucesso, ultimoErro };
  };

  const sincronizar = async () => {
    try {
      setCarregando(true);

      const { count: totalBanco, error: erroCount } = await supabase
        .from('empresas_mestre')
        .select('*', { count: 'exact', head: true });

      if (erroCount) throw erroCount;

      setTotalAbsoluto(totalBanco || 0);

      let todosLeads = [];
      let de = 0;
      let ate = 999;
      let continua = true;

      while (continua) {
        const { data, error } = await supabase
          .from('empresas_mestre')
          .select('*')
          .eq('status_lead', aba === 'estoque' ? 'Novo' : 'Triagem')
          .order('razao_social', { ascending: true })
          .range(de, ate);

        if (error) throw error;

        todosLeads = [...todosLeads, ...(data || [])];

        if (!data || data.length < 1000) {
          continua = false;
        } else {
          de += 1000;
          ate += 1000;
        }
      }

      setLeads(todosLeads);
    } catch (e) {
      console.error("Erro na sincronização:", e);
      setErroBusca(`Erro na sincronização: ${e.message || 'falha ao carregar dados.'}`);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    sincronizar();
  }, [aba]);

  const leadsFiltrados = useMemo(() => {
    return leads.filter((lead) => {
      const matchRazao =
        filtrosAtivos.razao_social === 'Todos' ||
        lead.razao_social === filtrosAtivos.razao_social;

      const matchFantasia =
        filtrosAtivos.nome_fantasia === 'Todos' ||
        lead.nome_fantasia === filtrosAtivos.nome_fantasia;

      const matchCNPJ =
        filtrosAtivos.cnpj === 'Todos' ||
        lead.cnpj === filtrosAtivos.cnpj;

      const matchBairro =
        filtrosAtivos.bairro === 'Todos' ||
        lead.bairro === filtrosAtivos.bairro;

      const matchFonte =
        filtrosAtivos.fonte_lead === 'Todos' ||
        lead.fonte_lead === filtrosAtivos.fonte_lead;

      const matchCnaeP =
        filtrosAtivos.cnae_principal_descricao === 'Todos' ||
        lead.cnae_principal_descricao === filtrosAtivos.cnae_principal_descricao;

      const matchCnaeS =
        filtrosAtivos.cnae_secundario === 'Todos' ||
        (lead.cnae_secundario &&
          lead.cnae_secundario.includes(filtrosAtivos.cnae_secundario));

      const texto = buscaGlobal.toLowerCase();
      const matchBusca =
        !buscaGlobal ||
        Object.values(lead).some((val) =>
          String(val || '').toLowerCase().includes(texto)
        );

      return (
        matchRazao &&
        matchFantasia &&
        matchCNPJ &&
        matchBairro &&
        matchFonte &&
        matchCnaeP &&
        matchCnaeS &&
        matchBusca
      );
    });
  }, [leads, filtrosAtivos, buscaGlobal]);

  const obterOpcoes = (campo) => {
    const opcoes = [...new Set(leads.map((l) => l[campo]).filter(Boolean))].sort();
    return ['Todos', ...opcoes];
  };

  const processarCNPJ = async (cnpj, leadExistente = {}) => {
    const cnpjLimpo = String(cnpj).replace(/\D/g, '');

    if (cnpjLimpo.length !== 14) {
      return { ok: false, erro: "CNPJ inválido" };
    }

    const consulta = await consultarCNPJNaBrasilAPI(cnpjLimpo);

    if (!consulta.ok) {
      return { ok: false, erro: consulta.erro };
    }

    const info = consulta.dados;

    const descSec = info.cnaes_secundarios
      ? info.cnaes_secundarios.map((c) => c.descricao).join(' | ')
      : 'Não informado';

    const { error } = await supabase
      .from('empresas_mestre')
      .upsert(
        {
          ...leadExistente,
          cnpj: cnpjLimpo,
          razao_social: info.razao_social || '',
          nome_fantasia: info.nome_fantasia || info.razao_social || '',
          logradouro: info.logradouro || '',
          numero: info.numero || '',
          bairro: info.bairro || '',
          municipio: info.municipio || '',
          uf: info.uf || '',
          cnae_principal_codigo: info.cnae_fiscal ? String(info.cnae_fiscal) : '',
          cnae_principal_descricao: info.cnae_fiscal_descricao || 'Não informado',
          cnae_secundario: descSec,
          situacao_cadastral: info.descricao_situacao_cadastral || 'ATIVA',
          status_lead: leadExistente.status_lead || 'Novo',
          fonte_lead: leadExistente.fonte_lead || 'Busca Manual'
        },
        { onConflict: 'cnpj' }
      );

    if (error) {
      return { ok: false, erro: `Erro ao salvar no banco: ${error.message}` };
    }

    return {
      ok: true,
      situacao: info.descricao_situacao_cadastral
    };
  };

  const limparInativos = async () => {
    if (!confirm(`Limpar inativos dos ${leadsFiltrados.length} leads atuais?`)) {
      return;
    }

    setResultadoBusca('');
    setErroBusca('');

    let excluidos = 0;

    for (let i = 0; i < leadsFiltrados.length; i++) {
      const lead = leadsFiltrados[i];
      setStatusProcesso(`Verificando ${i + 1} de ${leadsFiltrados.length}: ${lead.razao_social}`);

      const resultado = await processarCNPJ(lead.cnpj, lead);

      if (resultado && resultado.ok && resultado.situacao !== 'ATIVA') {
        await supabase.from('empresas_mestre').delete().eq('cnpj', lead.cnpj);
        excluidos++;
      }

      await new Promise((r) => setTimeout(r, 450));
    }

    setStatusProcesso('');
    setResultadoBusca(`${excluidos} empresa(s) inativa(s) removida(s).`);
    await sincronizar();
  };

  const atualizarFaltantes = async () => {
    setResultadoBusca('');
    setErroBusca('');

    const { data: faltantes, error } = await supabase
      .from('empresas_mestre')
      .select('*')
      .or('cnae_principal_descricao.is.null,cnae_secundario.is.null,cnae_principal_descricao.eq.""');

    if (error) {
      setErroBusca(`Erro ao localizar faltantes: ${error.message}`);
      return;
    }

    if (!faltantes || faltantes.length === 0) {
      alert("Dados completos!");
      return;
    }

    if (!confirm(`Atualizar ${faltantes.length} leads?`)) {
      return;
    }

    for (let i = 0; i < faltantes.length; i++) {
      const lead = faltantes[i];
      setStatusProcesso(`Atualizando ${i + 1} de ${faltantes.length}`);
      await processarCNPJ(lead.cnpj, lead);
      await new Promise((r) => setTimeout(r, 450));
    }

    setStatusProcesso('');
    setResultadoBusca(`${faltantes.length} lead(s) reprocessado(s).`);
    await sincronizar();
  };

  const extrairEPesquisar = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setResultadoBusca('');
    setErroBusca('');
    setStatusProcesso('Lendo arquivo...');

    const reader = new FileReader();

    reader.onload = async (evt) => {
      try {
        let textoBruto = '';

        if (file.name.toLowerCase().endsWith('.xlsx')) {
          const workbook = XLSX.read(evt.target.result, { type: 'binary' });
          const primeiraAba = workbook.Sheets[workbook.SheetNames[0]];
          textoBruto = JSON.stringify(XLSX.utils.sheet_to_json(primeiraAba));
        } else {
          textoBruto = evt.target.result;
        }

        const cnpjs = [...new Set((textoBruto.match(/\d{14}/g) || []))];

        if (cnpjs.length === 0) {
          setStatusProcesso('');
          setErroBusca("Nenhum CNPJ com 14 dígitos encontrado no arquivo.");
          return;
        }

        const { sucesso, ultimoErro } = await processarEmLotes({
          itens: cnpjs,
          tamanhoLote: 5,
          pausaMs: 300,
          mensagemProgresso: (processados, total) =>
            `Processando arquivo: ${processados} de ${total}...`,
          processador: async (cnpj) =>
            processarCNPJ(cnpj, { fonte_lead: `Arquivo: ${file.name}` })
        });

        if (sucesso === 0 && ultimoErro) {
          setErroBusca(`Erro no processamento: ${ultimoErro}`);
        } else if (ultimoErro) {
          setResultadoBusca(`Arquivo concluído: ${sucesso} empresa(s) salva(s). Falha em alguns: ${ultimoErro}`);
        } else {
          setResultadoBusca(`Arquivo concluído: ${sucesso} empresa(s) salva(s).`);
        }

        await sincronizar();
      } catch (err) {
        setStatusProcesso('');
        setErroBusca('Erro ao ler o arquivo.');
      }
    };

    if (file.name.toLowerCase().endsWith('.xlsx')) {
      reader.readAsBinaryString(file);
    } else {
      reader.readAsText(file);
    }
  };

  const buscarECadastrarCNPJs = async () => {
    setResultadoBusca('');
    setErroBusca('');

    const cnpjs = extrairCNPJsDoTexto(cnpjBusca);

    if (cnpjs.length === 0) {
      setErroBusca('Nenhum CNPJ válido foi encontrado no texto digitado.');
      return;
    }

    const { sucesso, ultimoErro } = await processarEmLotes({
      itens: cnpjs,
      tamanhoLote: 5,
      pausaMs: 300,
      mensagemProgresso: (processados, total) =>
        `Processando ${processados} de ${total}...`,
      processador: async (cnpj) =>
        processarCNPJ(cnpj, { fonte_lead: 'Busca Manual' })
    });

    if (sucesso === 0 && ultimoErro) {
      setErroBusca(`Nenhum CNPJ foi salvo. Motivo: ${ultimoErro}`);
      return;
    }

    if (ultimoErro) {
      setResultadoBusca(`Salvos ${sucesso} de ${cnpjs.length}. Falha em alguns: ${ultimoErro}`);
    } else {
      setResultadoBusca(`Sucesso: ${sucesso} CNPJ(s) salvo(s).`);
    }

    setCnpjBusca('');
    await sincronizar();
  };

  return (
    <div className="min-h-screen bg-black text-white pb-40 font-sans antialiased">
      <header className="px-5 pt-8 pb-4 sticky top-0 bg-black/95 border-b border-white/5 z-50">
        <div className="flex justify-between items-center mb-2">
          <h1 className="text-[10px] font-black text-blue-500 uppercase italic tracking-widest">
            Vendedor TRR
          </h1>

          <div className="flex gap-3 text-[9px] font-bold uppercase">
            {['todo', 'pescaria'].map((m) => (
              <button
                key={m}
                onClick={() => {
                  setModuloAtivo(m);
                  setResultadoBusca('');
                  setErroBusca('');
                  setStatusProcesso('');
                }}
                className={
                  moduloAtivo === m
                    ? 'text-white border-b border-blue-500'
                    : 'text-zinc-600'
                }
              >
                {m === 'todo' ? 'LISTA' : 'PESCARIA DE CNPJ'}
              </button>
            ))}
          </div>
        </div>

        <div className="flex justify-between items-center">
          <h2 className="text-3xl font-black italic uppercase tracking-tighter text-white">
            {moduloAtivo === 'todo'
              ? aba === 'triagem'
                ? 'Triagem'
                : 'Estoque'
              : 'Pescaria de CNPJ'}
          </h2>

          <div className="flex gap-2">
            {moduloAtivo === 'todo' && (
              <>
                <button
                  onClick={limparInativos}
                  className="text-[9px] bg-red-600 px-4 py-2 rounded-full font-bold"
                >
                  🗑️ LIMPAR
                </button>

                <button
                  onClick={atualizarFaltantes}
                  className="text-[9px] bg-emerald-600 px-4 py-2 rounded-full font-bold"
                >
                  🔄 ENRIQUECER
                </button>
              </>
            )}

            <button
              onClick={() => setMostrarFiltros(!mostrarFiltros)}
              className="text-[9px] bg-zinc-800 px-4 py-2 rounded-full font-bold border border-white/10"
            >
              FILTROS
            </button>
          </div>
        </div>

        {moduloAtivo === 'todo' && (
          <div className="mt-4 space-y-3">
            <input
              type="text"
              placeholder="Busca rápida..."
              className="w-full bg-zinc-900 p-3 rounded-xl text-xs outline-none border border-zinc-800 text-white"
              value={buscaGlobal}
              onChange={(e) => setBuscaGlobal(e.target.value)}
            />

            {mostrarFiltros && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 p-4 bg-zinc-900 rounded-2xl border border-white/5">
                {[
                  { label: 'Razão Social', campo: 'razao_social' },
                  { label: 'Nome Fantasia', campo: 'nome_fantasia' },
                  { label: 'CNPJ', campo: 'cnpj' },
                  { label: 'Bairro', campo: 'bairro' },
                  { label: 'Fonte', campo: 'fonte_lead' },
                  { label: 'CNAE Principal', campo: 'cnae_principal_descricao' }
                ].map((filtro) => (
                  <div key={filtro.campo} className="flex flex-col gap-1">
                    <label className="text-[9px] font-black text-zinc-500 uppercase ml-1">
                      {filtro.label}
                    </label>

                    <select
                      value={filtrosAtivos[filtro.campo]}
                      onChange={(e) =>
                        setFiltrosAtivos({
                          ...filtrosAtivos,
                          [filtro.campo]: e.target.value
                        })
                      }
                      className="bg-zinc-800 text-[11px] p-2.5 rounded-lg text-white outline-none"
                    >
                      {obterOpcoes(filtro.campo).map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}

                <button
                  onClick={() =>
                    setFiltrosAtivos({
                      razao_social: 'Todos',
                      nome_fantasia: 'Todos',
                      cnpj: 'Todos',
                      bairro: 'Todos',
                      fonte_lead: 'Todos',
                      cnae_principal_descricao: 'Todos',
                      cnae_secundario: 'Todos'
                    })
                  }
                  className="lg:col-span-3 text-[9px] font-bold text-red-500 uppercase py-2 bg-red-500/10 rounded-lg"
                >
                  Limpar Filtros
                </button>
              </div>
            )}

            <div className="flex justify-between items-center px-1">
              <p className="text-[10px] text-zinc-400 font-black uppercase tracking-widest">
                {totalAbsoluto} CNPJs
              </p>

              {statusProcesso && (
                <p className="text-[9px] text-blue-500 animate-pulse font-black uppercase italic">
                  {statusProcesso}
                </p>
              )}
            </div>
          </div>
        )}
      </header>

      <main className="px-4 mt-6">
        {resultadoBusca && (
          <div className="bg-emerald-900/30 border border-emerald-500/50 p-4 rounded-2xl mb-6 flex justify-between items-center text-emerald-400 text-xs font-bold animate-pulse">
            <span>✅ {resultadoBusca}</span>
            <button
              onClick={() => setResultadoBusca('')}
              className="bg-emerald-500/20 px-3 py-1 rounded-full text-[10px]"
            >
              OK
            </button>
          </div>
        )}

        {erroBusca && (
          <div className="bg-red-900/30 border border-red-500/50 p-4 rounded-2xl mb-6 flex justify-between items-center text-red-400 text-xs font-bold animate-pulse">
            <span>❌ {erroBusca}</span>
            <button
              onClick={() => setErroBusca('')}
              className="bg-red-500/20 px-3 py-1 rounded-full text-[10px]"
            >
              OK
            </button>
          </div>
        )}

        {moduloAtivo === 'todo' && (
          <div className="bg-zinc-900/30 border border-white/5 rounded-2xl divide-y divide-zinc-800/50">
            {carregando ? (
              <div className="text-center py-20 text-[10px] animate-pulse text-zinc-600 font-black uppercase tracking-widest">
                Sincronizando...
              </div>
            ) : leadsFiltrados.length === 0 ? (
              <div className="text-center py-20 text-[10px] text-zinc-600 font-black uppercase tracking-widest">
                Nenhum lead encontrado
              </div>
            ) : (
              leadsFiltrados.map((lead) => (
                <div
                  key={lead.cnpj}
                  className="py-4 px-4 flex justify-between items-center gap-3 hover:bg-zinc-800/40 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <h3 className="text-[12px] font-bold uppercase truncate text-white leading-tight">
                      {lead.razao_social}
                    </h3>

                    <div className="flex gap-2 mt-2 flex-wrap">
                      <span className="text-[8px] bg-zinc-800 px-2 py-0.5 rounded text-zinc-400 font-bold border border-white/5 uppercase">
                        {lead.bairro}
                      </span>

                      <span className="text-[8px] bg-blue-900/20 px-2 py-0.5 rounded text-blue-400 font-bold border border-blue-500/10 uppercase">
                        {lead.cnpj}
                      </span>

                      <span className="text-[8px] bg-orange-900/20 px-2 py-0.5 rounded text-orange-400 font-bold border border-orange-500/10 truncate max-w-[200px]">
                        {lead.cnae_principal_descricao || 'SEM CNAE'}
                      </span>

                      {lead.cnae_secundario && (
                        <span className="text-[8px] bg-zinc-900/50 px-2 py-0.5 rounded text-zinc-500 font-medium truncate max-w-[200px] italic text-white">
                          Sec: {lead.cnae_secundario}
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={async () => {
                      await supabase
                        .from('empresas_mestre')
                        .update({
                          status_lead: aba === 'estoque' ? 'Triagem' : 'Em Prospecção'
                        })
                        .eq('cnpj', lead.cnpj);

                      await sincronizar();
                    }}
                    className="h-10 w-10 bg-blue-600 rounded-xl flex items-center justify-center text-white active:scale-95 transition-all"
                  >
                    ➡️
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        {moduloAtivo === 'pescaria' && (
          <div className="max-w-3xl mx-auto space-y-8">
            <div className="bg-zinc-900 p-8 rounded-3xl border border-dashed border-zinc-800 text-center">
              <h3 className="text-lg font-black uppercase mb-3 text-white">Upload de arquivo</h3>
              <p className="text-[11px] text-zinc-500 mb-4">
                Envie Excel (.xlsx), texto (.txt) ou PDF textual para pescar CNPJs.
              </p>

              <input
                type="file"
                onChange={extrairEPesquisar}
                className="text-xs mb-4 w-full text-zinc-400"
              />

              {statusProcesso && (
                <p className="mt-4 text-blue-500 text-[10px] animate-pulse font-bold uppercase">
                  {statusProcesso}
                </p>
              )}
            </div>

            <div className="max-w-3xl mx-auto space-y-4 text-white">
              <h3 className="text-lg font-black uppercase text-white">Colar texto ou lista</h3>
              <p className="text-[11px] text-zinc-500">
                Cole CNPJs com ou sem máscara, ou até texto misturado.
              </p>

              <textarea
                placeholder="Cole os CNPJs aqui..."
                className="w-full bg-zinc-900 p-4 rounded-2xl text-sm h-40 outline-none border border-zinc-800 text-white"
                value={cnpjBusca}
                onChange={(e) => setCnpjBusca(e.target.value)}
              />

              <button
                onClick={buscarECadastrarCNPJs}
                className="w-full bg-blue-600 py-4 rounded-2xl font-black uppercase text-sm text-white shadow-lg active:scale-95 transition-all"
              >
                PESCAR E SALVAR
              </button>
            </div>
          </div>
        )}
      </main>

      <nav className="fixed bottom-6 left-6 right-6 h-16 bg-zinc-900/90 backdrop-blur-md border border-white/10 rounded-full px-8 flex justify-around items-center z-50 shadow-2xl">
        {['estoque', 'triagem'].map((a) => (
          <button
            key={a}
            onClick={() => setAba(a)}
            className={`text-[11px] font-black uppercase tracking-widest ${
              aba === a ? 'text-blue-500' : 'text-zinc-600'
            }`}
          >
            {a}
          </button>
        ))}
      </nav>
    </div>
  );
}
