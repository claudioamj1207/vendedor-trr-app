"use client";
import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';

const supabase = createClient("https://qswmodzcsdkjmdzgxtlo.supabase.co", "sb_publishable_lWTV-2xQxwJlIAEn-zj_vg_z75OgB4k");

export default function VendedorTRR_Master() {
  const [leads, setLeads] = useState([]);
  const [aba, setAba] = useState('estoque'); 
  const [moduloAtivo, setModuloAtivo] = useState('todo'); 
  const [busca, setBusca] = useState('');
  const [cnpjBusca, setCnpjBusca] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [statusProcesso, setStatusProcesso] = useState('');
  const [resultadoBusca, setResultadoBusca] = useState(''); // Novo: Guarda o resultado do processamento

  const sincronizar = async () => {
    try {
      setCarregando(true);
      let query = supabase.from('empresas_mestre').select('cnpj, razao_social, nome_fantasia, bairro');
      
      if (moduloAtivo === 'todo') {
        if (aba === 'estoque') query = query.eq('status_lead', 'Novo');
        if (aba === 'triagem') query = query.eq('status_lead', 'Triagem');
      } else if (moduloAtivo === 'cnpj' && cnpjBusca) {
        query = query.eq('cnpj', cnpjBusca.replace(/\D/g, ''));
      }
      
      const { data } = await query.order('razao_social', { ascending: true });
      setLeads(data || []);
    } finally { setCarregando(false); }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { sincronizar(); }, [aba, moduloAtivo]);

  // Limpa os alertas quando troca de aba
  useEffect(() => { setResultadoBusca(''); setStatusProcesso(''); }, [moduloAtivo]);

  // --- MOTOR PESCADOR: CONSULTA RECEITA COMPLETA ---
  const processarCNPJ = async (cnpj, fonteInfo) => {
    const cnpjLimpo = cnpj.replace(/\D/g, '');
    if (cnpjLimpo.length !== 14) return;
    
    try {
      setStatusProcesso(`Consultando na Receita: ${cnpjLimpo}...`);
      const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpjLimpo}`);
      const info = await res.json();
      
      if (info.cnpj) {
        await supabase.from('empresas_mestre').upsert({
          cnpj: cnpjLimpo,
          razao_social: info.razao_social,
          nome_fantasia: info.nome_fantasia,
          logradouro: info.logradouro,
          numero: info.numero,
          complemento: info.complemento,
          bairro: info.bairro,
          cep: info.cep,
          municipio: info.municipio,
          uf:
