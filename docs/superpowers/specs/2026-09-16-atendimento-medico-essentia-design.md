# Design: Atendimento Médico Automatizado (Case Essentia Technologies)

## Objetivo

Simular um fluxo de atendimento médico automatizado via chat (texto e áudio), com API REST própria como fonte da verdade e N8N como camada de orquestração/IA, atendendo integralmente o case em `case.pdf` e usando `.ideas/case_essentia_sugestao_chatgpt/` como plano de referência (agnóstico de stack).

## Stack

- API: TypeScript + Fastify + Zod (validação de fronteira) + SQLite (better-sqlite3 ou driver equivalente).
- Testes: Vitest.
- Documentação de API: Swagger (`@fastify/swagger` + `@fastify/swagger-ui`).
- Coleção de requisições: Postman.
- Orquestração/IA: N8N (AI Agent node, OpenAI Chat Model, Memory node, Tool nodes).
- STT: OpenAI Whisper (via node/HTTP Request da API de transcrição da OpenAI).
- TTS: OpenAI TTS (via HTTP Request da API de speech da OpenAI).
- E-mail: Gmail node do N8N (demo) / SMTP node contra Mailpit (dev e testes locais).
- Infra: Docker Compose (api, n8n, mailpit).

## Princípio arquitetural central

**Separação estrita entre API (regras de negócio e dados) e N8N (orquestração e IA).** O N8N nunca é fonte de verdade: toda decisão que envolve dados (disponibilidade real, preço, existência de paciente/agendamento) é revalidada pela API. O LLM decide *qual* ação tomar e extrai parâmetros; a API decide se a ação é válida e a executa.

## Arquitetura geral

```
Paciente
  -> N8N Chat Trigger (texto ou áudio)
  -> [se áudio] node de transcrição (OpenAI Whisper)
  -> AI Agent (OpenAI Chat Model + Memory por sessionId + Tool nodes)
  -> tool call -> HTTP Request (header x-api-key) -> API
  -> API: rota -> schema Zod -> service -> repository -> SQLite
  -> resposta da API -> AI Agent formata em linguagem natural
  -> [se entrada foi áudio] node TTS (OpenAI) -> áudio de resposta
  -> resposta ao paciente

Em paralelo, quando aplicável:
  API confirma criação/cancelamento -> N8N dispara Gmail/Mailpit -> confirmação por e-mail
```

Docker Compose sobe três serviços: `api`, `n8n`, `mailpit`, com volumes para o arquivo SQLite e para os dados do N8N.

## Modelo de dados (SQLite)

- `patients(id, name, email, phone)`
- `doctors(id, name, specialty)`
- `appointment_slots(id, doctor_id, date, start_time, end_time, status)` — status: `available` | `booked`
- `appointments(id, patient_id, slot_id, status, created_at, cancelled_at)` — status: `active` | `cancelled`
- `payment_configs(id, consultation_type, price, payment_methods)`

Regras:
- Um slot nunca tem dois agendamentos `active` simultaneamente. Garantido na camada de service dentro de uma transação (verificação + escrita atômica), nunca apenas por checagem prévia isolada.
- Cancelamento é uma mudança de estado (`status = cancelled`, `cancelled_at` preenchido), nunca um DELETE físico do agendamento.
- Dados iniciais (seed) cobrem: múltiplos pacientes, médicos de especialidades diferentes, horários disponíveis, ao menos um cenário pronto para gerar conflito de agendamento, e configuração de preço/pagamento por tipo de consulta.

## Camadas da API (regra de implementação)

Fluxo de uma requisição, sem pular camadas:

```
rota (schema Zod de entrada/saída) -> controller (só parsing/HTTP, chama 1 método de service) -> service (toda a lógica/regra de negócio) -> repository (única camada que fala SQL/SQLite)
```

