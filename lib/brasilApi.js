export async function consultarCNPJNaBrasilAPI(cnpj) {
  const cnpjLimpo = String(cnpj || '').replace(/\D/g, '');

  if (cnpjLimpo.length !== 14) {
    return { ok: false, erro: 'CNPJ inválido' };
  }

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const precisaComplementoEndereco = (dados = {}) => {
    const logradouroVazio = !String(dados.logradouro || '').trim();
    const numeroVazio = !String(dados.numero || '').trim();
    const bairroVazio = !String(dados.bairro || '').trim();
    const cepVazio = !String(dados.cep || '').trim();

    return logradouroVazio || numeroVazio || bairroVazio || cepVazio;
  };

  const normalizarTexto = (valor, fallback = '') => {
    if (valor === null || valor === undefined) return fallback;
    const texto = String(valor).trim();
    return texto === '' ? fallback : texto;
  };

  const mapearBrasilAPI = (info = {}) => {
    return {
      cnpj: cnpjLimpo,
      razao_social: normalizarTexto(info.razao_social),
      nome_fantasia: normalizarTexto(
        info.nome_fantasia,
        normalizarTexto(info.razao_social)
      ),
      logradouro: normalizarTexto(info.logradouro),
      numero: normalizarTexto(info.numero),
      bairro: normalizarTexto(info.bairro),
      municipio: normalizarTexto(info.municipio),
      uf: normalizarTexto(info.uf),
      cep: normalizarTexto(info.cep),
      complemento: normalizarTexto(info.complemento),
      telefone_1: normalizarTexto(info.telefone_1),
      telefone_2: normalizarTexto(info.telefone_2),
      email: normalizarTexto(info.email),
      cnae_fiscal: info.cnae_fiscal ? String(info.cnae_fiscal) : '',
      cnae_fiscal_descricao: normalizarTexto(info.cnae_fiscal_descricao),
      cnaes_secundarios: Array.isArray(info.cnaes_secundarios)
        ? info.cnaes_secundarios
        : [],
      descricao_situacao_cadastral: normalizarTexto(
        info.descricao_situacao_cadastral,
        'ATIVA'
      ),
      capital_social: info.capital_social ?? '',
      porte: normalizarTexto(info.porte),
      data_inicio_atividade: normalizarTexto(info.data_inicio_atividade),
      fonte_consulta: 'BrasilAPI',
      _raw_brasilapi: info,
    };
  };

  const mapearCNPJws = (info = {}) => {
    const estabelecimento = info.estabelecimento || {};
    const atividadePrincipal = estabelecimento.atividade_principal || {};
    const atividadesSecundarias = Array.isArray(
      estabelecimento.atividades_secundarias
    )
      ? estabelecimento.atividades_secundarias
      : [];

    const telefone1 = [
      normalizarTexto(estabelecimento.ddd1),
      normalizarTexto(estabelecimento.telefone1),
    ]
      .filter(Boolean)
      .join('');

    const telefone2 = [
      normalizarTexto(estabelecimento.ddd2),
      normalizarTexto(estabelecimento.telefone2),
    ]
      .filter(Boolean)
      .join('');

    return {
      cnpj: cnpjLimpo,
      razao_social: normalizarTexto(info.razao_social),
      nome_fantasia: normalizarTexto(
        estabelecimento.nome_fantasia,
        normalizarTexto(info.razao_social)
      ),
      logradouro: normalizarTexto(estabelecimento.logradouro),
      numero: normalizarTexto(estabelecimento.numero),
      bairro: normalizarTexto(estabelecimento.bairro),
      municipio: normalizarTexto(estabelecimento.cidade?.nome),
      uf: normalizarTexto(estabelecimento.estado?.sigla),
      cep: normalizarTexto(estabelecimento.cep),
      complemento: normalizarTexto(estabelecimento.complemento),
      telefone_1: telefone1,
      telefone_2: telefone2,
      email: normalizarTexto(estabelecimento.email),
      cnae_fiscal: normalizarTexto(atividadePrincipal.id),
      cnae_fiscal_descricao: normalizarTexto(atividadePrincipal.descricao),
      cnaes_secundarios: atividadesSecundarias.map((item) => ({
        codigo: normalizarTexto(item.id),
        descricao: normalizarTexto(item.descricao),
      })),
      descricao_situacao_cadastral: normalizarTexto(
        estabelecimento.situacao_cadastral,
        'ATIVA'
      ),
      capital_social: info.capital_social ?? '',
      porte: normalizarTexto(info.porte?.descricao),
      data_inicio_atividade: normalizarTexto(
        estabelecimento.data_inicio_atividade
      ),
      fonte_consulta: 'CNPJ.ws',
      _raw_cnpjws: info,
    };
  };

  const mesclarDados = (principal = {}, complementar = {}) => {
    const escolher = (a, b) => {
      const aTexto = typeof a === 'string' ? a.trim() : a;
      const bTexto = typeof b === 'string' ? b.trim() : b;

      if (aTexto !== undefined && aTexto !== null && aTexto !== '') return a;
      if (bTexto !== undefined && bTexto !== null && bTexto !== '') return b;
      return a ?? b ?? '';
    };

    const secundariasPrincipal = Array.isArray(principal.cnaes_secundarios)
      ? principal.cnaes_secundarios
      : [];
    const secundariasComplementar = Array.isArray(complementar.cnaes_secundarios)
      ? complementar.cnaes_secundarios
      : [];

    return {
      cnpj: escolher(principal.cnpj, complementar.cnpj),
      razao_social: escolher(principal.razao_social, complementar.razao_social),
      nome_fantasia: escolher(
        principal.nome_fantasia,
        complementar.nome_fantasia
      ),
      logradouro: escolher(principal.logradouro, complementar.logradouro),
      numero: escolher(principal.numero, complementar.numero),
      bairro: escolher(principal.bairro, complementar.bairro),
      municipio: escolher(principal.municipio, complementar.municipio),
      uf: escolher(principal.uf, complementar.uf),
      cep: escolher(principal.cep, complementar.cep),
      complemento: escolher(principal.complemento, complementar.complemento),
      telefone_1: escolher(principal.telefone_1, complementar.telefone_1),
      telefone_2: escolher(principal.telefone_2, complementar.telefone_2),
      email: escolher(principal.email, complementar.email),
      cnae_fiscal: escolher(principal.cnae_fiscal, complementar.cnae_fiscal),
      cnae_fiscal_descricao: escolher(
        principal.cnae_fiscal_descricao,
        complementar.cnae_fiscal_descricao
      ),
      cnaes_secundarios:
        secundariasPrincipal.length > 0
          ? secundariasPrincipal
          : secundariasComplementar,
      descricao_situacao_cadastral: escolher(
        principal.descricao_situacao_cadastral,
        complementar.descricao_situacao_cadastral
      ),
      capital_social: escolher(
        principal.capital_social,
        complementar.capital_social
      ),
      porte: escolher(principal.porte, complementar.porte),
      data_inicio_atividade: escolher(
        principal.data_inicio_atividade,
        complementar.data_inicio_atividade
      ),
      fonte_consulta:
        principal.fonte_consulta && complementar.fonte_consulta
          ? `${principal.fonte_consulta} + ${complementar.fonte_consulta}`
          : escolher(principal.fonte_consulta, complementar.fonte_consulta),
      _raw_brasilapi: principal._raw_brasilapi,
      _raw_cnpjws: complementar._raw_cnpjws,
    };
  };

  const consultarBrasilAPI = async () => {
    const MAX_TENTATIVAS = 3;
    const PAUSA_MS = 1200;

    for (let tentativa = 1; tentativa <= MAX_TENTATIVAS; tentativa++) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 12000);

        const res = await fetch(
          `https://brasilapi.com.br/api/cnpj/v1/${cnpjLimpo}`,
          {
            signal: controller.signal,
          }
        );

        clearTimeout(timeout);

        if (!res.ok) {
          if (tentativa === MAX_TENTATIVAS) {
            return {
              ok: false,
              erro: `Falha na consulta da Receita para ${cnpjLimpo}`,
            };
          }
        } else {
          const info = await res.json();

          if (!info?.cnpj) {
            return {
              ok: false,
              erro: `CNPJ não encontrado: ${cnpjLimpo}`,
            };
          }

          return {
            ok: true,
            dados: mapearBrasilAPI(info),
          };
        }
      } catch (err) {
        if (tentativa === MAX_TENTATIVAS) {
          return {
            ok: false,
            erro: 'Falha de conexão com a API da Receita',
          };
        }
      }

      await sleep(PAUSA_MS);
    }

    return {
      ok: false,
      erro: 'Falha de conexão com a API da Receita',
    };
  };

  const consultarCNPJws = async () => {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);

      const res = await fetch(`https://publica.cnpj.ws/cnpj/${cnpjLimpo}`, {
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
        },
      });

      clearTimeout(timeout);

      if (!res.ok) {
        if (res.status === 429) {
          return {
            ok: false,
            erro: 'Limite da CNPJ.ws atingido. Aguarde um pouco e tente novamente.',
          };
        }

        if (res.status === 404) {
          return {
            ok: false,
            erro: `CNPJ não encontrado na CNPJ.ws: ${cnpjLimpo}`,
          };
        }

        return {
          ok: false,
          erro: `Falha na consulta complementar da CNPJ.ws para ${cnpjLimpo}`,
        };
      }

      const info = await res.json();

      if (!info?.estabelecimento?.cnpj && !info?.razao_social) {
        return {
          ok: false,
          erro: `Resposta inválida da CNPJ.ws para ${cnpjLimpo}`,
        };
      }

      return {
        ok: true,
        dados: mapearCNPJws(info),
      };
    } catch (err) {
      return {
        ok: false,
        erro: 'Falha de conexão com a CNPJ.ws',
      };
    }
  };

  const brasil = await consultarBrasilAPI();
  let dadosFinais = null;

  if (brasil.ok) {
    dadosFinais = brasil.dados;
  }

  if (!dadosFinais) {
    await sleep(800);
    const complementar = await consultarCNPJws();

    if (complementar.ok) {
      dadosFinais = complementar.dados;
    } else {
      return {
        ok: false,
        erro: `Falha geral nas consultas para ${cnpjLimpo}`,
      };
    }
  }

  if (dadosFinais && precisaComplementoEndereco(dadosFinais)) {
    await sleep(800);
    const complementar = await consultarCNPJws();

    if (complementar.ok) {
      dadosFinais = mesclarDados(dadosFinais, complementar.dados);
    }
  }

  return {
    ok: true,
    dados: dadosFinais,
  };
}
