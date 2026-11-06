/* ============================================================
   Elogest Recebe Fácil — config.js

   apiUrl: null  → modo demonstração (dados no localStorage do navegador).
   apiUrl: '/api' → usa o backend real.

   Quando o sistema é aberto pelo backend (python -m uvicorn app.main:app),
   o próprio servidor responde este arquivo com apiUrl: '/api' — não é
   preciso editar nada. Só altere aqui se hospedar o frontend separado
   do backend (ex.: apiUrl: 'https://api.suaempresa.com.br/api').
   ============================================================ */

window.ELOGEST_CONFIG = window.ELOGEST_CONFIG || { apiUrl: null };
