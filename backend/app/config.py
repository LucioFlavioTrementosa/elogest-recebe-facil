"""Configuração lida de variáveis de ambiente (com padrões seguros para desenvolvimento)."""

import os
import secrets
from pathlib import Path
from zoneinfo import ZoneInfo

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = Path(os.getenv("ELOGEST_DATA_DIR", BASE_DIR / "data"))
DATA_DIR.mkdir(parents=True, exist_ok=True)

DB_PATH = Path(os.getenv("ELOGEST_DB", DATA_DIR / "elogest.db"))

# Pasta do frontend servida pelo próprio backend (mesma origem → sem CORS).
FRONTEND_DIR = Path(os.getenv("ELOGEST_FRONTEND_DIR", BASE_DIR.parent / "elogest-recebe-facil"))

# Fuso usado para decidir o que é "hoje" (débito vencido x pendente).
TIMEZONE = ZoneInfo(os.getenv("ELOGEST_TZ", "America/Sao_Paulo"))

TOKEN_EXPIRA_HORAS = int(os.getenv("ELOGEST_TOKEN_HORAS", "8"))

# Origens extras liberadas no CORS (ex.: "http://localhost:5500"), separadas por vírgula.
CORS_ORIGINS = [o.strip() for o in os.getenv("ELOGEST_CORS_ORIGINS", "").split(",") if o.strip()]

LOGIN_MAX_TENTATIVAS = int(os.getenv("ELOGEST_LOGIN_MAX_TENTATIVAS", "5"))
LOGIN_JANELA_SEGUNDOS = int(os.getenv("ELOGEST_LOGIN_JANELA_SEGUNDOS", "900"))


def _carregar_segredo_jwt() -> str:
    """Usa ELOGEST_JWT_SECRET; sem ela, gera um segredo e o persiste em data/.jwt_secret
    para que os tokens sobrevivam a reinícios do servidor."""
    do_ambiente = os.getenv("ELOGEST_JWT_SECRET")
    if do_ambiente:
        return do_ambiente
    arquivo = DATA_DIR / ".jwt_secret"
    if arquivo.exists():
        return arquivo.read_text(encoding="utf-8").strip()
    segredo = secrets.token_urlsafe(48)
    arquivo.write_text(segredo, encoding="utf-8")
    return segredo


JWT_SECRET = _carregar_segredo_jwt()
JWT_ALGORITMO = "HS256"
