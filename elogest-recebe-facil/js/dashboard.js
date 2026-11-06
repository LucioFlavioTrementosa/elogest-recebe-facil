/* ============================================================
   Elogest Recebe Fácil — dashboard.js
   ============================================================ */

ElogestAuth.exigirSessao();

const F = ElogestFormat;

document.addEventListener('DOMContentLoaded', () => {
    ElogestUI.renderLayout('dashboard');
    carregarMetricasEGrafico();
    carregarTabelas();
});

async function carregarMetricasEGrafico() {
    try {
        const dados = await ElogestStore.Dashboard.resumo();

        const cardsGrid = document.getElementById('cards-grid');
        cardsGrid.innerHTML = `
            <div class="card-metrica card-metrica--clientes">
                <div class="card-metrica__header">
                    <span class="card-metrica__label">Total de Clientes</span>
                    <div class="card-metrica__icone-box card-metrica__icone-box--ciano">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#00b8e1" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                    </div>
                </div>
                <p class="card-metrica__valor">${dados.total_clientes}</p>
                <p class="card-metrica__sub">clientes cadastrados</p>
            </div>
            <div class="card-metrica card-metrica--pendente">
                <div class="card-metrica__header">
                    <span class="card-metrica__label">Valores Pendentes</span>
                    <div class="card-metrica__icone-box card-metrica__icone-box--amarelo">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#d97706" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                    </div>
                </div>
                <p class="card-metrica__valor">${F.formatarMoeda(dados.valor_pendente)}</p>
                <p class="card-metrica__sub">${dados.total_pendentes} débito(s) pendente(s)</p>
            </div>
            <div class="card-metrica card-metrica--vencido">
                <div class="card-metrica__header">
                    <span class="card-metrica__label">Valores Vencidos</span>
                    <div class="card-metrica__icone-box card-metrica__icone-box--vermelho">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                    </div>
                </div>
                <p class="card-metrica__valor">${F.formatarMoeda(dados.valor_atrasado)}</p>
                <p class="card-metrica__sub">${dados.total_atrasados} débito(s) vencido(s)</p>
            </div>
            <div class="card-metrica card-metrica--pago">
                <div class="card-metrica__header">
                    <span class="card-metrica__label">Total Recebido</span>
                    <div class="card-metrica__icone-box card-metrica__icone-box--verde">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#009d4f" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
                    </div>
                </div>
                <p class="card-metrica__valor">${F.formatarMoeda(dados.valor_pago)}</p>
                <p class="card-metrica__sub">valores recebidos</p>
            </div>
        `;

        desenharGraficoStatus(dados);
    } catch (err) {
        console.error('Erro ao carregar métricas:', err);
        ElogestUI.showToast('Não foi possível carregar as métricas do dashboard.', 'erro');
    }
}

