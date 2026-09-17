import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

interface N8nNode {
  name: string;
  type: string;
  typeVersion: number;
}

interface N8nWorkflow {
  name: string;
  nodes: N8nNode[];
  connections: Record<
    string,
    Record<string, Array<Array<{ node: string; type: string; index: number }>>>
  >;
}

function loadWorkflow(): N8nWorkflow {
  const raw = readFileSync('n8n/workflow.json', 'utf-8');
  return JSON.parse(raw) as N8nWorkflow;
}

function findNode(workflow: N8nWorkflow, name: string): N8nNode {
  const node = workflow.nodes.find((n) => n.name === name);
  if (!node) {
    throw new Error(`Node not found: ${name}`);
  }
  return node;
}

describe('n8n workflow structure', () => {
  it('is valid JSON with the expected top-level shape', () => {
    const workflow = loadWorkflow();
    expect(workflow.name).toBe('Essentia - Atendimento Medico');
    expect(Array.isArray(workflow.nodes)).toBe(true);
    expect(typeof workflow.connections).toBe('object');
  });

  it('has no duplicate node names', () => {
    const workflow = loadWorkflow();
    const names = workflow.nodes.map((n) => n.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('has a Chat Trigger as the entry point', () => {
    const workflow = loadWorkflow();
    const trigger = findNode(workflow, 'Recepcao do Paciente');
    expect(trigger.type).toBe('@n8n/n8n-nodes-langchain.chatTrigger');
  });

  it('routes audio and text through separate normalization paths that both produce a "mensagem" field', () => {
    const workflow = loadWorkflow();
    findNode(workflow, 'Tem Audio');
    findNode(workflow, 'Transcrever Audio');
    findNode(workflow, 'Normalizar Transcricao');
    findNode(workflow, 'Normalizar Texto');

    const audioBranch = workflow.connections['Tem Audio']?.main?.[0]?.[0]?.node;
    const textBranch = workflow.connections['Tem Audio']?.main?.[1]?.[0]?.node;
    expect(audioBranch).toBe('Transcrever Audio');
    expect(textBranch).toBe('Normalizar Texto');
  });

  it('routes both normalized message paths into moderation, and moderation into a flagged/not-flagged branch', () => {
    const workflow = loadWorkflow();
    findNode(workflow, 'Moderar Conteudo');
    findNode(workflow, 'Conteudo Sinalizado');
    findNode(workflow, 'Resposta Padrao de Recusa');

    expect(workflow.connections['Normalizar Texto']?.main?.[0]?.[0]?.node).toBe('Moderar Conteudo');
    expect(workflow.connections['Normalizar Transcricao']?.main?.[0]?.[0]?.node).toBe(
      'Moderar Conteudo',
    );
    expect(workflow.connections['Moderar Conteudo']?.main?.[0]?.[0]?.node).toBe(
      'Conteudo Sinalizado',
    );
    expect(workflow.connections['Conteudo Sinalizado']?.main?.[0]?.[0]?.node).toBe(
      'Resposta Padrao de Recusa',
    );
  });

  it('every connection target references a node that actually exists', () => {
    const workflow = loadWorkflow();
    const nodeNames = new Set(workflow.nodes.map((n) => n.name));
    for (const [sourceName, outputs] of Object.entries(workflow.connections)) {
      expect(nodeNames.has(sourceName)).toBe(true);
      for (const branch of outputs.main ?? []) {
        for (const target of branch) {
          expect(nodeNames.has(target.node)).toBe(true);
        }
      }
    }
  });

  it('wires the not-flagged branch into the AI Agent, with a chat model and memory attached', () => {
    const workflow = loadWorkflow();
    const agent = findNode(workflow, 'Assistente de Atendimento');
    expect(agent.type).toBe('@n8n/n8n-nodes-langchain.agent');
    findNode(workflow, 'Modelo de Chat OpenAI');
    findNode(workflow, 'Memoria da Conversa');

    expect(workflow.connections['Conteudo Sinalizado']?.main?.[1]?.[0]?.node).toBe(
      'Assistente de Atendimento',
    );

    const modeloConnections = workflow.connections['Modelo de Chat OpenAI'] as unknown as Record<
      string,
      Array<Array<{ node: string; type: string }>>
    >;
    expect(modeloConnections.ai_languageModel[0][0].node).toBe('Assistente de Atendimento');

    const memoriaConnections = workflow.connections['Memoria da Conversa'] as unknown as Record<
      string,
      Array<Array<{ node: string; type: string }>>
    >;
    expect(memoriaConnections.ai_memory[0][0].node).toBe('Assistente de Atendimento');
  });

  it('wires all 5 tools to the AI Agent via ai_tool connections', () => {
    const workflow = loadWorkflow();
    const expectedTools = [
      'Tool - Identificar Paciente',
      'Tool - Consultar Disponibilidade',
      'Tool - Agendar Consulta',
      'Tool - Cancelar Consulta',
      'Tool - Consultar Pagamento',
    ];

    for (const toolName of expectedTools) {
      const node = findNode(workflow, toolName);
      expect(node.type).toBe('@n8n/n8n-nodes-langchain.toolHttpRequest');

      const toolConnections = workflow.connections[toolName] as unknown as Record<
        string,
        Array<Array<{ node: string; type: string }>>
      >;
      expect(toolConnections.ai_tool[0][0].node).toBe('Assistente de Atendimento');
    }
  });

  it('every tool sends the x-api-key header and targets the internal API base URL', () => {
    const raw = readFileSync('n8n/workflow.json', 'utf-8');
    const workflow = JSON.parse(raw) as {
      nodes: Array<{ name: string; type: string; parameters: Record<string, unknown> }>;
    };
    const tools = workflow.nodes.filter(
      (n) => n.type === '@n8n/n8n-nodes-langchain.toolHttpRequest',
    );
    expect(tools).toHaveLength(5);

    for (const tool of tools) {
      const url = tool.parameters.url as string;
      expect(url).toContain('$env.N8N_API_BASE_URL');

      // NOTE: this n8n version's @n8n/n8n-nodes-langchain.toolHttpRequest (typeVersion 1.1)
      // reads header parameters from `parametersHeaders.values` (each entry has a
      // `valueProvider` of 'fieldValue' | 'modelRequired' | 'modelOptional'), not from the
      // older `headerParameters.parameters` name/value shape. Verified via real import +
      // NDV/UI inspection and the node's compiled source (ToolHttpRequest.node.js /
      // utils.js), which call `getNodeParameter('parametersHeaders.values', ...)`.
      const headerParams = tool.parameters.parametersHeaders as {
        values: Array<{ name: string; valueProvider: string; value?: string }>;
      };
      const apiKeyHeader = headerParams.values.find((p) => p.name === 'x-api-key');
      expect(apiKeyHeader?.valueProvider).toBe('fieldValue');
      expect(apiKeyHeader?.value).toBe('={{ $env.N8N_API_KEY }}');
    }
  });

  it('detects booking/cancellation from the agent output and branches to an email send node', () => {
    const workflow = loadWorkflow();
    findNode(workflow, 'Detectar Agendamento ou Cancelamento');
    findNode(workflow, 'Deve Enviar Email');
    const emailNode = findNode(workflow, 'Enviar Email de Confirmacao');
    expect(emailNode.type).toBe('n8n-nodes-base.emailSend');

    expect(workflow.connections['Assistente de Atendimento']?.main?.[0]?.[0]?.node).toBe(
      'Detectar Agendamento ou Cancelamento',
    );
    expect(workflow.connections['Detectar Agendamento ou Cancelamento']?.main?.[0]?.[0]?.node).toBe(
      'Deve Enviar Email',
    );
    expect(workflow.connections['Deve Enviar Email']?.main?.[0]?.[0]?.node).toBe(
      'Enviar Email de Confirmacao',
    );
  });
});
