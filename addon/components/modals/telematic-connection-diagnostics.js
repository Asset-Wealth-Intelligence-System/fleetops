import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { inject as service } from '@ember/service';
import { action } from '@ember/object';
import { task } from 'ember-concurrency';
import copyToClipboard from '@fleetbase/ember-core/utils/copy-to-clipboard';

const SENSITIVE_METADATA_KEYS = ['password', 'secret', 'session', 'token'];

export default class ModalsTelematicConnectionDiagnosticsComponent extends Component {
    @service intl;
    @service fetch;
    @service modalsManager;
    @service notifications;

    @tracked result;
    @tracked startedAt;
    @tracked completedAt;

    constructor(owner, { options = {} }) {
        super(...arguments);
        this.options = options;
        this.setupOptions();
        this.runTest.perform();
    }

    get telematic() {
        return this.options.telematic;
    }

    get providerLabel() {
        return this.telematic?.provider_descriptor?.label ?? this.telematic?.provider ?? this.intl.t('literal.fleet-ops.provider-27703');
    }

    get providerKey() {
        return this.telematic?.provider;
    }

    get connectionState() {
        if (this.runTest.isRunning) {
            return 'testing';
        }

        if (!this.result) {
            return 'idle';
        }

        return this.result.success ? 'success' : 'failed';
    }

    get connectionStateTitle() {
        if (this.connectionState === 'testing') {
            return this.intl.t('literal.fleet-ops.testing-provider-connection');
        }

        if (this.connectionState === 'success') {
            return this.intl.t('literal.fleet-ops.connection-verified');
        }

        if (this.connectionState === 'failed') {
            return this.intl.t('literal.fleet-ops.connection-failed');
        }

        return this.intl.t('literal.fleet-ops.ready-to-test');
    }

    get connectionStateMessage() {
        if (this.connectionState === 'testing') {
            return this.intl.t('literal.fleet-ops.waiting-for-the-provider-to-accept-the-saved-cre-f2c14');
        }

        if (this.connectionState === 'idle') {
            return this.intl.t('literal.fleet-ops.run-a-connection-test-to-verify-the-saved-provid-8bbf8');
        }

        if (this.isDuplicateConnectionMessage) {
            return null;
        }

        return this.result?.message;
    }

    get isDuplicateConnectionMessage() {
        const message = this.result?.message;

        if (!message) {
            return false;
        }

        return ['connection successful', 'connection verified'].includes(message.trim().toLowerCase());
    }

    get connectionMetadataEntries() {
        const metadata = this.result?.metadata ?? {};

        return Object.entries(metadata)
            .filter(([key, value]) => {
                if (value === null || value === undefined || value === '') {
                    return false;
                }

                return !this.isSensitiveMetadataKey(key);
            })
            .map(([key, value]) => ({
                label: this.formatMetadataLabel(key),
                value: this.formatDiagnosticValue(value),
            }));
    }

    get hasConnectionMetadata() {
        return this.connectionMetadataEntries.length > 0;
    }

    get connectionDiagnosticEntries() {
        const entries = [];
        const startedAt = this.startedAt;
        const completedAt = this.completedAt;

        entries.push({
            time: this.formatDiagnosticTime(startedAt),
            tone: 'muted',
            text: this.intl.t('literal.fleet-ops.provider-selected-806e5', { providerLabel: this.providerLabel, value: this.providerKey ? ` (${this.providerKey})` : '' }),
        });

        entries.push({
            time: this.formatDiagnosticTime(startedAt),
            tone: 'info',
            text: this.intl.t('literal.fleet-ops.sending-saved-provider-connection-test-request'),
        });

        if (this.connectionState === 'testing') {
            entries.push({
                time: this.formatDiagnosticTime(),
                tone: 'info',
                text: this.intl.t('literal.fleet-ops.awaiting-provider-response'),
            });
            return entries;
        }

        if (this.connectionState === 'idle') {
            entries.push({
                time: this.formatDiagnosticTime(),
                tone: 'muted',
                text: this.intl.t('literal.fleet-ops.connection-test-has-not-been-run-yet'),
            });
            return entries;
        }

        entries.push({
            time: this.formatDiagnosticTime(completedAt),
            tone: 'info',
            text: this.intl.t('literal.fleet-ops.provider-response-received'),
        });

        if (this.hasConnectionMetadata) {
            entries.push({
                time: this.formatDiagnosticTime(completedAt),
                tone: 'muted',
                text: this.intl.t('literal.fleet-ops.provider-metadata', { join: this.connectionMetadataEntries.map((entry) => `${entry.label}=${entry.value}`).join(', ') }),
            });
        }

        if (this.connectionState === 'success') {
            entries.push({
                time: this.formatDiagnosticTime(completedAt),
                tone: 'success',
                text: this.intl.t('literal.fleet-ops.connection-verified'),
            });
            return entries;
        }

        entries.push({
            time: this.formatDiagnosticTime(completedAt),
            tone: 'danger',
            text: this.intl.t('literal.fleet-ops.connection-failed-b9b9b', { value: this.result?.message ? `: ${this.formatDiagnosticValue(this.result.message)}` : '' }),
        });

        return entries;
    }