- **Controller nunca contém lógica de negócio.** Sua única responsabilidade é: receber a requisição já validada pelo schema Zod, chamar o método correspondente do service, mapear o retorno/erro do service para status HTTP e corpo de resposta.
- **Toda regra de negócio vive no service** (checar conflito de slot, checar existência, decidir status HTTP semântico via erros tipados, aplicar cache de disponibilidade e sua invalidação).
- **Repository é a única camada que acessa o SQLite diretamente.** Não há SQL fora dela.
- Erros de negócio são exceções tipadas (ex.: `SlotNotFoundError`, `SlotAlreadyBookedError`, `AppointmentNotFoundError`, `AppointmentAlreadyCancelledError`) lançadas no service e traduzidas para status HTTP num único lugar (error handler do Fastify), nunca com `if` de status espalhado pelos controllers.

## Endpoints mínimos

- `GET /patients/lookup?email=` ou `?phone=` — identificar paciente (usado antes de agendar/cancelar).
- `GET /doctors`
- `GET /doctors/:id/availability?date=YYYY-MM-DD`
- `POST /appointments` (`{ patientId, slotId }`)
- `GET /appointments/:id`
- `POST /appointments/:id/cancel` (endpoint explícito, mais claro para auditoria que DELETE)
- `GET /payments?consultationType=`

Todas as rotas exigem header `x-api-key` (middleware de autenticação simples via env `API_KEY`).

## Camada de IA / N8N

- Workflow principal com AI Agent node único, roteando por intenção via tools; sem duplicar lógica de negócio dentro do N8N.
- Tools (cada uma um HTTP Request node exposto como Tool para o Agent):
  - `identificar_paciente(email?, phone?)`
  - `consultar_disponibilidade(date, specialty?, doctorId?)`
  - `agendar_consulta(patientId, slotId)`
  - `cancelar_consulta(appointmentId)`
  - `consultar_pagamento(consultationType?)`
- Saudação e encerramento são respondidos pelo próprio Agent via prompt, sem tool call (evita chamadas desnecessárias à API).
- Estado da conversa (slot filling: dados que ainda faltam, ex. paciente pediu para agendar mas não disse data) fica no Memory node do N8N, indexado por `sessionId` do chat. A API permanece sem qualquer noção de "conversa em andamento".
- Multimodalidade: detecção de tipo de mensagem no início do workflow; áudio passa por transcrição antes de entrar no Agent; se a mensagem de entrada foi áudio, a resposta final passa por TTS antes de voltar ao paciente.

## Guardrails de IA e segurança contra usuário malicioso

- **Moderation API da OpenAI** roda antes de qualquer processamento da mensagem do paciente; conteúdo sinalizado é recusado com resposta padrão, sem chegar ao Agent.
- **System prompt blindado**: instruído a nunca inventar horários/preços/dados, a ignorar qualquer instrução embutida no texto do paciente que tente alterar seu papel, revelar o prompt ou pular etapas de validação, e a sempre usar os dados retornados pelas tools como única fonte de verdade.
- **A API nunca confia no LLM**: todo parâmetro que chega via tool call é revalidado por Zod e pelas regras de negócio do service antes de qualquer escrita (ex.: mesmo que o Agent "decida" agendar um slot, a API reconfirma disponibilidade na transação de criação).
- **Autenticação simples**: header `x-api-key` entre N8N e API, validado por middleware Fastify.
- **Rate limiting** (`@fastify/rate-limit`) por IP/sessionId para mitigar abuso/spam de requisições.
- **Zod estrito na fronteira**: schemas rejeitam campos extras (`strict()`), validam tipos, tamanhos máximos de string e formatos (datas, e-mail), tanto em query/params quanto em body.
- **Mensagens de erro genéricas** para o cliente (N8N/paciente); detalhes internos (stack trace, SQL) só em log de servidor, nunca na resposta HTTP.

## Testes (Vitest)

