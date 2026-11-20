import Controller from '@ember/controller';
import { inject as service } from '@ember/service';
import { action } from '@ember/object';

export default class SettingsIndexController extends Controller {
    @service intl;
    @service docsPanel;

    get groups() {
        return [
            {
                title: this.intl.t('literal.fleet-ops.driver-and-map-experience'),
                description: this.intl.t('literal.fleet-ops.tune-what-dispatchers-and-drivers-see-while-work-28ece'),
                links: [
                    {
                        label: this.intl.t('literal.fleet-ops.navigator-app'),
                        route: 'settings.navigator-app',
                        icon: 'location-arrow',
                        description: this.intl.t('literal.fleet-ops.driver-app-behavior-and-workflow-defaults'),
                    },
                    {
                        label: this.intl.t('literal.fleet-ops.map'),
                        route: 'settings.map',
                        icon: 'map',
                        description: this.intl.t('literal.fleet-ops.map-providers-defaults-and-display-behavior'),
                    },
                ],
            },
            {
                title: this.intl.t('literal.fleet-ops.dispatch-automation'),
                description: this.intl.t('literal.fleet-ops.shape-route-planning-assignment-and-scheduling-b-2d21a'),
                links: [
                    {
                        label: this.intl.t('literal.fleet-ops.routing'),
                        route: 'settings.routing',
                        icon: 'route',
                        description: this.intl.t('literal.fleet-ops.routing-engines-and-routing-defaults'),
                    },
                    {
                        label: this.intl.t('literal.fleet-ops.orchestrator'),
                        route: 'settings.orchestrator',
                        icon: 'circle-nodes',
                        description: this.intl.t('literal.fleet-ops.dispatch-orchestration-and-assignment-behavior'),
                    },
                    {
                        label: this.intl.t('literal.fleet-ops.scheduling'),
                        route: 'settings.scheduling',
                        icon: 'calendar-days',
                        description: this.intl.t('literal.fleet-ops.schedule-planning-and-operational-timing-rules'),
                    },
                ],
            },
            {
                title: this.intl.t('literal.fleet-ops.business-and-data'),
                description: this.intl.t('literal.fleet-ops.keep-commerce-metadata-and-visual-conventions-al-2cd41'),
                links: [
                    {
                        label: this.intl.t('literal.fleet-ops.payments'),
                        route: 'settings.payments',
                        icon: 'cash-register',
                        description: this.intl.t('literal.fleet-ops.payment-setup-for-operational-commerce-workflows'),
                    },
                    {
                        label: this.intl.t('literal.fleet-ops.custom-fields'),
                        route: 'settings.custom-fields',
                        icon: 'pen-to-square',
                        description: this.intl.t('literal.fleet-ops.operational-metadata-fields-for-fleet-ops-record-63a58'),
                    },
                    {
                        label: this.intl.t('literal.fleet-ops.avatars'),
                        route: 'settings.avatars',
                        icon: 'icons',
                        description: this.intl.t('literal.fleet-ops.visual-assets-for-driver-vehicle-and-map-display-2c757'),
                    },
                ],
            },
            {
                title: this.intl.t('literal.fleet-ops.communication'),
                description: this.intl.t('literal.fleet-ops.control-operational-alerts-and-notification-beha-95924'),
                links: [
                    {
                        label: this.intl.t('literal.fleet-ops.notifications'),
                        route: 'settings.notifications',
                        icon: 'bell',
                        description: this.intl.t('literal.fleet-ops.operational-status-alerts-and-notification-rules'),
                    },
                ],
            },
        ];
    }

