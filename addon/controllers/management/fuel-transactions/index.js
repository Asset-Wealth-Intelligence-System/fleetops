import Controller from '@ember/controller';
import { inject as service } from '@ember/service';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';
import { task } from 'ember-concurrency';

export default class ManagementFuelTransactionsIndexController extends Controller {
    @service intl;
    @service tableContext;
    @service fetch;
    @service notifications;
    @service hostRouter;

    @tracked queryParams = ['page', 'limit', 'sort', 'query', 'provider', 'sync_status', 'vehicle', 'connection', 'transaction_at'];
    @tracked page = 1;
    @tracked limit;
    @tracked sort = '-transaction_at';
    @tracked query;
    @tracked provider;
    @tracked sync_status;
    @tracked vehicle;
    @tracked connection;
    @tracked transaction_at;
    @tracked table;

    get hasRecords() {
        return Array.from(this.model ?? []).length > 0;
    }

    get emptyStateTitle() {
        if (this.sync_status === 'unmatched') {
            return this.intl.t('literal.fleet-ops.no-unmatched-fuel-transactions');
        }

        if (this.connection) {
            return this.intl.t('literal.fleet-ops.no-transactions-imported-for-this-integration');
        }

        return this.intl.t('literal.fleet-ops.no-fuel-transactions-imported-yet');
    }

    get emptyStateMessage() {
        if (this.sync_status === 'unmatched') {
            return this.intl.t('literal.fleet-ops.fleet-ops-did-not-find-imported-provider-bills-t-772d6');
        }

        if (this.connection) {
            return this.intl.t('literal.fleet-ops.run-a-sync-from-the-fuel-integration-detail-page-5e375');
        }

        return this.intl.t('literal.fleet-ops.connect-petroapp-or-another-fuel-integration-the-881b8');
    }

    get actionButtons() {
        return [
            {
                icon: 'refresh',
                onClick: this.refresh,
                helpText: this.intl.t('literal.fleet-ops.refresh'),
            },
            {
                icon: 'gas-pump',
                text: this.intl.t('literal.fleet-ops.fuel-integrations'),
                onClick: () => this.hostRouter.transitionTo('console.fleet-ops.connectivity.fuel-providers.index'),
            },
        ];
    }

    @action refresh() {
        this.target.send('refresh');
    }

    get bulkActions() {
        const selected = this.tableContext.getSelectedRows();

        return [
            {
                label: this.intl.t('literal.fleet-ops.reprocess-selected', { length: selected.length }),
                fn: () => selected.forEach((transaction) => this.reprocessTransaction.perform(transaction)),
            },
        ];
    }