- Banco SQLite `:memory:` dedicado aos testes, nunca o `dev.db` usado localmente.
- Cada teste sobe uma instância nova da aplicação com banco em memória e roda o seed mínimo antes de exercer o cenário — testes idempotentes e paralelizáveis, sem estado compartilhado entre eles.
- Script `npm run seed` único, reaproveitado tanto para popular o `dev.db` (ambiente local/demo) quanto, via helper, para popular o banco em memória no setup dos testes de integração.
- Casos obrigatórios (do case): paciente existente/inexistente, lista de disponibilidade, agendar horário disponível, agendar horário já ocupado, agendar slot inexistente, cancelar agendamento, cancelar agendamento inexistente, cancelar agendamento já cancelado, consultar valores/pagamento, payload inválido.
- Edge cases adicionais: concorrência (duas requisições simultâneas para o mesmo slot, apenas uma deve vencer), payload com campos extras/tipos errados (deve ser rejeitado pelo Zod antes de chegar ao service), string extremamente longa em campos de texto, cache de disponibilidade sendo invalidado corretamente após criar/cancelar um agendamento.
- Comando único para rodar toda a suíte, documentado no README.

## Diferenciais (após o fluxo obrigatório estar estável)

1. Testes unitários e de integração (já incorporados desde o início via TDD).
2. Function calling (já é o núcleo da camada de IA via AI Agent + Tools).
3. Retry para Gmail e TTS: usar mecanismo nativo de retry do N8N por node, com limite de tentativas e distinção entre erro transitório e definitivo (não retentar erro de autenticação/payload inválido). Resultado da operação principal nunca é falsificado: agendamento criado com sucesso e e-mail falho são reportados como estados distintos.
4. Cache de disponibilidade: implementado **na API** (não no N8N, para manter a separação IA/API), chave `data + doctorId/specialty`, TTL curto configurável via env, invalidado explicitamente pelo service ao criar ou cancelar um agendamento que afete o slot cacheado. Cache nunca é fonte de verdade: criação de agendamento sempre revalida contra o banco.
5. Painel de visualização: página estática (HTML/JS puro, sem framework/build) servida pela própria API via `@fastify/static`, consumindo os endpoints REST existentes sem duplicar regra de negócio. Filtros por data/status, indicação visual de cancelado.

## Infraestrutura

- `docker-compose.yml` com serviços `api`, `n8n`, `mailpit`, volumes para o arquivo SQLite e para dados persistentes do N8N.
- `.env.example` documentando todas as variáveis: `PORT`, `DATABASE_PATH`, `API_KEY`, `AVAILABILITY_CACHE_TTL_SECONDS`, `OPENAI_API_KEY`, credenciais Gmail/OAuth (produção/demo) e configuração SMTP do Mailpit (dev/teste), variáveis do N8N.
- Nenhum segredo real versionado; apenas `.env.example` com placeholders.

## Entregáveis (conforme case)

- Código da API (camadas rota/controller/service/repository).
- Banco SQLite configurado com dados iniciais (script de seed).
- Export do workflow N8N.
- README com: visão geral, arquitetura, pré-requisitos, subir API, inicializar banco, variáveis de ambiente, subir/configurar N8N, importar workflow, configurar Gmail, configurar LLM/STT/TTS, executar testes, usar a coleção Postman, reproduzir os fluxos, limitações conhecidas.
- Documentação Swagger da API.
- Coleção Postman com variáveis (`baseUrl`, `apiKey`, `patientId`, `doctorId`, `slotId`, `appointmentId`) e assertions básicas de status/campos.
- Checklist de testes e evidências (API, N8N, integrações, diferenciais).
- Vídeo/GIF de demonstração cobrindo consulta, agendamento, cancelamento, pagamento, multimodalidade e diferenciais implementados.

## Limitações assumidas

- Não há autenticação/login real de paciente; identificação é feita por e-mail ou telefone informado na própria conversa, buscado via `identificar_paciente`.
- Cache de disponibilidade é em memória de processo (não distribuído); suficiente para o escopo do case.
- Gmail real só é exercitado no ambiente de demonstração final; desenvolvimento e testes usam Mailpit para evitar dependência de conta/quota do Gmail.
