"""Criação de usuários e dados de demonstração.

    python -m app.seed --demo                                   # admin/123456 + clientes/débitos de exemplo
    python -m app.seed --usuario joao --senha "S3nh@Forte" --nome "João"   # cria ou troca a senha de um usuário

Os dados de exemplo só são inseridos se a base ainda não tiver clientes —
rodar de novo nunca apaga nem duplica nada.
"""

import argparse
import sys
from datetime import timedelta

from . import db
from .db import hoje, para_centavos
from .security import gerar_hash_senha
from .validacao import somente_digitos

CLIENTES = [
    ("Maria Aparecida Souza", "111.222.333-96", "(14) 99123-4567", "maria.souza@email.com", "Rua das Flores, 123 - Centro - Jaú/SP", "Cliente frequente. Compras semanais às segundas-feiras.", "Centro"),
    ("João Pedro Lima", "222.333.444-05", "(14) 99234-5678", "joaopedro.lima@email.com", "Av. Brasil, 890 - Vila Alta - Jaú/SP", "", "Vila Alta"),
    ("Mercado Bom Preço LTDA", "12.345.678/0001-95", "(14) 99345-6789", "financeiro@bompreco.com", "Rua Sete de Setembro, 45 - Centro - Jaú/SP", "Cliente PJ — compra em atacado mensalmente.", "Centro"),
    ("Ana Beatriz Ferreira", "333.444.555-08", "(14) 99456-7890", "", "Rua XV de Novembro, 210 - Jaú/SP", "", "Jardim Europa"),
    ("Padaria Pão Dourado", "98.765.432/0001-98", "(14) 99567-8901", "contato@paodourado.com", "Rua dos Ipês, 78 - Jardim Europa - Jaú/SP", "Pedido recorrente de farinha e açúcar.", "Jardim Europa"),
    ("Carlos Eduardo Martins", "444.555.666-19", "(14) 99678-9012", "cadu.martins@email.com", "Rua Amazonas, 55 - Jaú/SP", "Costuma atrasar pagamentos — atenção redobrada.", "Vila Alta"),
]

# (índice do cliente, valor, dias criação, dias vencimento, descrição, pago?)
DEBITOS = [
    (0, 348.90, -40, -12, "Compra de arroz, feijão e óleo — Nota fiscal 10245", False),
    (1, 129.50, -20, -3, "Compra de produtos de limpeza — Nota fiscal 10312", False),
    (2, 2450.00, -35, -8, "Pedido em atacado — massas e enlatados — NF 10298", False),
    (5, 87.30, -50, -25, "Compra avulsa — bebidas — Nota fiscal 10180", False),
    (0, 156.00, -5, 9, "Compra de café e biscoitos — Nota fiscal 10401", False),
    (3, 412.75, -2, 15, "Compra mensal de secos e molhados — NF 10410", False),
    (4, 980.20, -1, 20, "Farinha de trigo (50kg) e açúcar (30kg) — NF 10415", False),
    (1, 235.00, -3, 6, "Compra de higiene pessoal — Nota fiscal 10408", False),
    (2, 1780.40, -70, -40, "Pedido em atacado — bebidas — NF 09980", True),
    (4, 540.00, -60, -30, "Fermento e óleo de soja — Nota fiscal 10050", True),
    (5, 65.90, -90, -60, "Compra avulsa — Nota fiscal 09850", True),
    (3, 310.00, -15, -1, "Compra de temperos e enlatados — Nota fiscal 10350", False),
]

