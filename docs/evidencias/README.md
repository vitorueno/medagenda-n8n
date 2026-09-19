# Checklist de testes e evidências

Esta pasta é o entregável **"Checklist de testes e evidências"** do case. Cada
item abaixo aponta para um arquivo com o artefato real (saída de comando,
transcrição de requisição/resposta, conversa de chat), não para uma descrição
do que foi feito.

Todas as evidências foram capturadas contra os serviços rodando via
`docker compose up -d --build`, com pacientes fictícios do seed. A chave de API
aparece como `$API_KEY` nas transcrições.

## Índice

| Arquivo                                                                    | O que contém                                                                                                |
| -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| [`01-testes-automatizados.txt`](01-testes-automatizados.txt)                 | Saída completa de `npx vitest run`: 114 testes, 23 arquivos, todos passando                                 |
| [`02-lint-e-typecheck.txt`](02-lint-e-typecheck.txt)                         | `eslint`, `prettier --check` e `tsc --noEmit` sem nenhum apontamento                                          |
| [`03-api-rest-curl.md`](03-api-rest-curl.md)                                 | Transcrições `curl` reais de todos os endpoints, incluindo os casos de erro                                 |
| [`04-conversa-n8n-ponta-a-ponta.md`](04-conversa-n8n-ponta-a-ponta.md)       | Conversa real no chat do N8N cobrindo os quatro fluxos do enunciado, com o efeito no banco                   |
| [`05-demonstracao-em-video.md`](05-demonstracao-em-video.md)                 | Vídeo do fluxo completo (texto, áudio, pagamento, cancelamento, e-mail) e vídeos complementares               |

## Cobertura dos critérios de avaliação

| Critério do enunciado                                          | Onde está a evidência                                                                              |
| --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| **Banco de dados**: modelagem simples, dados consistentes      | `03` (respostas com dados do seed), `01` (testes de migração, seed e repositórios)                  |
| **Estrutura da API**: endpoints bem definidos                  | `03` (todos os endpoints, sucesso e erro), Swagger em `http://localhost:3000/docs`                    |
| **Integração com N8N**: fluxo claro, uso correto de nodes      | `04` (conversa real), `01` (18 testes que validam a estrutura do `n8n/workflow.json`)                  |
| **Tratamento multimodal**: texto vs. áudio                     | `01` (testes que verificam os ramos de áudio/texto do workflow); demonstração em vídeo no `05`        |
| **Integração externa**: Gmail e TTS                            | `04` (o e-mail de confirmação dispara no fluxo); demonstração em vídeo no `05`                        |
| **Documentação**: instalação, execução e teste                 | `README.md` na raiz do repositório                                                                     |
| **Organização**: versionamento, modularização                  | histórico de commits (conventional commits, hook de pre-commit rodando lint + testes)                  |

## Diferenciais do enunciado

| Diferencial                  | Situação                                                                                    |
| ----------------------------- | --------------------------------------------------------------------------------------------- |
| Testes unitários na API      | 114 testes (`01`)                                                                              |
| Uso de function calling       | 5 tools HTTP no AI Agent (`04`, e os testes de estrutura do workflow em `01`)                  |
| Retentativa para e-mails e TTS| `retryOnFail` com 3 tentativas nos nodes externos, verificado por teste (`01`)                 |
| Cache de disponibilidade      | Cache com TTL e invalidação ao agendar/cancelar, com testes dedicados (`01`)                   |
| Painel de visualização        | Não implementado                                                                               |

## Como reproduzir

```bash
docker compose up -d --build          # sobe api, n8n e mailpit
npm install && npx vitest run         # reproduz 01
npx eslint . && npx tsc --noEmit      # reproduz 02
```

Para `03` e `04` é preciso importar o workflow no N8N e configurar as
credenciais. O passo a passo está no `README.md` da raiz.
