import sqlite3
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status

from .. import repo
from ..db import agora_iso, get_db, hoje_iso, para_centavos, subtotal_centavos
from ..schemas import DebitoEntrada, ItemEntrada, ItensEntrada
from ..security import usuario_atual

router = APIRouter(prefix="/api/debitos", tags=["debitos"])


def _buscar(conn: sqlite3.Connection, debito_id: int) -> sqlite3.Row:
    row = conn.execute("SELECT * FROM debitos WHERE id = ?", (debito_id,)).fetchone()
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Débito não encontrado.")
    return row


def _total_itens(itens: list[ItemEntrada]) -> int | None:
    """Soma em centavos dos itens válidos, ou None se não há carrinho."""
    validos = [i for i in itens if i.valido]
    if not validos:
        return None
    return sum(subtotal_centavos(i.quantidade, para_centavos(i.valor_unitario)) for i in validos)


def _substituir_itens(conn, debito_id: int, cliente_id: int, data: str, itens: list[ItemEntrada]) -> None:
    conn.execute("DELETE FROM itens_compra WHERE debito_id = ?", (debito_id,))
    conn.executemany(
        """INSERT INTO itens_compra (debito_id, cliente_id, produto_nome, categoria,
               quantidade, valor_unitario_centavos, data)
           VALUES (?, ?, ?, ?, ?, ?, ?)""",
        [
            (debito_id, cliente_id, i.produto_nome, i.categoria or "Geral", i.quantidade,
             para_centavos(i.valor_unitario), data)
            for i in itens if i.valido
        ],
    )


@router.get("", dependencies=[Depends(usuario_atual)])
def listar(
    cliente_id: int | None = None,
    status_calculado: Literal["PENDENTE", "ATRASADO", "PAGO"] | None = Query(default=None, alias="status"),
    conn: sqlite3.Connection = Depends(get_db),
):
    hoje = hoje_iso()
    sql, params = "SELECT * FROM debitos", []
    if cliente_id is not None:
        sql, params = sql + " WHERE cliente_id = ?", [cliente_id]
    debitos = [repo.debito(r, hoje) for r in conn.execute(sql + " ORDER BY id", params)]
    if status_calculado:
        debitos = [d for d in debitos if d["status_calculado"] == status_calculado]
    return debitos


@router.post("", status_code=status.HTTP_201_CREATED)
def criar(
    dados: DebitoEntrada,
    usuario: sqlite3.Row = Depends(usuario_atual),
    conn: sqlite3.Connection = Depends(get_db),
):
    if conn.execute("SELECT 1 FROM clientes WHERE id = ?", (dados.cliente_id,)).fetchone() is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Cliente informado não existe.")

    criacao = (dados.criacao_debito.isoformat() if dados.criacao_debito else hoje_iso())
    if dados.vencimento_debito.isoformat() < criacao:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "O vencimento não pode ser anterior à data de criação.")

    # Com itens, o valor é sempre a soma deles (o servidor é a fonte da verdade).
    total_itens = _total_itens(dados.itens)
    valor = total_itens if total_itens is not None else para_centavos(dados.valor_debito or 0)
    if valor <= 0:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Informe um valor maior que zero.")

    # Débito + itens numa única transação: ou grava tudo, ou nada.
    with conn:
        cur = conn.execute(
            """INSERT INTO debitos (cliente_id, valor_centavos, criacao_debito, vencimento_debito,
                   descricao_debito, criado_por)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (dados.cliente_id, valor, criacao, dados.vencimento_debito.isoformat(),
             dados.descricao_debito, usuario["id"]),
        )
        debito_id = cur.lastrowid
        _substituir_itens(conn, debito_id, dados.cliente_id, criacao, dados.itens)

    return repo.debito(_buscar(conn, debito_id), hoje_iso())


@router.patch("/{debito_id}/pagar")
def marcar_como_pago(
    debito_id: int,
    usuario: sqlite3.Row = Depends(usuario_atual),
    conn: sqlite3.Connection = Depends(get_db),
):
    with conn:
        # UPDATE condicional: evita pagar duas vezes mesmo com cliques simultâneos.
        cur = conn.execute(
            "UPDATE debitos SET status = 'PAGO', pago_em = ?, pago_por = ? WHERE id = ? AND status <> 'PAGO'",
            (agora_iso(), usuario["id"], debito_id),
        )
    if cur.rowcount == 0:
        _buscar(conn, debito_id)  # 404 se não existe
        raise HTTPException(status.HTTP_409_CONFLICT, "Este débito já está marcado como pago.")
    return repo.debito(_buscar(conn, debito_id), hoje_iso())


@router.get("/{debito_id}/itens", dependencies=[Depends(usuario_atual)])
def listar_itens(debito_id: int, conn: sqlite3.Connection = Depends(get_db)):
    _buscar(conn, debito_id)
    rows = conn.execute("SELECT * FROM itens_compra WHERE debito_id = ? ORDER BY id", (debito_id,))
    return [repo.item(r) for r in rows]


@router.put("/{debito_id}/itens", dependencies=[Depends(usuario_atual)])
def substituir_itens(debito_id: int, dados: ItensEntrada, conn: sqlite3.Connection = Depends(get_db)):
    debito = _buscar(conn, debito_id)
    if debito["status"] == "PAGO":
        raise HTTPException(status.HTTP_409_CONFLICT, "Não é possível alterar itens de um débito já pago.")
    total = _total_itens(dados.itens)
    if total is not None and total <= 0:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "O total dos itens precisa ser maior que zero.")
    with conn:
        _substituir_itens(conn, debito_id, debito["cliente_id"], debito["criacao_debito"], dados.itens)
        if total is not None:
            conn.execute("UPDATE debitos SET valor_centavos = ? WHERE id = ?", (total, debito_id))
    rows = conn.execute("SELECT * FROM itens_compra WHERE debito_id = ? ORDER BY id", (debito_id,))
    return [repo.item(r) for r in rows]
