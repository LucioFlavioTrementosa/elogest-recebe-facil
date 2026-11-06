"""Conversão linha do banco → formato JSON que o frontend já consome."""

import sqlite3

from .db import para_reais


def status_calculado(status: str, vencimento: str, hoje: str) -> str:
    """PAGO / ATRASADO / PENDENTE — nunca gravado, sempre derivado."""
    if status == "PAGO":
        return "PAGO"
    return "ATRASADO" if vencimento < hoje else "PENDENTE"


def cliente(row: sqlite3.Row) -> dict:
    return {
        "id": row["id"],
        "nome_cliente": row["nome_cliente"],
        "cpf_cnpj": row["cpf_cnpj"],
        "telefone_cliente": row["telefone_cliente"],
        "email_cliente": row["email_cliente"],
        "endereco_cliente": row["endereco_cliente"],
        "bairro_cliente": row["bairro_cliente"],
        "obs_cliente": row["obs_cliente"],
    }


def debito(row: sqlite3.Row, hoje: str) -> dict:
    return {
        "id": row["id"],
        "cliente_id": row["cliente_id"],
        "valor_debito": para_reais(row["valor_centavos"]),
        "criacao_debito": row["criacao_debito"],
        "vencimento_debito": row["vencimento_debito"],
        "descricao_debito": row["descricao_debito"],
        "status": row["status"],
        "status_calculado": status_calculado(row["status"], row["vencimento_debito"], hoje),
        "pago_em": row["pago_em"],
    }


def item(row: sqlite3.Row) -> dict:
    return {
        "id": row["id"],
        "debito_id": row["debito_id"],
        "cliente_id": row["cliente_id"],
        "produto_nome": row["produto_nome"],
        "categoria": row["categoria"],
        "quantidade": row["quantidade"],
        "valor_unitario": para_reais(row["valor_unitario_centavos"]),
        "data": row["data"],
    }
