<script setup lang="ts">
import { ref, watch } from 'vue';
import { N8nButton, N8nHeading, N8nIcon, N8nText } from '@n8n/design-system';
import { useAgentPanelStore } from '../agentPanel.store';
import AgentAvatarComp from './AgentAvatar.vue';

const panelStore = useAgentPanelStore();
const taskPrompt = ref('');
const llmApiKey = ref('');

const isEditingName = ref(false);
const editName = ref('');
const isEditingAvatar = ref(false);
const editAvatar = ref('');

watch(
	() => panelStore.panelAgentId,
	() => {
		isEditingName.value = false;
		isEditingAvatar.value = false;
	},
);

function startEditName() {
	editName.value = panelStore.selectedAgent?.firstName ?? '';
	isEditingName.value = true;
}

async function saveName() {
	const name = editName.value.trim();
	if (!name) return;
	await panelStore.updateAgent({ firstName: name });
	isEditingName.value = false;
}

function cancelEditName() {
	isEditingName.value = false;
}

function startEditAvatar() {
	const agent = panelStore.selectedAgent;
	editAvatar.value = agent?.avatar.type === 'initials' ? '' : (agent?.avatar.value ?? '');
	isEditingAvatar.value = true;
}

async function saveAvatar() {
	const value = editAvatar.value.trim() || null;
	await panelStore.updateAgent({ avatar: value });
	isEditingAvatar.value = false;
}

function cancelEditAvatar() {
	isEditingAvatar.value = false;
}

async function onRunTask() {
	const prompt = taskPrompt.value.trim();
	if (!prompt) return;
	const keys = llmApiKey.value.trim() ? { llmApiKey: llmApiKey.value.trim() } : undefined;
	await panelStore.dispatchTask(prompt, keys);
}

function stepIcon(step: { toAgent?: string; external?: boolean; workflowName?: string }) {
	if (step.toAgent) return 'users';
	if (step.external) return 'globe';
	if (step.workflowName) return 'workflow';
	return 'play';
}

function stepStatusIcon(status: string) {
	switch (status) {
		case 'running':
			return 'spinner';
		case 'success':
			return 'check';
		case 'failed':
		case 'error':
			return 'x';
		default:
			return 'spinner';
	}
}
</script>

