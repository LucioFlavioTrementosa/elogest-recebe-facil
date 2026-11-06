/* ============================================================
   Elogest Recebe Fácil — store.js

   "Banco de dados" simulado em localStorage, usado quando o
   protótipo é aberto direto pelo index.html (modo demonstração).

   Quando as páginas são servidas pelo backend (pasta ../backend),
   js/config.js define ELOGEST_CONFIG.apiUrl e js/store-api.js
   substitui este objeto por chamadas HTTP reais — com os MESMOS
   nomes de função e formatos de retorno. As regras de validação
   aqui espelham as do backend, para os dois modos se comportarem
   igual.

   Toda função pública devolve uma Promise e tem um pequeno atraso
   artificial (simularAtraso), imitando uma chamada de rede real.

   Estrutura das "tabelas":
   - usuarios: { id, usuario, senha, nome }
   - clientes: { id, nome_cliente, cpf_cnpj, telefone_cliente, email_cliente, endereco_cliente, obs_cliente, bairro_cliente }
   - debitos:  { id, cliente_id, valor_debito, criacao_debito, vencimento_debito, descricao_debito, status, pago_em }
     (status é PENDENTE ou PAGO; status_calculado é derivado em tempo real)
   - itens_compra: { id, debito_id, cliente_id, produto_nome, categoria, quantidade, valor_unitario, data }
     (carrinho opcional de um débito — alimenta o mini CRM de produtos e o
     relatório por região; um débito sem itens continua funcionando normalmente)
   ============================================================ */

