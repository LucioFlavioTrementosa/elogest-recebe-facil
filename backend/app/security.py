"""Hash de senha (scrypt), tokens JWT e limite de tentativas de login."""

import base64
import hashlib
import hmac
import secrets
import sqlite3
import threading
import time
from collections import defaultdict, deque
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from . import config
from .db import get_db

# ---------------------------------------------------------------- senhas
_SCRYPT_N, _SCRYPT_R, _SCRYPT_P = 2**14, 8, 1


def gerar_hash_senha(senha: str) -> str:
    sal = secrets.token_bytes(16)
    chave = hashlib.scrypt(senha.encode(), salt=sal, n=_SCRYPT_N, r=_SCRYPT_R, p=_SCRYPT_P)
    b64 = lambda b: base64.b64encode(b).decode()  # noqa: E731
    return f"scrypt${_SCRYPT_N}${_SCRYPT_R}${_SCRYPT_P}${b64(sal)}${b64(chave)}"


def verificar_senha(senha: str, armazenado: str) -> bool:
    try:
        _, n, r, p, sal, chave = armazenado.split("$")
        calculada = hashlib.scrypt(
            senha.encode(), salt=base64.b64decode(sal), n=int(n), r=int(r), p=int(p)
        )
        return hmac.compare_digest(calculada, base64.b64decode(chave))
    except (ValueError, TypeError):
        return False


# Hash fixo usado quando o usuário não existe, para o tempo de resposta não
# revelar quais nomes de usuário são válidos.
_HASH_FALSO = gerar_hash_senha(secrets.token_hex(8))


def verificar_senha_ou_falso(senha: str, armazenado: str | None) -> bool:
    if armazenado is None:
        verificar_senha(senha, _HASH_FALSO)
        return False
    return verificar_senha(senha, armazenado)


# ---------------------------------------------------------------- tokens
def criar_token(usuario_id: int) -> str:
    agora = datetime.now(timezone.utc)
    payload = {
        "sub": str(usuario_id),
        "iat": agora,
        "exp": agora + timedelta(hours=config.TOKEN_EXPIRA_HORAS),
    }
    return jwt.encode(payload, config.JWT_SECRET, algorithm=config.JWT_ALGORITMO)


_bearer = HTTPBearer(auto_error=False)


def usuario_atual(
    cred: HTTPAuthorizationCredentials | None = Depends(_bearer),
    conn: sqlite3.Connection = Depends(get_db),
) -> sqlite3.Row:
    nao_autorizado = HTTPException(
        status.HTTP_401_UNAUTHORIZED,
        "Sessão expirada ou inválida. Faça login novamente.",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if cred is None:
        raise nao_autorizado
    try:
        payload = jwt.decode(cred.credentials, config.JWT_SECRET, algorithms=[config.JWT_ALGORITMO])
        usuario_id = int(payload["sub"])
    except (jwt.PyJWTError, KeyError, ValueError):
        raise nao_autorizado
    usuario = conn.execute("SELECT id, usuario, nome FROM usuarios WHERE id = ?", (usuario_id,)).fetchone()
    if usuario is None:
        raise nao_autorizado
    return usuario


# ---------------------------------------------------------------- limite de login
class LimitadorLogin:
    """Janela deslizante em memória por (IP, usuário). Suficiente para um único
    processo; com vários workers, troque por Redis ou similar."""

    def __init__(self, maximo: int, janela_segundos: int):
        self.maximo = maximo
        self.janela = janela_segundos
        self._falhas: dict[tuple[str, str], deque[float]] = defaultdict(deque)
        self._lock = threading.Lock()

    def _limpar(self, chave, agora):
        fila = self._falhas[chave]
        while fila and agora - fila[0] > self.janela:
            fila.popleft()
        return fila

    def bloqueado(self, ip: str, usuario: str) -> bool:
        with self._lock:
            return len(self._limpar((ip, usuario.lower()), time.monotonic())) >= self.maximo

    def registrar_falha(self, ip: str, usuario: str) -> None:
        with self._lock:
            agora = time.monotonic()
            self._limpar((ip, usuario.lower()), agora).append(agora)

    def limpar(self, ip: str, usuario: str) -> None:
        with self._lock:
            self._falhas.pop((ip, usuario.lower()), None)


limitador_login = LimitadorLogin(config.LOGIN_MAX_TENTATIVAS, config.LOGIN_JANELA_SEGUNDOS)
