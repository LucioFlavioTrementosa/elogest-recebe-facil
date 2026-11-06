"""Acesso ao SQLite: conexão por requisição, schema e helpers de data/dinheiro.

Dinheiro é sempre guardado em CENTAVOS (INTEGER) para não acumular erro de
ponto flutuante; a API converte para reais (float com 2 casas) na borda.
"""

import sqlite3
from datetime import date, datetime
from decimal import ROUND_HALF_UP, Decimal
from pathlib import Path

from . import config

SCHEMA = """
CREATE TABLE IF NOT EXISTS usuarios (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario     TEXT    NOT NULL UNIQUE COLLATE NOCASE,
    senha_hash  TEXT    NOT NULL,
    nome        TEXT    NOT NULL,
    criado_em   TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS clientes (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    nome_cliente      TEXT NOT NULL,
    cpf_cnpj          TEXT NOT NULL,
    cpf_cnpj_digitos  TEXT NOT NULL UNIQUE,
    telefone_cliente  TEXT NOT NULL,
    email_cliente     TEXT NOT NULL DEFAULT '',
    endereco_cliente  TEXT NOT NULL DEFAULT '',
    bairro_cliente    TEXT NOT NULL DEFAULT '',
    obs_cliente       TEXT NOT NULL DEFAULT '',
    criado_em         TEXT NOT NULL DEFAULT (datetime('now')),
    atualizado_em     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS debitos (
    id                 INTEGER PRIMARY KEY AUTOINCREMENT,
    cliente_id         INTEGER NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
    valor_centavos     INTEGER NOT NULL CHECK (valor_centavos > 0),
    criacao_debito     TEXT    NOT NULL,
    vencimento_debito  TEXT    NOT NULL,
    descricao_debito   TEXT    NOT NULL,
    status             TEXT    NOT NULL DEFAULT 'PENDENTE' CHECK (status IN ('PENDENTE', 'PAGO')),
    pago_em            TEXT,
    pago_por           INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    criado_por         INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    criado_em          TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_debitos_cliente ON debitos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_debitos_vencimento ON debitos(vencimento_debito);

CREATE TABLE IF NOT EXISTS itens_compra (
    id                       INTEGER PRIMARY KEY AUTOINCREMENT,
    debito_id                INTEGER NOT NULL REFERENCES debitos(id) ON DELETE CASCADE,
    cliente_id               INTEGER NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
    produto_nome             TEXT    NOT NULL,
    categoria                TEXT    NOT NULL DEFAULT 'Geral',
    quantidade               REAL    NOT NULL CHECK (quantidade > 0),
    valor_unitario_centavos  INTEGER NOT NULL CHECK (valor_unitario_centavos >= 0),
    data                     TEXT    NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_itens_debito ON itens_compra(debito_id);
CREATE INDEX IF NOT EXISTS idx_itens_cliente ON itens_compra(cliente_id);
"""


def conectar(caminho: Path | str | None = None) -> sqlite3.Connection:
    conn = sqlite3.connect(caminho or config.DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA busy_timeout = 5000")
    return conn


def inicializar(caminho: Path | str | None = None) -> None:
    conn = conectar(caminho)
    try:
        conn.execute("PRAGMA journal_mode = WAL")
        conn.executescript(SCHEMA)
        conn.commit()
    finally:
        conn.close()


def get_db():
    """Dependência FastAPI: uma conexão por requisição, fechada ao final."""
    conn = conectar()
    try:
        yield conn
    finally:
        conn.close()


def hoje() -> date:
    """Data de hoje no fuso configurado (não em UTC)."""
    return datetime.now(config.TIMEZONE).date()


def hoje_iso() -> str:
    return hoje().isoformat()


def agora_iso() -> str:
    return datetime.now(config.TIMEZONE).isoformat(timespec="seconds")


def arredondar(valor: Decimal | float) -> int:
    """Arredondamento comercial (meio para cima), sem o viés do round() de float."""
    return int(Decimal(str(valor)).quantize(Decimal("1"), rounding=ROUND_HALF_UP))


def para_centavos(valor: float) -> int:
    return arredondar(Decimal(str(valor)) * 100)


def subtotal_centavos(quantidade: float, valor_unitario_centavos: int) -> int:
    return arredondar(Decimal(str(quantidade)) * valor_unitario_centavos)


def para_reais(centavos: int | None) -> float:
    return round((centavos or 0) / 100, 2)