<template>
	<aside :class="$style.panel" data-testid="agent-action-panel">
		<!-- Header -->
		<div :class="$style.header">
			<div :class="$style.headerInfo">
				<!-- Avatar with edit overlay -->
				<div v-if="panelStore.selectedAgent" :class="$style.avatarWrapper">
					<AgentAvatarComp :avatar="panelStore.selectedAgent.avatar" size="large" />
					<button
						:class="$style.avatarEditBtn"
						data-testid="agent-edit-avatar"
						title="Edit avatar"
						@click="startEditAvatar"
					>
						<N8nIcon icon="pen" size="xsmall" />
					</button>
				</div>
				<div>
					<!-- Editable name -->
					<div v-if="isEditingName" :class="$style.editRow">
						<input
							v-model="editName"
							:class="$style.editInput"
							data-testid="agent-edit-name-input"
							maxlength="32"
							@keydown.enter="saveName"
							@keydown.escape="cancelEditName"
						/>
						<button :class="$style.editAction" @click="saveName">
							<N8nIcon icon="check" size="xsmall" />
						</button>
						<button :class="$style.editAction" @click="cancelEditName">
							<N8nIcon icon="x" size="xsmall" />
						</button>
					</div>
					<div v-else :class="$style.nameRow">
						<N8nHeading bold tag="h3" size="medium">
							{{ panelStore.selectedAgent?.firstName }}
						</N8nHeading>
						<button
							:class="$style.inlineEditBtn"
							data-testid="agent-edit-name"
							title="Edit name"
							@click="startEditName"
						>
							<N8nIcon icon="pen" size="xsmall" />
						</button>
					</div>
					<N8nText color="text-light" size="small">
						{{ panelStore.selectedAgent?.role }}
					</N8nText>
					<div v-if="panelStore.zoneName" :class="$style.zone">{{ panelStore.zoneName }}</div>
				</div>
			</div>
			<button
				:class="$style.closeBtn"
				data-testid="agent-panel-close"
				@click="panelStore.closePanel()"
			>
				<N8nIcon icon="x" size="medium" />
			</button>
		</div>

		<!-- Avatar edit popover -->
		<div v-if="isEditingAvatar" :class="$style.avatarEditRow" data-testid="agent-avatar-edit-row">
			<input
				v-model="editAvatar"
				:class="$style.editInput"
				placeholder="Emoji or image URL"
				data-testid="agent-edit-avatar-input"
				maxlength="255"
				@keydown.enter="saveAvatar"
				@keydown.escape="cancelEditAvatar"
			/>
			<N8nButton label="Save" size="mini" @click="saveAvatar" />
			<N8nButton label="Cancel" type="tertiary" size="mini" @click="cancelEditAvatar" />
		</div>

		<!-- Loading -->
		<div v-if="panelStore.isLoading" :class="$style.loading">
			<N8nIcon icon="spinner" spin size="medium" />
			<N8nText color="text-light" size="small">Loading capabilities...</N8nText>
		</div>

		<!-- Content -->
		<div v-else :class="$style.content">
			<!-- Workflows -->
			<section :class="$style.section">
				<div :class="$style.sectionTitle">Workflows</div>
				<div v-if="panelStore.capabilities?.workflows.length" :class="$style.list">
					<div
						v-for="wf in panelStore.capabilities.workflows"
						:key="wf.id"
						:class="$style.listItem"
					>
						<N8nIcon icon="workflow" :class="$style.itemIcon" size="small" />
						<span :class="$style.itemName">{{ wf.name }}</span>
						<span :class="[$style.badge, wf.active ? $style.badgeActive : $style.badgeInactive]">
							{{ wf.active ? 'Active' : 'Inactive' }}
						</span>
					</div>
				</div>
				<N8nText v-else color="text-light" size="small">No workflows accessible</N8nText>
			</section>

			<!-- Credentials -->
			<section :class="$style.section">
				<div :class="$style.sectionTitle">Credentials</div>
				<div v-if="panelStore.capabilities?.credentials.length" :class="$style.list">
					<div
						v-for="cred in panelStore.capabilities.credentials"
						:key="cred.id"
						:class="$style.listItem"
					>
						<N8nIcon icon="key-round" :class="$style.itemIcon" size="small" />
						<span :class="$style.itemName">{{ cred.name }}</span>
						<N8nText color="text-light" size="xsmall">{{ cred.type }}</N8nText>
					</div>
				</div>
				<N8nText v-else color="text-light" size="small">No credentials accessible</N8nText>
			</section>

			<!-- Connected Agents -->
			<section v-if="panelStore.connectedAgents.length" :class="$style.section">
				<div :class="$style.sectionTitle">Connected Agents</div>
				<div :class="$style.list">
					<div v-for="agent in panelStore.connectedAgents" :key="agent.id" :class="$style.listItem">
						<AgentAvatarComp :avatar="agent.avatar" size="small" />
						<span :class="$style.itemName">{{ agent.firstName }}</span>
					</div>
				</div>
			</section>

			<!-- Task Input -->
			<section :class="$style.section">
				<div :class="$style.sectionTitle">Run a Task</div>
				<textarea
					v-model="taskPrompt"
					:class="$style.taskInput"
					placeholder="Describe what this agent should do..."
					data-testid="agent-task-input"
					:disabled="panelStore.isSubmitting"
				/>

				<!-- Advanced: BYOK -->
				<details :class="$style.advanced">
					<summary :class="$style.advancedSummary">Advanced</summary>
					<div :class="$style.advancedContent">
						<label :class="$style.advancedLabel">LLM API Key</label>
						<input
							v-model="llmApiKey"
							:class="$style.advancedInput"
							type="password"
							placeholder="sk-..."
							data-testid="agent-llm-key-input"
							autocomplete="off"
						/>
					</div>
				</details>

				<N8nButton
					:label="panelStore.isSubmitting ? 'Running...' : 'Run Task'"
					:disabled="!taskPrompt.trim() || panelStore.isSubmitting"
					:loading="panelStore.isSubmitting"
					size="medium"
					data-testid="agent-run-task"
					:class="$style.runBtn"
					@click="onRunTask"
				/>
			</section>

			<!-- Live Streaming Steps -->
			<section
				v-if="panelStore.streamingSteps.length || panelStore.isStreaming"
				:class="$style.section"
			>
				<div :class="$style.sectionTitle">Live Progress</div>
				<div :class="$style.streamSteps">
					<div
						v-for="(step, i) in panelStore.streamingSteps"
						:key="i"
						:class="$style.streamStep"
						:style="{ animationDelay: `${i * 0.1}s` }"
					>
						<div :class="$style.streamStepHeader">
							<N8nIcon :icon="stepIcon(step)" :class="$style.streamStepIcon" size="small" />
							<span :class="$style.streamStepAction">{{ step.action }}</span>
							<span v-if="step.workflowName" :class="$style.streamStepWorkflow">
								{{ step.workflowName }}
							</span>
							<span v-if="step.toAgent" :class="$style.streamStepAgent">
								&rarr; {{ step.toAgent }}
							</span>
							<span :class="$style.streamStepStatus">
								<N8nIcon
									:icon="stepStatusIcon(step.status)"
									:spin="step.status === 'running'"
									size="xsmall"
									:class="{
										[$style.statusSuccess]: step.status === 'success',
										[$style.statusFailed]: step.status === 'failed' || step.status === 'error',
										[$style.statusRunning]: step.status === 'running',
									}"
								/>
							</span>
						</div>
						<div v-if="step.result" :class="$style.streamStepResult">{{ step.result }}</div>
						<div v-if="step.error" :class="$style.streamStepError">{{ step.error }}</div>
					</div>

					<!-- Thinking indicator between steps -->
					<div v-if="panelStore.isStreaming" :class="$style.thinking">
						<span :class="$style.thinkingDot" />
						<span :class="[$style.thinkingDot, $style.thinkingDot2]" />
						<span :class="[$style.thinkingDot, $style.thinkingDot3]" />
					</div>
				</div>

				<!-- Summary card -->
				<div v-if="panelStore.streamingSummary" :class="$style.summaryCard">
					<N8nIcon icon="check" :class="$style.summaryIcon" size="small" />
					<span>{{ panelStore.streamingSummary }}</span>
				</div>
			</section>

			<!-- Fallback: Static Task Result (non-streaming response) -->
			<section
				v-if="panelStore.taskResult && !panelStore.streamingSteps.length"
				:class="$style.section"
			>
				<div :class="$style.sectionTitle">Result</div>
				<div
					:class="[
						$style.resultBox,
						panelStore.taskResult.status === 'error' ? $style.resultError : $style.resultSuccess,
					]"
				>
					<div v-if="panelStore.taskResult.summary" :class="$style.resultSummary">
						{{ panelStore.taskResult.summary }}
					</div>
					<div v-if="panelStore.taskResult.message" :class="$style.resultMessage">
						{{ panelStore.taskResult.message }}
					</div>
					<div v-if="panelStore.taskResult.steps?.length" :class="$style.steps">
						<div v-for="(step, i) in panelStore.taskResult.steps" :key="i" :class="$style.step">
							<span :class="$style.stepIndex">{{ i + 1 }}.</span>
							<span>{{ step.action }}</span>
							<span v-if="step.workflowName" :class="$style.stepWorkflow">
								{{ step.workflowName }}
							</span>
							<span v-if="step.toAgent" :class="$style.stepAgent"> &rarr; {{ step.toAgent }} </span>
							<span v-if="step.result" :class="$style.stepResult">{{ step.result }}</span>
						</div>
					</div>
				</div>
			</section>
		</div>
	</aside>
