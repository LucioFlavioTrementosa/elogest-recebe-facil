/* ============================================================
   Elogest Recebe Fácil — contas-receber.js
   ============================================================ */

ElogestAuth.exigirSessao();

const F = ElogestFormat;

let debitosCarregados = [];
let mapaClientesCarregado = {};
let filtroAtivo = 'todos';

document.addEventListener('DOMContentLoaded', async () => {
    ElogestUI.renderLayout('contas-receber');

    const tbody = document.getElementById('contas-receber-tbody');
    try {
        const [debitos, clientes] = await Promise.all([
            ElogestStore.Debitos.listar(),
            ElogestStore.Clientes.listar(),
        ]);

        debitosCarregados = debitos;
        mapaClientesCarregado = {};
        for (const c of clientes) mapaClientesCarregado[c.id] = c;

        renderizarTabela(aplicarFiltro(filtroAtivo));
        atualizarContadores();
        atualizarResumoFinanceiro();
        configurarFiltros();
    } catch (err) {
        console.error('Erro ao carregar contas a receber:', err);
        tbody.innerHTML = '<tr><td colspan="7" class="tabela__vazio">Erro ao carregar débitos.</td></tr>';
        ElogestUI.showToast('Não foi possível carregar os débitos.', 'erro');
    }
});

function aplicarFiltro(filtro) {
    switch (filtro) {
        case 'pendente': return debitosCarregados.filter((d) => d.status_calculado === 'PENDENTE');
        case 'vencido': return debitosCarregados.filter((d) => d.status_calculado === 'ATRASADO');
        case 'pago': return debitosCarregados.filter((d) => d.status_calculado === 'PAGO');
        default: return debitosCarregados;
    }
}

function renderizarTabela(debitos) {
    const tbody = document.getElementById('contas-receber-tbody');

    if (!debitos.length) {
        tbody.innerHTML = `
            <tr><td colspan="7">
                <div class="estado-vazio" style="box-shadow:none;padding:32px 16px;">
                    <p class="estado-vazio__titulo">Nenhum débito encontrado</p>
                    <p class="estado-vazio__texto">Não há débitos para este filtro no momento.</p>
                </div>
            </td></tr>
        `;
        return;
    }

    tbody.innerHTML = debitos.map(criarLinhaDebito).join('');
}

function criarLinhaDebito(debito) {
    const cliente = mapaClientesCarregado[debito.cliente_id] || {};
    const nome = cliente.nome_cliente || 'Cliente removido';

    let badgeClass, badgeText, valorClass;
    switch (debito.status_calculado) {
        case 'PAGO': badgeClass = 'badge--pago'; badgeText = 'Pago'; valorClass = 'tabela__valor--normal'; break;
        case 'ATRASADO': badgeClass = 'badge--vencido'; badgeText = 'Vencido'; valorClass = 'tabela__valor--perigo'; break;
        default: badgeClass = 'badge--pendente'; badgeText = 'Pendente'; valorClass = 'tabela__valor--normal';
    }

    let acoes;
    if (debito.status_calculado === 'PAGO') {
        acoes = '<span class="texto-quitado">✓ Quitado</span>';
    } else {
        acoes = `
            ${ElogestWhatsapp.gerarBotaoWhatsApp(debito, cliente.telefone_cliente, nome)}
            <button type="button" class="btn-pago" data-marcar-pago="${debito.id}">Marcar como pago</button>
        `;
    }

    return `
        <tr>
            <td><strong>${F.escapeHtml(nome)}</strong></td>
            <td>${F.escapeHtml(debito.descricao_debito)}</td>
            <td class="tabela__valor ${valorClass}">${F.formatarMoeda(debito.valor_debito)}</td>
            <td>${F.formatarData(debito.criacao_debito)}</td>
            <td>${F.formatarData(debito.vencimento_debito)}</td>
            <td><span class="badge ${badgeClass}">${badgeText}</span></td>
            <td><div class="tabela__acoes">${acoes}</div></td>
        </tr>
    `;
}

function atualizarContadores() {
    const total = debitosCarregados.length;
    const pendentes = debitosCarregados.filter((d) => d.status_calculado === 'PENDENTE').length;
    const vencidos = debitosCarregados.filter((d) => d.status_calculado === 'ATRASADO').length;
    const pagos = debitosCarregados.filter((d) => d.status_calculado === 'PAGO').length;

    document.getElementById('contador-todos').textContent = total;
    document.getElementById('contador-pendentes').textContent = pendentes;
    document.getElementById('contador-vencidos').textContent = vencidos;
    document.getElementById('contador-pagos').textContent = pagos;
}

function atualizarResumoFinanceiro() {
    let totalPendente = 0, totalVencido = 0, totalPago = 0;
    for (const d of debitosCarregados) {
        const valor = Number(d.valor_debito || 0);
        if (d.status_calculado === 'PAGO') totalPago += valor;
        else if (d.status_calculado === 'ATRASADO') totalVencido += valor;
        else totalPendente += valor;
    }
    document.getElementById('resumo-pendente').textContent = F.formatarMoeda(totalPendente);
    document.getElementById('resumo-vencido').textContent = F.formatarMoeda(totalVencido);
    document.getElementById('resumo-pago').textContent = F.formatarMoeda(totalPago);
    document.getElementById('resumo-total').textContent = F.formatarMoeda(totalPendente + totalVencido + totalPago);
}

function configurarFiltros() {
    document.querySelectorAll('.filtro-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
            filtroAtivo = btn.dataset.filtro;
            renderizarTabela(aplicarFiltro(filtroAtivo));
            document.querySelectorAll('.filtro-btn').forEach((b) => b.classList.remove('filtro-btn--ativo'));
            btn.classList.add('filtro-btn--ativo');
        });
    });
}

document.addEventListener('click', async (e) => {
    const botao = e.target.closest('[data-marcar-pago]');
    if (!botao) return;

    const id = botao.getAttribute('data-marcar-pago');
    const confirmado = await ElogestUI.confirmModal({
        titulo: 'Marcar como pago',
        mensagem: 'Confirma que este débito foi quitado pelo cliente?',
        textoConfirmar: 'Marcar como pago',
        neutro: true,
    });
    if (!confirmado) return;

    botao.disabled = true;
    try {
        const atualizado = await ElogestStore.Debitos.marcarComoPago(id);
        const idx = debitosCarregados.findIndex((d) => String(d.id) === String(id));
        if (idx !== -1) debitosCarregados[idx] = atualizado;

        renderizarTabela(aplicarFiltro(filtroAtivo));
        atualizarContadores();
        atualizarResumoFinanceiro();
        ElogestUI.showToast('Débito marcado como pago!', 'sucesso');
    } catch (err) {
        console.error('Erro ao marcar débito como pago:', err);
        ElogestUI.showToast(ElogestUI.mensagemErro(err, 'Não foi possível atualizar o débito.'), 'erro');
        botao.disabled = false;
    }
});
