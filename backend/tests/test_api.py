from datetime import date, datetime, timedelta
from unittest.mock import patch

from app import db

CLIENTE_OK = {
    "nome_cliente": "Fulano de Tal",
    "cpf_cnpj": "52998224725",
    "telefone_cliente": "14999990000",
    "email_cliente": "Fulano@Email.com",
    "bairro_cliente": "Centro",
}


def _amanha():
    return (db.hoje() + timedelta(days=1)).isoformat()


# ---------------------------------------------------------------- auth
def test_login_ok_e_me(client):
    r = client.post("/api/auth/login", json={"usuario": "admin", "senha": "123456"})
    assert r.status_code == 200
    corpo = r.json()
    assert corpo["usuario"] == {"id": 1, "usuario": "admin", "nome": "Administrador"}
    me = client.get("/api/auth/me", headers={"Authorization": f"Bearer {corpo['token']}"})
    assert me.json()["usuario"] == "admin"


def test_login_invalido_e_limite_de_tentativas(client):
    for _ in range(5):
        assert client.post("/api/auth/login", json={"usuario": "admin", "senha": "errada"}).status_code == 401
    r = client.post("/api/auth/login", json={"usuario": "admin", "senha": "123456"})
    assert r.status_code == 429


def test_rotas_exigem_token(client):
    assert client.get("/api/clientes").status_code == 401
    assert client.get("/api/clientes", headers={"Authorization": "Bearer lixo"}).status_code == 401


def test_senha_nao_fica_em_texto_puro(client):
    conn = db.conectar()
    hash_ = conn.execute("SELECT senha_hash FROM usuarios WHERE usuario='admin'").fetchone()[0]
    conn.close()
    assert "123456" not in hash_ and hash_.startswith("scrypt$")


# ---------------------------------------------------------------- clientes
def test_crud_cliente(auth):
    r = auth.post("/api/clientes", json=CLIENTE_OK)
    assert r.status_code == 201, r.text
    c = r.json()
    assert c["cpf_cnpj"] == "529.982.247-25"
    assert c["telefone_cliente"] == "(14) 99999-0000"
    assert c["email_cliente"] == "fulano@email.com"

    r = auth.put(f"/api/clientes/{c['id']}", json={**CLIENTE_OK, "nome_cliente": "Fulano Editado"})
    assert r.json()["nome_cliente"] == "Fulano Editado"

    assert auth.delete(f"/api/clientes/{c['id']}").status_code == 204
    assert auth.get(f"/api/clientes/{c['id']}").status_code == 404


def test_cliente_cpf_invalido_e_duplicado(auth):
    r = auth.post("/api/clientes", json={**CLIENTE_OK, "cpf_cnpj": "111.222.333-44"})
    assert r.status_code == 400
    assert r.json()["detail"] == "Informe um CPF ou CNPJ válido."

    assert auth.post("/api/clientes", json=CLIENTE_OK).status_code == 201
    r = auth.post("/api/clientes", json={**CLIENTE_OK, "cpf_cnpj": "529.982.247-25"})
    assert r.status_code == 409


def test_cliente_nao_aceita_campos_extras(auth):
    r = auth.post("/api/clientes", json={**CLIENTE_OK, "id": 999})
    assert r.status_code == 400
    assert "id" in r.json()["detail"]


def test_excluir_cliente_remove_debitos_e_itens(auth):
    assert auth.delete("/api/clientes/1").status_code == 204
    assert auth.get("/api/debitos?cliente_id=1").json() == []
    assert auth.get("/api/itens?cliente_id=1").json() == []


