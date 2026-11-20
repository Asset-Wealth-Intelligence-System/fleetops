import Component from '@glimmer/component';
import { action } from '@ember/object';

import { inject as service } from '@ember/service';
const DEFAULT_MATCHING_ORDER = ['plate_number', 'internal_id', 'vin', 'serial_number', 'call_sign', 'fuel_card_number', 'trip_number'];
const LEGACY_DEFAULT_MATCHING_ORDER = ['provider_vehicle_id', 'internal_number', 'structure_number', 'plate_number', 'vehicle_card_id', 'trip_number'];
const LEGACY_FIELD_ALIASES = {
    internal_number: 'internal_id',
    vehicle_card_id: 'fuel_card_number',
};

export default class FuelIntegrationMatchingPriorityComponent extends Component {
    @service intl;

    get MATCHING_FIELDS() {
        return [
            {
                key: 'plate_number',
                label: this.intl.t('literal.fleet-ops.plate-number'),
                source: this.intl.t('literal.fleet-ops.provider-plate-number'),
                target: 'Vehicle plate number',
                description: this.intl.t('literal.fleet-ops.best-default-for-fuel-card-imports-matches-licen-68b5e'),
            },
            {
                key: 'internal_id',
                label: this.intl.t('literal.fleet-ops.internal-id'),
                source: this.intl.t('literal.fleet-ops.provider-internal-fleet-number'),
                target: 'Vehicle internal ID',
                description: this.intl.t('literal.fleet-ops.use-when-the-provider-fleet-number-is-the-same-i-55dc2'),
            },
            {
                key: 'vin',
                label: 'VIN',
                source: this.intl.t('literal.fleet-ops.provider-vin'),
                target: 'Vehicle VIN',
                description: this.intl.t('literal.fleet-ops.matches-the-vehicle-identification-number-when-t-423e3'),
            },
            {
                key: 'serial_number',
                label: this.intl.t('literal.fleet-ops.serial-number-34602'),
                source: this.intl.t('literal.fleet-ops.provider-serial-number'),
                target: 'Vehicle serial number',
                description: this.intl.t('literal.fleet-ops.matches-manufacturer-or-fleet-serial-numbers-rec-bcbfd'),
            },
            {
                key: 'call_sign',
                label: this.intl.t('literal.fleet-ops.call-sign-f1159'),
                source: this.intl.t('literal.fleet-ops.provider-call-sign'),
                target: 'Vehicle call sign',
                description: this.intl.t('literal.fleet-ops.matches-operational-call-signs-when-those-are-sh-2b9c0'),
            },
            {
                key: 'fuel_card_number',
                label: this.intl.t('literal.fleet-ops.fuel-card-number-ce750'),
                source: this.intl.t('literal.fleet-ops.provider-fuel-card-number'),
                target: 'Vehicle fuel card number',
                description: this.intl.t('literal.fleet-ops.use-when-each-vehicle-has-a-dedicated-fuel-card-2deee'),
            },
            {
                key: 'trip_number',
                label: this.intl.t('literal.fleet-ops.trip-number-order-reference'),
                source: this.intl.t('literal.fleet-ops.provider-trip-order-reference'),
                target: 'Order public ID, internal ID, or tracking number',
                description: this.intl.t('literal.fleet-ops.links-the-transaction-to-an-order-when-the-provi-2b96b'),
            },
            {
                key: 'provider_vehicle_id',
                label: this.intl.t('literal.fleet-ops.provider-vehicle-id'),
                source: this.intl.t('literal.fleet-ops.provider-specific-vehicle-id'),
                target: 'Vehicle provider metadata',
                description: this.intl.t('literal.fleet-ops.advanced-fallback-only-use-it-when-provider-vehi-11adf'),
            },
        ];
    }

    fields = this.MATCHING_FIELDS;

    get order() {
        if (Array.isArray(this.args.order)) {
            if (this.args.order.join('|') === LEGACY_DEFAULT_MATCHING_ORDER.join('|')) {
                return DEFAULT_MATCHING_ORDER;
            }

            return Array.from(this.args.order)
                .map((key) => LEGACY_FIELD_ALIASES[key] ?? key)
                .filter((key, index, order) => key && order.indexOf(key) === index);
        }

        return DEFAULT_MATCHING_ORDER;
    }

    get selectedFields() {
        const lastIndex = this.order.length - 1;

        return this.order
            .map((key, index) => {
                const field = this.fields.find((option) => option.key === key);
                if (!field) {
                    return null;
                }

                return {
                    ...field,
                    index,
                    priority: index + 1,
                    canMoveUp: index > 0,
                    canMoveDown: index < lastIndex,
                };
            })
            .filter(Boolean);
    }

    get availableFields() {
        const selected = new Set(this.order);
        return this.fields.filter((field) => !selected.has(field.key));
    }

    get hasSelectedFields() {
        return this.selectedFields.length > 0;
    }

    updateOrder(order) {
        this.args.onChange?.(order);
    }

    @action addField(field) {
        if (this.order.includes(field.key)) {
            return;
        }

        this.updateOrder([...this.order, field.key]);
    }

    @action removeField(field) {
        this.updateOrder(this.order.filter((key) => key !== field.key));
    }

    @action moveField(field, direction) {
        const currentIndex = this.order.indexOf(field.key);
        const nextIndex = currentIndex + direction;

        if (currentIndex < 0 || nextIndex < 0 || nextIndex >= this.order.length) {
            return;
        }

        const nextOrder = [...this.order];
        [nextOrder[currentIndex], nextOrder[nextIndex]] = [nextOrder[nextIndex], nextOrder[currentIndex]];
        this.updateOrder(nextOrder);
    }
}
