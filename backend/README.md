# Elogest Recebe Fácil — Backend

API em **Python + FastAPI + SQLite** que substitui o "banco simulado" do
frontend (`../elogest-recebe-facil/js/store.js`). Ela usa os mesmos nomes de
campo e os mesmos formatos de resposta, então nenhuma tela precisou ser
reescrita.

O backend também **serve o frontend**. Abra `http://localhost:8000`: login,
telas e API ficam no mesmo endereço, sem configurar CORS.

## Como rodar (Windows / PowerShell)

```powershell
cd backend
python -m venv .venv
.venv\Scripts\python.exe -m pip install -r requirements-dev.txt

# cria o banco + usuário admin/123456 + dados de exemplo (pode rodar de novo; não duplica)
.venv\Scripts\python.exe -m app.seed --demo

# sobe o servidor em http://localhost:8000
.venv\Scripts\python.exe -m uvicorn app.main:app --port 8000
```

Documentação interativa da API: `http://localhost:8000/docs`.

Para criar um usuário de verdade ou trocar a senha dele:

```powershell
.venv\Scripts\python.exe -m app.seed --usuario maria --senha "UmaSenhaForte" --nome "Maria"
```

Para rodar os testes: `.venv\Scripts\python.exe -m pytest -q`

### Dois modos do frontend

| Como abre | Modo | Dados |
|---|---|---|
| `http://localhost:8000` (pelo backend) | **API** | banco SQLite em `backend/data/` |
| duplo clique no `index.html` | **Demonstração** | `localStorage` do navegador |

Quem decide o modo é o `js/config.js`. Quando a página vem do backend, o
próprio servidor responde esse arquivo com `apiUrl: '/api'`. Nos dois modos
as regras de validação são as mesmas.

## Endpoints

Todos, exceto o login, exigem `Authorization: Bearer <token>`.

| Método | Rota | Função no `ElogestStore` |
|---|---|---|
| POST | `/api/auth/login` | `Auth.login` → `{ mensagem, token, usuario }` |
| GET | `/api/auth/me` | — |
| GET | `/api/clientes` | `Clientes.listar` |
| GET | `/api/clientes/{id}` | `Clientes.buscar` |
| POST | `/api/clientes` | `Clientes.criar` |
| PUT | `/api/clientes/{id}` | `Clientes.atualizar` |
| DELETE | `/api/clientes/{id}` | `Clientes.excluir` (apaga débitos e itens junto) |
| GET | `/api/debitos?cliente_id=&status=` | `Debitos.listar({ clienteId, status })` |
| POST | `/api/debitos` | `Debitos.criar` (débito + `itens` numa transação) |
| PATCH | `/api/debitos/{id}/pagar` | `Debitos.marcarComoPago` |
| GET | `/api/debitos/{id}/itens` | `Itens.listarPorDebito` |
| PUT | `/api/debitos/{id}/itens` | `Itens.salvarItensDoDebito` |
| GET | `/api/itens?cliente_id=` | `Itens.listarPorCliente` |
| GET | `/api/itens/ranking?cliente_id=&mes=AAAA-MM` | `Itens.rankingProdutosCliente` / `rankingProdutosGeral` |
| GET | `/api/itens/gasto-total?cliente_id=` | `Itens.gastoTotalCliente` |
| GET | `/api/regioes/resumo` | `Regioes.resumo` |
| GET | `/api/dashboard/resumo` | `Dashboard.resumo` |

Todo erro volta como `{ "detail": "mensagem em português" }`, e as telas
mostram esse texto no toast. Os códigos usados são:

- `400`: validação
- `401`: sem login ou login expirado; a tela volta para o login
- `404`: não encontrado
- `409`: CPF/CNPJ duplicado ou débito já pago
- `429`: muitas tentativas de login

## Regras de negócio

- **Status do débito**: não é gravado; é calculado a cada consulta (`PAGO`,
  `ATRASADO` ou `PENDENTE`). O "hoje" usado no cálculo segue o fuso
  `America/Sao_Paulo`, e não o UTC.
- **Dinheiro**: é guardado em centavos, como número inteiro, e a API devolve
  em reais com 2 casas decimais.
- **Débito com itens**: o valor é sempre a soma dos itens válidos, isto é,
  com nome e quantidade maior que zero. O valor digitado é ignorado. Débito e
  itens são gravados numa transação só: ou grava tudo, ou nada.
- **Marcar como pago**: grava a data (`pago_em`) e quem deu a baixa
  (`pago_por`). Pagar duas vezes devolve `409`.
- **Cliente**: o CPF/CNPJ é validado com os dígitos verificadores e não pode se
  repetir. Telefone e documento são gravados já formatados.
- **Campos desconhecidos são recusados**. Assim, ninguém consegue criar um
  débito já como `PAGO` nem escolher o `id`.

## Segurança

- As senhas são guardadas com **scrypt** (hash com sal), nunca em texto puro.
- Login com **JWT** válido por 8 horas (`ELOGEST_TOKEN_HORAS`).
- Depois de 5 tentativas erradas em 15 minutos, o login é bloqueado por IP e
  usuário.
- Cabeçalhos de segurança: `nosniff`, `X-Frame-Options: DENY` e `no-store` na
  API.

Veja todas as variáveis de ambiente em `.env.example`.

### Antes de ir para produção

1. Defina `ELOGEST_JWT_SECRET` com um valor longo e aleatório.
2. **Troque ou apague o usuário `admin/123456`** (use `app.seed --usuario ...`).
3. Coloque o servidor atrás de HTTPS, com um proxy reverso como Nginx ou Caddy.
4. Faça backup de `data/elogest.db`. O SQLite atende bem uma loja; se crescer
   para vários usuários simultâneos pesados, migre para PostgreSQL.
5. O limite de tentativas de login fica na memória do processo. Com mais de um
   worker, troque por um armazenamento compartilhado, como o Redis.

## Estrutura

```
backend/
├── app/
│   ├── main.py         # app, tratamento de erros, serve o frontend
│   ├── config.py       # variáveis de ambiente
│   ├── db.py           # SQLite, schema, helpers de data e centavos
│   ├── security.py     # scrypt, JWT, limite de tentativas de login
│   ├── validacao.py    # CPF/CNPJ, telefone, e-mail
│   ├── schemas.py      # validação de entrada (Pydantic)
│   ├── repo.py         # linha do banco → JSON do frontend
│   ├── seed.py         # usuários e dados de demonstração
│   └── rotas/          # auth, clientes, debitos, relatorios
└── tests/test_api.py   # 16 testes da API
```