function desenharGraficoStatus(dados) {
    const painel = document.getElementById('painel-grafico');
    const canvas = document.getElementById('grafico-status');
    const legenda = document.getElementById('painel-grafico-legenda');
    const centroValor = document.getElementById('grafico-total');

    const fatias = [
        { label: 'Pendente', valor: dados.valor_pendente, cor: '#d97706' },
        { label: 'Vencido', valor: dados.valor_atrasado, cor: '#dc2626' },
        { label: 'Recebido', valor: dados.valor_pago, cor: '#00bd67' },
    ];
    const total = fatias.reduce((soma, f) => soma + f.valor, 0);

    painel.hidden = false;
    centroValor.textContent = F.formatarMoeda(dados.valor_pendente + dados.valor_atrasado);

    const ctx = canvas.getContext('2d');
    const cx = canvas.width / 2, cy = canvas.height / 2, raioExterno = 78, raioInterno = 50;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (total === 0) {
        ctx.beginPath();
        ctx.arc(cx, cy, raioExterno, 0, Math.PI * 2);
        ctx.fillStyle = '#eef2f6';
        ctx.fill();
    } else {
        let anguloAtual = -Math.PI / 2;
        fatias.forEach((f) => {
            if (f.valor <= 0) return;
            const fatiaAngulo = (f.valor / total) * Math.PI * 2;
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.arc(cx, cy, raioExterno, anguloAtual, anguloAtual + fatiaAngulo);
            ctx.closePath();
            ctx.fillStyle = f.cor;
            ctx.fill();
            anguloAtual += fatiaAngulo;
        });
        // Recorta o miolo (efeito donut)
        ctx.globalCompositeOperation = 'destination-out';
        ctx.beginPath();
        ctx.arc(cx, cy, raioInterno, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
    }

    legenda.innerHTML = fatias.map((f) => `
        <div class="painel-grafico__item">
            <span class="painel-grafico__ponto" style="background:${f.cor}"></span>
            <span class="painel-grafico__item-label">${f.label}</span>
            <span class="painel-grafico__item-valor">${F.formatarMoeda(f.valor)}</span>
        </div>
    `).join('');
}

async function carregarTabelas() {
    const tbodyVencidos = document.getElementById('dashboard-vencidos-tbody');
    const tbodyProximos = document.getElementById('dashboard-proximos-tbody');

    try {
        const [debitos, clientes] = await Promise.all([
            ElogestStore.Debitos.listar(),
            ElogestStore.Clientes.listar(),
        ]);

        const mapaClientes = {};
        for (const c of clientes) mapaClientes[c.id] = c;

        const vencidos = debitos.filter((d) => d.status_calculado === 'ATRASADO');
        const proximos = debitos
            .filter((d) => d.status_calculado === 'PENDENTE')
            .sort((a, b) => new Date(a.vencimento_debito) - new Date(b.vencimento_debito));

        renderizarVencidos(tbodyVencidos, vencidos, mapaClientes);
        renderizarProximos(tbodyProximos, proximos, mapaClientes);
    } catch (err) {
        console.error('Erro ao carregar tabelas do dashboard:', err);
        const msg = `<tr><td colspan="5" class="tabela__vazio">Erro ao carregar dados.</td></tr>`;
        tbodyVencidos.innerHTML = msg;
        tbodyProximos.innerHTML = msg;
        ElogestUI.showToast('Não foi possível carregar as tabelas do dashboard.', 'erro');
    }
}

function renderizarVencidos(tbody, debitos, mapaClientes) {
    if (!debitos.length) {
        tbody.innerHTML = '<tr><td colspan="5" class="tabela__vazio">Nenhuma cobrança vencida. Tudo em dia! 🎉</td></tr>';
        return;
    }
    tbody.innerHTML = debitos.map((d) => {
        const cliente = mapaClientes[d.cliente_id] || {};
        const nome = cliente.nome_cliente || 'Cliente removido';
        return `
            <tr>
                <td>${F.escapeHtml(nome)}</td>
                <td>${F.escapeHtml(d.descricao_debito)}</td>
                <td class="tabela__valor tabela__valor--perigo">${F.formatarMoeda(d.valor_debito)}</td>
                <td>${F.formatarData(d.vencimento_debito)}</td>
                <td>${ElogestWhatsapp.gerarBotaoWhatsApp(d, cliente.telefone_cliente, nome)}</td>
            </tr>
        `;
    }).join('');
}

function renderizarProximos(tbody, debitos, mapaClientes) {
    if (!debitos.length) {
        tbody.innerHTML = '<tr><td colspan="5" class="tabela__vazio">Nenhum débito pendente.</td></tr>';
        return;
    }
    tbody.innerHTML = debitos.map((d) => {
        const cliente = mapaClientes[d.cliente_id] || {};
        return `
            <tr>
                <td>${F.escapeHtml(cliente.nome_cliente || 'Cliente removido')}</td>
                <td>${F.escapeHtml(d.descricao_debito)}</td>
                <td class="tabela__valor tabela__valor--normal">${F.formatarMoeda(d.valor_debito)}</td>
                <td>${F.formatarData(d.vencimento_debito)}</td>
                <td><span class="badge badge--pendente">Pendente</span></td>
            </tr>
        `;
    }).join('');
}
