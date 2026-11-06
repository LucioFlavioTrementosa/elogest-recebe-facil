/* ============================================================
   Elogest Recebe Fácil — editar-cliente.js
   ============================================================ */

ElogestAuth.exigirSessao();

document.addEventListener('DOMContentLoaded', async () => {
    ElogestUI.renderLayout('clientes');
    const form = configurarFormularioCliente();

    const params = new URLSearchParams(window.location.search);
    const clienteId = params.get('id');
    const formEl = document.getElementById('form-cliente');

    if (!clienteId) {
        ElogestUI.showToast('Cliente não informado. Volte para a lista de clientes.', 'erro');
        formEl.querySelectorAll('input, textarea, button').forEach((el) => (el.disabled = true));
        return;
    }

    try {
        const cliente = await ElogestStore.Clientes.buscar(clienteId);
        document.getElementById('cliente_id').value = cliente.id;
        form.preencherFormulario(cliente);
    } catch (err) {
        console.error('Erro ao carregar cliente:', err);
        ElogestUI.showToast('Cliente não encontrado.', 'erro');
        formEl.querySelectorAll('input, textarea, button').forEach((el) => (el.disabled = true));
        return;
    }

    formEl.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!form.validarTudo()) {
            ElogestUI.showToast('Corrija os campos destacados antes de salvar.', 'alerta');
            return;
        }

        const btn = document.getElementById('btn-salvar');
        btn.disabled = true;
        btn.textContent = 'Salvando...';

        try {
            await ElogestStore.Clientes.atualizar(clienteId, form.coletarPayload());
            ElogestUI.showToast('Dados do cliente atualizados com sucesso!', 'sucesso');
            window.location.href = 'clientes.html';
        } catch (err) {
            console.error('Erro ao atualizar cliente:', err);
            ElogestUI.showToast(ElogestUI.mensagemErro(err, 'Não foi possível atualizar o cliente. Tente novamente.'), 'erro');
            btn.disabled = false;
            btn.textContent = 'Salvar Alterações';
        }
    });
});
