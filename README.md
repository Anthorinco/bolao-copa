# Bolão Copa 2026

Web app simples de bolão para a fase de grupos da Copa do Mundo de 2026.
Permite cadastrar até 6 participantes, salvar palpites por jogo e montar o
ranking com 1 ponto por placar exato.

## Resultados

Na tela do bolão, clique em **Buscar resultados oficiais** para atualizar os
placares finalizados pela FIFA e recalcular o ranking.

Para atualizar pelo terminal, use:

```bash
npm run update:results
```

O script grava apenas jogos finalizados em `src/data/fifa-results.json`. O
formato gerado é:

```json
{
  "rounds": [
    {
      "name": "Fase de grupos",
      "matches": [
        {
          "date": "2026-06-11",
          "team1": "México",
          "team2": "África do Sul",
          "score1": 2,
          "score2": 0
        }
      ]
    }
  ]
}
```

O app também aceita `matches` na raiz e seleções como objeto com `name`. O
identificador usado é
`YYYY-MM-DD-time-da-casa-time-visitante`, gerado a partir da data e dos nomes.

## Como rodar

1. Instale as dependências:

```bash
npm install
```

2. Crie `.env` a partir de `.env.example` e preencha `DATABASE_URL` com a URL
Postgres do Neon, Supabase ou outro banco compatível:

```bash
DATABASE_URL="postgresql://USER:PASSWORD@HOST/DATABASE?sslmode=require"
```

3. Crie as tabelas no banco:

```bash
npx prisma db push
```

4. Rode o app:

```bash
npm run dev
```

Abra `http://localhost:3000`.

## Comandos úteis

```bash
npm run lint
npx prisma validate
```
