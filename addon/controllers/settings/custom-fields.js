import Controller from '@ember/controller';

import { inject as service } from '@ember/service';
export default class SettingsCustomFieldsController extends Controller {
    @service intl;
    get subjects() {
        return [
            {
                model: 'driver',
                type: 'fleet-ops:driver',
                label: this.intl.t('literal.fleet-ops.driver'),
                groups: [],
            },
            {
                model: 'vehicle',
                type: 'fleet-ops:vehicle',
                label: this.intl.t('literal.fleet-ops.vehicle'),
                groups: [],
            },
            {
                model: 'contact',
                type: 'fleet-ops:contact',
                label: this.intl.t('literal.fleet-ops.contact'),
                groups: [],
            },
            {
                model: 'vendor',
                type: 'fleet-ops:vendor',
                label: this.intl.t('literal.fleet-ops.vendor'),
                groups: [],
            },
            {
                model: 'place',
                type: 'fleet-ops:place',
                label: this.intl.t('literal.fleet-ops.place'),
                groups: [],
            },
            {
                model: 'entity',
                type: 'fleet-ops:entity',
                label: this.intl.t('literal.fleet-ops.entity'),
                groups: [],
            },
            {
                model: 'fleet',
                type: 'fleet-ops:fleet',
                label: this.intl.t('literal.fleet-ops.fleet'),
                groups: [],
            },
            {
                model: 'issue',
                type: 'fleet-ops:issue',
                label: this.intl.t('literal.fleet-ops.issue'),
                groups: [],
            },
            {
                model: 'fuel-report',
                type: 'fleet-ops:fuel-report',
                label: this.intl.t('literal.fleet-ops.fuel-report'),
                groups: [],
            },
        ];
    }
}