    get quickActions() {
        return [
            {
                label: this.intl.t('literal.fleet-ops.start-with-driver-experience'),
                description: this.intl.t('literal.fleet-ops.navigator-app-and-map-settings-should-be-reviewe-a8a0f'),
                icon: 'location-arrow',
                route: 'settings.navigator-app',
                tone: 'info',
            },
            {
                label: this.intl.t('literal.fleet-ops.review-automation-rules'),
                description: this.intl.t('literal.fleet-ops.routing-orchestration-and-scheduling-settings-af-b7804'),
                icon: 'route',
                route: 'settings.routing',
                tone: 'warning',
            },
            {
                label: this.intl.t('literal.fleet-ops.keep-forms-focused'),
                description: this.intl.t('literal.fleet-ops.add-custom-fields-after-core-workflows-are-stabl-effcd'),
                icon: 'pen-to-square',
                route: 'settings.custom-fields',
                tone: 'success',
            },
        ];
    }

    get docs() {
        return [
            {
                label: this.intl.t('literal.fleet-ops.navigator-app'),
                icon: 'location-arrow',
                slug: 'fleet-ops/settings/navigator-app',
                title: this.intl.t('literal.fleet-ops.navigator-app-settings'),
                description: this.intl.t('literal.fleet-ops.configure-driver-app-behavior-onboarding-and-liv-1e7f8'),
            },
            {
                label: this.intl.t('literal.fleet-ops.map'),
                icon: 'map',
                slug: 'fleet-ops/settings/map',
                title: this.intl.t('literal.fleet-ops.map-settings'),
                description: this.intl.t('literal.fleet-ops.set-map-providers-display-defaults-and-operator-0570b'),
            },
            {
                label: this.intl.t('literal.fleet-ops.payments'),
                icon: 'cash-register',
                slug: 'fleet-ops/settings/payments',
                title: this.intl.t('literal.fleet-ops.payments-guide'),
                description: this.intl.t('literal.fleet-ops.connect-payment-providers-and-payment-behavior-f-22fe5'),
            },
            {
                label: this.intl.t('literal.fleet-ops.notifications'),
                icon: 'bell',
                slug: 'fleet-ops/settings/notifications',
                title: this.intl.t('literal.fleet-ops.notification-settings'),
                description: this.intl.t('literal.fleet-ops.tune-operational-alerts-sent-to-dispatchers-cust-d00f8'),
            },
            {
                label: this.intl.t('literal.fleet-ops.routing'),
                icon: 'route',
                slug: 'fleet-ops/settings/routing',
                title: this.intl.t('literal.fleet-ops.routing-settings'),
                description: this.intl.t('literal.fleet-ops.configure-routing-engines-tracking-defaults-and-6e79b'),
            },
            {
                label: this.intl.t('literal.fleet-ops.orchestrator'),
                icon: 'circle-nodes',
                slug: 'fleet-ops/settings/orchestrator',
                title: this.intl.t('literal.fleet-ops.orchestrator-settings'),
                description: this.intl.t('literal.fleet-ops.select-dispatch-automation-engines-and-assignmen-71867'),
            },
            {
                label: this.intl.t('literal.fleet-ops.scheduling'),
                icon: 'calendar-days',
                slug: 'fleet-ops/settings/scheduling',
                title: this.intl.t('literal.fleet-ops.scheduling-settings'),
                description: this.intl.t('literal.fleet-ops.manage-schedule-templates-and-timing-rules-for-p-3cb49'),
            },
            {
                label: this.intl.t('literal.fleet-ops.custom-fields'),
                icon: 'pen-to-square',
                slug: 'fleet-ops/settings/custom-fields',
                title: this.intl.t('literal.fleet-ops.custom-field-settings'),
                description: this.intl.t('literal.fleet-ops.add-structured-operational-metadata-to-fleet-ops-4a596'),
            },
            {
                label: this.intl.t('literal.fleet-ops.avatars'),
                icon: 'icons',
                slug: 'fleet-ops/settings/avatars',
                title: this.intl.t('literal.fleet-ops.avatar-settings'),
                description: this.intl.t('literal.fleet-ops.manage-visual-markers-used-across-maps-and-opera-50c57'),
            },
        ];
    }

    @action openDocs(link) {
        if (!link?.slug) {
            return;
        }

        return this.docsPanel.open(link.slug, {
            title: link.title ?? link.label,
            source: 'fleet-ops-settings-hub',
        });
    }
}
