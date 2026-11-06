"""Regras de validação de documentos e contatos — espelham js/format.js do frontend."""

import re

_EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")


def somente_digitos(valor: str | None) -> str:
    return re.sub(r"\D", "", valor or "")


def cpf_valido(digitos: str) -> bool:
    if len(digitos) != 11 or digitos == digitos[0] * 11:
        return False
    for tamanho in (9, 10):
        soma = sum(int(digitos[i]) * (tamanho + 1 - i) for i in range(tamanho))
        dv = (soma * 10) % 11 % 10
        if dv != int(digitos[tamanho]):
            return False
    return True


def cnpj_valido(digitos: str) -> bool:
    if len(digitos) != 14 or digitos == digitos[0] * 14:
        return False
    pesos = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    for tamanho in (12, 13):
        soma = sum(int(digitos[i]) * pesos[i + 13 - tamanho] for i in range(tamanho))
        resto = soma % 11
        dv = 0 if resto < 2 else 11 - resto
        if dv != int(digitos[tamanho]):
            return False
    return True


def cpf_cnpj_valido(valor: str | None) -> bool:
    d = somente_digitos(valor)
    return cpf_valido(d) if len(d) == 11 else cnpj_valido(d) if len(d) == 14 else False


def formatar_cpf_cnpj(valor: str) -> str:
    d = somente_digitos(valor)
    if len(d) == 11:
        return f"{d[:3]}.{d[3:6]}.{d[6:9]}-{d[9:]}"
    if len(d) == 14:
        return f"{d[:2]}.{d[2:5]}.{d[5:8]}/{d[8:12]}-{d[12:]}"
    return valor


def telefone_valido(valor: str | None) -> bool:
    return len(somente_digitos(valor)) in (10, 11)


def formatar_telefone(valor: str) -> str:
    d = somente_digitos(valor)
    if len(d) == 11:
        return f"({d[:2]}) {d[2:7]}-{d[7:]}"
    if len(d) == 10:
        return f"({d[:2]}) {d[2:6]}-{d[6:]}"
    return valor


def email_valido(valor: str | None) -> bool:
    return not valor or bool(_EMAIL_RE.match(valor))
