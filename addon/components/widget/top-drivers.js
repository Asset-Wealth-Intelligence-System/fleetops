import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';
import { inject as service } from '@ember/service';
import { task } from 'ember-concurrency';

export default class WidgetTopDriversComponent extends Component {
    @service intl;

    get SORTS() {
        return [
            { key: 'orders_completed', label: this.intl.t('literal.fleet-ops.orders') },
            { key: 'on_time', label: this.intl.t('literal.fleet-ops.on-time') },
            { key: 'distance', label: this.intl.t('literal.fleet-ops.distance') },
        ];
    }

    static widgetId = 'fleet-ops-top-drivers-widget';

    @service fetch;

    @tracked sortBy = 'orders_completed';
    @tracked data = null;
    @tracked error = null;

    sorts = this.SORTS;

    constructor() {
        super(...arguments);
        this.load.perform();
    }

    @task *load() {
        try {
            this.data = yield this.fetch.get('fleet-ops/analytics/top-drivers', {
                period: '30d',
                limit: 10,
                sort_by: this.sortBy,
            });
            this.error = null;
        } catch (e) {
            this.error = e?.message ?? this.intl.t('literal.fleet-ops.failed-to-load-top-drivers');
        }
    }

    @action
    setSort(key) {
        this.sortBy = key;
        this.load.perform();
    }

    onTimeStatus(pct) {
        if (typeof pct !== 'number') return 'info';
        if (pct >= 95) return 'success';
        if (pct >= 85) return 'warning';
        return 'danger';
    }
}
