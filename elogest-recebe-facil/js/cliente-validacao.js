/* ============================================================
   Elogest Recebe Fácil — cliente-validacao.js
   Validação em tempo real + máscaras compartilhadas entre
   cadastro-cliente.html e editar-cliente.html.
   ============================================================ */

function configurarFormularioCliente() {
    const F = ElogestFormat;

    const campoNome = document.getElementById('nome_cliente');
    const campoCpf = document.getElementById('cpf_cnpj');
    const campoTelefone = document.getElementById('telefone_cliente');
    const campoEmail = document.getElementById('email_cliente');
    const campoObs = document.getElementById('obs_cliente');
    const contadorObs = document.getElementById('contador-obs');

    F.anexarMascara(campoCpf, F.maskCpfCnpj);
    F.anexarMascara(campoTelefone, F.maskTelefone);

    if (campoObs && contadorObs) {
        const atualizarContador = () => { contadorObs.textContent = campoObs.value.length; };
        campoObs.addEventListener('input', atualizarContador);
        atualizarContador();
    }

    function marcarErro(input, mensagem) {
        const erroEl = document.getElementById('erro-' + input.id);
        if (mensagem) {
            input.classList.add('form-input--erro');
            input.classList.remove('form-input--valido');
            if (erroEl) { erroEl.textContent = mensagem; erroEl.classList.add('form-field__erro--visivel'); }
        } else {
            input.classList.remove('form-input--erro');
            input.classList.add('form-input--valido');
            if (erroEl) { erroEl.textContent = ''; erroEl.classList.remove('form-field__erro--visivel'); }
        }
    }

    function validarCampo(input) {
        if (input === campoNome) {
            if (!input.value.trim()) { marcarErro(input, 'Informe o nome completo.'); return false; }
            marcarErro(input, ''); return true;
        }
        if (input === campoCpf) {
            if (!input.value.trim()) { marcarErro(input, 'Informe o CPF ou CNPJ.'); return false; }
            if (!F.cpfCnpjValido(input.value)) { marcarErro(input, 'CPF ou CNPJ inválido — confira os números digitados.'); return false; }
            marcarErro(input, ''); return true;
        }
        if (input === campoTelefone) {
            if (!input.value.trim()) { marcarErro(input, 'Informe o telefone.'); return false; }
            if (!F.telefoneValido(input.value)) { marcarErro(input, 'Informe um telefone com DDD (10 ou 11 dígitos).'); return false; }
            marcarErro(input, ''); return true;
        }
        if (input === campoEmail) {
            if (!F.emailValido(input.value)) { marcarErro(input, 'Informe um e-mail válido.'); return false; }
            marcarErro(input, ''); return true;
        }
        return true;
    }

    [campoNome, campoCpf, campoTelefone, campoEmail].forEach((input) => {
        input.addEventListener('blur', () => validarCampo(input));
        input.addEventListener('input', () => {
            if (input.classList.contains('form-input--erro')) validarCampo(input);
        });
    });

    function validarTudo() {
        const resultados = [campoNome, campoCpf, campoTelefone, campoEmail].map(validarCampo);
        return resultados.every(Boolean);
    }

    function coletarPayload() {
        const campoBairro = document.getElementById('bairro_cliente');
        return {
            nome_cliente: campoNome.value.trim(),
            cpf_cnpj: campoCpf.value.trim(),
            telefone_cliente: campoTelefone.value.trim(),
            email_cliente: campoEmail.value.trim(),
            endereco_cliente: document.getElementById('endereco_cliente').value.trim(),
            bairro_cliente: campoBairro ? campoBairro.value.trim() : '',
            obs_cliente: campoObs.value.trim(),
        };
    }

    function preencherFormulario(cliente) {
        const campoBairro = document.getElementById('bairro_cliente');
        campoNome.value = cliente.nome_cliente || '';
        campoCpf.value = cliente.cpf_cnpj || '';
        campoTelefone.value = cliente.telefone_cliente || '';
        campoEmail.value = cliente.email_cliente || '';
        document.getElementById('endereco_cliente').value = cliente.endereco_cliente || '';
        if (campoBairro) campoBairro.value = cliente.bairro_cliente || '';
        campoObs.value = cliente.obs_cliente || '';
        if (contadorObs) contadorObs.textContent = campoObs.value.length;
    }

    return { validarTudo, coletarPayload, preencherFormulario };
}