(function (global) {
    'use strict';

    const PREFIX = 'elogest:';

    const ApiError = class extends Error {
        constructor(message, status) {
            super(message);
            this.status = status;
        }
    };

    function ler(chave, padrao) {
        try {
            const bruto = localStorage.getItem(PREFIX + chave);
            if (!bruto) return padrao;
            return JSON.parse(bruto);
        } catch {
            return padrao;
        }
    }

    function gravar(chave, valor) {
        try {
            localStorage.setItem(PREFIX + chave, JSON.stringify(valor));
        } catch {
            // Armazenamento indisponível (modo privado, cota excedida): falha
            // de verdade, para a tela não mostrar "salvo com sucesso" à toa.
            throw new ApiError('Não foi possível salvar os dados neste navegador (armazenamento cheio ou bloqueado).', 507);
        }
    }

    /** Grava várias chaves; se alguma falhar, desfaz as anteriores (tudo ou nada). */
    function gravarTudo(pares) {
        const anteriores = pares.map(([chave]) => [chave, localStorage.getItem(PREFIX + chave)]);
        try {
            pares.forEach(([chave, valor]) => gravar(chave, valor));
        } catch (err) {
            anteriores.forEach(([chave, bruto]) => {
                try {
                    if (bruto === null) localStorage.removeItem(PREFIX + chave);
                    else localStorage.setItem(PREFIX + chave, bruto);
                } catch { /* nada mais a fazer */ }
            });
            throw err;
        }
    }

    function simularAtraso(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms || 350));
    }

    function proximoId(lista) {
        return lista.reduce((max, item) => Math.max(max, item.id), 0) + 1;
    }

    /** AAAA-MM-DD no fuso LOCAL (toISOString usaria UTC e viraria o dia às 21h no Brasil). */
    function formatarISO(data) {
        const p = (n) => String(n).padStart(2, '0');
        return `${data.getFullYear()}-${p(data.getMonth() + 1)}-${p(data.getDate())}`;
    }

    /** Dinheiro em centavos inteiros para não acumular erro de ponto flutuante. */
    function centavos(valor) {
        return Math.round(Number((Number(valor) * 100).toFixed(4)));
    }

    /* ------------------------------------------------------------
       SEED — dados de demonstração, gerados só quando a base está
       vazia. Nunca sobrescreve dados que o usuário já cadastrou.
       ------------------------------------------------------------ */
    const VERSAO_SEED = 3;

    // Seeds antigos (v1/v2) usavam CPF/CNPJ com dígito verificador inválido,
    // que agora é rejeitado na edição — corrige só esses valores conhecidos.
    const DOCUMENTOS_SEED_ANTIGOS = {
        '111.222.333-44': '111.222.333-96',
        '222.333.444-55': '222.333.444-05',
        '12.345.678/0001-90': '12.345.678/0001-95',
        '333.444.555-66': '333.444.555-08',
        '98.765.432/0001-10': '98.765.432/0001-98',
        '444.555.666-77': '444.555.666-19',
    };

    function migrar() {
        const clientes = ler('clientes', null);
        if (!clientes) return;
        let mudou = false;
        for (const c of clientes) {
            const novo = DOCUMENTOS_SEED_ANTIGOS[c.cpf_cnpj];
            if (novo && !clientes.some((o) => o.cpf_cnpj === novo)) { c.cpf_cnpj = novo; mudou = true; }
        }
        if (mudou) gravar('clientes', clientes);
    }

    function semear() {
        if (ler('clientes', null) !== null) return; // já existe base — não mexe

        const hoje = new Date();
        const diasA_partir = (n) => {
            const d = new Date(hoje);
            d.setDate(d.getDate() + n);
            return formatarISO(d);
        };

        const usuarios = [
            { id: 1, usuario: 'admin', senha: '123456', nome: 'Administrador' },
        ];

        const clientes = [
            { id: 1, nome_cliente: 'Maria Aparecida Souza', cpf_cnpj: '111.222.333-96', telefone_cliente: '(14) 99123-4567', email_cliente: 'maria.souza@email.com', endereco_cliente: 'Rua das Flores, 123 - Centro - Jaú/SP', obs_cliente: 'Cliente frequente. Compras semanais às segundas-feiras.', bairro_cliente: 'Centro' },
            { id: 2, nome_cliente: 'João Pedro Lima', cpf_cnpj: '222.333.444-05', telefone_cliente: '(14) 99234-5678', email_cliente: 'joaopedro.lima@email.com', endereco_cliente: 'Av. Brasil, 890 - Vila Alta - Jaú/SP', obs_cliente: '', bairro_cliente: 'Vila Alta' },
            { id: 3, nome_cliente: 'Mercado Bom Preço LTDA', cpf_cnpj: '12.345.678/0001-95', telefone_cliente: '(14) 99345-6789', email_cliente: 'financeiro@bompreco.com', endereco_cliente: 'Rua Sete de Setembro, 45 - Centro - Jaú/SP', obs_cliente: 'Cliente PJ — compra em atacado mensalmente.', bairro_cliente: 'Centro' },
            { id: 4, nome_cliente: 'Ana Beatriz Ferreira', cpf_cnpj: '333.444.555-08', telefone_cliente: '(14) 99456-7890', email_cliente: '', endereco_cliente: 'Rua XV de Novembro, 210 - Jaú/SP', obs_cliente: '', bairro_cliente: 'Jardim Europa' },
            { id: 5, nome_cliente: 'Padaria Pão Dourado', cpf_cnpj: '98.765.432/0001-98', telefone_cliente: '(14) 99567-8901', email_cliente: 'contato@paodourado.com', endereco_cliente: 'Rua dos Ipês, 78 - Jardim Europa - Jaú/SP', obs_cliente: 'Pedido recorrente de farinha e açúcar.', bairro_cliente: 'Jardim Europa' },
            { id: 6, nome_cliente: 'Carlos Eduardo Martins', cpf_cnpj: '444.555.666-19', telefone_cliente: '(14) 99678-9012', email_cliente: 'cadu.martins@email.com', endereco_cliente: 'Rua Amazonas, 55 - Jaú/SP', obs_cliente: 'Costuma atrasar pagamentos — atenção redobrada.', bairro_cliente: 'Vila Alta' },
        ];

        const debitos = [
            { id: 1, cliente_id: 1, valor_debito: 348.90, criacao_debito: diasA_partir(-40), vencimento_debito: diasA_partir(-12), descricao_debito: 'Compra de arroz, feijão e óleo — Nota fiscal 10245', status: 'PENDENTE' },
            { id: 2, cliente_id: 2, valor_debito: 129.50, criacao_debito: diasA_partir(-20), vencimento_debito: diasA_partir(-3), descricao_debito: 'Compra de produtos de limpeza — Nota fiscal 10312', status: 'PENDENTE' },
            { id: 3, cliente_id: 3, valor_debito: 2450.00, criacao_debito: diasA_partir(-35), vencimento_debito: diasA_partir(-8), descricao_debito: 'Pedido em atacado — massas e enlatados — NF 10298', status: 'PENDENTE' },
            { id: 4, cliente_id: 6, valor_debito: 87.30, criacao_debito: diasA_partir(-50), vencimento_debito: diasA_partir(-25), descricao_debito: 'Compra avulsa — bebidas — Nota fiscal 10180', status: 'PENDENTE' },
            { id: 5, cliente_id: 1, valor_debito: 156.00, criacao_debito: diasA_partir(-5), vencimento_debito: diasA_partir(9), descricao_debito: 'Compra de café e biscoitos — Nota fiscal 10401', status: 'PENDENTE' },
            { id: 6, cliente_id: 4, valor_debito: 412.75, criacao_debito: diasA_partir(-2), vencimento_debito: diasA_partir(15), descricao_debito: 'Compra mensal de secos e molhados — NF 10410', status: 'PENDENTE' },
            { id: 7, cliente_id: 5, valor_debito: 980.20, criacao_debito: diasA_partir(-1), vencimento_debito: diasA_partir(20), descricao_debito: 'Farinha de trigo (50kg) e açúcar (30kg) — NF 10415', status: 'PENDENTE' },
            { id: 8, cliente_id: 2, valor_debito: 235.00, criacao_debito: diasA_partir(-3), vencimento_debito: diasA_partir(6), descricao_debito: 'Compra de higiene pessoal — Nota fiscal 10408', status: 'PENDENTE' },
            { id: 9, cliente_id: 3, valor_debito: 1780.40, criacao_debito: diasA_partir(-70), vencimento_debito: diasA_partir(-40), descricao_debito: 'Pedido em atacado — bebidas — NF 09980', status: 'PAGO', pago_em: diasA_partir(-40) },
            { id: 10, cliente_id: 5, valor_debito: 540.00, criacao_debito: diasA_partir(-60), vencimento_debito: diasA_partir(-30), descricao_debito: 'Fermento e óleo de soja — Nota fiscal 10050', status: 'PAGO', pago_em: diasA_partir(-30) },
            { id: 11, cliente_id: 6, valor_debito: 65.90, criacao_debito: diasA_partir(-90), vencimento_debito: diasA_partir(-60), descricao_debito: 'Compra avulsa — Nota fiscal 09850', status: 'PAGO', pago_em: diasA_partir(-60) },
            { id: 12, cliente_id: 4, valor_debito: 310.00, criacao_debito: diasA_partir(-15), vencimento_debito: diasA_partir(-1), descricao_debito: 'Compra de temperos e enlatados — Nota fiscal 10350', status: 'PENDENTE' },
        ];

        // Itens de compra — opcionais, alimentam o mini CRM (produto mais
        // comprado por cliente) e o relatório por região. Cobrem só alguns
        // débitos de propósito: um débito sem itens continua funcionando
        // normalmente, só não entra nesses dois relatórios.
        const itensCompra = [
            { id: 1, debito_id: 1, cliente_id: 1, produto_nome: 'Arroz 5kg', categoria: 'Mercearia', quantidade: 4, valor_unitario: 28.90, data: debitos[0].criacao_debito },
            { id: 2, debito_id: 1, cliente_id: 1, produto_nome: 'Feijão 1kg', categoria: 'Mercearia', quantidade: 6, valor_unitario: 8.50, data: debitos[0].criacao_debito },
            { id: 3, debito_id: 1, cliente_id: 1, produto_nome: 'Óleo de Soja 900ml', categoria: 'Mercearia', quantidade: 4, valor_unitario: 7.10, data: debitos[0].criacao_debito },
            { id: 4, debito_id: 5, cliente_id: 1, produto_nome: 'Café 500g', categoria: 'Mercearia', quantidade: 3, valor_unitario: 14.90, data: debitos[4].criacao_debito },
            { id: 5, debito_id: 5, cliente_id: 1, produto_nome: 'Biscoito Recheado', categoria: 'Mercearia', quantidade: 8, valor_unitario: 4.20, data: debitos[4].criacao_debito },
            { id: 6, debito_id: 3, cliente_id: 3, produto_nome: 'Massa 500g', categoria: 'Mercearia', quantidade: 40, valor_unitario: 4.35, data: debitos[2].criacao_debito },
            { id: 7, debito_id: 3, cliente_id: 3, produto_nome: 'Molho de Tomate', categoria: 'Enlatados', quantidade: 30, valor_unitario: 3.90, data: debitos[2].criacao_debito },
            { id: 8, debito_id: 3, cliente_id: 3, produto_nome: 'Milho Enlatado', categoria: 'Enlatados', quantidade: 25, valor_unitario: 4.60, data: debitos[2].criacao_debito },
            { id: 9, debito_id: 9, cliente_id: 3, produto_nome: 'Refrigerante 2L', categoria: 'Bebidas', quantidade: 60, valor_unitario: 7.80, data: debitos[8].criacao_debito },
            { id: 10, debito_id: 7, cliente_id: 5, produto_nome: 'Farinha de Trigo 50kg', categoria: 'Mercearia', quantidade: 1, valor_unitario: 210.00, data: debitos[6].criacao_debito },
            { id: 11, debito_id: 7, cliente_id: 5, produto_nome: 'Açúcar 30kg', categoria: 'Mercearia', quantidade: 1, valor_unitario: 145.00, data: debitos[6].criacao_debito },
            { id: 12, debito_id: 10, cliente_id: 5, produto_nome: 'Fermento Biológico', categoria: 'Mercearia', quantidade: 20, valor_unitario: 3.20, data: debitos[9].criacao_debito },
            { id: 13, debito_id: 10, cliente_id: 5, produto_nome: 'Óleo de Soja 900ml', categoria: 'Mercearia', quantidade: 15, valor_unitario: 7.10, data: debitos[9].criacao_debito },
            { id: 14, debito_id: 6, cliente_id: 4, produto_nome: 'Molho de Tomate', categoria: 'Enlatados', quantidade: 12, valor_unitario: 3.90, data: debitos[5].criacao_debito },
            { id: 15, debito_id: 6, cliente_id: 4, produto_nome: 'Milho Enlatado', categoria: 'Enlatados', quantidade: 10, valor_unitario: 4.60, data: debitos[5].criacao_debito },
        ];

        gravarTudo([
            ['usuarios', usuarios],
            ['clientes', clientes],
            ['debitos', debitos],
            ['itensCompra', itensCompra],
            ['proximoDebitoId', proximoId(debitos)],
            ['proximoClienteId', proximoId(clientes)],
            ['proximoItemId', proximoId(itensCompra)],
            ['seedVersion', VERSAO_SEED],
        ]);
    }

    const modoApi = Boolean(global.ELOGEST_CONFIG && global.ELOGEST_CONFIG.apiUrl);
    if (!modoApi) {
        try { migrar(); semear(); } catch { /* sem armazenamento: telas mostram "sem dados" */ }
    }

    /* ------------------------------------------------------------
       Status calculado — PAGO / ATRASADO / PENDENTE
       (mesma regra do sistema de referência: nunca é um campo fixo)
       ------------------------------------------------------------ */
    function calcularStatus(debito) {
        if (debito.status === 'PAGO') return 'PAGO';
        const hoje = formatarISO(new Date());
        return debito.vencimento_debito < hoje ? 'ATRASADO' : 'PENDENTE';
    }

    function comStatusCalculado(debito) {
        return Object.assign({}, debito, { status_calculado: calcularStatus(debito) });
    }

    /* ------------------------------------------------------------
       Validação — as mesmas regras do backend (app/schemas.py)
       ------------------------------------------------------------ */
    function erro400(mensagem) { return new ApiError(mensagem, 400); }
    const texto = (v) => String(v == null ? '' : v).trim();

    function normalizarCliente(payload) {
        const F = global.ElogestFormat;
        const c = {
            nome_cliente: texto(payload.nome_cliente).slice(0, 120),
            cpf_cnpj: texto(payload.cpf_cnpj),
            telefone_cliente: texto(payload.telefone_cliente),
            email_cliente: texto(payload.email_cliente).toLowerCase().slice(0, 150),
            endereco_cliente: texto(payload.endereco_cliente).slice(0, 180),
            bairro_cliente: texto(payload.bairro_cliente).slice(0, 80),
            obs_cliente: texto(payload.obs_cliente).slice(0, 300),
        };
        if (!c.nome_cliente) throw erro400('Informe o nome completo.');
        if (!F.cpfCnpjValido(c.cpf_cnpj)) throw erro400('Informe um CPF ou CNPJ válido.');
        if (!F.telefoneValido(c.telefone_cliente)) throw erro400('Informe um telefone com DDD (10 ou 11 dígitos).');
        if (!F.emailValido(c.email_cliente)) throw erro400('Informe um e-mail válido.');
        c.cpf_cnpj = F.maskCpfCnpj(c.cpf_cnpj);
        c.telefone_cliente = F.formatarTelefone(c.telefone_cliente);
        return c;
    }

    function garantirDocumentoUnico(clientes, cpfCnpj, ignorarId) {
        const digitos = cpfCnpj.replace(/\D/g, '');
        const duplicado = clientes.some((c) => String(c.id) !== String(ignorarId) && String(c.cpf_cnpj).replace(/\D/g, '') === digitos);
        if (duplicado) throw new ApiError('Já existe um cliente cadastrado com este CPF/CNPJ.', 409);
    }

    function itemValido(i) {
        return texto(i.produto_nome) !== '' && Number(i.quantidade) > 0;
    }

    /** Filtra os itens válidos e devolve { itens, totalCentavos } (total null se não há carrinho). */
    function prepararItens(itens) {
        const validos = (itens || []).filter(itemValido).map((i) => {
            const quantidade = Number(i.quantidade);
            const valorUnitario = Number(i.valor_unitario) || 0;
            if (valorUnitario < 0) throw erro400('O valor unitário dos itens não pode ser negativo.');
            return {
                produto_nome: texto(i.produto_nome).slice(0, 120),
                categoria: texto(i.categoria).slice(0, 60) || 'Geral',
                quantidade,
                valor_unitario: centavos(valorUnitario) / 100,
            };
        });
        if (!validos.length) return { itens: [], totalCentavos: null };
        const totalCentavos = validos.reduce((acc, i) => acc + Math.round(i.quantidade * centavos(i.valor_unitario)), 0);
        return { itens: validos, totalCentavos };
    }

    /* ------------------------------------------------------------
       API pública — mesmo "formato" da API HTTP (backend/)
       ------------------------------------------------------------ */
    const Auth = {
        async login(usuario, senha) {
            await simularAtraso(500);
            const usuarios = ler('usuarios', []);
            const encontrado = usuarios.find((u) => u.usuario === usuario && u.senha === senha);
            if (!encontrado) {
                throw new ApiError('Usuário ou senha inválidos.', 401);
            }
            return { mensagem: 'Login efetuado com sucesso.', token: null, usuario: { id: encontrado.id, usuario: encontrado.usuario, nome: encontrado.nome } };
        },
    };

    const Clientes = {
        async listar() {
            await simularAtraso();
            return ler('clientes', []).slice();
        },
        async buscar(id) {
            await simularAtraso(250);
            const cliente = ler('clientes', []).find((c) => String(c.id) === String(id));
            if (!cliente) throw new ApiError('Cliente não encontrado.', 404);
            return Object.assign({}, cliente);
        },
        async criar(payload) {
            await simularAtraso(450);
            const dados = normalizarCliente(payload);
            const clientes = ler('clientes', []);
            garantirDocumentoUnico(clientes, dados.cpf_cnpj, null);
            const id = ler('proximoClienteId', proximoId(clientes));
            const novo = Object.assign({ id }, dados);
            clientes.push(novo);
            gravarTudo([['clientes', clientes], ['proximoClienteId', id + 1]]);
            return novo;
        },
        async atualizar(id, payload) {
            await simularAtraso(450);
            const clientes = ler('clientes', []);
            const idx = clientes.findIndex((c) => String(c.id) === String(id));
            if (idx === -1) throw new ApiError('Cliente não encontrado.', 404);
            const dados = normalizarCliente(payload);
            garantirDocumentoUnico(clientes, dados.cpf_cnpj, clientes[idx].id);
            clientes[idx] = Object.assign({ id: clientes[idx].id }, dados);
            gravar('clientes', clientes);
            return clientes[idx];
        },
        async excluir(id) {
            await simularAtraso(400);
            const clientes = ler('clientes', []);
            const existe = clientes.some((c) => String(c.id) === String(id));
            if (!existe) throw new ApiError('Cliente não encontrado.', 404);
            // Remove também os débitos e os itens de compra vinculados, mantendo a base consistente.
            gravarTudo([
                ['clientes', clientes.filter((c) => String(c.id) !== String(id))],
                ['debitos', ler('debitos', []).filter((d) => String(d.cliente_id) !== String(id))],
                ['itensCompra', ler('itensCompra', []).filter((i) => String(i.cliente_id) !== String(id))],
            ]);
        },
    };

    const Debitos = {
        /** filtros opcionais: { clienteId, status: 'PENDENTE' | 'ATRASADO' | 'PAGO' } */
        async listar(filtros) {
            await simularAtraso();
            filtros = filtros || {};
            let debitos = ler('debitos', []).map(comStatusCalculado);
            if (filtros.clienteId != null) debitos = debitos.filter((d) => String(d.cliente_id) === String(filtros.clienteId));
            if (filtros.status) debitos = debitos.filter((d) => d.status_calculado === filtros.status);
            return debitos;
        },
        /**
         * Cria o débito e, opcionalmente, seus itens (payload.itens) numa
         * operação só. Com itens válidos, o valor é SEMPRE a soma deles.
         */
        async criar(payload) {
            await simularAtraso(450);
            const clientes = ler('clientes', []);
            const clienteId = Number(payload.cliente_id);
            if (!clientes.some((c) => c.id === clienteId)) throw erro400('Cliente informado não existe.');

            const criacao = texto(payload.criacao_debito) || formatarISO(new Date());
            const vencimento = texto(payload.vencimento_debito);
            const descricao = texto(payload.descricao_debito).slice(0, 500);
            if (!/^\d{4}-\d{2}-\d{2}$/.test(vencimento)) throw erro400('Informe a data de vencimento.');
            if (vencimento < criacao) throw erro400('O vencimento não pode ser anterior à data de criação.');
            if (!descricao) throw erro400('Descreva o débito.');

            const { itens, totalCentavos } = prepararItens(payload.itens);
            const valorCentavos = totalCentavos != null ? totalCentavos : centavos(payload.valor_debito || 0);
            if (!(valorCentavos > 0)) throw erro400('Informe um valor maior que zero.');

            const debitos = ler('debitos', []);
            const id = ler('proximoDebitoId', proximoId(debitos));
            const novo = {
                id,
                cliente_id: clienteId,
                valor_debito: valorCentavos / 100,
                criacao_debito: criacao,
                vencimento_debito: vencimento,
                descricao_debito: descricao,
                status: 'PENDENTE',
                pago_em: null,
            };
            debitos.push(novo);

            const todosItens = ler('itensCompra', []);
            let proximoItem = ler('proximoItemId', proximoId(todosItens));
            for (const i of itens) {
                todosItens.push(Object.assign({ id: proximoItem++, debito_id: id, cliente_id: clienteId, data: criacao }, i));
            }

            gravarTudo([
                ['debitos', debitos],
                ['proximoDebitoId', id + 1],
                ['itensCompra', todosItens],
                ['proximoItemId', proximoItem],
            ]);
            return comStatusCalculado(novo);
        },
        async marcarComoPago(id) {
            await simularAtraso(400);
            const debitos = ler('debitos', []);
            const idx = debitos.findIndex((d) => String(d.id) === String(id));
            if (idx === -1) throw new ApiError('Débito não encontrado.', 404);
            if (debitos[idx].status === 'PAGO') throw new ApiError('Este débito já está marcado como pago.', 409);
            debitos[idx] = Object.assign({}, debitos[idx], { status: 'PAGO', pago_em: new Date().toISOString() });
            gravar('debitos', debitos);
            return comStatusCalculado(debitos[idx]);
        },
    };

    /* ------------------------------------------------------------
       Itens de compra — mini CRM (o que cada cliente compra)
       ------------------------------------------------------------ */
    function agruparPorProduto(itens) {
        const mapa = new Map();
        for (const item of itens) {
            const chave = item.produto_nome.toLowerCase();
            const valor = Math.round(item.quantidade * centavos(item.valor_unitario));
            const atual = mapa.get(chave);
            if (atual) {
                atual.quantidade_total += item.quantidade;
                atual._centavos += valor;
                atual.ocorrencias += 1;
            } else {
                mapa.set(chave, {
                    produto_nome: item.produto_nome,
                    categoria: item.categoria,
                    quantidade_total: item.quantidade,
                    _centavos: valor,
                    ocorrencias: 1,
                });
            }
        }
        return [...mapa.values()]
            .sort((a, b) => b._centavos - a._centavos)
            .map(({ _centavos, ...resto }) => Object.assign(resto, { valor_total: _centavos / 100 }));
    }

    const Itens = {
        async listarPorCliente(clienteId) {
            await simularAtraso(250);
            return ler('itensCompra', []).filter((i) => String(i.cliente_id) === String(clienteId));
        },
        async listarPorDebito(debitoId) {
            await simularAtraso(200);
            return ler('itensCompra', []).filter((i) => String(i.debito_id) === String(debitoId));
        },
        /**
         * Substitui o conjunto de itens de um débito já existente. Com itens
         * válidos, o valor do débito passa a ser a soma deles.
         * (Para débito novo, prefira Debitos.criar({ ..., itens }).)
         */
        async salvarItensDoDebito({ debitoId, itens }) {
            await simularAtraso(350);
            const debitos = ler('debitos', []);
            const idx = debitos.findIndex((d) => String(d.id) === String(debitoId));
            if (idx === -1) throw new ApiError('Débito não encontrado.', 404);
            const debito = debitos[idx];
            if (debito.status === 'PAGO') throw new ApiError('Não é possível alterar itens de um débito já pago.', 409);

            const preparado = prepararItens(itens);
            if (preparado.totalCentavos === 0) throw erro400('O total dos itens precisa ser maior que zero.');

            const todos = ler('itensCompra', []).filter((i) => String(i.debito_id) !== String(debitoId));
            let proximoItem = ler('proximoItemId', proximoId(todos));
            const novos = preparado.itens.map((i) => Object.assign(
                { id: proximoItem++, debito_id: debito.id, cliente_id: debito.cliente_id, data: debito.criacao_debito }, i));
            if (preparado.totalCentavos != null) {
                debitos[idx] = Object.assign({}, debito, { valor_debito: preparado.totalCentavos / 100 });
            }
            gravarTudo([['itensCompra', todos.concat(novos)], ['proximoItemId', proximoItem], ['debitos', debitos]]);
            return novos;
        },
        /**
         * Ranking de produtos (mais comprado primeiro).
         * opcoes: { mes: 'AAAA-MM' } para restringir a um mês.
         */
        async rankingProdutosCliente(clienteId, opcoes) {
            await simularAtraso(300);
            const mes = opcoes && opcoes.mes;
            const itens = ler('itensCompra', []).filter((i) =>
                String(i.cliente_id) === String(clienteId) && (!mes || String(i.data || '').slice(0, 7) === mes));
            return agruparPorProduto(itens);
        },
        /** Ranking geral de produtos (todos os clientes) — usado no relatório de regiões. */
        async rankingProdutosGeral() {
            await simularAtraso(300);
            return agruparPorProduto(ler('itensCompra', []));
        },
        async gastoTotalCliente(clienteId) {
            await simularAtraso(200);
            const itens = ler('itensCompra', []).filter((i) => String(i.cliente_id) === String(clienteId));
            return itens.reduce((acc, i) => acc + Math.round(i.quantidade * centavos(i.valor_unitario)), 0) / 100;
        },
    };

    /* ------------------------------------------------------------
       Regiões — agrega clientes + débitos reais por bairro
       ------------------------------------------------------------ */
    const SEM_BAIRRO = 'Sem região definida';

    const Regioes = {
        async resumo() {
            await simularAtraso(300);
            const clientes = ler('clientes', []);
            const debitos = ler('debitos', []);

            const gastosPorCliente = new Map();
            for (const d of debitos) {
                const chave = String(d.cliente_id);
                const atual = gastosPorCliente.get(chave) || { total: 0, pago: 0 };
                const valor = centavos(d.valor_debito || 0);
                atual.total += valor;
                if (d.status === 'PAGO') atual.pago += valor;
                gastosPorCliente.set(chave, atual);
            }

            const porBairro = new Map();
            for (const cliente of clientes) {
                const bairro = (cliente.bairro_cliente || '').trim() || SEM_BAIRRO;
                const gasto = gastosPorCliente.get(String(cliente.id)) || { total: 0, pago: 0 };
                const atual = porBairro.get(bairro) || { bairro, total_clientes: 0, total: 0, pago: 0, comGasto: 0 };
                atual.total_clientes += 1;
                atual.total += gasto.total;
                atual.pago += gasto.pago;
                if (gasto.total > 0) atual.comGasto += 1;
                porBairro.set(bairro, atual);
            }

            return [...porBairro.values()]
                .map((r) => ({
                    bairro: r.bairro,
                    total_clientes: r.total_clientes,
                    valor_total_gasto: r.total / 100,
                    valor_pago: r.pago / 100,
                    valor_em_aberto: (r.total - r.pago) / 100,
                    // Ticket médio por CLIENTE que comprou (≠ ticket médio por débito do perfil do cliente).
                    ticket_medio: r.comGasto > 0 ? Math.round(r.total / r.comGasto) / 100 : 0,
                }))
                .sort((a, b) => b.valor_total_gasto - a.valor_total_gasto);
        },
    };

    const Dashboard = {
        async resumo() {
            await simularAtraso();
            const debitos = ler('debitos', []).map(comStatusCalculado);
            const clientes = ler('clientes', []);

            let valorPendente = 0, valorAtrasado = 0, valorPago = 0;
            let totalPendentes = 0, totalAtrasados = 0;

            for (const d of debitos) {
                const valor = centavos(d.valor_debito || 0);
                if (d.status_calculado === 'PAGO') valorPago += valor;
                else if (d.status_calculado === 'ATRASADO') { valorAtrasado += valor; totalAtrasados++; }
                else { valorPendente += valor; totalPendentes++; }
            }

            return {
                total_clientes: clientes.length,
                total_pendentes: totalPendentes,
                total_atrasados: totalAtrasados,
                valor_pendente: valorPendente / 100,
                valor_atrasado: valorAtrasado / 100,
                valor_pago: valorPago / 100,
            };
        },
    };

    global.ElogestStore = { Auth, Clientes, Debitos, Itens, Regioes, Dashboard, ApiError, modo: 'demo' };
})(window);