</template>

<style lang="scss" module>
.panel {
	width: 380px;
	flex-shrink: 0;
	border-left: var(--border);
	background: var(--color--background);
	display: flex;
	flex-direction: column;
	overflow-y: auto;
}

.header {
	display: flex;
	align-items: flex-start;
	justify-content: space-between;
	padding: var(--spacing--lg);
	border-bottom: var(--border);
}

.headerInfo {
	display: flex;
	gap: var(--spacing--xs);
	align-items: flex-start;
}

.avatarWrapper {
	position: relative;
	flex-shrink: 0;
}

.avatarEditBtn {
	position: absolute;
	bottom: -2px;
	right: -2px;
	width: 22px;
	height: 22px;
	border-radius: 50%;
	background: var(--color--background);
	border: var(--border);
	color: var(--color--text--tint-2);
	cursor: pointer;
	display: flex;
	align-items: center;
	justify-content: center;

	&:hover {
		color: var(--color--primary);
		border-color: var(--color--primary);
	}
}

.nameRow {
	display: flex;
	align-items: center;
	gap: var(--spacing--4xs);
}

.inlineEditBtn {
	background: none;
	border: none;
	color: var(--color--text--tint-2);
	cursor: pointer;
	padding: var(--spacing--5xs);
	display: flex;
	align-items: center;
	opacity: 0;
	transition: opacity 0.15s;

	.nameRow:hover & {
		opacity: 1;
	}

	&:hover {
		color: var(--color--primary);
	}
}

