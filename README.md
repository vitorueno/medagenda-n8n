# Essentia Technologies — Atendimento Médico Automatizado

Case técnico de automação com IA e N8N. Este README cobre a API REST; a
orquestração N8N, integrações (Gmail, STT/TTS) e o restante dos entregáveis
são adicionados em um plano seguinte.

## Arquitetura

Veja `docs/superpowers/specs/2026-09-16-atendimento-medico-essentia-design.md`
para o design completo. Resumo: API TypeScript + Fastify + Zod + SQLite
(camadas rota → controller → service → repository), N8N como orquestrador de
IA consumindo esta API via HTTP com header `x-api-key`.

## Pré-requisitos

- Node.js 20+
- Docker e Docker Compose (opcional, para rodar containerizado)

## Configuração

1. Copie `.env.example` para `.env`.
2. Defina um `API_KEY` com pelo menos 16 caracteres.

## Rodando localmente

```bash
npm install
npm run seed   # cria e popula ./data/dev.db
npm run dev    # sobe a API em http://localhost:3000
```

**Nota:** se você editar `src/db/seed.ts` ou `src/db/run-seed.ts` localmente após já ter executado `npm run build` uma vez, `npm run seed` executará silenciosamente a versão compilada desatualizada em `dist/` até que você rode `npm run build` novamente.

## Rodando via Docker Compose

```bash
docker compose build
docker compose up -d
docker compose run --rm api npm run seed
```

A API expõe `/health` (sem autenticação) e a documentação Swagger em
`/docs`. Todas as demais rotas exigem o header `x-api-key`.

## Testes

```bash
npm test
```

Os testes usam um banco SQLite em memória, isolado por teste, e não tocam
`./data/dev.db`.

## Lint e formatação

```bash
npm run lint
npm run format
```

O hook de pre-commit (Husky + lint-staged) bloqueia o commit se o lint, a
formatação ou os testes falharem.

## Coleção Postman

Importe `postman/essentia-api.postman_collection.json` no Postman, ajuste a
variável `apiKey` para o valor configurado no seu `.env`, e execute as
requisições na ordem em que aparecem na coleção.

## Endpoints

| Método | Rota                                       | Descrição                              |
| ------ | ------------------------------------------ | -------------------------------------- |
| GET    | `/patients/lookup?email=` ou `?phone=`     | Identifica um paciente                 |
| GET    | `/doctors`                                 | Lista médicos                          |
| GET    | `/availability?date=&specialty=&doctorId=` | Lista horários disponíveis             |
| POST   | `/appointments`                            | Cria um agendamento                    |
| GET    | `/appointments/:id`                        | Consulta um agendamento                |
| POST   | `/appointments/:id/cancel`                 | Cancela um agendamento                 |
| GET    | `/payments?consultationType=`              | Consulta valores e formas de pagamento |

## Limitações conhecidas

Ver seção "Limitações assumidas" no spec de design.
