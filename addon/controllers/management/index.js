import Controller from '@ember/controller';
import { tracked } from '@glimmer/tracking';
import { inject as service } from '@ember/service';
import { action } from '@ember/object';
import { task } from 'ember-concurrency';

export default class ManagementIndexController extends Controller {
    @service intl;
    @service fetch;
    @service docsPanel;

    @tracked hub = null;

    constructor() {
        super(...arguments);
        this.loadHub.perform();
    }

    get kpis() {
        return (this.hub?.kpis ?? this.loadingKpis).map((kpi) => ({
            ...kpi,
            actionLabel: kpi.actionLabel ?? this.kpiActionLabels[kpi.key] ?? this.intl.t('literal.fleet-ops.open-a31ae', { label: kpi.label }),
        }));
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
            'fleet-ops/resources/drivers/overview': this.intl.t('literal.fleet-ops.create-driver-profiles-app-access-assignment-con-51fac'),
            'fleet-ops/resources/vehicles/overview': this.intl.t('literal.fleet-ops.track-fleet-assets-assignment-readiness-and-vehi-16d14'),
            'fleet-ops/resources/fleets/overview': this.intl.t('literal.fleet-ops.group-drivers-and-vehicles-by-team-region-or-ser-74e21'),
            'fleet-ops/resources/contacts/overview': this.intl.t('literal.fleet-ops.manage-people-and-organizations-used-across-orde-4eac2'),
            'fleet-ops/resources/places/overview': this.intl.t('literal.fleet-ops.manage-reusable-pickup-dropoff-hub-and-facility-10f99'),
            'fleet-ops/resources/issues/overview': this.intl.t('literal.fleet-ops.track-incidents-service-exceptions-and-operation-eaba3'),
        };
    }

    get kpiActionLabels() {
        return {
            drivers: this.intl.t('literal.fleet-ops.manage-drivers'),
            vehicles: this.intl.t('literal.fleet-ops.track-vehicles'),
            issues: this.intl.t('literal.fleet-ops.review-issues'),
            fuel_records: this.intl.t('literal.fleet-ops.review-fuel-records'),
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
                key: 'drivers',
                label: this.intl.t('literal.fleet-ops.drivers'),
                value: '...',
                caption: this.intl.t('literal.fleet-ops.loading-resource-readiness'),
                tone: 'blue',
                icon: 'id-card',
                route: 'management.drivers',
            },
            {
                key: 'vehicles',
                label: this.intl.t('literal.fleet-ops.vehicles'),
                value: '...',
                caption: this.intl.t('literal.fleet-ops.loading-fleet-asset-coverage'),
                tone: 'green',
                icon: 'truck',
                route: 'management.vehicles',
            },
            {
                key: 'issues',
                label: this.intl.t('literal.fleet-ops.open-issues'),
                value: '...',
                caption: this.intl.t('literal.fleet-ops.loading-exception-health'),
                tone: 'rose',
                icon: 'triangle-exclamation',
                route: 'management.issues',
            },
            {
                key: 'fuel_records',
                label: this.intl.t('literal.fleet-ops.fuel-records'),
                value: '...',
                caption: this.intl.t('literal.fleet-ops.loading-fuel-activity'),
                tone: 'amber',
                icon: 'gas-pump',
                route: 'management.fuel-reports',
            },
        ];
    }

    @action openDocs(link) {
        if (!link?.slug) {
            return;
        }

        return this.docsPanel.open(link.slug, {
            title: link.title ?? link.label,
            source: 'fleet-ops-resources-hub',
        });
    }

    @task *loadHub() {
        this.hub = yield this.fetch.get('fleet-ops/hubs/resources');
    }
}
