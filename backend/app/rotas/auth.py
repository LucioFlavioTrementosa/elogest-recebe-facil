import sqlite3

from fastapi import APIRouter, Depends, HTTPException, Request, status

from ..db import get_db
from ..schemas import LoginEntrada
from ..security import criar_token, limitador_login, usuario_atual, verificar_senha_ou_falso

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login")
def login(dados: LoginEntrada, request: Request, conn: sqlite3.Connection = Depends(get_db)):
    ip = request.client.host if request.client else "?"
    if limitador_login.bloqueado(ip, dados.usuario):
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS,
            "Muitas tentativas de login. Aguarde alguns minutos e tente novamente.",
        )

    row = conn.execute(
        "SELECT id, usuario, nome, senha_hash FROM usuarios WHERE usuario = ?", (dados.usuario,)
    ).fetchone()
    if not verificar_senha_ou_falso(dados.senha, row["senha_hash"] if row else None):
        limitador_login.registrar_falha(ip, dados.usuario)
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Usuário ou senha inválidos.")

    limitador_login.limpar(ip, dados.usuario)
    return {
        "mensagem": "Login efetuado com sucesso.",
        "token": criar_token(row["id"]),
        "usuario": {"id": row["id"], "usuario": row["usuario"], "nome": row["nome"]},
    }


@router.get("/me")
def me(usuario: sqlite3.Row = Depends(usuario_atual)):
    return {"id": usuario["id"], "usuario": usuario["usuario"], "nome": usuario["nome"]}
