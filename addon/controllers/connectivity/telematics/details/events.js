import Controller from '@ember/controller';
import { action } from '@ember/object';
import { inject as service } from '@ember/service';
import { tracked } from '@glimmer/tracking';
import { task } from 'ember-concurrency';

export default class ConnectivityTelematicsDetailsEventsController extends Controller {
    get severityOptions() {
        return [
            { label: this.intl.t('literal.fleet-ops.info'), value: 'info' },
            { label: this.intl.t('literal.fleet-ops.warning'), value: 'warning' },
            { label: this.intl.t('literal.fleet-ops.error'), value: 'error' },
            { label: this.intl.t('literal.fleet-ops.critical'), value: 'critical' },
            { label: this.intl.t('literal.fleet-ops.high'), value: 'high' },
        ];
    }

    @service deviceEventActions;
    @service hostRouter;
    @service intl;

    @tracked queryParams = ['page', 'limit', 'sort', 'query', 'event_type', 'severity', 'device_uuid', 'provider', 'processed', 'occurred_at', 'created_at'];
    @tracked telematic;
    @tracked page = 1;
    @tracked limit;
    @tracked sort = '-created_at';
    @tracked query;
    @tracked event_type;
    @tracked severity;
    @tracked device_uuid;
    @tracked provider;
    @tracked processed;
    @tracked occurred_at;
    @tracked created_at;

    get events() {
        return Array.from(this.model ?? []);
    }

    get warningEventsCount() {
        return this.events.filter((event) => ['warning', 'error', 'critical', 'high'].includes(String(event.severity ?? '').toLowerCase())).length;
    }

    get unprocessedEventsCount() {
        return this.events.filter((event) => !event.processed_at).length;
    }

    get deviceCount() {
        return new Set(this.events.map((event) => event.device_uuid).filter(Boolean)).size;
    }

    get hasActiveFilters() {
        return Boolean(this.query || this.event_type || this.severity || this.device_uuid || this.provider || this.processed || this.occurred_at || this.created_at);
    }

    get hasEvents() {
        return this.events.length > 0;
    }

    get hasHealthyEventState() {
        return this.hasEvents && this.warningEventsCount === 0 && this.unprocessedEventsCount === 0 && !this.hasActiveFilters;
    }

    get emptyStateVariant() {
        if (this.hasEvents) {
            return null;
        }

        if (this.hasActiveFilters) {
            return 'filtered_empty';
        }

        return 'empty';
    }

    get emptyStateContent() {
        switch (this.emptyStateVariant) {
            case 'filtered_empty':
                return {
                    tone: 'info',
                    icon: 'filter',
                    title: this.intl.t('literal.fleet-ops.no-events-match-these-filters'),
                    message: this.intl.t('literal.fleet-ops.clear-the-current-search-and-filters-to-return-t-0bc05'),
                    primaryText: this.intl.t('literal.fleet-ops.clear-filters'),
                    primaryIcon: 'filter',
                    primaryAction: this.clearFilters,
                };
            case 'empty':
                return {
                    tone: 'info',
                    icon: 'list',
                    title: this.intl.t('literal.fleet-ops.no-telemetry-events-yet'),
                    message: this.intl.t('literal.fleet-ops.events-arrive-through-provider-webhooks-or-inges-d08f7'),
                    primaryText: this.intl.t('literal.fleet-ops.refresh'),
                    primaryIcon: 'refresh',
                    primaryAction: this.refresh,
                    note: this.intl.t('literal.fleet-ops.provider-payloads-headers-and-raw-diagnostics-ar-e463f'),
                };
            default:
                return null;
        }
    }

    get metrics() {
        return [
            {
                label: this.intl.t('literal.fleet-ops.recent-events'),
                value: this.model?.meta?.total ?? this.events.length,
                icon: 'list',
                accentClass: 'fleetops-connectivity-kpi-accent-blue',
            },
            { label: this.intl.t('literal.fleet-ops.warnings'), value: this.warningEventsCount, icon: 'triangle-exclamation', accentClass: 'fleetops-connectivity-kpi-accent-amber' },
            { label: this.intl.t('literal.fleet-ops.unprocessed'), value: this.unprocessedEventsCount, icon: 'clock', accentClass: 'fleetops-connectivity-kpi-accent-rose' },
            { label: this.intl.t('literal.fleet-ops.devices-reporting'), value: this.deviceCount, icon: 'microchip', accentClass: 'fleetops-connectivity-kpi-accent-green' },
        ];
    }