    get connectionDiagnosticText() {
        return this.connectionDiagnosticEntries.map((entry) => `[${entry.time}] ${entry.text}`).join('\n');
    }

    setupOptions() {
        this.options.title = this.options.title ?? this.intl.t('literal.fleet-ops.test-connection');
        this.options.acceptButtonText = 'Run Test';
        this.options.acceptButtonIcon = 'plug';
        this.options.declineButtonText = this.options.declineButtonText ?? this.intl.t('literal.fleet-ops.close');
        this.options.confirm = async (modal) => {
            modal.startLoading();

            try {
                await this.runTest.perform();
            } finally {
                modal.stopLoading();
            }
        };
    }

    @task *runTest() {
        if (!this.telematic?.id) {
            return;
        }

        this.startedAt = new Date();
        this.completedAt = null;
        this.modalsManager.setOption('acceptButtonDisabled', true);
        this.modalsManager.setOption('acceptButtonText', 'Testing...');

        try {
            const result = yield this.fetch.post(`telematics/${this.telematic.id}/test-connection`);
            this.result = result;
            this.completedAt = new Date();
            yield this.options.onTested?.(result);
        } catch (error) {
            this.completedAt = new Date();
            this.result = {
                success: false,
                message: error.message || this.intl.t('literal.fleet-ops.connection-test-failed'),
            };
        } finally {
            this.modalsManager.setOption('acceptButtonDisabled', false);
            this.modalsManager.setOption('acceptButtonText', this.result ? this.intl.t('literal.fleet-ops.test-again') : this.intl.t('literal.fleet-ops.run-test'));
        }
    }

    @action
    copyConnectionDiagnostics() {
        copyToClipboard(this.connectionDiagnosticText)
            .then(() => {
                this.notifications.success(this.intl.t('literal.fleet-ops.connection-diagnostics-copied'));
            })
            .catch(() => {
                this.notifications.error(this.intl.t('literal.fleet-ops.unable-to-copy-connection-diagnostics'));
            });
    }

    formatMetadataLabel(key) {
        return key.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
    }

    formatDiagnosticValue(value) {
        const sanitizedValue = this.sanitizeDiagnosticValue(value);

        if (typeof sanitizedValue === 'object') {
            return JSON.stringify(sanitizedValue);
        }

        return String(sanitizedValue);
    }

    sanitizeDiagnosticValue(value, seen = new WeakSet()) {
        if (!value || typeof value !== 'object') {
            return value;
        }

        if (seen.has(value)) {
            return '[circular]';
        }

        seen.add(value);

        if (Array.isArray(value)) {
            return value.map((item) => this.sanitizeDiagnosticValue(item, seen));
        }

        return Object.entries(value).reduce((acc, [key, item]) => {
            if (!this.isSensitiveMetadataKey(key)) {
                acc[key] = this.sanitizeDiagnosticValue(item, seen);
            }

            return acc;
        }, {});
    }

    formatDiagnosticTime(date = new Date()) {
        if (!(date instanceof Date)) {
            return '--:--:--';
        }

        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
    }

    isSensitiveMetadataKey(key) {
        return SENSITIVE_METADATA_KEYS.some((sensitiveKey) => key.toLowerCase().includes(sensitiveKey));
    }
}
