import Controller from '@ember/controller';
import { inject as service } from '@ember/service';
import { action } from '@ember/object';

export default class ConnectivityFuelProvidersIndexDetailsTransactionsController extends Controller {
    @service intl;
    @service hostRouter;

    get columns() {
        return [
            { sticky: true, label: this.intl.t('literal.fleet-ops.transaction'), valuePath: 'provider_transaction_id', cellComponent: 'click-to-copy', resizable: true },
            { label: this.intl.t('literal.fleet-ops.status-ec53a'), valuePath: 'sync_status', cellComponent: 'table/cell/status', resizable: true },
            { label: this.intl.t('literal.fleet-ops.vehicle'), valuePath: 'vehicle_name', resizable: true },
            { label: this.intl.t('literal.fleet-ops.station'), valuePath: 'station_name', resizable: true },
            { label: this.intl.t('literal.fleet-ops.liters'), valuePath: 'volume', resizable: true },
            { label: this.intl.t('literal.fleet-ops.amount'), valuePath: 'amount', cellComponent: 'table/cell/currency', resizable: true },
            { label: this.intl.t('literal.fleet-ops.fuel-report'), valuePath: 'fuel_report_id', cellComponent: 'click-to-copy', resizable: true },
            { label: this.intl.t('literal.fleet-ops.date'), valuePath: 'transaction_at', resizable: true },
        ];
    }

    @action refresh() {
        return this.hostRouter.refresh();
    }
}
