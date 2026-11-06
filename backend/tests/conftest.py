import os
import sys
import tempfile
from pathlib import Path

import pytest

# Base isolada por sessão de testes — configurada ANTES de importar o app.
_tmp = tempfile.mkdtemp(prefix="elogest-test-")
os.environ["ELOGEST_DATA_DIR"] = _tmp
os.environ["ELOGEST_JWT_SECRET"] = "segredo-de-teste-com-tamanho-suficiente-para-hs256"
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from fastapi.testclient import TestClient  # noqa: E402

from app import config, db, seed  # noqa: E402
from app.main import app  # noqa: E402
from app.security import limitador_login  # noqa: E402


@pytest.fixture()
def client():
    if config.DB_PATH.exists():
        config.DB_PATH.unlink()
    db.inicializar()
    conn = db.conectar()
    with conn:
        seed.semear_demo(conn)
    conn.close()
    limitador_login._falhas.clear()
    with TestClient(app) as c:
        yield c


@pytest.fixture()
def auth(client):
    r = client.post("/api/auth/login", json={"usuario": "admin", "senha": "123456"})
    assert r.status_code == 200, r.text
    client.headers["Authorization"] = f"Bearer {r.json()['token']}"
    return client
