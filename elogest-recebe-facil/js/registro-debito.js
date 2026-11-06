/* ============================================================
   Elogest Recebe Fácil — registro-debito.js
   ============================================================ */

ElogestAuth.exigirSessao();

const F = ElogestFormat;

let itensCarrinho = []; // { id, produto_nome, categoria, quantidade, valor_unitario }
let proximoIdLinha = 1;

document.addEventListener('DOMContentLoaded', async () => {
    ElogestUI.renderLayout('novo-debito');

    document.getElementById('criacao_debito').value = F.hojeISO();

    const campoValor = document.getElementById('valor_debito');
    F.anexarMascara(campoValor, F.maskMoeda);

    const selectCliente = document.getElementById('cliente_debito');
    try {
        const clientes = await ElogestStore.Clientes.listar();
        if (!clientes.length) {
            selectCliente.innerHTML = '<option value="">Nenhum cliente cadastrado</option>';
            ElogestUI.showToast('Cadastre um cliente antes de registrar um débito.', 'alerta');
        } else {
            selectCliente.innerHTML =
                '<option value="">Selecione um cliente...</option>' +
                clientes.map((c) => `<option value="${c.id}">${F.escapeHtml(c.nome_cliente)}</option>`).join('');
        }
    } catch (err) {
        console.error('Erro ao carregar clientes:', err);
        selectCliente.innerHTML = '<option value="">Erro ao carregar clientes</option>';
        ElogestUI.showToast('Não foi possível carregar a lista de clientes.', 'erro');
    }

    document.getElementById('btn-add-item').addEventListener('click', () => {
        itensCarrinho.push({ id: proximoIdLinha++, produto_nome: '', categoria: '', quantidade: 1, valor_unitario: 0 });
        renderizarCarrinho();
    });

    renderizarCarrinho();

    const campoVencimento = document.getElementById('vencimento_debito');
    const campoDescricao = document.getElementById('descricao_debito');

    function marcarErro(input, mensagem) {
        const erroEl = document.getElementById('erro-' + input.id);
        const classeErro = input.tagName === 'SELECT' ? 'form-select--erro' : 'form-input--erro';
        if (mensagem) {
            input.classList.add(classeErro);
            if (erroEl) { erroEl.textContent = mensagem; erroEl.classList.add('form-field__erro--visivel'); }
        } else {
            input.classList.remove(classeErro);
            if (erroEl) { erroEl.textContent = ''; erroEl.classList.remove('form-field__erro--visivel'); }
        }
    }

    // Mesma regra do store/backend: só conta item com nome e quantidade > 0.
    function itemValido(i) {
        return i.produto_nome.trim() !== '' && Number(i.quantidade) > 0;
    }

    function temItensValidos() {
        return itensCarrinho.some(itemValido);
    }

    /** Total só dos itens válidos — os mesmos que serão gravados. */
    function totalItensValidos() {
        return itensCarrinho.filter(itemValido)
            .reduce((acc, i) => acc + Math.round(Number(i.quantidade) * Math.round(Number(i.valor_unitario) * 100)), 0) / 100;
    }

    function validarTudo() {
        let ok = true;

        if (!selectCliente.value) { marcarErro(selectCliente, 'Selecione um cliente.'); ok = false; }
        else marcarErro(selectCliente, '');

        const valorNumerico = F.moedaParaNumero(campoValor.value);
        if (!campoValor.value || valorNumerico <= 0) { marcarErro(campoValor, 'Informe um valor maior que zero.'); ok = false; }
        else marcarErro(campoValor, '');

        const dataCriacao = document.getElementById('criacao_debito').value || F.hojeISO();
        if (!campoVencimento.value) { marcarErro(campoVencimento, 'Informe a data de vencimento.'); ok = false; }
        else if (campoVencimento.value < dataCriacao) { marcarErro(campoVencimento, 'O vencimento não pode ser anterior à data de criação.'); ok = false; }
        else marcarErro(campoVencimento, '');

        if (!campoDescricao.value.trim()) { marcarErro(campoDescricao, 'Descreva o débito.'); ok = false; }
        else marcarErro(campoDescricao, '');

        return ok;
    }

    document.getElementById('form-debito').addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!validarTudo()) {
            ElogestUI.showToast('Corrija os campos destacados antes de salvar.', 'alerta');
            return;
        }

        const btn = document.getElementById('btn-salvar');
        btn.disabled = true;
        btn.textContent = 'Registrando...';

        const dataCriacao = document.getElementById('criacao_debito').value || F.hojeISO();
        const clienteId = Number(selectCliente.value);

        try {
            // Débito e itens numa chamada só: ou grava tudo, ou nada (evita
            // débito "órfão" sem itens e duplicado ao tentar de novo).
            await ElogestStore.Debitos.criar({
                cliente_id: clienteId,
                valor_debito: F.moedaParaNumero(campoValor.value),
                criacao_debito: dataCriacao,
                vencimento_debito: campoVencimento.value,
                descricao_debito: campoDescricao.value.trim(),
                itens: temItensValidos() ? itensCarrinho : [],
            });

            ElogestUI.showToast('Débito registrado com sucesso!', 'sucesso');
            window.location.href = 'contas-receber.html';
        } catch (err) {
            console.error('Erro ao registrar débito:', err);
            ElogestUI.showToast(ElogestUI.mensagemErro(err, 'Não foi possível registrar o débito. Tente novamente.'), 'erro');
            btn.disabled = false;
            btn.textContent = 'Registrar Débito';
        }
    });

    function renderizarCarrinho() {
        const lista = document.getElementById('carrinho-lista');
        const totalWrap = document.getElementById('carrinho-total');
        const totalValor = document.getElementById('carrinho-total-valor');

        if (!itensCarrinho.length) {
            lista.innerHTML = '<p class="carrinho-itens__vazio">Nenhum item adicionado.</p>';
            totalWrap.hidden = true;
        } else {
            lista.innerHTML = itensCarrinho.map((item) => `
                <div class="carrinho-item" data-linha="${item.id}">
                    <div class="form-field">
                        <label class="form-label">Produto</label>
                        <input type="text" class="form-input" placeholder="Ex: Arroz 5kg" data-campo="produto_nome" value="${F.escapeHtml(item.produto_nome)}">
                    </div>
                    <div class="form-field">
                        <label class="form-label">Categoria</label>
                        <input type="text" class="form-input" placeholder="Ex: Mercearia" data-campo="categoria" value="${F.escapeHtml(item.categoria)}">
                    </div>
                    <div class="form-field form-field--qtd">
                        <label class="form-label">Qtd.</label>
                        <input type="number" min="0" step="1" class="form-input" data-campo="quantidade" value="${item.quantidade}">
                    </div>
                    <div class="form-field form-field--valor">
                        <label class="form-label">Valor unit. (R$)</label>
                        <input type="number" min="0" step="0.01" class="form-input" data-campo="valor_unitario" value="${item.valor_unitario}">
                    </div>
                    <div class="carrinho-item__subtotal">${F.formatarMoeda(item.quantidade * item.valor_unitario)}</div>
                    <button type="button" class="carrinho-item__remover" data-remover="${item.id}" aria-label="Remover item">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                    </button>
                </div>
            `).join('');

            totalWrap.hidden = false;
            totalValor.textContent = F.formatarMoeda(totalItensValidos());

            lista.querySelectorAll('[data-campo]').forEach((input) => {
                input.addEventListener('input', (e) => atualizarCampoLinha(e.target));
            });
            lista.querySelectorAll('[data-remover]').forEach((btn) => {
                btn.addEventListener('click', () => {
                    itensCarrinho = itensCarrinho.filter((i) => String(i.id) !== btn.getAttribute('data-remover'));
                    renderizarCarrinho();
                });
            });
        }

        atualizarValorAutomatico();
    }

    function atualizarCampoLinha(input) {
        const linhaEl = input.closest('[data-linha]');
        const id = linhaEl.getAttribute('data-linha');
        const item = itensCarrinho.find((i) => String(i.id) === id);
        if (!item) return;

        const campo = input.getAttribute('data-campo');
        if (campo === 'quantidade' || campo === 'valor_unitario') {
            item[campo] = Math.max(0, Number(input.value) || 0);
        } else {
            item[campo] = input.value;
        }

        const subtotalEl = linhaEl.querySelector('.carrinho-item__subtotal');
        subtotalEl.textContent = F.formatarMoeda(item.quantidade * item.valor_unitario);

        document.getElementById('carrinho-total-valor').textContent = F.formatarMoeda(totalItensValidos());

        atualizarValorAutomatico();
    }

    function atualizarValorAutomatico() {
        const dicaId = 'dica-valor-auto';
        let dicaEl = document.getElementById(dicaId);
        if (temItensValidos()) {
            campoValor.value = F.maskMoeda(String(Math.round(totalItensValidos() * 100)));
            campoValor.disabled = true;
            if (!dicaEl) {
                dicaEl = document.createElement('span');
                dicaEl.id = dicaId;
                dicaEl.className = 'form-label__dica';
                dicaEl.textContent = 'Calculado a partir dos itens abaixo';
                campoValor.closest('.form-field').querySelector('.form-label').appendChild(dicaEl);
            }
            marcarErro(campoValor, '');
        } else {
            campoValor.disabled = false;
            if (dicaEl) dicaEl.remove();
        }
    }
});