# (índice do débito, produto, categoria, quantidade, valor unitário)
ITENS = [
    (0, "Arroz 5kg", "Mercearia", 4, 28.90), (0, "Feijão 1kg", "Mercearia", 6, 8.50),
    (0, "Óleo de Soja 900ml", "Mercearia", 4, 7.10), (4, "Café 500g", "Mercearia", 3, 14.90),
    (4, "Biscoito Recheado", "Mercearia", 8, 4.20), (2, "Massa 500g", "Mercearia", 40, 4.35),
    (2, "Molho de Tomate", "Enlatados", 30, 3.90), (2, "Milho Enlatado", "Enlatados", 25, 4.60),
    (8, "Refrigerante 2L", "Bebidas", 60, 7.80), (6, "Farinha de Trigo 50kg", "Mercearia", 1, 210.00),
    (6, "Açúcar 30kg", "Mercearia", 1, 145.00), (9, "Fermento Biológico", "Mercearia", 20, 3.20),
    (9, "Óleo de Soja 900ml", "Mercearia", 15, 7.10), (5, "Molho de Tomate", "Enlatados", 12, 3.90),
    (5, "Milho Enlatado", "Enlatados", 10, 4.60),
]


def salvar_usuario(conn, usuario: str, senha: str, nome: str) -> None:
    conn.execute(
        """INSERT INTO usuarios (usuario, senha_hash, nome) VALUES (?, ?, ?)
           ON CONFLICT(usuario) DO UPDATE SET senha_hash = excluded.senha_hash, nome = excluded.nome""",
        (usuario, gerar_hash_senha(senha), nome),
    )


def semear_demo(conn) -> bool:
    if conn.execute("SELECT 1 FROM usuarios WHERE usuario = 'admin'").fetchone() is None:
        salvar_usuario(conn, "admin", "123456", "Administrador")
    if conn.execute("SELECT COUNT(*) FROM clientes").fetchone()[0] > 0:
        return False

    base = hoje()
    dia = lambda n: (base + timedelta(days=n)).isoformat()  # noqa: E731

    ids_clientes = []
    for nome, doc, tel, email, end, obs, bairro in CLIENTES:
        cur = conn.execute(
            """INSERT INTO clientes (nome_cliente, cpf_cnpj, cpf_cnpj_digitos, telefone_cliente,
                   email_cliente, endereco_cliente, obs_cliente, bairro_cliente)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (nome, doc, somente_digitos(doc), tel, email, end, obs, bairro),
        )
        ids_clientes.append(cur.lastrowid)

    debitos = []
    for idx_cli, valor, d_criacao, d_venc, desc, pago in DEBITOS:
        cur = conn.execute(
            """INSERT INTO debitos (cliente_id, valor_centavos, criacao_debito, vencimento_debito,
                   descricao_debito, status, pago_em)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (ids_clientes[idx_cli], para_centavos(valor), dia(d_criacao), dia(d_venc), desc,
             "PAGO" if pago else "PENDENTE", dia(d_venc) if pago else None),
        )
        debitos.append((cur.lastrowid, ids_clientes[idx_cli], dia(d_criacao)))

    for idx_deb, produto, categoria, qtd, unit in ITENS:
        debito_id, cliente_id, data = debitos[idx_deb]
        conn.execute(
            """INSERT INTO itens_compra (debito_id, cliente_id, produto_nome, categoria,
                   quantidade, valor_unitario_centavos, data)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (debito_id, cliente_id, produto, categoria, qtd, para_centavos(unit), data),
        )
    return True


def main(argv=None) -> int:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--demo", action="store_true", help="cria admin/123456 e dados de exemplo")
    p.add_argument("--usuario")
    p.add_argument("--senha")
    p.add_argument("--nome")
    args = p.parse_args(argv)

    if not args.demo and not args.usuario:
        p.print_help()
        return 1
    if args.usuario and (not args.senha or len(args.senha) < 8):
        print("Informe --senha com pelo menos 8 caracteres.", file=sys.stderr)
        return 1

    db.inicializar()
    conn = db.conectar()
    try:
        with conn:
            if args.demo:
                criou = semear_demo(conn)
                print("Dados de demonstração criados." if criou else "Base já tinha clientes — dados de exemplo não inseridos.")
                print("Login de demonstração: admin / 123456 (troque em produção!)")
            if args.usuario:
                salvar_usuario(conn, args.usuario, args.senha, args.nome or args.usuario)
                print(f"Usuário '{args.usuario}' salvo.")
    finally:
        conn.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
