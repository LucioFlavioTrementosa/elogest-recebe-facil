/* ============================================================
   Elogest Recebe Fácil — format.js
   Formatação de moeda/data/telefone, máscaras progressivas de
   input (CPF/CNPJ, telefone, valor) e helpers de validação.
   Compartilhado por todas as páginas.
   ============================================================ */

(function (global) {
    'use strict';

    function formatarMoeda(valor) {
        const num = Number(valor || 0);
        return 'R$ ' + num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    function formatarData(data) {
        if (!data) return '-';
        const str = String(data).slice(0, 10);
        const partes = str.split('-');
        if (partes.length !== 3) return str;
        return `${partes[2]}/${partes[1]}/${partes[0]}`;
    }

    function formatarTelefone(tel) {
        if (!tel) return '-';
        const limpo = String(tel).replace(/\D/g, '');
        if (limpo.length === 11) return `(${limpo.substring(0, 2)}) ${limpo.substring(2, 7)}-${limpo.substring(7)}`;
        if (limpo.length === 10) return `(${limpo.substring(0, 2)}) ${limpo.substring(2, 6)}-${limpo.substring(6)}`;
        return escapeHtml(tel);
    }

    function escapeHtml(texto) {
        if (texto === null || texto === undefined) return '';
        const div = document.createElement('div');
        div.textContent = String(texto);
        return div.innerHTML;
    }

    function gerarIniciais(nome) {
        if (!nome) return '?';
        return escapeHtml(nome.trim().split(/\s+/).map((p) => p[0]).join('').substring(0, 2).toUpperCase());
    }

    /** AAAA-MM-DD no fuso LOCAL (toISOString usa UTC: no Brasil viraria o dia às 21h). */
    function dataISO(data) {
        const p = (n) => String(n).padStart(2, '0');
        return `${data.getFullYear()}-${p(data.getMonth() + 1)}-${p(data.getDate())}`;
    }

    function hojeISO() {
        return dataISO(new Date());
    }

    /* ---- Máscaras progressivas (aplicadas em "input") ---- */

    function maskCpfCnpj(valorBruto) {
        const v = valorBruto.replace(/\D/g, '').slice(0, 14);
        if (v.length <= 11) {
            // CPF: 000.000.000-00
            return v
                .replace(/(\d{3})(\d)/, '$1.$2')
                .replace(/(\d{3})(\d)/, '$1.$2')
                .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
        }
        // CNPJ: 00.000.000/0000-00
        return v
            .replace(/(\d{2})(\d)/, '$1.$2')
            .replace(/(\d{3})(\d)/, '$1.$2')
            .replace(/(\d{3})(\d)/, '$1/$2')
            .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
    }

    function maskTelefone(valorBruto) {
        const v = valorBruto.replace(/\D/g, '').slice(0, 11);
        if (v.length <= 10) {
            return v
                .replace(/(\d{2})(\d)/, '($1) $2')
                .replace(/(\d{4})(\d{1,4})$/, '$1-$2');
        }
        return v
            .replace(/(\d{2})(\d)/, '($1) $2')
            .replace(/(\d{5})(\d{1,4})$/, '$1-$2');
    }

    function maskMoeda(valorBruto) {
        let v = valorBruto.replace(/\D/g, '');
        if (!v) return '';
        v = v.replace(/^0+(?=\d)/, '');
        while (v.length < 3) v = '0' + v;
        const centavos = v.slice(-2);
        const inteiro = v.slice(0, -2).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
        return `${inteiro},${centavos}`;
    }

    function moedaParaNumero(valorMascarado) {
        if (!valorMascarado) return 0;
        return Number(valorMascarado.replace(/\./g, '').replace(',', '.')) || 0;
    }

    function anexarMascara(input, funcaoMascara) {
        input.addEventListener('input', () => {
            const posicaoOriginal = input.selectionStart;
            const tamanhoAntes = input.value.length;
            input.value = funcaoMascara(input.value);
            const diff = input.value.length - tamanhoAntes;
            const novaPosicao = Math.max(0, (posicaoOriginal || 0) + diff);
            input.setSelectionRange(novaPosicao, novaPosicao);
        });
    }

    /* ---- Validação ---- */

    function cpfValido(d) {
        if (d.length !== 11 || /^(\d)\1+$/.test(d)) return false;
        for (const tamanho of [9, 10]) {
            let soma = 0;
            for (let i = 0; i < tamanho; i++) soma += Number(d[i]) * (tamanho + 1 - i);
            if ((soma * 10) % 11 % 10 !== Number(d[tamanho])) return false;
        }
        return true;
    }

    function cnpjValido(d) {
        if (d.length !== 14 || /^(\d)\1+$/.test(d)) return false;
        const pesos = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
        for (const tamanho of [12, 13]) {
            let soma = 0;
            for (let i = 0; i < tamanho; i++) soma += Number(d[i]) * pesos[i + 13 - tamanho];
            const resto = soma % 11;
            if ((resto < 2 ? 0 : 11 - resto) !== Number(d[tamanho])) return false;
        }
        return true;
    }

    /** Confere tamanho E dígitos verificadores (mesma regra do backend). */
    function cpfCnpjValido(valor) {
        const v = String(valor || '').replace(/\D/g, '');
        return v.length === 11 ? cpfValido(v) : v.length === 14 ? cnpjValido(v) : false;
    }

    function telefoneValido(valor) {
        const v = String(valor || '').replace(/\D/g, '');
        return v.length === 10 || v.length === 11;
    }

    function emailValido(valor) {
        if (!valor) return true; // campo opcional
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor);
    }

    global.ElogestFormat = {
        formatarMoeda, formatarData, formatarTelefone, escapeHtml, gerarIniciais, dataISO, hojeISO,
        maskCpfCnpj, maskTelefone, maskMoeda, moedaParaNumero, anexarMascara,
        cpfCnpjValido, telefoneValido, emailValido,
    };
})(window);
