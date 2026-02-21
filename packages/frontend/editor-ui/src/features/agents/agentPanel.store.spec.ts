import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useAgentPanelStore } from './agentPanel.store';
import { useAgentsStore } from './agents.store';
import type { AgentNode } from './agents.types';

// Mock dependencies the store imports
vi.mock('@n8n/constants', () => ({ BROWSER_ID_STORAGE_KEY: 'browser-id' }));
vi.mock('@n8n/rest-api-client', () => ({ makeRestApiRequest: vi.fn() }));
vi.mock('@n8n/stores/useRootStore', () => ({
	useRootStore: () => ({ restApiContext: { baseUrl: 'http://localhost:5678/rest' } }),
}));

/** Build an SSE text chunk from a sequence of events */
function sseChunk(events: object[]): Uint8Array {
	const text = events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join('');
	return new TextEncoder().encode(text);
}

/** Create a mock ReadableStream that yields one chunk then closes */
function mockSSEResponse(events: object[]): Response {
	const chunk = sseChunk(events);
	let read = false;

	const body = {
		getReader: () => ({
			read: async () => {
				if (!read) {
					read = true;
					return { done: false, value: chunk };
				}
				return { done: true, value: undefined };
			},
		}),
	} as unknown as ReadableStream<Uint8Array>;

	return {
		headers: new Headers({ 'content-type': 'text/event-stream' }),
		body,
	} as unknown as Response;
}

function makeAgent(overrides: Partial<AgentNode> & { id: string; firstName: string }): AgentNode {
	return {
		lastName: '',
		email: `${overrides.firstName.toLowerCase()}@n8n.local`,
		role: overrides.firstName,
		avatar: { type: 'initials', value: overrides.firstName.slice(0, 2).toUpperCase() },
		status: 'idle',
		position: { x: 0, y: 0 },
		zoneId: null,
		workflowCount: 0,
		tasksCompleted: 0,
		lastActive: '',
		resourceUsage: 0,
		...overrides,
	};
}

describe('agentPanel.store', () => {
	let agentsStore: ReturnType<typeof useAgentsStore>;
	let panelStore: ReturnType<typeof useAgentPanelStore>;

	beforeEach(() => {
		setActivePinia(createPinia());
		vi.stubGlobal('fetch', vi.fn());
		agentsStore = useAgentsStore();
		panelStore = useAgentPanelStore();

		agentsStore.agents = [
			makeAgent({ id: 'qa-1', firstName: 'QA' }),
			makeAgent({ id: 'comms-1', firstName: 'Comms', position: { x: 100, y: 0 } }),
		];

		panelStore.panelAgentId = 'qa-1';
		panelStore.panelOpen = true;
	});

	describe('handleDoneEvent – resets all agents', () => {
		it('should reset delegated agent to idle when done fires without observation', async () => {
			vi.mocked(fetch).mockResolvedValueOnce(
				mockSSEResponse([
					{ type: 'step', action: 'send_message', toAgent: 'Comms' },
					// No observation — simulates error path or race
					{ type: 'done', summary: 'Task complete' },
				]),
			);

			await panelStore.dispatchTask('What agents can you see?');

			expect(agentsStore.agents.find((a) => a.id === 'qa-1')?.status).toBe('idle');
			expect(agentsStore.agents.find((a) => a.id === 'comms-1')?.status).toBe('idle');
			expect(panelStore.activeConnections.size).toBe(0);
		});
	});

	describe('handleObservationEvent – interleaved delegation', () => {
		it('should reset delegated agent via observation toAgent when steps are interleaved', async () => {
			// Simulate: QA delegates to Comms → Comms runs workflow → Comms returns
			// The observation for the delegation has toAgent, but the lastStep is the
			// nested execute_workflow (no toAgent). Without the fix, Comms stays busy.
			vi.mocked(fetch).mockResolvedValueOnce(
				mockSSEResponse([
					{ type: 'step', action: 'send_message', toAgent: 'Comms' },
					{ type: 'step', action: 'execute_workflow', workflowName: 'Message' },
					{ type: 'observation', result: 'success', workflowName: 'Message' },
					{ type: 'observation', result: 'success', toAgent: 'Comms', summary: 'Responded' },
					{ type: 'done', summary: 'All done' },
				]),
			);

			await panelStore.dispatchTask('Run reports');

			expect(agentsStore.agents.find((a) => a.id === 'comms-1')?.status).toBe('idle');
			expect(panelStore.activeConnections.size).toBe(0);
		});

		it('should update the delegation step when observation has toAgent', async () => {
			// The observation with toAgent should update the send_message step,
			// not the interleaved execute_workflow step
			vi.mocked(fetch).mockResolvedValueOnce(
				mockSSEResponse([
					{ type: 'step', action: 'send_message', toAgent: 'Comms' },
					{ type: 'step', action: 'execute_workflow', workflowName: 'Message' },
					{ type: 'observation', result: 'success', workflowName: 'Message' },
					{ type: 'observation', result: 'success', toAgent: 'Comms', summary: 'Responded' },
					{ type: 'done', summary: 'All done' },
				]),
			);

			await panelStore.dispatchTask('Run reports');

			const delegationStep = panelStore.streamingSteps.find((s) => s.toAgent === 'Comms');
			expect(delegationStep?.result).toBe('success');
			expect(delegationStep?.status).toBe('success');
		});
	});
});