# ---------------------------------------------------------------- débitos
def test_debito_com_itens_usa_soma_dos_itens_validos(auth):
    r = auth.post("/api/debitos", json={
        "cliente_id": 1,
        "valor_debito": 9999,  # ignorado: há itens
        "vencimento_debito": _amanha(),
        "descricao_debito": "Compra com carrinho",
        "itens": [
            {"produto_nome": "Arroz", "categoria": "", "quantidade": 2, "valor_unitario": 10.10},
            {"produto_nome": "", "quantidade": 5, "valor_unitario": 100},  # sem nome → descartado
        ],
    })
    assert r.status_code == 201, r.text
    d = r.json()
    assert d["valor_debito"] == 20.20
    assert d["status"] == "PENDENTE" and d["status_calculado"] == "PENDENTE"
    itens = auth.get(f"/api/debitos/{d['id']}/itens").json()
    assert len(itens) == 1 and itens[0]["categoria"] == "Geral"


def test_debito_sem_itens_e_validacoes(auth):
    base = {"cliente_id": 1, "vencimento_debito": _amanha(), "descricao_debito": "Avulso"}
    assert auth.post("/api/debitos", json={**base, "valor_debito": 0}).status_code == 400
    assert auth.post("/api/debitos", json={**base, "valor_debito": 10, "cliente_id": 999}).status_code == 400
    assert auth.post("/api/debitos", json={**base, "valor_debito": 10, "status": "PAGO"}).status_code == 400
    r = auth.post("/api/debitos", json={**base, "valor_debito": 10,
                                         "criacao_debito": _amanha(), "vencimento_debito": db.hoje_iso()})
    assert r.status_code == 400
    neg = {**base, "itens": [{"produto_nome": "X", "quantidade": 1, "valor_unitario": -5}]}
    assert auth.post("/api/debitos", json=neg).status_code == 400
    assert auth.post("/api/debitos", json={**base, "valor_debito": 10.5}).json()["valor_debito"] == 10.5


def test_marcar_como_pago_uma_vez(auth):
    r = auth.patch("/api/debitos/1/pagar")
    assert r.status_code == 200
    assert r.json()["status_calculado"] == "PAGO" and r.json()["pago_em"]
    assert auth.patch("/api/debitos/1/pagar").status_code == 409
    assert auth.patch("/api/debitos/9999/pagar").status_code == 404


def test_status_usa_fuso_de_sao_paulo(auth):
    """Às 22h de São Paulo (01h UTC do dia seguinte) um débito que vence hoje ainda é PENDENTE."""
    from app import config
    noite = datetime(2026, 3, 10, 22, 0, tzinfo=config.TIMEZONE)
    with patch("app.db.datetime") as dt:
        dt.now.side_effect = lambda tz=None: noite.astimezone(tz) if tz else noite
        assert db.hoje() == date(2026, 3, 10)


def test_filtro_por_status(auth):
    atrasados = auth.get("/api/debitos?status=ATRASADO").json()
    assert atrasados and all(d["status_calculado"] == "ATRASADO" for d in atrasados)


# ---------------------------------------------------------------- relatórios
def test_dashboard_bate_com_lista(auth):
    resumo = auth.get("/api/dashboard/resumo").json()
    debitos = auth.get("/api/debitos").json()
    pago = round(sum(d["valor_debito"] for d in debitos if d["status_calculado"] == "PAGO"), 2)
    assert resumo["valor_pago"] == pago
    assert resumo["total_clientes"] == 6
    assert resumo["total_atrasados"] == sum(d["status_calculado"] == "ATRASADO" for d in debitos)


def test_regioes_e_ranking(auth):
    regioes = auth.get("/api/regioes/resumo").json()
    assert regioes[0]["bairro"] == "Centro"
    assert sum(r["total_clientes"] for r in regioes) == 6

    ranking = auth.get("/api/itens/ranking?cliente_id=1").json()
    assert ranking[0]["produto_nome"] == "Arroz 5kg"
    assert auth.get("/api/itens/ranking?mes=2026-13").status_code == 400
    assert auth.get("/api/itens/gasto-total?cliente_id=1").json()["gasto_total"] == 273.30


def test_frontend_servido_com_config_da_api(client):
    r = client.get("/js/config.js")
    assert "apiUrl: '/api'" in r.text
    assert client.get("/").status_code == 200
