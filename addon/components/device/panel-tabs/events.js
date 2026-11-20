import Component from '@glimmer/component';
import { action } from '@ember/object';
import { inject as service } from '@ember/service';
import { tracked } from '@glimmer/tracking';
import { task } from 'ember-concurrency';

function toRecentList(records) {
    const list = Array.from(records ?? []);

    list.meta = {
        current_page: 1,
        last_page: 1,
        per_page: list.length,
        total: list.length,
        from: list.length > 0 ? 1 : 0,
        to: list.length,
    };

    return list;
}

export default class DevicePanelTabsEventsComponent extends Component {
    get severityOptions() {
        return [
            { label: this.intl.t('literal.fleet-ops.info'), value: 'info' },
            { label: this.intl.t('literal.fleet-ops.warning'), value: 'warning' },
            { label: this.intl.t('literal.fleet-ops.error'), value: 'error' },
            { label: this.intl.t('literal.fleet-ops.critical'), value: 'critical' },
            { label: this.intl.t('literal.fleet-ops.high'), value: 'high' },
        ];
    }

    @service intl;
    @service deviceEventActions;
    @service store;

    @tracked events = toRecentList();

    constructor() {
        super(...arguments);
        this.loadEvents.perform();
    }

    get device() {
        return this.args.resource ?? this.args.model;
    }

    get columns() {
        return [
            {
                sticky: true,
                label: this.intl.t('literal.fleet-ops.event'),
                valuePath: 'event_type',
                cellComponent: 'table/cell/anchor',
                action: this.deviceEventActions.panel?.view ?? this.deviceEventActions.transition.view,
                permission: 'fleet-ops view device-event',
                resizable: true,
            },
            {
                label: this.intl.t('literal.fleet-ops.severity'),
                valuePath: 'severity',
                cellComponent: 'table/cell/status',
                filterOptions: this.severityOptions,
                resizable: true,
            },
            {
                label: this.intl.t('literal.fleet-ops.message'),
                valuePath: 'message',
                resizable: true,
            },
            {
                label: this.intl.t('literal.fleet-ops.code'),
                valuePath: 'code',
                resizable: true,
            },
            {
                label: this.intl.t('literal.fleet-ops.processed-e6f64'),
                valuePath: 'processedAt',
                sortParam: 'processed_at',
                resizable: true,
            },
            {
                label: this.intl.t('literal.fleet-ops.occurred-b378d'),
                valuePath: 'occurredAt',
                sortParam: 'occurred_at',
                resizable: true,
            },
            {
                label: '',
                cellComponent: 'table/cell/dropdown',
                ddButtonText: false,
                ddButtonIcon: 'ellipsis-h',
                ddButtonIconPrefix: 'fas',
                wrapperClass: 'flex items-center justify-end mx-2',
                sticky: 'right',
                width: 60,
                actions: [
                    {
                        label: this.intl.t('literal.fleet-ops.view-event'),
                        fn: this.deviceEventActions.panel?.view ?? this.deviceEventActions.transition.view,
                        permission: 'fleet-ops view device-event',
                    },
                    {
                        label: this.intl.t('literal.fleet-ops.mark-processed-f1bfb'),
                        fn: this.markProcessed,
                        permission: 'fleet-ops update device-event',
                    },
                ],
            },
        ];
    }

    @action async markProcessed(deviceEvent) {
        await this.deviceEventActions.markProcessed(deviceEvent);
        await this.loadEvents.perform();
    }

    @action refreshEvents() {
        return this.loadEvents.perform();
    }

    @task *loadEvents() {
        if (!this.device?.id) {
            this.events = toRecentList();
            return;
        }

        const events = yield this.store.query('device-event', { device_uuid: this.device.id, limit: 10, sort: '-created_at' });
        this.events = toRecentList(events);
    }
}
