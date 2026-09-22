export const normalizarDocumento = value => String(value ?? '').replace(/\D/g, '');
export const documentoCompleto = value => /^\d{14}$/.test(normalizarDocumento(value));
export function formatarDocumento(value) {
  const d = normalizarDocumento(value);
  if (d.length === 11) return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
  if (d.length === 14) return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
  return String(value ?? '');
}
const chave = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
// Supports the multiline ERP report and ordinary column-based CSV/XLSX files.
export function analisarLinhasClientes(rows) {
  const registros = new Map(), pendencias = [];
  let cpfsIgnorados = 0;
  let duplicados = 0, atual = null, header = null;
  const adicionar = (documento, nome, extra, linha) => {
    const d = normalizarDocumento(documento);
    if (d.length === 11) { cpfsIgnorados++; atual = null; return; }
    if (!documentoCompleto(d) || !String(nome || '').trim()) {
      pendencias.push({ linha, documento: String(documento ?? ''), nome: String(nome ?? ''), motivo: 'Informe CNPJ com 14 dígitos e nome. Zeros não são completados automaticamente.' });
      atual = null; return;
    }
    if (registros.has(d)) duplicados++;
    atual = { documento: d, nome: String(nome).trim(), ...extra };
    registros.set(d, atual);
  };
  rows.forEach((row, index) => {
    const cells = row.map(x => String(x ?? '').trim());
    if (!cells.some(Boolean)) return;
    const first = cells[0] || '';
    const match = first.match(/^([\d.\/\-\s]+)\s+-\s+(.+)$/);
    if (match) { adicionar(match[1], match[2], { email: cells[10] || '', telefone: cells[16] || '' }, index + 1); return; }
    if (atual && cells.some(c => /^Bairro:/i.test(c))) {
      atual.endereco = first;
      atual.bairro = (cells.find(c => /^Bairro:/i.test(c)) || '').replace(/^Bairro:\s*/i, '');
      const cep = cells.find(c => /^CEP:/i.test(c)) || '';
      atual.cep = cep.match(/\d{5}-?\d{3}/)?.[0] || '';
      atual.municipio = cep.match(/\(([^)]+)\)/)?.[1] || '';
      return;
    }
    const keys = cells.map(chave);
    if (keys.some(k => ['documento','cnpjcpf','cpfcnpj','cnpj','cpf'].includes(k)) && keys.some(k => ['nome','cliente','razaosocial'].includes(k))) { header = keys; return; }
    if (!header) return;
    const get = names => { const i = header.findIndex(k => names.includes(k)); return i < 0 ? '' : cells[i] || ''; };
    adicionar(get(['documento','cnpjcpf','cpfcnpj','cnpj','cpf']), get(['nome','cliente','razaosocial']), {
      email: get(['email']), telefone: get(['telefone','telefone1','fone']),
      endereco: get(['endereco','logradouro']), bairro: get(['bairro']),
      municipio: get(['municipio','cidade']), uf: get(['uf','estado']).toUpperCase(), cep: get(['cep'])
    }, index + 1);
  });
  return { registros: [...registros.values()], pendencias, duplicados, cpfsIgnorados };
}
export function classificarCliente(documento, base) {
  if (!base || !documentoCompleto(documento)) return 'A conferir';
  return base.documentos.has(normalizarDocumento(documento)) ? 'Cadastrado na Viva' : 'Não cadastrado na base Viva';
}

// Do not join adjacent CPFs or extract 14-digit fragments from longer numbers.
export function extrairCNPJsDoTexto(texto) {
  const encontrados = String(texto || '').match(/(?<!\d)(?:\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}|\d{14})(?!\d)/g) || [];
  return [...new Set(encontrados.map(normalizarDocumento))];
}
