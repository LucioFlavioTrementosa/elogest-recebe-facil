"""Mini CRM (itens de compra), relatório por região e resumo do dashboard."""

import re
import sqlite3

from fastapi import APIRouter, Depends, HTTPException, Query, status

from .. import repo
from ..db import get_db, hoje_iso, para_reais, subtotal_centavos
from ..security import usuario_atual

router = APIRouter(prefix="/api", tags=["relatorios"], dependencies=[Depends(usuario_atual)])

SEM_BAIRRO = "Sem região definida"
_MES_RE = re.compile(r"^\d{4}-(0[1-9]|1[0-2])$")


def _agrupar_por_produto(rows) -> list[dict]:
    """Agrupa por nome (sem diferenciar maiúsculas/acentuação de caixa) e ordena por valor."""
    mapa: dict[str, dict] = {}
    for r in rows:
        chave = r["produto_nome"].casefold()
        valor = subtotal_centavos(r["quantidade"], r["valor_unitario_centavos"])
        atual = mapa.get(chave)
        if atual:
            atual["quantidade_total"] += r["quantidade"]
            atual["_centavos"] += valor
            atual["ocorrencias"] += 1
        else:
            mapa[chave] = {
                "produto_nome": r["produto_nome"],
                "categoria": r["categoria"],
                "quantidade_total": r["quantidade"],
                "_centavos": valor,
                "ocorrencias": 1,
            }
    resultado = sorted(mapa.values(), key=lambda p: p["_centavos"], reverse=True)
    for p in resultado:
        p["valor_total"] = para_reais(p.pop("_centavos"))
    return resultado


@router.get("/itens")
def listar_itens(cliente_id: int, conn: sqlite3.Connection = Depends(get_db)):
    rows = conn.execute("SELECT * FROM itens_compra WHERE cliente_id = ? ORDER BY id", (cliente_id,))
    return [repo.item(r) for r in rows]


@router.get("/itens/ranking")
def ranking_produtos(
    cliente_id: int | None = None,
    mes: str | None = Query(default=None, description="Filtra por mês, formato AAAA-MM"),
    conn: sqlite3.Connection = Depends(get_db),
):
    if mes is not None and not _MES_RE.match(mes):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Mês inválido. Use o formato AAAA-MM.")
    sql, filtros, params = "SELECT * FROM itens_compra", [], []
    if cliente_id is not None:
        filtros.append("cliente_id = ?")
        params.append(cliente_id)
    if mes is not None:
        filtros.append("substr(data, 1, 7) = ?")
        params.append(mes)
    if filtros:
        sql += " WHERE " + " AND ".join(filtros)
    return _agrupar_por_produto(conn.execute(sql + " ORDER BY id", params))


@router.get("/itens/gasto-total")
def gasto_total_itens(cliente_id: int, conn: sqlite3.Connection = Depends(get_db)):
    rows = conn.execute(
        "SELECT quantidade, valor_unitario_centavos FROM itens_compra WHERE cliente_id = ?", (cliente_id,)
    )
    total = sum(subtotal_centavos(r["quantidade"], r["valor_unitario_centavos"]) for r in rows)
    return {"cliente_id": cliente_id, "gasto_total": para_reais(total)}


@router.get("/regioes/resumo")
def resumo_regioes(conn: sqlite3.Connection = Depends(get_db)):
    rows = conn.execute(
        """SELECT c.id, c.bairro_cliente,
                  COALESCE(SUM(d.valor_centavos), 0) AS total,
                  COALESCE(SUM(CASE WHEN d.status = 'PAGO' THEN d.valor_centavos END), 0) AS pago
           FROM clientes c LEFT JOIN debitos d ON d.cliente_id = c.id
           GROUP BY c.id"""
    )
    por_bairro: dict[str, dict] = {}
    for r in rows:
        bairro = (r["bairro_cliente"] or "").strip() or SEM_BAIRRO
        atual = por_bairro.setdefault(
            bairro, {"bairro": bairro, "total_clientes": 0, "total": 0, "pago": 0, "com_gasto": 0}
        )
        atual["total_clientes"] += 1
        atual["total"] += r["total"]
        atual["pago"] += r["pago"]
        if r["total"] > 0:
            atual["com_gasto"] += 1

    resultado = [
        {
            "bairro": b["bairro"],
            "total_clientes": b["total_clientes"],
            "valor_total_gasto": para_reais(b["total"]),
            "valor_pago": para_reais(b["pago"]),
            "valor_em_aberto": para_reais(b["total"] - b["pago"]),
            # Ticket médio por CLIENTE que comprou (≠ ticket médio por débito do perfil do cliente).
            "ticket_medio": para_reais(round(b["total"] / b["com_gasto"])) if b["com_gasto"] else 0,
        }
        for b in por_bairro.values()
    ]
    return sorted(resultado, key=lambda r: r["valor_total_gasto"], reverse=True)


@router.get("/dashboard/resumo")
def resumo_dashboard(conn: sqlite3.Connection = Depends(get_db)):
    hoje = hoje_iso()
    d = conn.execute(
        """SELECT
             COALESCE(SUM(CASE WHEN status <> 'PAGO' AND vencimento_debito >= :hoje THEN 1 END), 0) AS total_pendentes,
             COALESCE(SUM(CASE WHEN status <> 'PAGO' AND vencimento_debito <  :hoje THEN 1 END), 0) AS total_atrasados,
             COALESCE(SUM(CASE WHEN status <> 'PAGO' AND vencimento_debito >= :hoje THEN valor_centavos END), 0) AS pendente,
             COALESCE(SUM(CASE WHEN status <> 'PAGO' AND vencimento_debito <  :hoje THEN valor_centavos END), 0) AS atrasado,
             COALESCE(SUM(CASE WHEN status =  'PAGO' THEN valor_centavos END), 0) AS pago
           FROM debitos""",
        {"hoje": hoje},
    ).fetchone()
    total_clientes = conn.execute("SELECT COUNT(*) FROM clientes").fetchone()[0]
    return {
        "total_clientes": total_clientes,
        "total_pendentes": d["total_pendentes"],
        "total_atrasados": d["total_atrasados"],
        "valor_pendente": para_reais(d["pendente"]),
        "valor_atrasado": para_reais(d["atrasado"]),
        "valor_pago": para_reais(d["pago"]),
    }