.editRow {
	display: flex;
	align-items: center;
	gap: var(--spacing--4xs);
}

.editInput {
	padding: var(--spacing--4xs) var(--spacing--2xs);
	border: var(--border);
	border-radius: var(--radius);
	font-family: var(--font-family);
	font-size: var(--font-size--sm);
	color: var(--color--text);
	background: var(--color--background);
	min-width: 0;
	flex: 1;

	&:focus {
		outline: none;
		border-color: var(--color--primary);
	}
}

.editAction {
	background: none;
	border: none;
	color: var(--color--text--tint-2);
	cursor: pointer;
	padding: var(--spacing--4xs);
	display: flex;
	align-items: center;

	&:hover {
		color: var(--color--primary);
	}
}

.avatarEditRow {
	display: flex;
	align-items: center;
	gap: var(--spacing--2xs);
	padding: var(--spacing--2xs) var(--spacing--lg);
	border-bottom: var(--border);
	background: var(--color--foreground--tint-2);
}

.zone {
	font-size: var(--font-size--2xs);
	color: var(--color--primary);
	margin-top: var(--spacing--4xs);
}

.closeBtn {
	background: none;
	border: none;
	color: var(--color--text--tint-2);
	cursor: pointer;
	padding: var(--spacing--4xs);
	border-radius: var(--radius);
	display: flex;
	align-items: center;
	justify-content: center;

	&:hover {
		color: var(--color--text);
		background: var(--color--foreground--tint-2);
	}
}

.loading {
	padding: var(--spacing--2xl);
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: var(--spacing--xs);
}

.content {
	display: flex;
	flex-direction: column;
	gap: 0;
}

.section {
	padding: var(--spacing--sm) var(--spacing--lg);
	border-bottom: var(--border);
}

.sectionTitle {
	font-size: var(--font-size--2xs);
	font-weight: var(--font-weight--bold);
	color: var(--color--text--tint-2);
	text-transform: uppercase;
	letter-spacing: 0.5px;
	margin: 0 0 var(--spacing--2xs);
}

.list {
	display: flex;
	flex-direction: column;
	gap: var(--spacing--4xs);
}

.listItem {
	display: flex;
	align-items: center;
	gap: var(--spacing--2xs);
	padding: var(--spacing--4xs) 0;
	font-size: var(--font-size--sm);
}

.itemIcon {
	color: var(--color--text--tint-2);
	flex-shrink: 0;
}

