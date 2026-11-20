import Controller from '@ember/controller';
import { inject as service } from '@ember/service';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';
import { task } from 'ember-concurrency';

export default class ConnectivityFuelProvidersIndexController extends Controller {
    @service fetch;
    @service notifications;
    @service tableContext;
    @service fuelIntegrationActions;
    @service intl;

    @tracked queryParams = ['page', 'limit', 'sort', 'query', 'provider', 'status', 'environment'];
    @tracked page = 1;
    @tracked limit;
    @tracked sort = '-updated_at';
    @tracked query;
    @tracked provider;
    @tracked status;
    @tracked environment;
    @tracked table;
    @tracked providers = [];

    constructor() {
        super(...arguments);
        this.loadProviders.perform();
    }

    get actionButtons() {
        return [
            {
                icon: 'refresh',
                onClick: this.refresh,
                helpText: this.intl.t('common.reload'),
            },
            {
                icon: 'plus',
                text: this.intl.t('literal.fleet-ops.connect-integration'),
                type: 'primary',
                onClick: () => this.fuelIntegrationActions.transition.create(),
            },
        ];
    }

    get bulkActions() {
        const selected = this.tableContext.getSelectedRows();

        return [
            {
                label: this.intl.t('literal.fleet-ops.sync-selected', { length: selected.length }),
                fn: () => selected.forEach((connection) => this.syncConnection(connection)),
            },
        ];
    }

    get columns() {
        return [
            {
                sticky: true,
                label: this.intl.t('literal.fleet-ops.integration'),
                valuePath: 'name',
                cellComponent: 'click-to-copy',
                resizable: true,
                sortable: true,
                filterable: true,
                filterParam: 'query',
                filterComponent: 'filter/string',
            },
            {
                label: this.intl.t('literal.fleet-ops.provider-key'),
                valuePath: 'provider',
                resizable: true,
                sortable: true,
                filterable: true,
                filterComponent: 'filter/string',
            },
            {
                label: this.intl.t('literal.fleet-ops.status-ec53a'),
                valuePath: 'status',
                cellComponent: 'table/cell/status',
                resizable: true,
                sortable: true,
                filterable: true,
                filterComponent: 'filter/multi-option',
                filterOptions: ['configured', 'connected', 'active', 'error', 'disabled'],
            },
            {
                label: this.intl.t('literal.fleet-ops.last-sync-e0997'),
                valuePath: 'last_synced_at',
                resizable: true,
                sortable: true,
            },
            {
                label: this.intl.t('literal.fleet-ops.imported'),
                valuePath: 'last_sync_state.summary.imported',
                resizable: true,
                sortable: false,
            },
            {
                label: this.intl.t('literal.fleet-ops.unmatched'),
                valuePath: 'last_sync_state.summary.unmatched',
                resizable: true,
                sortable: false,
            },
            {
                label: this.intl.t('literal.fleet-ops.last-error'),
                valuePath: 'last_error',
                resizable: true,
                hidden: true,
            },
            {
                label: '',
                cellComponent: 'table/cell/dropdown',
                ddButtonText: false,
                ddButtonIcon: 'ellipsis-h',
                ddButtonIconPrefix: 'fas',
                ddMenuLabel: this.intl.t('literal.fleet-ops.fuel-integration-actions'),
                cellClassNames: 'overflow-visible',
                wrapperClass: 'flex items-center justify-end mx-2',
                sticky: 'right',
                width: 60,
                actions: [
                    { label: this.intl.t('literal.fleet-ops.open-integration'), fn: this.openConnection },
                    { label: this.intl.t('literal.fleet-ops.edit-settings'), fn: this.editConnection },
                    { separator: true },
                    { label: this.intl.t('literal.fleet-ops.test-connection'), fn: this.testConnection },
                    { label: this.intl.t('literal.fleet-ops.sync-transactions'), fn: this.syncConnection },
                ],
                sortable: false,
                filterable: false,
                resizable: false,
                searchable: false,
            },
        ];
    }

    @task *loadProviders() {
        try {
            this.providers = yield this.fetch.get('fuel-provider-connections/providers');
        } catch (error) {
            this.notifications.serverError(error);
        }
    }

    @action refresh() {
        this.target.send('refresh');
    }

    @action openConnection(connection) {
        return this.fuelIntegrationActions.transition.view(connection);
    }

    @action editConnection(connection) {
        return this.fuelIntegrationActions.transition.edit(connection);
    }

    @action async testConnection(connection) {
        try {
            await this.fetch.post(`fuel-provider-connections/${connection.id}/test-connection`);
            this.notifications.success(this.intl.t('literal.fleet-ops.fuel-integration-connection-tested'));
            this.refresh();
        } catch (error) {
            this.notifications.serverError(error);
        }
    }

    @action async syncConnection(connection) {
        try {
            await this.fetch.post(`fuel-provider-connections/${connection.id}/sync`, { async: true });
            this.notifications.success(this.intl.t('literal.fleet-ops.fuel-transaction-sync-queued'));
            this.refresh();
        } catch (error) {
            this.notifications.serverError(error);
        }
    }
}
