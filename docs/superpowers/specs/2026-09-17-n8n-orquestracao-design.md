# Design: Orquestração N8N e IA (Case Essentia Technologies) — Plano 2/2

## Objetivo

Construir a camada de orquestração e IA que consome a API REST já pronta (Plano 1), atendendo os requisitos do case ainda não implementados: atendimento por chat (texto e áudio), integração com Gmail para confirmações, e guardrails contra usuário malicioso na camada de IA.

## Relação com o spec original

Este documento **não substitui** `docs/superpowers/specs/2026-09-16-atendimento-medico-essentia-design.md`, que continua sendo a autoridade arquitetural para as seções "Camada de IA/N8N", "Guardrails de IA e segurança" e "Princípio arquitetural central" (separação IA/API). Este spec adiciona os detalhes operacionais necessários para materializar aquele design em nodes concretos do N8N, dado um contexto que mudou desde então: a Plano 1 foi implementada e mergeada, e ainda não há uma API key da OpenAI disponível para verificação funcional em tempo real.

## Escopo

### Dentro do escopo desta plano
- Workflow N8N único (`n8n/workflow.json`) cobrindo: recepção de chat (texto/áudio), identificação de paciente, as 5 tools (`identificar_paciente`, `consultar_disponibilidade`, `agendar_consulta`, `cancelar_consulta`, `consultar_pagamento`), saudação/encerramento conversacionais, multimodalidade (STT na entrada, TTS na saída quando aplicável), e disparo de e-mail de confirmação.
- Atualização do `docker-compose.yml` para incluir os serviços `n8n` e `mailpit`.
- Atualização do `.env.example` com as variáveis necessárias (`OPENAI_API_KEY`, variáveis do N8N).
- Documentação (README) de como configurar credenciais dentro do N8N.
- Validação estrutural do workflow (script + import real no N8N via Docker).
- Checklist de evidências, separando o que foi verificado estruturalmente do que depende da API key da OpenAI (ainda não disponível).

### Fora do escopo desta plano
- Verificação funcional end-to-end com a IA respondendo de verdade (bloqueada até haver uma API key da OpenAI) — fica documentada como pendência manual.
- Configuração de credencial Gmail real (usa-se Mailpit; Gmail real fica para quando o vídeo de demonstração final for gravado, conforme já decidido no spec original).
- Painel de visualização de consultas (diferencial do case, também deixado de fora da Plano 1 por descuido) — vira uma Plano 3 separada.
- Retentativas (retry) para Gmail/TTS além do que os nodes nativos do N8N já oferecem por configuração — cobertas nesta plano apenas como configuração de node, não como lógica customizada extra.

## Por que identificação de intenção não é um node separado

O node **AI Agent** já resolve isso via function calling: ele recebe a mensagem do paciente (texto puro, já transcrito se veio como áudio) e o LLM decide, na mesma chamada, se deve chamar uma tool (e qual) ou responder diretamente (caso de saudação/encerramento). Um node de classificação de intenção anterior ao AI Agent seria uma chamada de LLM redundante — o Agent já faz essa classificação como parte de decidir qual tool invocar. O único roteamento que existe fora do AI Agent é a distinção de **formato** da mensagem (texto vs. áudio), que é sintática, não semântica.

## Arquitetura do workflow

```
Paciente
  → N8N Chat Trigger (webhook nativo do N8N, aceita texto e upload de arquivo)
  → Switch: mensagem é texto ou áudio?
      → [áudio] HTTP Request → OpenAI Whisper (audio → texto)
      → [texto] segue direto
  → AI Agent node
      - Chat Model: OpenAI (gpt-4o-mini ou equivalente, via env)
      - Memory: Simple Memory, indexada por sessionId do chat
      - System Prompt: guardrails (ver seção abaixo)
      - Tools (cada uma um HTTP Request node exposto como Tool, com header x-api-key):
          - identificar_paciente(email?, phone?) → GET /patients/lookup
          - consultar_disponibilidade(date, specialty?, doctorId?) → GET /availability
          - agendar_consulta(patientId, slotId) → POST /appointments
          - cancelar_consulta(appointmentId) → POST /appointments/:id/cancel
          - consultar_pagamento(consultationType?) → GET /payments
  → Switch: mensagem original era áudio?
      → [sim] HTTP Request → OpenAI TTS (texto → áudio) → responde com áudio
      → [não] responde com texto
  Em paralelo, quando agendar_consulta ou cancelar_consulta é executado com sucesso:
  → Gmail node (produção) / SMTP node apontando pro Mailpit (dev) → e-mail de confirmação
```

## Estado da conversa (slot filling)

O Memory node do N8N (Simple Memory) mantém o histórico de mensagens por `sessionId`, permitindo que o AI Agent lembre de dados já informados em turnos anteriores (ex.: paciente disse "quero marcar consulta" sem informar data ainda). A API nunca recebe ou armazena qualquer noção de "conversa em andamento" — ela só é chamada quando o Agent já tem todos os parâmetros necessários para uma tool.

