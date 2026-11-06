/* ============================================================
   Elogest Recebe Fácil — store-api.js

   Implementação HTTP do ElogestStore, ativada quando
   ELOGEST_CONFIG.apiUrl está definido (o backend serve um
   js/config.js que faz isso). Mesmas funções e formatos do
   store.js em modo demonstração — as páginas não mudam.
   ============================================================ */

(function (global) {
    'use strict';

    const config = global.ELOGEST_CONFIG || {};
    if (!config.apiUrl) return; // modo demonstração: fica o store.js (localStorage)

    const BASE = config.apiUrl.replace(/\/$/, '');
    const { ApiError } = global.ElogestStore;

    function redirecionarParaLogin() {
        if (global.ElogestAuth) global.ElogestAuth.clearSession();
        if (!/(^|\/)(index\.html)?$/.test(global.location.pathname)) {
            global.location.replace('index.html');
        }
    }

    async function requisicao(metodo, caminho, corpo, opcoes) {
        opcoes = opcoes || {};
        const headers = { Accept: 'application/json' };
        const token = global.ElogestAuth && global.ElogestAuth.getToken();
        if (token && !opcoes.semToken) headers.Authorization = 'Bearer ' + token;
        if (corpo !== undefined) headers['Content-Type'] = 'application/json';

        let resposta;
        try {
            resposta = await fetch(BASE + caminho, {
                method: metodo,
                headers,
                body: corpo !== undefined ? JSON.stringify(corpo) : undefined,
            });
        } catch {
            throw new ApiError('Sem conexão com o servidor. Verifique sua internet e tente novamente.', 0);
        }

        if (resposta.status === 204) return null;
        let dados = null;
        try { dados = await resposta.json(); } catch { /* corpo vazio ou não-JSON */ }

        if (!resposta.ok) {
            if (resposta.status === 401 && !opcoes.semToken) redirecionarParaLogin();
            const mensagem = (dados && typeof dados.detail === 'string' && dados.detail) || 'Erro inesperado no servidor.';
            throw new ApiError(mensagem, resposta.status);
        }
        return dados;
    }

    const qs = (params) => {
        const pares = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '');
        return pares.length ? '?' + new URLSearchParams(pares).toString() : '';
    };
    const id = (v) => encodeURIComponent(v);

    // O backend rejeita campos desconhecidos — envia só o que ele espera.
    const campos = (obj, nomes) => Object.fromEntries(nomes.filter((n) => obj[n] !== undefined).map((n) => [n, obj[n]]));
    const CAMPOS_CLIENTE = ['nome_cliente', 'cpf_cnpj', 'telefone_cliente', 'email_cliente', 'endereco_cliente', 'bairro_cliente', 'obs_cliente'];
    const CAMPOS_DEBITO = ['cliente_id', 'valor_debito', 'criacao_debito', 'vencimento_debito', 'descricao_debito'];
    const CAMPOS_ITEM = ['produto_nome', 'categoria', 'quantidade', 'valor_unitario'];
    const limparItens = (itens) => (itens || []).map((i) => campos(i, CAMPOS_ITEM));

    const Auth = {
        login: (usuario, senha) => requisicao('POST', '/auth/login', { usuario, senha }, { semToken: true }),
    };

    const Clientes = {
        listar: () => requisicao('GET', '/clientes'),
        buscar: (clienteId) => requisicao('GET', `/clientes/${id(clienteId)}`),
        criar: (payload) => requisicao('POST', '/clientes', campos(payload, CAMPOS_CLIENTE)),
        atualizar: (clienteId, payload) => requisicao('PUT', `/clientes/${id(clienteId)}`, campos(payload, CAMPOS_CLIENTE)),
        excluir: (clienteId) => requisicao('DELETE', `/clientes/${id(clienteId)}`),
    };

    const Debitos = {
        listar: (filtros) => {
            filtros = filtros || {};
            return requisicao('GET', '/debitos' + qs({ cliente_id: filtros.clienteId, status: filtros.status }));
        },
        criar: (payload) => {
            const corpo = campos(payload, CAMPOS_DEBITO);
            if (!corpo.criacao_debito) delete corpo.criacao_debito;
            corpo.itens = limparItens(payload.itens);
            return requisicao('POST', '/debitos', corpo);
        },
        marcarComoPago: (debitoId) => requisicao('PATCH', `/debitos/${id(debitoId)}/pagar`),
    };

    const Itens = {
        listarPorCliente: (clienteId) => requisicao('GET', '/itens' + qs({ cliente_id: clienteId })),
        listarPorDebito: (debitoId) => requisicao('GET', `/debitos/${id(debitoId)}/itens`),
        salvarItensDoDebito: ({ debitoId, itens }) =>
            requisicao('PUT', `/debitos/${id(debitoId)}/itens`, { itens: limparItens(itens) }),
        rankingProdutosCliente: (clienteId, opcoes) =>
            requisicao('GET', '/itens/ranking' + qs({ cliente_id: clienteId, mes: opcoes && opcoes.mes })),
        rankingProdutosGeral: () => requisicao('GET', '/itens/ranking'),
        gastoTotalCliente: async (clienteId) =>
            (await requisicao('GET', '/itens/gasto-total' + qs({ cliente_id: clienteId }))).gasto_total,
    };

    const Regioes = { resumo: () => requisicao('GET', '/regioes/resumo') };
    const Dashboard = { resumo: () => requisicao('GET', '/dashboard/resumo') };

    global.ElogestStore = { Auth, Clientes, Debitos, Itens, Regioes, Dashboard, ApiError, modo: 'api' };
})(window);
