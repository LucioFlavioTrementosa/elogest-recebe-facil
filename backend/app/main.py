"""Aplicação FastAPI: API em /api/* e o frontend estático servido na raiz."""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from fastapi.staticfiles import StaticFiles

from . import config, db
from .rotas import auth, clientes, debitos, relatorios

log = logging.getLogger("elogest")


@asynccontextmanager
async def ciclo_de_vida(_app: FastAPI):
    db.inicializar()
    conn = db.conectar()
    try:
        if conn.execute("SELECT COUNT(*) FROM usuarios").fetchone()[0] == 0:
            log.warning("Nenhum usuário cadastrado. Rode: python -m app.seed --demo  (ou --usuario/--senha/--nome)")
    finally:
        conn.close()
    yield


app = FastAPI(title="Elogest Recebe Fácil — API", version="1.0.0", lifespan=ciclo_de_vida)

if config.CORS_ORIGINS:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=config.CORS_ORIGINS,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
        allow_headers=["Authorization", "Content-Type"],
    )


@app.middleware("http")
async def cabecalhos_de_seguranca(request: Request, call_next):
    resposta = await call_next(request)
    resposta.headers.setdefault("X-Content-Type-Options", "nosniff")
    resposta.headers.setdefault("X-Frame-Options", "DENY")
    resposta.headers.setdefault("Referrer-Policy", "same-origin")
    if request.url.path.startswith("/api/"):
        resposta.headers.setdefault("Cache-Control", "no-store")
    return resposta


@app.exception_handler(RequestValidationError)
async def erro_de_validacao(_request: Request, exc: RequestValidationError):
    """Devolve 400 com UMA mensagem legível em `detail` (mesmo formato dos outros erros),
    mais a lista completa em `erros` para quem quiser mostrar por campo."""
    erros = []
    for e in exc.errors():
        campo = ".".join(str(p) for p in e.get("loc", []) if p not in ("body", "query", "path"))
        tipo = e.get("type")
        if tipo == "value_error":  # mensagens nossas, já em português
            msg = e.get("msg", "").removeprefix("Value error, ")
        elif tipo == "missing":
            msg = f"Campo obrigatório: {campo}."
        elif tipo == "extra_forbidden":
            msg = f"Campo não permitido: {campo}."
        else:  # mensagens padrão do Pydantic vêm em inglês
            msg = f"Valor inválido no campo {campo or 'informado'}."
        erros.append({"campo": campo, "mensagem": msg})
    return JSONResponse(status_code=400, content={"detail": erros[0]["mensagem"], "erros": erros})


app.include_router(auth.router)
app.include_router(clientes.router)
app.include_router(debitos.router)
app.include_router(relatorios.router)


@app.get("/api/saude", tags=["infra"])
def saude():
    return {"status": "ok"}


# Quando o frontend é servido por aqui, este config.js "vence" o arquivo estático
# e liga o modo API. Abrindo o index.html direto do disco, vale o js/config.js
# estático (modo demonstração com localStorage).
@app.get("/js/config.js", include_in_schema=False)
def config_frontend():
    return Response(
        "window.ELOGEST_CONFIG = { apiUrl: '/api' };\n",
        media_type="application/javascript",
        headers={"Cache-Control": "no-store"},
    )


if config.FRONTEND_DIR.is_dir():
    app.mount("/", StaticFiles(directory=config.FRONTEND_DIR, html=True), name="frontend")
else:
    log.warning("Pasta do frontend não encontrada em %s — servindo só a API.", config.FRONTEND_DIR)
