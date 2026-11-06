/* ============================================================
   Elogest Recebe Fácil — auth.js
   Sessão guardada em localStorage. No modo API ela carrega o token
   JWT devolvido pelo backend (que é quem de fato valida cada
   requisição); no modo demonstração não há token.

   Este arquivo roda a "guarda de rota" de forma síncrona, assim
   que é carregado (antes do DOMContentLoaded), para evitar que
   o conteúdo de uma página protegida pisque na tela antes do
   redirecionamento para o login.
   ============================================================ */

(function (global) {
    'use strict';

    const CHAVE_SESSAO = 'elogest:sessao';

    function getSession() {
        try {
            const bruto = localStorage.getItem(CHAVE_SESSAO);
            return bruto ? JSON.parse(bruto) : null;
        } catch {
            return null;
        }
    }

    function setSession(usuario, token) {
        localStorage.setItem(CHAVE_SESSAO, JSON.stringify(Object.assign({}, usuario, { token: token || null })));
    }

    function getToken() {
        const sessao = getSession();
        return (sessao && sessao.token) || null;
    }

    function modoApi() {
        return Boolean(global.ELOGEST_CONFIG && global.ELOGEST_CONFIG.apiUrl);
    }

    /** No modo API, sessão sem token não vale (o backend recusaria tudo). */
    function sessaoValida() {
        const sessao = getSession();
        return Boolean(sessao && (!modoApi() || sessao.token));
    }

    function clearSession() {
        localStorage.removeItem(CHAVE_SESSAO);
    }

    function logout() {
        clearSession();
        window.location.href = 'index.html';
    }

    /**
     * Chamar no topo de páginas internas (protegidas). Se não houver
     * sessão ativa, redireciona para o login imediatamente.
     */
    function exigirSessao() {
        if (!sessaoValida()) {
            window.location.replace('index.html');
        }
    }

    /**
     * Chamar no topo da tela de login. Se já houver sessão ativa,
     * pula direto para o dashboard em vez de mostrar o formulário.
     */
    function redirecionarSeLogado() {
        if (sessaoValida()) {
            window.location.replace('dashboard.html');
        }
    }

    global.ElogestAuth = { getSession, getToken, setSession, clearSession, logout, exigirSessao, redirecionarSeLogado };
})(window);
