/* ============================================================
   Elogest Recebe Fácil — cadastro-cliente.js
   ============================================================ */

ElogestAuth.exigirSessao();

document.addEventListener('DOMContentLoaded', () => {
    ElogestUI.renderLayout('novo-cliente');
    const form = configurarFormularioCliente();

    document.getElementById('form-cliente').addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!form.validarTudo()) {
            ElogestUI.showToast('Corrija os campos destacados antes de salvar.', 'alerta');
            return;
        }

        const btn = document.getElementById('btn-salvar');
        btn.disabled = true;
        btn.textContent = 'Salvando...';

        try {
            const cliente = await ElogestStore.Clientes.criar(form.coletarPayload());
            ElogestUI.showToast(`Cliente "${cliente.nome_cliente}" cadastrado com sucesso!`, 'sucesso');
            window.location.href = 'clientes.html';
        } catch (err) {
            console.error('Erro ao cadastrar cliente:', err);
            ElogestUI.showToast(ElogestUI.mensagemErro(err, 'Não foi possível cadastrar o cliente. Tente novamente.'), 'erro');
            btn.disabled = false;
            btn.textContent = 'Salvar Cliente';
        }
    });
});
