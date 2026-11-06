/* ============================================================
   Elogest Recebe Fácil — clientes.js
   ============================================================ */

ElogestAuth.exigirSessao();

const F = ElogestFormat;

document.addEventListener('DOMContentLoaded', () => {
    ElogestUI.renderLayout('clientes');
    ElogestUI.configurarMenuOpcoes();
    carregarClientes();
});

async function carregarClientes() {
    const container = document.getElementById('clientes-grid');
    try {
        const [clientes, debitos] = await Promise.all([
            ElogestStore.Clientes.listar(),
            ElogestStore.Debitos.listar(),
        ]);

        if (!clientes.length) {
            container.innerHTML = `
                <div class="estado-vazio">
                    <div class="estado-vazio__icone">
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                    </div>
                    <p class="estado-vazio__titulo">Nenhum cliente cadastrado ainda</p>
                    <p class="estado-vazio__texto">Cadastre o primeiro cliente para começar a controlar débitos e cobranças.</p>
                    <a href="cadastro-cliente.html" class="btn-primario">+ Novo Cliente</a>
                </div>
            `;
            return;
        }

        const debitosPorCliente = {};
        for (const d of debitos) {
            if (d.status_calculado === 'PAGO') continue;
            const chave = String(d.cliente_id);
            if (!debitosPorCliente[chave]) debitosPorCliente[chave] = { total: 0, qtd: 0 };
            debitosPorCliente[chave].total += Number(d.valor_debito || 0);
            debitosPorCliente[chave].qtd += 1;
        }

        container.innerHTML = clientes.map((cliente) => criarCardCliente(cliente, debitosPorCliente[String(cliente.id)])).join('');
        configurarBusca();
    } catch (err) {
        console.error('Erro ao carregar clientes:', err);
        container.innerHTML = `
            <div class="estado-vazio estado-vazio--erro">
                <div class="estado-vazio__icone">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                </div>
                <p class="estado-vazio__titulo">Erro ao carregar clientes</p>
                <p class="estado-vazio__texto">Tente recarregar a página.</p>
            </div>
        `;
    }
}

function criarCardCliente(cliente, debitoInfo) {
    const iniciais = F.gerarIniciais(cliente.nome_cliente);
    const telefone = F.formatarTelefone(cliente.telefone_cliente);
    const endereco = cliente.endereco_cliente || 'Endereço não informado';
    const cpfCnpj = cliente.cpf_cnpj || '-';
    const totalDevido = (debitoInfo && debitoInfo.total) || 0;
    const qtdDebitos = (debitoInfo && debitoInfo.qtd) || 0;
    const classeValor = totalDevido > 0 ? 'cliente-card__valor-numero--perigo' : 'cliente-card__valor-numero--ok';

    return `
        <div class="cliente-card" data-id="${cliente.id}">
            <div class="cliente-card__avatar">${iniciais}</div>
            <div class="cliente-card__info">
                <h3 class="cliente-card__nome">
                    <a href="cliente-detalhes.html?id=${cliente.id}" class="cliente-card__nome-link">${F.escapeHtml(cliente.nome_cliente)}</a>
                    ${cliente.bairro_cliente ? `<span class="cliente-card__bairro">${F.escapeHtml(cliente.bairro_cliente)}</span>` : ''}
                </h3>
                <p class="cliente-card__detalhe">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72"/></svg>
                    ${telefone}
                </p>
                <p class="cliente-card__detalhe">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                    ${F.escapeHtml(endereco)}
                </p>
                <p class="cliente-card__detalhe">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M7 15h0M2 9.5h20"/></svg>
                    ${F.escapeHtml(cpfCnpj)}
                </p>
            </div>
            <div class="cliente-card__valor">
                <span class="cliente-card__valor-label">Deve</span>
                <span class="cliente-card__valor-numero ${classeValor}">${F.formatarMoeda(totalDevido)}</span>
                <span class="cliente-card__valor-sub">${qtdDebitos} débito(s) em aberto</span>
            </div>
            <div class="cliente-card__acoes">
                <a href="editar-cliente.html?id=${cliente.id}" class="btn-editar">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    Editar
                </a>
                <div class="menu-opcoes">
                    <button class="menu-opcoes__btn" aria-label="Mais opções para ${F.escapeHtml(cliente.nome_cliente)}">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/></svg>
                    </button>
                    <div class="menu-opcoes__dropdown">
                        <button class="menu-opcoes__item menu-opcoes__item--excluir" data-excluir-id="${cliente.id}">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                            Excluir cliente
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function configurarBusca() {
    const input = document.getElementById('busca_cliente');
    if (!input) return;
    input.addEventListener('input', (e) => {
        const termo = e.target.value.toLowerCase().trim();
        document.querySelectorAll('.cliente-card').forEach((card) => {
            card.style.display = card.textContent.toLowerCase().includes(termo) ? '' : 'none';
        });
    });
}

document.addEventListener('click', async (e) => {
    const botao = e.target.closest('[data-excluir-id]');
    if (!botao) return;

    const id = botao.getAttribute('data-excluir-id');
    const card = botao.closest('.cliente-card');
    const nome = card.querySelector('.cliente-card__nome').textContent;

    const confirmado = await ElogestUI.confirmModal({
        titulo: 'Excluir cliente',
        mensagem: `Tem certeza que deseja excluir "${nome}"?\n\nEsta ação remove o cadastro do cliente e todos os débitos vinculados a ele. Não pode ser desfeita.`,
        textoConfirmar: 'Excluir',
    });
    if (!confirmado) return;

    try {
        await ElogestStore.Clientes.excluir(id);
        card.style.transition = 'all 0.3s ease';
        card.style.opacity = '0';
        card.style.transform = 'translateX(30px)';
        setTimeout(() => {
            card.remove();
            if (!document.querySelectorAll('.cliente-card').length) carregarClientes();
        }, 300);
        ElogestUI.showToast(`Cliente "${nome}" excluído com sucesso.`, 'sucesso');
    } catch (err) {
        console.error('Erro ao excluir cliente:', err);
        ElogestUI.showToast(ElogestUI.mensagemErro(err, 'Não foi possível excluir o cliente.'), 'erro');
    }
});