    get columns() {
        return [
            {
                sticky: true,
                label: this.intl.t('literal.fleet-ops.transaction'),
                valuePath: 'provider_transaction_id',
                cellComponent: 'click-to-copy',
                resizable: true,
                sortable: true,
                filterable: true,
                filterParam: 'query',
                filterComponent: 'filter/string',
            },
            {
                label: this.intl.t('literal.fleet-ops.provider-27703'),
                valuePath: 'provider',
                resizable: true,
                sortable: true,
                filterable: true,
                filterComponent: 'filter/string',
            },
            {
                label: this.intl.t('literal.fleet-ops.status-ec53a'),
                valuePath: 'sync_status',
                cellComponent: 'table/cell/status',
                resizable: true,
                sortable: true,
                filterable: true,
                filterComponent: 'filter/multi-option',
                filterOptions: ['imported', 'matched', 'unmatched', 'reviewed', 'ignored', 'duplicate', 'error'],
            },
            {
                label: this.intl.t('literal.fleet-ops.vehicle'),
                valuePath: 'vehicle_name',
                resizable: true,
                sortable: false,
                filterable: true,
                filterParam: 'vehicle',
                filterComponent: 'filter/model',
                model: 'vehicle',
                modelNamePath: 'displayName',
            },
            {
                label: this.intl.t('literal.fleet-ops.card-internal'),
                valuePath: 'vehicle_card_id',
                resizable: true,
            },
            {
                label: this.intl.t('literal.fleet-ops.trip'),
                valuePath: 'trip_number',
                resizable: true,
                hidden: true,
            },
            {
                label: this.intl.t('literal.fleet-ops.station'),
                valuePath: 'station_name',
                resizable: true,
            },
            {
                label: this.intl.t('literal.fleet-ops.liters'),
                valuePath: 'volume',
                resizable: true,
                sortable: true,
            },
            {
                label: this.intl.t('literal.fleet-ops.amount'),
                valuePath: 'amount',
                cellComponent: 'table/cell/currency',
                resizable: true,
                sortable: true,
            },
            {
                label: this.intl.t('literal.fleet-ops.fuel-report'),
                valuePath: 'fuel_report_id',
                cellComponent: 'table/cell/anchor',
                action: this.openFuelReport,
                resizable: true,
            },
            {
                label: this.intl.t('literal.fleet-ops.date'),
                valuePath: 'transactionAt',
                sortParam: 'transaction_at',
                resizable: true,
                sortable: true,
                filterable: true,
                filterParam: 'transaction_at',
                filterComponent: 'filter/date',
            },
            {
                label: '',
                cellComponent: 'table/cell/dropdown',
                ddButtonText: false,
                ddButtonIcon: 'ellipsis-h',
                ddButtonIconPrefix: 'fas',
                ddMenuLabel: this.intl.t('literal.fleet-ops.fuel-transaction-actions'),
                cellClassNames: 'overflow-visible',
                wrapperClass: 'flex items-center justify-end mx-2',
                sticky: 'right',
                width: 60,
                actions: [
                    { label: this.intl.t('literal.fleet-ops.review-details'), fn: this.openDetails },
                    { label: this.intl.t('literal.fleet-ops.open-fuel-report'), fn: this.openFuelReport },
                    { separator: true },
                    { label: this.intl.t('literal.fleet-ops.match-to-vehicle'), fn: this.matchVehicle },
                    { label: this.intl.t('literal.fleet-ops.match-to-order'), fn: this.matchOrder },
                    { label: this.intl.t('literal.fleet-ops.reprocess-rematch'), fn: (transaction) => this.reprocessTransaction.perform(transaction) },
                    { label: this.intl.t('literal.fleet-ops.ignore-transaction'), fn: (transaction) => this.markReviewed.perform(transaction, 'ignored') },
                    { label: this.intl.t('literal.fleet-ops.mark-reviewed'), fn: (transaction) => this.markReviewed.perform(transaction, 'reviewed') },
                ],
                sortable: false,
                filterable: false,
                resizable: false,
                searchable: false,
            },
        ];
    }

    @action openDetails(transaction) {
        return this.hostRouter.transitionTo('console.fleet-ops.management.fuel-transactions.index.details', transaction);
    }

    @action openFuelReport(transaction) {
        if (!transaction?.fuel_report_id) {
            this.notifications.info(this.intl.t('literal.fleet-ops.this-transaction-does-not-have-a-linked-fuel-rep-1584b'));
            return;
        }

        return this.hostRouter.transitionTo('console.fleet-ops.management.fuel-reports.index.details', transaction.fuel_report_id);
    }

    @action matchVehicle(transaction) {
        return this.hostRouter.transitionTo('console.fleet-ops.management.fuel-transactions.index.details', transaction);
    }

    @action matchOrder(transaction) {
        return this.hostRouter.transitionTo('console.fleet-ops.management.fuel-transactions.index.details', transaction);
    }

    @task *reprocessTransaction(transaction) {
        try {
            yield this.fetch.post(`fuel-provider-transactions/${transaction.id}/reprocess`);
            this.notifications.success(this.intl.t('literal.fleet-ops.fuel-transaction-reprocessed'));
            this.target.send('refresh');
        } catch (error) {
            this.notifications.serverError(error);
        }
    }

    @task *markReviewed(transaction, status) {
        try {
            yield this.fetch.post(`fuel-provider-transactions/${transaction.id}/review`, { status });
            this.notifications.success(status === 'ignored' ? this.intl.t('literal.fleet-ops.fuel-transaction-ignored') : this.intl.t('literal.fleet-ops.fuel-transaction-marked-reviewed'));
            this.target.send('refresh');
        } catch (error) {
            this.notifications.serverError(error);
        }
    }
}
