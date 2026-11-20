import Component from '@glimmer/component';

import { inject as service } from '@ember/service';
export default class CellTelematicStatusComponent extends Component {
    @service intl;
    get status() {
        return this.args.row?.status;
    }

    get badgeStatus() {
        switch (this.status) {
            case 'active':
            case 'connected':
                return 'success';
            case 'synchronizing':
                return 'info';
            case 'error':
            case 'degraded':
            case 'disconnected':
                return 'warning';
            default:
                return this.status ?? 'default';
        }
    }

    get label() {
        switch (this.status) {
            case 'active':
            case 'connected':
                return this.intl.t('literal.fleet-ops.connected');
            case 'synchronizing':
                return this.intl.t('literal.fleet-ops.syncing');
            case 'initialized':
                return this.intl.t('literal.fleet-ops.not-tested');
            case 'error':
                return this.intl.t('literal.fleet-ops.needs-attention');
            default:
                return this.status ?? this.intl.t('literal.fleet-ops.unknown');
        }
    }
}
