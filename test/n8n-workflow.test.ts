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
    { main?: Array<Array<{ node: string; type: string; index: number }>> }
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
});
