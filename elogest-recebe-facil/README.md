# Elogest Recebe Fácil — Frontend (protótipo visual)

Protótipo **100% frontend** (HTML + CSS + JavaScript puro, sem framework
e sem build step) do sistema de cobranças e contas a receber, com a
nova identidade visual **Elogest**.

O backend real fica em `../backend` (Python + FastAPI + SQLite). Veja o
`README.md` de lá. O frontend funciona de dois jeitos:

| Como abrir | Modo | Onde ficam os dados |
|---|---|---|
| Rodando o backend e acessando `http://localhost:8000` | **API** | banco SQLite do servidor |
| Duplo clique no `index.html` | **Demonstração** | `localStorage` deste navegador |

Quem escolhe o modo é o `js/config.js`: o backend responde esse arquivo com
`apiUrl: '/api'`, e o arquivo estático tem `apiUrl: null`.

**Login de demonstração:** usuário `admin`, senha `123456`.

## O que está pronto

- Login com sessão simulada (guarda de rota: páginas internas
  redirecionam para o login se não houver sessão ativa).
- Dashboard com cards de métricas, gráfico de distribuição por status
  (pendente/vencido/recebido) e tabelas de cobranças vencidas / próximos
  vencimentos.
- Listagem de clientes com busca, valor devido calculado a partir dos
  débitos, edição e exclusão (com modal de confirmação).
- Cadastro e edição de cliente com máscaras de CPF/CNPJ e telefone,
  validação em tempo real e contador de caracteres nas observações.
- Registro de débito vinculado a um cliente, com máscara de valor
  monetário.
- Contas a Receber com filtros por status, resumo financeiro,
  "marcar como pago" e botão "Cobrar" que monta o link do WhatsApp
  (`wa.me`) com mensagem pré-formatada.
- Toasts e modal de confirmação customizados no lugar de
  `alert()`/`confirm()`.
- Estados de carregamento (skeleton) e vazios (empty state) ilustrados.
- Layout responsivo (sidebar recolhível em mobile).
- **Mini CRM por cliente** (`cliente-detalhes.html`): perfil do cliente com
  gasto total, recebido, em aberto, ticket médio, ranking de produtos mais
  comprados (geral e no mês) e histórico completo de débitos. Acessível
  clicando no nome do cliente em `clientes.html`.
- **Relatório por região** (`regioes.html`): região que mais gasta em
  destaque, gráfico de barras das top 5 regiões, produtos mais vendidos no
  geral e tabela completa por bairro (clientes, total gasto, recebido, em
  aberto, ticket médio).
- No cadastro/edição de cliente, campo opcional "Bairro / Região".
- No registro de débito, carrinho opcional de itens da compra (produto,
  categoria, quantidade, valor unitário) — quando preenchido, o valor do
  débito é calculado automaticamente e os itens alimentam o CRM e o
  relatório de regiões. Sem itens, o débito funciona como antes.

## Identidade visual

Paleta extraída de `../id nova/codigos hexadecimais.webp` e aplicada em
`css/style.css` (seção 1 — Variáveis):

| Cor | Hex | Uso |
|---|---|---|
| Ciano | `#00B8E1` | Links, foco, destaques |
| Ciano médio (derivado) | `#0093B4` | Botões, hover |
| Azul-marinho | `#004168` | Sidebar, títulos, botões |
| Verde | `#009D4F` / `#00BD67` | Status "pago", sucesso |

Logo e ícone (`../id nova/logo-elogest.webp` e `icon-elogest.webp`)
copiados para `assets/`.

## Estrutura

```
elogest-frontend/
├── assets/              # logo e ícone da marca
├── css/style.css        # todo o CSS do sistema
├── js/
│   ├── config.js        # escolhe o modo (demonstração ou API)
│   ├── store.js         # "banco de dados" simulado (localStorage) — modo demonstração
│   ├── store-api.js     # mesma interface do store.js, via fetch() — modo API
│   ├── format.js        # formatação e máscaras de input
│   ├── auth.js           # sessão simulada + guarda de rota
│   ├── ui.js             # layout (sidebar/header), toasts, modal
│   ├── whatsapp.js       # geração do link de cobrança
│   ├── cliente-validacao.js  # validação compartilhada dos formulários de cliente
│   └── <pagina>.js        # lógica específica de cada página
├── index.html            # login (ponto de entrada)
├── dashboard.html
├── clientes.html
├── cliente-detalhes.html # perfil do cliente / mini CRM
├── cadastro-cliente.html
├── editar-cliente.html
├── registro-debito.html
├── contas-receber.html
└── regioes.html          # relatório por região/bairro
```

## Integração com o backend

Toda a "API" fica em `window.ElogestStore`, com duas implementações de mesma
interface:

- `js/store.js` grava no `localStorage`;
- `js/store-api.js` chama o backend via `fetch()`, envia o token JWT e, se
  receber `401`, volta para a tela de login.

As páginas só chamam `ElogestStore.*` com `await` e mostram no toast a
mensagem de erro do servidor, usando `ElogestUI.mensagemErro`. As regras de
validação são as mesmas nos dois modos:

- CPF/CNPJ com dígito verificador, sem duplicados;
- valor maior que zero;
- vencimento não anterior à data de criação;
- débito com itens vale a soma dos itens válidos, gravados numa operação só.
