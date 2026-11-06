/* ============================================================
   Elogest Recebe Fácil — regioes.js
   Relatório por região/bairro: quem mais compra e o que mais vende.
   ============================================================ */

ElogestAuth.exigirSessao();

const F = ElogestFormat;

document.addEventListener('DOMContentLoaded', async () => {
    ElogestUI.renderLayout('regioes');

    try {
        const [regioes, produtos] = await Promise.all([
            ElogestStore.Regioes.resumo(),
            ElogestStore.Itens.rankingProdutosGeral(),
        ]);

        renderizarBanner(regioes[0]);
        renderizarGrafico(regioes);
        renderizarProdutos(produtos);
        renderizarTabela(regioes);
    } catch (err) {
        console.error('Erro ao carregar relatório de regiões:', err);
        ElogestUI.showToast('Não foi possível carregar o relatório de regiões.', 'erro');
    }
});

function renderizarBanner(lider) {
    const container = document.getElementById('banner-lider');
    if (!lider || lider.valor_total_gasto <= 0) {
        container.innerHTML = '';
        return;
    }
    container.innerHTML = `
        <div class="banner-lider">
            <div class="banner-lider__icone">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><path d="M8 21h8M12 17v4M17 5V3H7v2M7 5H4a2 2 0 0 0 2 2h1M17 5h3a2 2 0 0 1-2 2h-1M7 5c0 5 2 8 5 8s5-3 5-8"/></svg>
            </div>
            <div>
                <p class="banner-lider__label">Região que mais gasta</p>
                <p class="banner-lider__nome">${F.escapeHtml(lider.bairro)}</p>
            </div>
            <div class="banner-lider__valor-wrap">
                <p class="banner-lider__label">Total gasto</p>
                <p class="banner-lider__valor">${F.formatarMoeda(lider.valor_total_gasto)}</p>
            </div>
        </div>
    `;
}

function renderizarGrafico(regioes) {
    const container = document.getElementById('grafico-regioes');
    const top5 = regioes.filter((r) => r.valor_total_gasto > 0).slice(0, 5);

    if (!top5.length) {
        container.innerHTML = `
            <div class="estado-vazio" style="box-shadow:none;padding:24px 8px;">
                <p class="estado-vazio__titulo">Nenhuma região com dados ainda</p>
                <p class="estado-vazio__texto">Preencha o campo "Bairro / Região" no cadastro dos clientes para começar a ver este relatório.</p>
            </div>
        `;
        return;
    }

    const maior = Math.max(...top5.map((r) => r.valor_total_gasto));
    container.innerHTML = `
        <div class="grafico-barras">
            ${top5.map((r) => `
                <div class="grafico-barras__linha">
                    <span class="grafico-barras__label" title="${F.escapeHtml(r.bairro)}">${F.escapeHtml(r.bairro)}</span>
                    <span class="grafico-barras__trilho">
                        <span class="grafico-barras__preenchimento" style="width:${maior > 0 ? (r.valor_total_gasto / maior) * 100 : 0}%"></span>
                    </span>
                    <span class="grafico-barras__valor">${F.formatarMoeda(r.valor_total_gasto)}</span>
                </div>
            `).join('')}
        </div>
    `;
}

function renderizarProdutos(produtos) {
    const container = document.getElementById('ranking-produtos-geral');
    const top6 = (produtos || []).slice(0, 6);

    if (!top6.length) {
        container.innerHTML = '<p class="painel-ranking__vazio">Nenhum item detalhado registrado ainda. Adicione itens ao registrar débitos.</p>';
        return;
    }

    container.innerHTML = `
        <ul class="painel-ranking__lista">
            ${top6.map((p, index) => `
                <li class="painel-ranking__item">
                    <span class="painel-ranking__item-nome">
                        <span class="painel-ranking__posicao">${index + 1}</span>
                        <span class="painel-ranking__item-nome-texto">${F.escapeHtml(p.produto_nome)}</span>
                    </span>
                    <span class="painel-ranking__item-valor" title="Ordenado pelo valor total vendido">${p.quantidade_total}x · ${F.formatarMoeda(p.valor_total)}</span>
                </li>
            `).join('')}
        </ul>
    `;
}

function renderizarTabela(regioes) {
    const tbody = document.getElementById('tabela-regioes-tbody');
    if (!regioes.length) {
        tbody.innerHTML = '<tr><td colspan="6" class="tabela__vazio">Nenhum dado por região ainda.</td></tr>';
        return;
    }
    tbody.innerHTML = regioes.map((r) => `
        <tr>
            <td><strong>${F.escapeHtml(r.bairro)}</strong></td>
            <td>${r.total_clientes}</td>
            <td class="tabela__valor tabela__valor--normal">${F.formatarMoeda(r.valor_total_gasto)}</td>
            <td style="color:var(--cor-sucesso-escura);font-weight:700;">${F.formatarMoeda(r.valor_pago)}</td>
            <td style="color:var(--cor-alerta);font-weight:700;">${F.formatarMoeda(r.valor_em_aberto)}</td>
            <td>${F.formatarMoeda(r.ticket_medio)}</td>
        </tr>
    `).join('');
}
