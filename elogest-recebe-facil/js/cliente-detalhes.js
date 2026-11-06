/* ============================================================
   Elogest Recebe Fácil — cliente-detalhes.js
   Perfil do cliente: mini CRM + histórico de débitos.
   ============================================================ */

ElogestAuth.exigirSessao();

const F = ElogestFormat;

document.addEventListener('DOMContentLoaded', async () => {
    ElogestUI.renderLayout('clientes');

    const params = new URLSearchParams(window.location.search);
    const clienteId = params.get('id');
    const container = document.getElementById('conteudo-perfil');

    if (!clienteId) {
        renderizarErro(container, 'Cliente não informado.');
        return;
    }

    try {
        const [cliente, debitos, rankingGeral, rankingMes, gastoItens] = await Promise.all([
            ElogestStore.Clientes.buscar(clienteId),
            ElogestStore.Debitos.listar({ clienteId }),
            ElogestStore.Itens.rankingProdutosCliente(clienteId),
            ElogestStore.Itens.rankingProdutosCliente(clienteId, { mes: F.hojeISO().slice(0, 7) }),
            ElogestStore.Itens.gastoTotalCliente(clienteId),
        ]);

        const debitosDoCliente = debitos
            .sort((a, b) => (a.vencimento_debito < b.vencimento_debito ? 1 : -1));

        let aberto = 0, pago = 0;
        for (const d of debitosDoCliente) {
            const v = Number(d.valor_debito || 0);
            if (d.status_calculado === 'PAGO') pago += v; else aberto += v;
        }
        const geral = aberto + pago;
        const ticketMedio = debitosDoCliente.length ? geral / debitosDoCliente.length : 0;

        container.innerHTML = `
            <div class="perfil-header">
                <div class="perfil-header__avatar">${F.gerarIniciais(cliente.nome_cliente)}</div>
                <div class="perfil-header__info">
                    <div class="perfil-header__nome-linha">
                        <span class="perfil-header__nome">${F.escapeHtml(cliente.nome_cliente)}</span>
                        ${cliente.bairro_cliente ? `<span class="cliente-card__bairro">${F.escapeHtml(cliente.bairro_cliente)}</span>` : ''}
                    </div>
                    <div class="perfil-header__detalhes">
                        <span>${F.formatarTelefone(cliente.telefone_cliente)}</span>
                        ${cliente.email_cliente ? `<span>${F.escapeHtml(cliente.email_cliente)}</span>` : ''}
                        <span>${F.escapeHtml(cliente.cpf_cnpj || '-')}</span>
                    </div>
                </div>
                <a href="editar-cliente.html?id=${cliente.id}" class="btn-editar">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    Editar cadastro
                </a>
            </div>

            <div class="perfil-cards-grid">
                <div class="perfil-card">
                    <div class="perfil-card__icone-box perfil-card__icone-box--ciano">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
                    </div>
                    <p class="perfil-card__valor">${F.formatarMoeda(geral)}</p>
                    <p class="perfil-card__label">Gasto total (histórico)</p>
                </div>
                <div class="perfil-card">
                    <div class="perfil-card__icone-box perfil-card__icone-box--verde">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/></svg>
                    </div>
                    <p class="perfil-card__valor">${F.formatarMoeda(pago)}</p>
                    <p class="perfil-card__label">Já recebido</p>
                </div>
                <div class="perfil-card">
                    <div class="perfil-card__icone-box perfil-card__icone-box--amarelo">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                    </div>
                    <p class="perfil-card__valor">${F.formatarMoeda(aberto)}</p>
                    <p class="perfil-card__label">Em aberto</p>
                </div>
                <div class="perfil-card">
                    <div class="perfil-card__icone-box perfil-card__icone-box--vermelho">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                    </div>
                    <p class="perfil-card__valor">${F.formatarMoeda(ticketMedio)}</p>
                    <p class="perfil-card__label">Ticket médio</p>
                </div>
            </div>

            <div class="grid-2-colunas">
                ${painelRanking('Produtos que mais compra (geral)', rankingGeral)}
                ${painelRanking('Produtos comprados este mês', rankingMes, 'Nenhuma compra detalhada registrada neste mês.')}
            </div>

            ${gastoItens > 0 ? `<p class="nota-rodape">* "Gasto total (histórico)" considera todos os débitos do cliente. O ranking de produtos acima considera apenas débitos registrados com itens detalhados (${F.formatarMoeda(gastoItens)} em itens detalhados até agora).</p>` : ''}

            <div>
                <h2 class="titulo-secao">Histórico de Débitos</h2>
                <div class="tabela-container">
                    <table class="tabela">
                        <thead>
                            <tr><th>Descrição</th><th>Valor</th><th>Vencimento</th><th>Status</th><th>Ação</th></tr>
                        </thead>
                        <tbody>${renderizarHistorico(debitosDoCliente, cliente)}</tbody>
                    </table>
                </div>
            </div>
        `;
    } catch (err) {
        console.error('Erro ao carregar perfil do cliente:', err);
        renderizarErro(container, err && err.status === 404 ? 'Cliente não encontrado.' : ElogestUI.mensagemErro(err, 'Não foi possível carregar o perfil do cliente.'));
    }
});