.itemName {
	color: var(--color--text);
	flex: 1;
	min-width: 0;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.badge {
	font-size: var(--font-size--3xs);
	padding: 1px var(--spacing--4xs);
	border-radius: var(--radius);
	flex-shrink: 0;
	font-weight: var(--font-weight--bold);
}

.badgeActive {
	background: var(--color--success--tint-3);
	color: var(--color--success--shade-1);
}

.badgeInactive {
	background: var(--color--foreground--tint-2);
	color: var(--color--text--tint-2);
}

.taskInput {
	width: 100%;
	min-height: 80px;
	padding: var(--spacing--2xs);
	border: var(--border);
	border-radius: var(--radius);
	font-family: var(--font-family);
	font-size: var(--font-size--sm);
	color: var(--color--text);
	background: var(--color--background);
	resize: vertical;
	box-sizing: border-box;

	&::placeholder {
		color: var(--color--text--tint-2);
	}

	&:focus {
		outline: none;
		border-color: var(--color--primary);
	}

	&:disabled {
		opacity: 0.6;
	}
}

// BYOK Advanced section
.advanced {
	margin-top: var(--spacing--2xs);
}

.advancedSummary {
	font-size: var(--font-size--2xs);
	color: var(--color--text--tint-2);
	cursor: pointer;
	user-select: none;

	&:hover {
		color: var(--color--text--tint-1);
	}
}

.advancedContent {
	margin-top: var(--spacing--2xs);
	display: flex;
	flex-direction: column;
	gap: var(--spacing--4xs);
}

.advancedLabel {
	font-size: var(--font-size--2xs);
	color: var(--color--text--tint-2);
}

.advancedInput {
	padding: var(--spacing--4xs) var(--spacing--2xs);
	border: var(--border);
	border-radius: var(--radius);
	font-family: var(--font-family);
	font-size: var(--font-size--sm);
	color: var(--color--text);
	background: var(--color--background);

	&:focus {
		outline: none;
		border-color: var(--color--primary);
	}
}

.runBtn {
	margin-top: var(--spacing--2xs);
	width: 100%;
}

// Live streaming steps
.streamSteps {
	display: flex;
	flex-direction: column;
	gap: var(--spacing--4xs);
}

.streamStep {
	padding: var(--spacing--2xs) var(--spacing--xs);
	background: var(--color--foreground--tint-2);
	border-radius: var(--radius);
	animation: slideIn 0.3s ease-out both;
}

@keyframes slideIn {
	from {
		opacity: 0;
		transform: translateY(8px);
	}
	to {
		opacity: 1;
		transform: translateY(0);
	}
}

.streamStepHeader {
	display: flex;
	align-items: center;
	gap: var(--spacing--4xs);
	font-size: var(--font-size--2xs);
}

.streamStepIcon {
	color: var(--color--text--tint-2);
	flex-shrink: 0;
}

.streamStepAction {
	color: var(--color--text);
	font-weight: var(--font-weight--bold);
}

.streamStepWorkflow {
	color: var(--color--primary);
}

.streamStepAgent {
	color: var(--color--secondary);
}

.streamStepStatus {
	margin-left: auto;
	flex-shrink: 0;
}

.statusSuccess {
	color: var(--color--success);
}

.statusFailed {
	color: var(--color--danger);
}

.statusRunning {
	color: var(--color--text--tint-2);
}

.streamStepResult {
	font-size: var(--font-size--2xs);
	color: var(--color--text--tint-1);
	margin-top: var(--spacing--4xs);
	padding-left: var(--spacing--lg);
	font-style: italic;
}

.streamStepError {
	font-size: var(--font-size--2xs);
	color: var(--color--danger);
	margin-top: var(--spacing--4xs);
	padding-left: var(--spacing--lg);
}

// Thinking dots
.thinking {
	display: flex;
	align-items: center;
	gap: var(--spacing--4xs);
	padding: var(--spacing--2xs) var(--spacing--xs);
}

.thinkingDot {
	width: 6px;
	height: 6px;
	border-radius: 50%;
	background: var(--color--text--tint-2);
	animation: bounce 1.4s ease-in-out infinite both;
}

.thinkingDot2 {
	animation-delay: 0.16s;
}

.thinkingDot3 {
	animation-delay: 0.32s;
}

@keyframes bounce {
	0%,
	80%,
	100% {
		transform: scale(0.6);
		opacity: 0.4;
	}
	40% {
		transform: scale(1);
		opacity: 1;
	}
}

// Summary card
.summaryCard {
	display: flex;
	align-items: flex-start;
	gap: var(--spacing--2xs);
	margin-top: var(--spacing--2xs);
	padding: var(--spacing--xs);
	background: var(--color--success--tint-4);
	border: 1px solid var(--color--success--tint-2);
	border-radius: var(--radius);
	font-size: var(--font-size--sm);
	color: var(--color--text);
	animation: fadeIn 0.4s ease-out both;
}

.summaryIcon {
	color: var(--color--success);
	flex-shrink: 0;
	margin-top: 1px;
}

@keyframes fadeIn {
	from {
		opacity: 0;
	}
	to {
		opacity: 1;
	}
}

// Static result fallback
.resultBox {
	padding: var(--spacing--xs);
	border-radius: var(--radius);
	font-size: var(--font-size--sm);
}

.resultSuccess {
	background: var(--color--success--tint-4);
	border: 1px solid var(--color--success--tint-2);
}

.resultError {
	background: var(--color--danger--tint-4);
	border: 1px solid var(--color--danger--tint-3);
}

.resultSummary {
	color: var(--color--text);
	font-weight: var(--font-weight--bold);
	margin-bottom: var(--spacing--4xs);
}

.resultMessage {
	color: var(--color--text--tint-1);
}

.steps {
	margin-top: var(--spacing--2xs);
	display: flex;
	flex-direction: column;
	gap: var(--spacing--4xs);
}

.step {
	display: flex;
	gap: var(--spacing--4xs);
	align-items: baseline;
	font-size: var(--font-size--2xs);
	color: var(--color--text--tint-1);
}

.stepIndex {
	color: var(--color--text--tint-2);
	font-weight: var(--font-weight--bold);
	flex-shrink: 0;
}

.stepWorkflow {
	color: var(--color--primary);
}

.stepAgent {
	color: var(--color--secondary);
}

.stepResult {
	color: var(--color--text--tint-2);
	font-style: italic;
}
</style>
