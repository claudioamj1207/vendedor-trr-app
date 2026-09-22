import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import XLSX from 'xlsx';
import { analisarLinhasClientes, classificarCliente, formatarDocumento, extrairCNPJsDoTexto } from '../lib/clientesViva.mjs';
test('ERP: CPF, CNPJ, leading zeros, incomplete document and addresses',{skip:!process.env.VIVA_CSV_PATH},()=>{
 const text=new TextDecoder('windows-1252').decode(fs.readFileSync(process.env.VIVA_CSV_PATH));
 const wb=XLSX.read(text,{type:'string',raw:true});
 const r=analisarLinhasClientes(XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{header:1,raw:false,defval:''}));
 assert.equal(r.registros.length,640);assert.equal(r.pendencias.length,2);
 assert.equal(r.registros.filter(x=>x.documento.length===11).length,0);
 assert.equal(r.registros.filter(x=>x.documento.length===14).length,640);
 assert.ok(r.registros.some(x=>x.documento.startsWith('0')));
 assert.ok(r.registros[0].municipio);assert.ok(r.registros[0].email);
});
test('all UFs and formatted CPF; exact branch match; unavailable base',()=>{
 const r=analisarLinhasClientes([['CPF/CNPJ','Nome','UF'],['012.345.678-90','Pessoa','SP'],['01.234.567/0001-89','Matriz','PA'],['01234567000260','Filial','SC'],['123456789','Incompleto','AM']]);
 assert.equal(r.registros.length,2);assert.equal(r.cpfsIgnorados,1);assert.equal(r.registros[0].uf,'PA');assert.equal(r.pendencias.length,1);
 const b={documentos:new Set(['01234567000189','01234567890'])};
 assert.equal(classificarCliente('01.234.567/0001-89',b),'Cadastrado na Viva');
 assert.equal(classificarCliente('01234567000260',b),'Não cadastrado na base Viva');
 assert.equal(classificarCliente('01234567890',null),'A conferir');
 assert.equal(classificarCliente('123456789',b),'A conferir');
 assert.equal(formatarDocumento('01234567890'),'012.345.678-90');
});
test('duplicates consolidate and unrecognized input never becomes an empty replacement',()=>{
 const r=analisarLinhasClientes([['Documento','Nome'],['01234567000189','Um'],['01234567000189','Dois']]);
 assert.equal(r.duplicados,1);assert.equal(r.registros.length,1);assert.equal(r.registros[0].nome,'Dois');
 assert.equal(analisarLinhasClientes([['Nome'],['Fulano']]).registros.length,0);
});

test('pescaria ignores CPFs, adjacent CPFs and longer numeric fragments',()=>{
 assert.deepEqual(extrairCNPJsDoTexto('01234567890 98765432100 012.345.678-90'),[]);
 assert.deepEqual(extrairCNPJsDoTexto('9012345670001899'),[]);
 assert.deepEqual(extrairCNPJsDoTexto('01234567890;01.234.567/0001-89;01234567000189'),['01234567000189']);
 assert.equal(analisarLinhasClientes([['CPF','Nome'],['01234567890','Pessoa']]).registros.length,0);
});