## Identificação do paciente

O system prompt instrui o Agent a sempre chamar `identificar_paciente` (com email ou telefone informado pelo paciente na conversa) antes de chamar `agendar_consulta` ou `cancelar_consulta`, e a usar o `id` retornado como `patientId`. Se `identificar_paciente` não encontrar ninguém, o Agent deve pedir para o paciente confirmar o dado ou informar outro.

## Guardrails de IA (herdados do spec original, sem mudanças)

- **Moderation API da OpenAI** roda antes de qualquer processamento da mensagem do paciente.
- **System prompt blindado**: nunca inventar horários/preços/dados; ignorar instruções embutidas no texto do paciente que tentem alterar o papel do Agent, revelar o prompt ou pular validações; sempre usar os dados retornados pelas tools como única fonte de verdade.
- **A API nunca confia no LLM**: todo parâmetro que chega via tool call é revalidado por Zod e pelas regras de negócio da API antes de qualquer escrita — isso já está garantido pela Plano 1, essa plano só precisa não contornar essa fronteira (por exemplo, nunca fazer o N8N escrever direto no banco).

## Credenciais e variáveis de ambiente

Como ainda não há uma API key da OpenAI disponível:

- `.env.example` ganha: `OPENAI_API_KEY`, `N8N_ENCRYPTION_KEY`, `N8N_HOST`, `N8N_PORT`, `WEBHOOK_URL` (variáveis padrão do N8N para rodar via Docker Compose).
- O README documenta o passo manual de configurar a credencial da OpenAI **dentro da UI do N8N** (N8N guarda credenciais no seu próprio storage criptografado, não lê diretamente do `.env` da aplicação — só usa variáveis de ambiente do próprio processo N8N para coisas como `N8N_ENCRYPTION_KEY`).
- A credencial SMTP do Mailpit não precisa de autenticação (Mailpit aceita qualquer conexão SMTP local), então essa parte funciona sem nenhuma key.

## Docker Compose

Adiciona ao `docker-compose.yml` existente (que hoje só tem o serviço `api`):

- `n8n`: imagem oficial `n8nio/n8n`, expõe a porta configurada, volume para persistir workflows/credenciais/execuções, `depends_on: api` com a condição de healthcheck (reaproveitando o fix `127.0.0.1` da Plano 1 para o healthcheck do `api`).
- `mailpit`: imagem oficial `axllent/mailpit`, expõe a porta SMTP (1025) e a porta da UI web (8025) para inspecionar e-mails capturados.

## Estratégia de verificação (diferente da Plano 1)

Workflow N8N não tem testes unitários no sentido tradicional. A verificação acontece em três camadas:

1. **Validação estrutural**: um script Node simples (`n8n/validate-workflow.js` ou similar) carrega `n8n/workflow.json` e confere que todos os nodes esperados existem (por tipo/nome), que as conexões entre eles batem com o fluxo desenhado acima, e que nenhuma tool aponta para uma URL que não existe na API. Roda sem depender de nenhuma credencial.
2. **Import real**: sobe o N8N via Docker Compose, importa `workflow.json` via CLI do N8N (`n8n import:workflow --input=...`, executado dentro do container via `docker compose exec`), que é mais simples e não exige autenticação prévia na UI. Confirma que a importação não gera erro e que o workflow aparece corretamente na UI (verificado via automação de navegador, com captura de evidência).
3. **Verificação funcional real** (mensagem de texto real, IA respondendo, e-mail chegando no Mailpit, áudio sendo transcrito e sintetizado): **bloqueada até haver uma API key da OpenAI configurada**. Fica documentada explicitamente no checklist de evidências como pendência manual, com o passo a passo de como o usuário deve validar assim que tiver a key.

## Entregáveis desta plano

- `n8n/workflow.json` — o workflow exportável (entregável "Export do fluxo N8N" do case).
- `n8n/validate-workflow.js` (ou `.ts`) — script de validação estrutural.
- `docker-compose.yml` atualizado com `n8n` e `mailpit`.
- `.env.example` atualizado.
- `README.md` atualizado com: como subir N8N, como importar o workflow, como configurar a credencial da OpenAI dentro do N8N, como inspecionar e-mails no Mailpit, quais partes exigem a API key para verificação completa.
- Checklist de evidências (estrutural vs. funcional/pendente).

## Limitações assumidas

- Verificação funcional completa (IA respondendo, STT/TTS reais) depende de uma API key da OpenAI que ainda não está disponível nesta sessão; o workflow é entregue estruturalmente correto e pronto para uso assim que a key for configurada.
- Gmail real não é configurado nesta plano; usa-se Mailpit. A configuração de Gmail real fica para o momento de gravação do vídeo de demonstração final, conforme já decidido no spec original.
- Painel de visualização de consultas fica para uma Plano 3 separada.
