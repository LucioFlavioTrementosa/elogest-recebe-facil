import sqlite3

from fastapi import APIRouter, Depends, HTTPException, Response, status

from .. import repo
from ..db import agora_iso, get_db
from ..schemas import ClienteEntrada
from ..security import usuario_atual
from ..validacao import somente_digitos

router = APIRouter(prefix="/api/clientes", tags=["clientes"], dependencies=[Depends(usuario_atual)])

_CPF_DUPLICADO = "Já existe um cliente cadastrado com este CPF/CNPJ."


def _buscar(conn: sqlite3.Connection, cliente_id: int) -> sqlite3.Row:
    row = conn.execute("SELECT * FROM clientes WHERE id = ?", (cliente_id,)).fetchone()
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Cliente não encontrado.")
    return row


@router.get("")
def listar(conn: sqlite3.Connection = Depends(get_db)):
    return [repo.cliente(r) for r in conn.execute("SELECT * FROM clientes ORDER BY id")]


@router.get("/{cliente_id}")
def buscar(cliente_id: int, conn: sqlite3.Connection = Depends(get_db)):
    return repo.cliente(_buscar(conn, cliente_id))


@router.post("", status_code=status.HTTP_201_CREATED)
def criar(dados: ClienteEntrada, conn: sqlite3.Connection = Depends(get_db)):
    try:
        with conn:
            cur = conn.execute(
                """INSERT INTO clientes (nome_cliente, cpf_cnpj, cpf_cnpj_digitos, telefone_cliente,
                       email_cliente, endereco_cliente, bairro_cliente, obs_cliente)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                (dados.nome_cliente, dados.cpf_cnpj, somente_digitos(dados.cpf_cnpj), dados.telefone_cliente,
                 dados.email_cliente, dados.endereco_cliente, dados.bairro_cliente, dados.obs_cliente),
            )
    except sqlite3.IntegrityError:
        raise HTTPException(status.HTTP_409_CONFLICT, _CPF_DUPLICADO)
    return repo.cliente(_buscar(conn, cur.lastrowid))


@router.put("/{cliente_id}")
def atualizar(cliente_id: int, dados: ClienteEntrada, conn: sqlite3.Connection = Depends(get_db)):
    _buscar(conn, cliente_id)
    try:
        with conn:
            conn.execute(
                """UPDATE clientes SET nome_cliente = ?, cpf_cnpj = ?, cpf_cnpj_digitos = ?,
                       telefone_cliente = ?, email_cliente = ?, endereco_cliente = ?,
                       bairro_cliente = ?, obs_cliente = ?, atualizado_em = ?
                   WHERE id = ?""",
                (dados.nome_cliente, dados.cpf_cnpj, somente_digitos(dados.cpf_cnpj), dados.telefone_cliente,
                 dados.email_cliente, dados.endereco_cliente, dados.bairro_cliente, dados.obs_cliente,
                 agora_iso(), cliente_id),
            )
    except sqlite3.IntegrityError:
        raise HTTPException(status.HTTP_409_CONFLICT, _CPF_DUPLICADO)
    return repo.cliente(_buscar(conn, cliente_id))


@router.delete("/{cliente_id}", status_code=status.HTTP_204_NO_CONTENT)
def excluir(cliente_id: int, conn: sqlite3.Connection = Depends(get_db)):
    _buscar(conn, cliente_id)
    with conn:
        # Débitos e itens saem junto via ON DELETE CASCADE.
        conn.execute("DELETE FROM clientes WHERE id = ?", (cliente_id,))
    return Response(status_code=status.HTTP_204_NO_CONTENT)
