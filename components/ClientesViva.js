'use client';
import React, { useCallback, useEffect, useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '../lib/supabase';
import { analisarLinhasClientes, formatarDocumento } from '../lib/clientesViva.mjs';
const STORAGE = 'vtrr_viva_session';
export default function ClientesViva({ onBaseChange }) {
 const ativoToken = useRef('');
 const [token,setToken]=useState(''), [base,setBase]=useState(null), [perfil,setPerfil]=useState('');
 const [usuario,setUsuario]=useState(''), [senha,setSenha]=useState(''), [erro,setErro]=useState('');
 const [ocupado,setOcupado]=useState(false), [previa,setPrevia]=useState(null), [aberto,setAberto]=useState(false);
 const [dataBase,setDataBase]=useState(new Date().toLocaleDateString('en-CA'));
 const [busca,setBusca]=useState('');
 const publicar=useCallback(b=>{ setBase(b); onBaseChange(b ? {...b,documentos:new Set(b.registros.map(r=>r.documento))} : null); },[onBaseChange]);
 const carregar=useCallback(async t=>{
   const {data,error}=await supabase.rpc('viva_clientes_base',{p_token:t});
   if(error) throw error;
   if(ativoToken.current===t){publicar(data.base); setPerfil(data.perfil);} return data;
 },[publicar]);
 useEffect(()=>{
   let ativo=true; const salvo=sessionStorage.getItem(STORAGE);
   if(salvo) { ativoToken.current=salvo; setToken(salvo); carregar(salvo).catch(e=>{if(ativo){publicar(null);setToken('');sessionStorage.removeItem(STORAGE);setErro(e.message);}}); }
   return ()=>{ativo=false;};
 },[carregar,publicar]);
 useEffect(()=>{
   if(!token)return;
   const atualizar=()=>carregar(token).catch(e=>{if(ativoToken.current===token){publicar(null);setErro(e.message);setToken('');ativoToken.current='';sessionStorage.removeItem(STORAGE);}});
   window.addEventListener('focus',atualizar);
   const id=setInterval(atualizar,60000);
   return ()=>{window.removeEventListener('focus',atualizar);clearInterval(id);};
 },[token,carregar,publicar]);
 async function entrar(e){
   e.preventDefault();setOcupado(true);setErro('');
   try{const {data,error}=await supabase.rpc('app_login',{p_usuario:usuario,p_senha:senha,p_persistir:false});
    if(error||!data?.ok)throw new Error(error?.message||data?.mensagem||'Não foi possível entrar.');
    ativoToken.current=data.token;await carregar(data.token);sessionStorage.setItem(STORAGE,data.token);setToken(data.token);setSenha('');
   }catch(e){setErro(e.message);}finally{setOcupado(false);}
 }
 async function selecionar(e){
   const file=e.target.files?.[0];e.target.value='';setPrevia(null);setErro('');if(!file)return;
   setOcupado(true);
   try{
    if(file.size>10*1024*1024)throw new Error('O arquivo deve ter até 10 MB.');
    const bytes=await file.arrayBuffer();let wb;
    if(/\.csv$/i.test(file.name)){
     let texto=new TextDecoder('utf-8').decode(bytes);
     if(texto.includes('\uFFFD'))texto=new TextDecoder('windows-1252').decode(bytes);
     wb=XLSX.read(texto,{type:'string',raw:true});
    }else if(/\.xlsx?$/i.test(file.name)){wb=XLSX.read(bytes,{type:'array',cellText:true});}
    else throw new Error('Selecione um arquivo CSV, XLS ou XLSX.');
    const rows=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{header:1,raw:false,defval:''});
    const resultado=analisarLinhasClientes(rows);
    if(!resultado.registros.length)throw new Error('Nenhum cadastro reconhecido. Use a listagem completa do sistema ou colunas Documento, Nome e, opcionalmente, UF, Município, E-mail e Telefone.');
    if(resultado.registros.length>20000)throw new Error('O limite é de 20.000 cadastros por arquivo.');
    setPrevia({...resultado,fonte:file.name,revisao:base?.revisao||0});setAberto(true);
   }catch(e){setErro(e.message);}finally{setOcupado(false);}
 }
 async function salvar(){
   setOcupado(true);setErro('');
   try{
    const {data,error}=await supabase.rpc('viva_clientes_base',{p_token:token,p_dados:{...previa,data_base:dataBase}});
    if(error)throw error;if(ativoToken.current===token){publicar(data.base);setPrevia(null);}
   }catch(e){setErro(e.message);}finally{setOcupado(false);}
 }
 const lista=base?.registros.filter(r=>[r.nome,r.documento,r.municipio,r.uf].join(' ').toLowerCase().includes(busca.toLowerCase()))||[];
 return <section className="bg-white text-slate-900 border border-slate-200 rounded-2xl p-4 my-4 space-y-3">
  <div className="flex flex-wrap justify-between gap-2 items-center">
   <div><h2 className="font-bold text-blue-800">Clientes Viva</h2>
   <p className="text-xs text-slate-600">{base?`${base.registros.length} cadastros • Base de ${base.data_base.split('-').reverse().join('/')} • ${base.pendencias.length} a conferir`:token?'Nenhuma relação carregada. Abra o upload para importar clientes.':'Entre para identificar os leads cadastrados na Viva.'}</p></div>
   <button className="text-sm text-blue-700 underline" onClick={()=>setAberto(!aberto)}>{aberto?'Recolher':'Abrir base / upload'}</button>
  </div>
  {!token && <form onSubmit={entrar} className="flex flex-wrap gap-2 items-end">
   <label className="text-xs">Usuário do sistema<input required autoComplete="username" value={usuario} onChange={e=>setUsuario(e.target.value)} className="block border rounded p-2" /></label>
   <label className="text-xs">Senha<input required type="password" autoComplete="current-password" value={senha} onChange={e=>setSenha(e.target.value)} className="block border rounded p-2" /></label>
   <button disabled={ocupado} className="bg-blue-700 text-white rounded px-4 py-2 disabled:opacity-50">{ocupado?'Entrando…':'Entrar'}</button>
  </form>}
  {erro && <p role="alert" className="text-sm text-red-700">{erro}</p>}
  {token && aberto && <>
   <p className="text-xs text-slate-600">CPF e CNPJ de todas as UFs são aceitos. A comparação usa o documento completo; ter cadastro não significa ter comprado. A base é compartilhada entre os usuários com acesso.</p>
   {perfil==='proprietario' && <div className="space-y-2 border-t pt-3">
    <label className="block text-sm font-semibold">Atualizar relação de clientes <input aria-label="Arquivo de clientes Viva" disabled={ocupado} type="file" accept=".csv,.xlsx,.xls" onChange={selecionar} className="block mt-2 text-xs" /></label>
    <p className="text-xs text-slate-600">CSV do sistema ou planilha com Documento e Nome. O upload substitui a relação anterior após a prévia; não altera os leads nem seu histórico comercial.</p>
   </div>}
   {previa && <div className="border border-blue-200 bg-blue-50 rounded-xl p-3 space-y-2">
    <h3 className="font-bold">Prévia: {previa.fonte}</h3>
    <p className="text-sm">{previa.registros.length} cadastros aceitos ({previa.registros.filter(r=>r.documento.length===11).length} CPFs) • {previa.duplicados} duplicados consolidados • {previa.pendencias.length} a conferir</p>
    <p className="text-xs">Documentos são conferidos pelo formato; zeros iniciais são preservados quando presentes no arquivo. A UF não é deduzida do DDD.</p>
    <label className="text-sm">Data da relação <input required type="date" value={dataBase} onChange={e=>setDataBase(e.target.value)} className="border rounded p-1" /></label>
    <ul className="text-xs">{previa.registros.slice(0,5).map(r=><li key={r.documento}>{formatarDocumento(r.documento)} — {r.nome}</li>)}</ul>
    <button disabled={ocupado||!dataBase} onClick={salvar} className="bg-emerald-700 text-white rounded px-3 py-2 mr-2 disabled:opacity-50">{ocupado?'Salvando…':'Confirmar atualização da base'}</button>
    <button disabled={ocupado} onClick={()=>setPrevia(null)} className="text-sm underline">Cancelar</button>
   </div>}
   {!!(previa?.pendencias||base?.pendencias)?.length && <details><summary className="text-sm cursor-pointer">Cadastros a conferir</summary><ul className="text-xs space-y-1 mt-2">{(previa?.pendencias||base?.pendencias).map((r,i)=><li key={i}>Linha {r.linha}: {r.documento} — {r.nome}. {r.motivo}</li>)}</ul></details>}
   {base && <details><summary className="text-sm cursor-pointer">Consultar clientes importados</summary>
    <input aria-label="Buscar cliente Viva" placeholder="Nome, CPF/CNPJ, município ou UF" value={busca} onChange={e=>setBusca(e.target.value)} className="border rounded p-2 text-sm w-full my-2"/>
    <p className="text-xs">{lista.length} resultados. Mostrando até 100; refine a busca.</p>
    <div className="max-h-80 overflow-auto"><table className="text-xs w-full text-left"><thead><tr><th>CPF/CNPJ</th><th>Nome</th><th>Município / UF</th></tr></thead><tbody>{lista.slice(0,100).map(r=><tr key={r.documento} className="border-t"><td className="p-2 whitespace-nowrap">{formatarDocumento(r.documento)}</td><td>{r.nome}</td><td>{r.municipio||'—'} / {r.uf||'Não informada'}</td></tr>)}</tbody></table></div>
   </details>}
   <button disabled={ocupado} className="text-xs underline disabled:opacity-50" onClick={()=>{ativoToken.current='';supabase.rpc('app_logout',{p_token:token});sessionStorage.removeItem(STORAGE);setToken('');setPerfil('');publicar(null);setPrevia(null);}}>Fechar acesso à base Viva neste navegador</button>
  </>}
 </section>;
}
