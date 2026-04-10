export async function consultarCNPJNaBrasilAPI(cnpj) {
  const cnpjLimpo = String(cnpj).replace(/\D/g, '');

  if (cnpjLimpo.length !== 14) {
    return { ok: false, erro: 'CNPJ inválido' };
  }

  try {
    const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpjLimpo}`);

    if (!res.ok) {
      return { ok: false, erro: `Falha na consulta da Receita para ${cnpjLimpo}` };
    }

    const info = await res.json();

    if (!info?.cnpj) {
      return { ok: false, erro: `CNPJ não encontrado: ${cnpjLimpo}` };
    }

    return {
      ok: true,
      dados: info
    };
  } catch (err) {
    return { ok: false, erro: 'Falha de conexão com a API da Receita' };
  }
}
