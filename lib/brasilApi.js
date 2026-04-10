export async function consultarCNPJNaBrasilAPI(cnpj) {
  const cnpjLimpo = String(cnpj).replace(/\D/g, '');

  if (cnpjLimpo.length !== 14) {
    return { ok: false, erro: 'CNPJ inválido' };
  }

  const MAX_TENTATIVAS = 3;
  const PAUSA_MS = 1200;

  for (let tentativa = 1; tentativa <= MAX_TENTATIVAS; tentativa++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12000);

      const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpjLimpo}`, {
        signal: controller.signal
      });

      clearTimeout(timeout);

      if (!res.ok) {
        if (tentativa === MAX_TENTATIVAS) {
          return {
            ok: false,
            erro: `Falha na consulta da Receita para ${cnpjLimpo}`
          };
        }
      } else {
        const info = await res.json();

        if (!info?.cnpj) {
          return { ok: false, erro: `CNPJ não encontrado: ${cnpjLimpo}` };
        }

        return {
          ok: true,
          dados: info
        };
      }
    } catch (err) {
      if (tentativa === MAX_TENTATIVAS) {
        return { ok: false, erro: 'Falha de conexão com a API da Receita' };
      }
    }

    await new Promise((resolve) => setTimeout(resolve, PAUSA_MS));
  }

  return { ok: false, erro: 'Falha de conexão com a API da Receita' };
}
