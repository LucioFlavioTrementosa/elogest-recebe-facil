/* ============================================================
   Elogest Recebe Fácil — index.js (tela de login)
   ============================================================ */

ElogestAuth.redirecionarSeLogado();

document.getElementById('btn-ver-senha').addEventListener('click', () => {
    const input = document.getElementById('senha');
    input.type = input.type === 'password' ? 'text' : 'password';
});

document.getElementById('link-recuperar').addEventListener('click', (e) => {
    e.preventDefault();
    ElogestUI.showToast('Recuperação de senha ainda não está disponível neste protótipo.', 'info');
});

function mostrarErroCampo(idInput, idErro, mensagem) {
    const input = document.getElementById(idInput);
    const erro = document.getElementById(idErro);
    if (mensagem) {
        input.classList.add('form-input--erro');
        erro.textContent = mensagem;
        erro.classList.add('campo__erro--visivel');
    } else {
        input.classList.remove('form-input--erro');
        erro.textContent = '';
        erro.classList.remove('campo__erro--visivel');
    }
}

document.getElementById('form-login').addEventListener('submit', async (e) => {
    e.preventDefault();

    const usuario = document.getElementById('usuario').value.trim();
    const senha = document.getElementById('senha').value;
    let valido = true;

    if (!usuario) { mostrarErroCampo('usuario', 'erro-usuario', 'Informe o usuário.'); valido = false; }
    else mostrarErroCampo('usuario', 'erro-usuario', '');

    if (!senha) { mostrarErroCampo('senha', 'erro-senha', 'Informe a senha.'); valido = false; }
    else mostrarErroCampo('senha', 'erro-senha', '');

    if (!valido) return;

    const btn = document.getElementById('btn-entrar');
    btn.disabled = true;
    btn.textContent = 'Entrando...';

    try {
        const resposta = await ElogestStore.Auth.login(usuario, senha);
        ElogestAuth.setSession(resposta.usuario, resposta.token);
        window.location.href = 'dashboard.html';
    } catch (err) {
        if (err instanceof ElogestStore.ApiError && err.status === 401) {
            mostrarErroCampo('senha', 'erro-senha', 'Usuário ou senha incorretos.');
        } else {
            ElogestUI.showToast(ElogestUI.mensagemErro(err, 'Não foi possível entrar agora. Tente novamente.'), 'erro');
        }
        btn.disabled = false;
        btn.textContent = 'Entrar no Sistema';
    }
});