function painelRanking(titulo, itens, textoVazio) {
    textoVazio = textoVazio || 'Nenhuma compra detalhada registrada ainda. Cadastre débitos com itens para alimentar o CRM.';
    const lista = (itens || []).slice(0, 5);
    return `
        <div class="painel-ranking">
            <h3 class="painel-ranking__titulo">${titulo}</h3>
            ${lista.length === 0
                ? `<p class="painel-ranking__vazio">${textoVazio}</p>`
                : `<ul class="painel-ranking__lista">
                    ${lista.map((item, index) => `
                        <li class="painel-ranking__item">
                            <span class="painel-ranking__item-nome">
                                <span class="painel-ranking__posicao">${index + 1}</span>
                                <span class="painel-ranking__item-nome-texto">${F.escapeHtml(item.produto_nome)}</span>
                            </span>
                            <span class="painel-ranking__item-valor">${item.quantidade_total}x · ${F.formatarMoeda(item.valor_total)}</span>
                        </li>
                    `).join('')}
                   </ul>`}
        </div>
    `;
}

function renderizarHistorico(debitos, cliente) {
    if (!debitos.length) {
        return '<tr><td colspan="5" class="tabela__vazio">Nenhum débito registrado para este cliente ainda.</td></tr>';
    }
    return debitos.map((d) => {
        const valorClasse = d.status_calculado === 'ATRASADO' ? 'tabela__valor--perigo' : 'tabela__valor--normal';
        let badgeClass, badgeText;
        switch (d.status_calculado) {
            case 'PAGO': badgeClass = 'badge--pago'; badgeText = 'Pago'; break;
            case 'ATRASADO': badgeClass = 'badge--vencido'; badgeText = 'Vencido'; break;
            default: badgeClass = 'badge--pendente'; badgeText = 'Pendente';
        }
        const acao = d.status_calculado !== 'PAGO'
            ? ElogestWhatsapp.gerarBotaoWhatsApp(d, cliente.telefone_cliente, cliente.nome_cliente)
            : '<span class="texto-quitado">✓ Quitado</span>';
        return `
            <tr>
                <td>${F.escapeHtml(d.descricao_debito)}</td>
                <td class="tabela__valor ${valorClasse}">${F.formatarMoeda(d.valor_debito)}</td>
                <td>${F.formatarData(d.vencimento_debito)}</td>
                <td><span class="badge ${badgeClass}">${badgeText}</span></td>
                <td>${acao}</td>
            </tr>
        `;
    }).join('');
}

function renderizarErro(container, mensagem) {
    container.innerHTML = `
        <div class="estado-vazio estado-vazio--erro">
            <div class="estado-vazio__icone">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
            </div>
            <p class="estado-vazio__titulo">${F.escapeHtml(mensagem)}</p>
            <a href="clientes.html" class="btn-primario">Voltar para clientes</a>
        </div>
    `;
}