    get actionButtons() {
        return [
            {
                icon: 'refresh',
                size: 'sm',
                onClick: this.refresh,
                helpText: this.intl.t('common.refresh'),
                wrapperClass: 'fleetops-telematics-action-button',
                isLoading: this.refreshTask.isRunning,
                disabled: this.refreshTask.isRunning,
            },
        ];
    }

    @tracked bulkActions = [];

    get columns() {
        return [
            {
                sticky: true,
                label: this.intl.t('literal.fleet-ops.event'),
                valuePath: 'event_type',
                cellComponent: 'table/cell/anchor',
                action: this.deviceEventActions.transition.view,
                permission: 'fleet-ops view device-event',
                resizable: true,
                sortable: true,
                filterable: true,
                filterParam: 'event_type',
                filterComponent: 'filter/string',
            },
            {
                label: this.intl.t('literal.fleet-ops.device'),
                valuePath: 'device_name',
                resizable: true,
                sortable: true,
                filterable: true,
                filterComponent: 'filter/model',
                filterComponentPlaceholder: this.intl.t('literal.fleet-ops.select-device-1dffe'),
                filterParam: 'device_uuid',
                model: 'device',
                modelNamePath: 'displayName',
                query: { telematic_uuid: this.telematic?.id },
            },
            {
                label: this.intl.t('literal.fleet-ops.provider-27703'),
                valuePath: 'provider',
                cellClassNames: 'uppercase',
                resizable: true,
                sortable: true,
                filterable: true,
                filterParam: 'provider',
                filterComponent: 'filter/string',
            },
            {
                label: this.intl.t('literal.fleet-ops.severity'),
                valuePath: 'severity',
                cellComponent: 'table/cell/status',
                resizable: true,
                sortable: true,
                filterable: true,
                filterParam: 'severity',
                filterComponent: 'filter/multi-option',
                filterOptions: this.severityOptions,
                filterOptionLabel: 'label',
                filterOptionValue: 'value',
            },
            {
                label: this.intl.t('literal.fleet-ops.processed-e6f64'),
                valuePath: 'processedAt',
                sortParam: 'processed_at',
                resizable: true,
                sortable: true,
                filterable: true,
                filterParam: 'processed',
                filterComponent: 'filter/multi-option',
                filterOptions: [
                    { label: this.intl.t('literal.fleet-ops.processed-e6f64'), value: 'processed' },
                    { label: this.intl.t('literal.fleet-ops.unprocessed'), value: 'unprocessed' },
                ],
                filterOptionLabel: 'label',
                filterOptionValue: 'value',
            },
            {
                label: this.intl.t('literal.fleet-ops.occurred-b378d'),
                valuePath: 'occurredAt',
                sortParam: 'occurred_at',
                resizable: true,
                sortable: true,
                filterable: true,
                filterComponent: 'filter/date',
            },
            {
                label: this.intl.t('column.created-at'),
                valuePath: 'createdAt',
                sortParam: 'created_at',
                resizable: true,
                sortable: true,
                filterable: true,
                filterComponent: 'filter/date',
                hidden: true,
            },
            {
                label: '',
                cellComponent: 'table/cell/dropdown',
                ddButtonText: false,
                ddButtonIcon: 'ellipsis-h',
                ddButtonIconPrefix: 'fas',
                ddMenuLabel: this.intl.t('common.resource-actions', { resource: this.intl.t('resource.device-event') }),
                cellClassNames: 'overflow-visible align-middle',
                wrapperClass: 'flex items-center justify-end mx-2',
                sticky: 'right',
                width: 60,
                actions: [
                    {
                        label: this.intl.t('common.view-resource', { resource: this.intl.t('resource.device-event') }),
                        fn: this.deviceEventActions.transition.view,
                        permission: 'fleet-ops view device-event',
                    },
                    {
                        label: this.intl.t('literal.fleet-ops.mark-processed-f1bfb'),
                        fn: this.markProcessed,
                        permission: 'fleet-ops update device-event',
                    },
                ],
                sortable: false,
                filterable: false,
                resizable: false,
                searchable: false,
            },
        ];
    }

    @action refresh() {
        if (this.refreshTask.isRunning) {
            return;
        }

        return this.refreshTask.perform();
    }

    @action clearFilters() {
        this.query = null;
        this.event_type = null;
        this.severity = null;
        this.device_uuid = null;
        this.provider = null;
        this.processed = null;
        this.occurred_at = null;
        this.created_at = null;
        this.page = 1;
    }

    @action async markProcessed(deviceEvent) {
        await this.deviceEventActions.markProcessed(deviceEvent);
        await this.hostRouter.refresh();
    }

    @task *refreshTask() {
        yield this.hostRouter.refresh();
    }
}
