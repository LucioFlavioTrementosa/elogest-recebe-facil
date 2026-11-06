/* ============================================================
   Elogest Recebe Fácil — ui.js

   Componentes de interface compartilhados por todas as páginas
   internas:
   - Layout único (sidebar + header + rodapé), injetado via JS para
     não duplicar o mesmo HTML em 6 arquivos diferentes.
   - Sistema de toast (substitui alert()).
   - Modal de confirmação acessível (substitui confirm()).
   - Menu mobile (abrir/fechar sidebar) e menu de opções (3 pontinhos).
   ============================================================ */

(function (global) {
    'use strict';

    const NAV_ITENS = [
        {
            chave: 'dashboard', href: 'dashboard.html', label: 'Dashboard',
            icone: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>',
        },
        {
            chave: 'clientes', href: 'clientes.html', label: 'Clientes',
            icone: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
        },
        {
            chave: 'novo-cliente', href: 'cadastro-cliente.html', label: 'Novo Cliente',
            icone: '<path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/>',
        },
        {
            chave: 'novo-debito', href: 'registro-debito.html', label: 'Novo Débito',
            icone: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/>',
        },
        {
            chave: 'contas-receber', href: 'contas-receber.html', label: 'Contas a Receber',
            icone: '<line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
        },
        {
            chave: 'regioes', href: 'regioes.html', label: 'Regiões',
            icone: '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>',
        },
    ];

    function renderLayout(paginaAtiva) {
        const sidebarEl = document.getElementById('sidebar');
        const headerEl = document.getElementById('header');
        const rodapeEl = document.getElementById('rodape');
        const sessao = (global.ElogestAuth && global.ElogestAuth.getSession()) || { nome: 'Usuário' };

        if (sidebarEl) {
            sidebarEl.innerHTML = `
                <div class="sidebar__logo">
                    <div class="sidebar__logo-icone">
                        <img src="assets/icon-elogest.webp" alt="">
                    </div>
                    <div>
                        <h2 class="sidebar__titulo">Elogest</h2>
                        <p class="sidebar__subtitulo">Recebe Fácil</p>
                    </div>
                </div>
                <div class="sidebar__divisor"></div>
                <nav class="sidebar__nav">
                    ${NAV_ITENS.map((item) => `
                        <a href="${item.href}" class="sidebar__nav-item${item.chave === paginaAtiva ? ' sidebar__nav-item--ativo' : ''}">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${item.icone}</svg>
                            <span>${item.label}</span>
                        </a>
                    `).join('')}
                </nav>
                <div class="sidebar__espacador"></div>
                <div class="sidebar__divisor"></div>
                <button type="button" class="sidebar__sair" id="btn-sair">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                    <span>Sair do Sistema</span>
                </button>
            `;
            const btnSair = document.getElementById('btn-sair');
            if (btnSair) {
                btnSair.addEventListener('click', async () => {
                    const ok = await confirmModal({
                        titulo: 'Sair do sistema',
                        mensagem: 'Tem certeza que deseja encerrar a sessão?',
                        textoConfirmar: 'Sair',
                        neutro: true,
                    });
                    if (ok) global.ElogestAuth.logout();
                });
            }
        }

        if (headerEl) {
            const nome = sessao.nome || 'Usuário';
            headerEl.innerHTML = `
                <button class="header__menu-btn" id="btn-menu" aria-label="Abrir menu">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
                </button>
                <div class="header__info">
                    <p class="header__bemvindo">Bem-vindo(a) de volta</p>
                    <h3 class="header__nome">${global.ElogestFormat.escapeHtml(nome)}</h3>
                </div>
                <div class="header__avatar">${global.ElogestFormat.gerarIniciais(nome)}</div>
            `;
        }

        if (rodapeEl) {
            const aviso = global.ElogestStore && global.ElogestStore.modo === 'api' ? '' : ' — Modo demonstração (dados salvos só neste navegador)';
            rodapeEl.innerHTML = `<p>Elogest Recebe Fácil © ${new Date().getFullYear()}${aviso}</p>`;
        }

        configurarMenuMobile();
    }

    function configurarMenuMobile() {
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('overlay');
        const btnMenu = document.getElementById('btn-menu');

        function abrirFechar() {
            sidebar && sidebar.classList.toggle('sidebar--aberta');
            overlay && overlay.classList.toggle('overlay--visivel');
        }
        function fechar() {
            sidebar && sidebar.classList.remove('sidebar--aberta');
            overlay && overlay.classList.remove('overlay--visivel');
        }
        if (btnMenu) btnMenu.addEventListener('click', abrirFechar);
        if (overlay) overlay.addEventListener('click', fechar);
    }

    /* ------------------------------------------------------------
       TOASTS
       ------------------------------------------------------------ */
    const ICONES_TOAST = {
        sucesso: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><polyline points="8 12 11 15 16 9"/></svg>',
        erro: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
        alerta: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
        info: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
    };

    function getToastContainer() {
        let container = document.getElementById('toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toast-container';
            container.className = 'toast-container';
            container.setAttribute('role', 'status');
            container.setAttribute('aria-live', 'polite');
            document.body.appendChild(container);
        }
        return container;
    }

    function showToast(mensagem, tipo, duracaoMs) {
        tipo = tipo || 'info';
        const container = getToastContainer();
        const toast = document.createElement('div');
        toast.className = `toast toast--${tipo}`;
        toast.innerHTML = `
            <span class="toast__icone">${ICONES_TOAST[tipo] || ICONES_TOAST.info}</span>
            <span class="toast__texto">${global.ElogestFormat.escapeHtml(mensagem)}</span>
            <button type="button" class="toast__fechar" aria-label="Fechar notificação">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
        `;

        function remover() {
            toast.classList.add('toast--saindo');
            setTimeout(() => toast.remove(), 200);
        }

        toast.querySelector('.toast__fechar').addEventListener('click', remover);
        container.appendChild(toast);
        setTimeout(remover, duracaoMs || 4500);
        return toast;
    }

    /**
     * Texto para mostrar ao usuário a partir de um erro da API: usa a
     * mensagem do servidor para erros de negócio/validação (4xx, ou sem
     * conexão) e o texto padrão da tela para o resto.
     */
    function mensagemErro(err, padrao) {
        const ApiError = global.ElogestStore && global.ElogestStore.ApiError;
        if (ApiError && err instanceof ApiError && err.message && (err.status === 0 || (err.status >= 400 && err.status < 500) || err.status === 507)) {
            return err.message;
        }
        return padrao;
    }

    /* ------------------------------------------------------------
       MODAL DE CONFIRMAÇÃO
       ------------------------------------------------------------ */
    function confirmModal(opcoes) {
        opcoes = opcoes || {};
        return new Promise((resolve) => {
            const backdrop = document.createElement('div');
            backdrop.className = 'modal-backdrop';
            backdrop.setAttribute('role', 'presentation');

            const card = document.createElement('div');
            card.className = 'modal-card' + (opcoes.neutro ? ' modal-card--neutro' : '');
            card.setAttribute('role', 'alertdialog');
            card.setAttribute('aria-modal', 'true');
            card.setAttribute('aria-labelledby', 'modal-titulo');
            card.innerHTML = `
                <div class="modal-card__icone">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        ${opcoes.neutro
                            ? '<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>'
                            : '<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>'}
                    </svg>
                </div>
                <h2 class="modal-card__titulo" id="modal-titulo">${global.ElogestFormat.escapeHtml(opcoes.titulo || 'Confirmar ação')}</h2>
                <p class="modal-card__mensagem">${global.ElogestFormat.escapeHtml(opcoes.mensagem || 'Tem certeza?')}</p>
                <div class="modal-card__acoes">
                    <button type="button" class="btn-secundario" data-acao="cancelar">${global.ElogestFormat.escapeHtml(opcoes.textoCancelar || 'Cancelar')}</button>
                    <button type="button" class="${opcoes.neutro ? 'btn-primario' : 'btn-perigo'}" data-acao="confirmar">${global.ElogestFormat.escapeHtml(opcoes.textoConfirmar || 'Confirmar')}</button>
                </div>
            `;
            backdrop.appendChild(card);
            document.body.appendChild(backdrop);

            const btnConfirmar = card.querySelector('[data-acao="confirmar"]');
            const btnCancelar = card.querySelector('[data-acao="cancelar"]');
            btnConfirmar.focus();

            function finalizar(resultado) {
                document.removeEventListener('keydown', onKeyDown);
                backdrop.remove();
                resolve(resultado);
            }
            function onKeyDown(e) {
                if (e.key === 'Escape') finalizar(false);
            }

            btnConfirmar.addEventListener('click', () => finalizar(true));
            btnCancelar.addEventListener('click', () => finalizar(false));
            backdrop.addEventListener('click', (e) => { if (e.target === backdrop) finalizar(false); });
            document.addEventListener('keydown', onKeyDown);
        });
    }

    /* ------------------------------------------------------------
       MENU DE OPÇÕES (3 pontinhos) — clientes.html
       ------------------------------------------------------------ */
    function configurarMenuOpcoes() {
        document.addEventListener('click', (e) => {
            const botao = e.target.closest('.menu-opcoes__btn');
            if (botao) {
                const dropdownAtual = botao.nextElementSibling;
                const cardAtual = botao.closest('.cliente-card');
                document.querySelectorAll('.menu-opcoes__dropdown').forEach((d) => {
                    if (d !== dropdownAtual) d.classList.remove('menu-opcoes__dropdown--aberto');
                });
                document.querySelectorAll('.cliente-card').forEach((c) => {
                    if (c !== cardAtual) c.classList.remove('cliente-card--menu-aberto');
                });
                dropdownAtual.classList.toggle('menu-opcoes__dropdown--aberto');
                cardAtual.classList.toggle('cliente-card--menu-aberto');
                return;
            }
            if (!e.target.closest('.menu-opcoes')) {
                document.querySelectorAll('.menu-opcoes__dropdown').forEach((d) => d.classList.remove('menu-opcoes__dropdown--aberto'));
                document.querySelectorAll('.cliente-card').forEach((c) => c.classList.remove('cliente-card--menu-aberto'));
            }
        });
    }

    global.ElogestUI = { renderLayout, showToast, mensagemErro, confirmModal, configurarMenuOpcoes };
})(window);
