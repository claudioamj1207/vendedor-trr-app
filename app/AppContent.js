"use client";
import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export default function VendedorTRR_Master() {
  const [leads, setLeads] = useState([]);
  const [cnpjBusca, setCnpjBusca] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [statusProcesso, setStatusProcesso] = useState('');
  const [resultadoBusca, setResultadoBusca] = useState('');
  const [erroBusca, setErroBusca] = useState('');

  const sincronizar = async () => {
    try {
      setCarregando(true);

      const { data, error } = await supabase
        .from('empresas_mestre')
        .select('*')
        .order('razao_social', { ascending: true });

      if (error) {
        setErroBusca(`Erro ao carregar leads: ${error.message}`);
        setLeads([]);
        return;
      }

      setLeads(data || []);
    } catch (err) {
      setErroBusca('Falha ao sincronizar com o banco.');
      setLeads([]);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    sincronizar();
  }, []);

  const processarCNPJ = async (cnpj, leadExistente = {}) => {
    const cnpjLimpo = String(cnpj).replace(/\D/g, '');

    if (cnpjLimpo.length !== 14) {
      return { ok: false, erro: `CNPJ inválido: ${cnpj}` };
    }

    try {
      const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpjLimpo}`);

      if (!res.ok) {
        return { ok: false, erro: `Erro na API para o CNPJ ${cnpjLimpo}` };
      }

      const info = await res.json();

      if (!info?.cnpj) {
        return { ok: false, erro: `CNPJ não encontrado: ${cnpjLimpo}` };
      }

      const { error } = await supabase.from('empresas_mestre').upsert(
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
          situacao_cadastral: info.descricao_situacao_cadastral || 'Não informado',
          status_lead: leadExistente.status_lead || 'Novo',
          fonte_lead: leadExistente.fonte_lead || 'Busca Manual'
        },
        { onConflict: 'cnpj' }
      );

      if (error) {
        return { ok: false, erro: `Erro ao salvar no banco: ${error.message}` };
      }

      return { ok: true };
    } catch (err) {
      return { ok: false, erro: 'Falha de conexão com a API ou banco.' };
    }
  };

  const buscarECadastrarCNPJs = async () => {
    setResultadoBusca('');
    setErroBusca('');

    const regex = /\d{2}[.\s,-]?\d{3}[.\s,-]?\d{3}\/?\d{4}-?\d{2}|\d{14}/g;
    const encontrados = cnpjBusca.match(regex) || [];
    const cnpjsUnicos = [...new Set(encontrados.map(item => item.replace(/\D/g, '')))].filter(c => c.length === 14);

    if (cnpjsUnicos.length === 0) {
      setErroBusca('Nenhum CNPJ válido foi encontrado no texto digitado.');
      return;
    }

    let sucesso = 0;
    let ultimoErro = '';

    for (let i = 0; i < cnpjsUnicos.length; i++) {
      const atual = cnpjsUnicos[i];
      setStatusProcesso(`Processando ${i + 1} de ${cnpjsUnicos.length}: ${atual}`);

      const resultado = await processarCNPJ(atual, { fonte_lead: 'Busca Manual' });

      if (resultado.ok) {
        sucesso++;
      } else {
        ultimoErro = resultado.erro || 'Erro desconhecido';
      }
    }

    setStatusProcesso('');

    if (sucesso > 0) {
      setResultadoBusca(`Sucesso: ${sucesso} CNPJ(s) salvo(s).`);
      setCnpjBusca('');
      await sincronizar();
    } else {
      setErroBusca(`Nenhum CNPJ foi salvo. Motivo: ${ultimoErro}`);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white p-4">
      <h1 className="text-2xl font-bold mb-1">Vendedor TRR</h1>
      <p className="text-sm text-zinc-400 mb-6">Teste de integração com Supabase + Brasil API</p>

      <div className="max-w-3xl space-y-4">
        <textarea
          className="w-full bg-zinc-900 border border-zinc-800 p-4 rounded-xl min-h-[160px] outline-none"
          placeholder="Cole aqui um ou mais CNPJs. Exemplo:
12.345.678/0001-90
12345678000190"
          value={cnpjBusca}
          onChange={(e) => setCnpjBusca(e.target.value)}
        />

        <button
          onClick={buscarECadastrarCNPJs}
          className="bg-blue-600 hover:bg-blue-700 px-5 py-3 rounded-xl font-bold"
        >
          PESQUISAR E SALVAR
        </button>

        {statusProcesso && (
          <div className="bg-blue-900/30 border border-blue-500/40 p-3 rounded-xl text-sm text-blue-300">
            {statusProcesso}
          </div>
        )}

        {resultadoBusca && (
          <div className="bg-emerald-900/30 border border-emerald-500/40 p-3 rounded-xl text-sm text-emerald-300">
            {resultadoBusca}
          </div>
        )}

        {erroBusca && (
          <div className="bg-red-900/30 border border-red-500/40 p-3 rounded-xl text-sm text-red-300">
            {erroBusca}
          </div>
        )}
      </div>

      <div className="mt-8">
        <h2 className="text-lg font-bold mb-3">Empresas salvas</h2>

        {carregando ? (
          <p className="text-zinc-500">Carregando...</p>
        ) : leads.length === 0 ? (
          <p className="text-zinc-500">Nenhuma empresa encontrada no banco.</p>
        ) : (
          <div className="space-y-3">
            {leads.map((lead) => (
              <div
                key={lead.cnpj}
                className="border border-zinc-800 bg-zinc-900/40 rounded-xl p-4"
              >
                <p className="font-bold text-white">{lead.razao_social || 'Sem razão social'}</p>
                <p className="text-sm text-zinc-400">{lead.nome_fantasia || 'Sem nome fantasia'}</p>
                <div className="mt-2 text-xs text-zinc-500 space-y-1">
                  <p>CNPJ: {lead.cnpj}</p>
                  <p>Bairro: {lead.bairro || 'Não informado'}</p>
                  <p>Cidade/UF: {lead.municipio || '-'} / {lead.uf || '-'}</p>
                  <p>CNAE Principal: {lead.cnae_principal_descricao || 'Não informado'}</p>
                  <p>Situação: {lead.situacao_cadastral || 'Não informado'}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
