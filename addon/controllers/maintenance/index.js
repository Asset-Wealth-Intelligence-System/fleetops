import Controller from '@ember/controller';
import { tracked } from '@glimmer/tracking';
import { inject as service } from '@ember/service';
import { action } from '@ember/object';
import { task } from 'ember-concurrency';

export default class MaintenanceIndexController extends Controller {
    @service intl;
    @service fetch;
    @service docsPanel;

    @tracked hub = null;

    constructor() {
        super(...arguments);
        this.loadHub.perform();
    }

    get kpis() {
        return this.hub?.kpis ?? this.loadingKpis;
    }

    get actions() {
        return (this.hub?.actions ?? []).map((action) => this.normalizeAction(action));
    }

    get sections() {
        return this.hub?.sections ?? [];
    }

    get docs() {
        return (this.hub?.docs ?? []).map((doc) => ({
            ...doc,
            description: doc.description ?? this.docDescriptions[doc.slug] ?? '',
        }));
    }

    get docDescriptions() {
        return {
            'fleet-ops/maintenance/schedules/overview': this.intl.t('literal.fleet-ops.plan-recurring-service-windows-and-convert-due-s-25562'),
            'fleet-ops/maintenance/work-orders/overview': this.intl.t('literal.fleet-ops.coordinate-assigned-maintenance-work-vendors-due-4f1ba'),
            'fleet-ops/maintenance/equipment/overview': this.intl.t('literal.fleet-ops.track-serviceable-equipment-that-participates-in-ed032'),
            'fleet-ops/maintenance/parts/overview': this.intl.t('literal.fleet-ops.manage-parts-inventory-and-restocking-signals-us-fd09b'),
        };
    }

    normalizeAction(action = {}) {
        const query = action.query && typeof action.query === 'object' && !Array.isArray(action.query) ? action.query : {};

        return {
            ...action,
            query,
        };
    }

    get loadingKpis() {
        return [
            {
                key: 'overdue_schedules',
                label: this.intl.t('literal.fleet-ops.overdue-schedules'),
                value: '...',
                caption: this.intl.t('literal.fleet-ops.loading-recurring-service-risk'),
                tone: 'rose',
                icon: 'calendar-xmark',
                route: 'maintenance.schedules',
            },
            {
                key: 'upcoming_schedules',
                label: this.intl.t('literal.fleet-ops.due-this-week'),
                value: '...',
                caption: this.intl.t('literal.fleet-ops.loading-upcoming-service-windows'),
                tone: 'blue',
                icon: 'calendar-day',
                route: 'maintenance.schedules',
            },
            {
                key: 'open_work_orders',
                label: this.intl.t('literal.fleet-ops.open-work-orders'),
                value: '...',
                caption: this.intl.t('literal.fleet-ops.loading-active-maintenance-work'),
                tone: 'amber',
                icon: 'clipboard-list',
                route: 'maintenance.work-orders',
            },
            {
                key: 'low_stock_parts',
                label: this.intl.t('literal.fleet-ops.low-stock-parts'),
                value: '...',
                caption: this.intl.t('literal.fleet-ops.loading-parts-inventory-signals'),
                tone: 'amber',
                icon: 'cog',
                route: 'maintenance.parts',
            },
        ];
    }

    @action openDocs(link) {
        if (!link?.slug) {
            return;
        }

        return this.docsPanel.open(link.slug, {
            title: link.title ?? link.label,
            source: 'fleet-ops-maintenance-hub',
        });
    }

    @task *loadHub() {
        this.hub = yield this.fetch.get('fleet-ops/hubs/maintenance');
    }
}
