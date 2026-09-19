# Assistente de Agendamento Médico

Case técnico para a vaga de Especialista em Automações com IA e N8N.

## Sobre

Um atendimento médico automatizado por chat: o paciente conversa em linguagem
natural (texto ou áudio) e consegue consultar horários, agendar, cancelar e
perguntar sobre valores, recebendo a confirmação por e-mail.

São duas peças com responsabilidades separadas:

- **API REST** (TypeScript + Fastify + Zod + SQLite): a fonte da verdade.
  Conhece pacientes, médicos, horários, agendamentos e preços, e é quem decide
  se uma ação é válida.
- **Workflow N8N**: a orquestração. Recebe a mensagem do paciente, transcreve
  se vier em áudio, modera o conteúdo e entrega a um **AI Agent** que decide,
  via function calling, qual endpoint da API chamar.

```
Paciente
  → Chat Trigger (texto ou áudio)
  → [áudio] transcrição (Whisper)
  → moderação de conteúdo
  → AI Agent (gpt-4o-mini + memória por sessão + 5 tools HTTP)
        └→ tool call → API (header x-api-key) → rota → Zod → service → repository → SQLite
  → resposta em texto, ou em áudio (TTS) se a pergunta veio em áudio
  → em paralelo, ao agendar/cancelar: e-mail de confirmação (Gmail, ou Mailpit)
```

O princípio que organiza tudo: **o N8N nunca é fonte da verdade**. O modelo
escolhe _qual_ ação tomar e extrai os parâmetros; a API valida e executa. Nada
que o paciente vê sobre disponibilidade, preço ou agendamento vem do modelo.
Vem sempre de uma chamada real à API.

## Começando

Pré-requisitos: Docker e Docker Compose. Para rodar os testes fora do
container, Node.js 22+.

```bash
cp .env.example .env     # defina API_KEY, N8N_ENCRYPTION_KEY e OPENAI_API_KEY
docker compose up -d --build
```

Isso sobe três serviços e popula o banco com dados de exemplo
automaticamente:

| Serviço | URL                   | Para quê                                       |
| ------- | --------------------- | ---------------------------------------------- |
| API     | http://localhost:3000 | REST; Swagger em `/docs`, health em `/health`  |
| N8N     | http://localhost:5678 | editor e chat do workflow                      |
| Mailpit | http://localhost:8080 | caixa de entrada falsa, se você não usar Gmail |

Depois que os containers estiverem saudáveis (`docker compose ps`), faltam dois
passos dentro do N8N. Ele nunca guarda segredos de credencial no arquivo
exportado, então isso é feito uma vez por instância:

**1. Importe o workflow**

```bash
docker compose exec n8n n8n import:workflow --input=/workflows/workflow.json
```

**2. Configure as credenciais** (crie a conta de owner no primeiro acesso a
http://localhost:5678)

- **OpenAI**: crie uma credencial "OpenAi account" e selecione-a nos quatro
  nodes que usam OpenAI (`Transcrever Audio`, `Moderar Conteudo`,
  `Modelo de Chat OpenAI`, `Sintetizar Audio de Resposta`). No campo "API Key",
  alterne para o modo _Expression_ e use `{{ $env.OPENAI_API_KEY }}`, para não
  colar a chave na interface.
- **E-mail**: para usar o Mailpit, crie uma credencial SMTP no node
  `Enviar Email de Confirmacao` com host `mailpit`, porta `1025`, sem
  usuário/senha, sem SSL/TLS e com "Disable STARTTLS" marcado. Para enviar
  e-mail de verdade, preencha `GMAIL_CLIENT_ID`/`GMAIL_CLIENT_SECRET` no `.env`
  e configure a credencial OAuth2 no node `Enviar Email via Gmail`; o workflow
  escolhe o Gmail sozinho quando essas variáveis estão preenchidas.

**3. Converse.** Abra o workflow no N8N e use o painel de chat. Um bom começo:

> Bom dia! Queria marcar uma consulta de dermatologia. Que horários vocês têm?

O paciente `ana.souza@example.com` já existe no banco de exemplo, e há horários
disponíveis para amanhã e depois de amanhã.

## Endpoints

Todas as rotas exigem o header `x-api-key`, exceto `/health` e `/docs`.

| Método | Rota                                       | Descrição                                        |
| ------ | ------------------------------------------ | ------------------------------------------------ |
| GET    | `/patients/lookup?email=` ou `?phone=`     | Identifica um paciente                           |
| GET    | `/doctors`                                 | Lista médicos                                    |
| GET    | `/availability?date=&specialty=&doctorId=` | Lista horários disponíveis                       |
| POST   | `/appointments`                            | Cria um agendamento por `slotId`                 |
| GET    | `/appointments/:id`                        | Consulta um agendamento                          |
| POST   | `/appointments/:id/cancel`                 | Cancela um agendamento por `id`                  |
| POST   | `/appointments/by-details`                 | Agenda por médico/especialidade + data + horário |
| POST   | `/appointments/cancel-by-patient`          | Cancela a consulta ativa de um paciente          |
| GET    | `/payments?consultationType=`              | Consulta valores e formas de pagamento           |

`by-details` e `cancel-by-patient` existem para que o agente de IA nunca
precise carregar um `slotId`/`appointmentId` opaco entre duas chamadas. Ele
repete apenas o que já apareceu na conversa (médico, data, horário), e a
resolução do id real acontece de forma determinística na API, onde está
testada.

## Testes e evidências

```bash
npm install
npm test                  # 114 testes, banco em memória isolado por teste
npm run lint
npm run format
```

O hook de pre-commit (Husky + lint-staged) roda lint, formatação e a suíte
inteira antes de deixar o commit passar.

As saídas reais desses comandos, as transcrições `curl` de todos os endpoints e
uma conversa completa no chat do N8N estão em
[`docs/evidencias/`](docs/evidencias/README.md), que também mapeia cada
evidência para os critérios de avaliação do case.

## Coleção Postman

Importe `postman/agendamento-medico.postman_collection.json`, ajuste a variável
`apiKey` para o valor do seu `.env` e execute as requisições na ordem em que
aparecem. As datas de agendamento são calculadas em tempo de execução, então a
coleção continua válida em qualquer dia.

## Rodando a API fora do Docker

```bash
npm install
npm run seed   # cria e popula ./data/dev.db
npm run dev    # http://localhost:3000
```

## Decisões de design

O desenho completo (modelo de dados, camadas, guardrails de IA e o racional
de cada escolha) está em
[`docs/superpowers/specs/`](docs/superpowers/specs/), junto com os planos de
implementação que guiaram as duas fases do projeto (API e, depois,
orquestração N8N).
