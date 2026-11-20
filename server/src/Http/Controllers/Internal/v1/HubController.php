<?php

namespace Fleetbase\FleetOps\Http\Controllers\Internal\v1;

use Fleetbase\FleetOps\Models\Contact;
use Fleetbase\FleetOps\Models\Device;
use Fleetbase\FleetOps\Models\Driver;
use Fleetbase\FleetOps\Models\Equipment;
use Fleetbase\FleetOps\Models\Fleet;
use Fleetbase\FleetOps\Models\FuelProviderTransaction;
use Fleetbase\FleetOps\Models\FuelReport;
use Fleetbase\FleetOps\Models\Issue;
use Fleetbase\FleetOps\Models\Maintenance;
use Fleetbase\FleetOps\Models\MaintenanceSchedule;
use Fleetbase\FleetOps\Models\Part;
use Fleetbase\FleetOps\Models\Place;
use Fleetbase\FleetOps\Models\Vehicle;
use Fleetbase\FleetOps\Models\Vendor;
use Fleetbase\FleetOps\Models\WorkOrder;
use Fleetbase\Http\Controllers\Controller;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

class HubController extends Controller
{
    public function resources(Request $request)
    {
        $company = $this->companyUuid($request);

        $counts = [
            'drivers'                       => $this->count(Driver::query(), $company),
            'vehicles'                      => $this->count(Vehicle::query(), $company),
            'fleets'                        => $this->count(Fleet::query()->whereNull('parent_fleet_uuid'), $company),
            'vendors'                       => $this->count(Vendor::query(), $company),
            'contacts'                      => $this->count(Contact::query(), $company),
            'places'                        => $this->count(Place::query(), $company),
            'issues'                        => $this->count(Issue::query()->whereNotIn('status', ['resolved', 'closed']), $company),
            'drivers_without_vehicles'      => $this->count(Driver::query()->whereNull('vehicle_uuid'), $company),
            'vehicles_without_drivers'      => $this->count(Vehicle::query()->whereDoesntHave('driver'), $company),
            'vehicles_without_devices'      => $this->count(Vehicle::query()->whereDoesntHave('devices'), $company),
            'unattached_devices'            => $this->count(Device::query()->whereNull('attachable_uuid'), $company),
            'resource_issues'               => $this->count(Issue::query()->whereNotIn('status', ['resolved', 'closed'])->where(function ($query) {
                $query->whereNotNull('vehicle_uuid')->orWhereNotNull('driver_uuid');
            }), $company),
            'overdue_vehicle_schedules'     => $this->count(MaintenanceSchedule::query()->where('subject_type', Vehicle::class)->where('status', 'active')->whereNotNull('next_due_date')->where('next_due_date', '<', Carbon::now()), $company),
            'upcoming_vehicle_schedules'    => $this->count(MaintenanceSchedule::query()->where('subject_type', Vehicle::class)->where('status', 'active')->whereBetween('next_due_date', [Carbon::now(), Carbon::now()->addDays(7)]), $company),
            'open_resource_work_orders'     => $this->count(WorkOrder::query()->whereIn('target_type', [Vehicle::class, Equipment::class])->whereIn('status', ['open', 'in_progress']), $company),
            'overdue_resource_work_orders'  => $this->count(WorkOrder::query()->whereIn('target_type', [Vehicle::class, Equipment::class])->whereNotIn('status', ['closed', 'canceled'])->whereNotNull('due_at')->where('due_at', '<', Carbon::now()), $company),
            'low_stock_parts'               => $this->count(Part::query()->where('quantity_on_hand', '>', 0)->where('quantity_on_hand', '<=', 5), $company),
            'unmatched_fuel_transactions'   => $this->count(FuelProviderTransaction::query()->where('sync_status', 'unmatched'), $company),
            'fuel_reports'                  => $this->count(FuelReport::query(), $company),
            'fuel_transactions'             => $this->count(FuelProviderTransaction::query(), $company),
        ];

        $fuelRecords = $counts['fuel_reports'] + $counts['fuel_transactions'];

        return response()->json([
            'kpis'     => [
                $this->kpi('drivers', $this->t('resources.kpis.drivers'), $counts['drivers'], $this->t($counts['drivers'] > 0 ? 'resources.kpis.drivers_ready' : 'resources.kpis.drivers_empty'), 'blue', 'id-card', 'management.drivers'),
                $this->kpi('vehicles', $this->t('resources.kpis.vehicles'), $counts['vehicles'], $this->t($counts['vehicles'] > 0 ? 'resources.kpis.vehicles_ready' : 'resources.kpis.vehicles_empty'), 'green', 'truck', 'management.vehicles'),
                $this->kpi('issues', $this->t('resources.kpis.issues'), $counts['issues'], $this->t($counts['issues'] > 0 ? 'resources.kpis.issues_open' : 'resources.kpis.issues_none'), $counts['issues'] > 0 ? 'rose' : 'green', 'triangle-exclamation', 'management.issues'),
                $this->kpi('fuel_records', $this->t('resources.kpis.fuel_records'), $fuelRecords, $this->t($fuelRecords > 0 ? 'resources.kpis.fuel_records_ready' : 'resources.kpis.fuel_records_empty'), 'amber', 'gas-pump', $counts['fuel_transactions'] > $counts['fuel_reports'] ? 'management.fuel-transactions' : 'management.fuel-reports'),
            ],
            'actions'  => $this->resourceActions($counts, $fuelRecords),
            'sections' => [
                [
                    'key'         => 'people_assets',
                    'title'       => $this->t('resources.sections.people_assets'),
                    'description' => $this->t('resources.sections.people_assets_desc'),
                    'links'       => [
                        $this->link($this->t('resources.links.drivers'), 'management.drivers', 'id-card', $counts['drivers'], $this->t('resources.links.drivers_desc')),
                        $this->link($this->t('resources.links.vehicles'), 'management.vehicles', 'truck', $counts['vehicles'], $this->t('resources.links.vehicles_desc')),
                        $this->link($this->t('resources.links.fleets'), 'management.fleets', 'user-group', $counts['fleets'], $this->t('resources.links.fleets_desc')),
                    ],
                ],
                [
                    'key'         => 'network',
                    'title'       => $this->t('resources.sections.network'),
                    'description' => $this->t('resources.sections.network_desc'),
                    'links'       => [
                        $this->link($this->t('resources.links.vendors'), 'management.vendors', 'warehouse', $counts['vendors'], $this->t('resources.links.vendors_desc')),
                        $this->link($this->t('resources.links.contacts'), 'management.contacts', 'address-book', $counts['contacts'], $this->t('resources.links.contacts_desc')),
                        $this->link($this->t('resources.links.places'), 'management.places', 'location-dot', $counts['places'], $this->t('resources.links.places_desc')),
                    ],
                ],
                [
                    'key'         => 'exceptions',
                    'title'       => $this->t('resources.sections.exceptions'),
                    'description' => $this->t('resources.sections.exceptions_desc'),
                    'links'       => [
                        $this->link($this->t('resources.links.fuel_reports'), 'management.fuel-reports', 'gas-pump', $counts['fuel_reports'], $this->t('resources.links.fuel_reports_desc')),
                        $this->link($this->t('resources.links.fuel_transactions'), 'management.fuel-transactions', 'credit-card', $counts['fuel_transactions'], $this->t('resources.links.fuel_transactions_desc')),
                        $this->link($this->t('resources.links.issues'), 'management.issues', 'triangle-exclamation', $counts['issues'], $this->t('resources.links.issues_desc')),
                    ],
                ],
            ],
            'docs'     => [
                $this->doc($this->t('resources.links.drivers'), 'id-card', 'fleet-ops/resources/drivers/overview', $this->t('resources.docs.drivers'), $this->t('resources.docs.drivers_desc')),
                $this->doc($this->t('resources.links.vehicles'), 'truck', 'fleet-ops/resources/vehicles/overview', $this->t('resources.docs.vehicles'), $this->t('resources.docs.vehicles_desc')),
                $this->doc($this->t('resources.links.fleets'), 'user-group', 'fleet-ops/resources/fleets/overview', $this->t('resources.docs.fleets'), $this->t('resources.docs.fleets_desc')),
                $this->doc($this->t('resources.links.contacts'), 'address-book', 'fleet-ops/resources/contacts/overview', $this->t('resources.docs.contacts'), $this->t('resources.docs.contacts_desc')),
                $this->doc($this->t('resources.links.places'), 'location-dot', 'fleet-ops/resources/places/overview', $this->t('resources.docs.places'), $this->t('resources.docs.places_desc')),
                $this->doc($this->t('resources.links.issues'), 'triangle-exclamation', 'fleet-ops/resources/issues/overview', $this->t('resources.docs.issues'), $this->t('resources.docs.issues_desc')),
            ],
        ]);
    }

    public function maintenance(Request $request)
    {
        $company = $this->companyUuid($request);
        $now     = Carbon::now();
        $next7   = Carbon::now()->addDays(7);

        $overdueSchedules        = $this->count(MaintenanceSchedule::query()->where('status', 'active')->whereNotNull('next_due_date')->where('next_due_date', '<', $now), $company);
        $upcomingSchedules       = $this->count(MaintenanceSchedule::query()->where('status', 'active')->whereBetween('next_due_date', [$now, $next7]), $company);
        $openWorkOrders          = $this->count(WorkOrder::query()->whereIn('status', ['open', 'in_progress']), $company);
        $overdueWorkOrders       = $this->count(WorkOrder::query()->whereNotIn('status', ['closed', 'canceled'])->whereNotNull('due_at')->where('due_at', '<', $now), $company);
        $openMaintenance         = $this->count(Maintenance::query()->whereNotIn('status', ['completed', 'canceled']), $company);
        $highPriorityMaintenance = $this->count(Maintenance::query()->whereNotIn('status', ['completed', 'canceled'])->whereIn('priority', ['high', 'urgent', 'critical']), $company);
        $lowStockParts           = $this->count(Part::query()->where('quantity_on_hand', '>', 0)->where('quantity_on_hand', '<=', 5), $company);
        $equipment               = $this->count(Equipment::query(), $company);

        return response()->json([
            'kpis'     => [
                $this->kpi('overdue_schedules', $this->t('maintenance.kpis.overdue_schedules'), $overdueSchedules, $this->t($overdueSchedules > 0 ? 'maintenance.kpis.overdue_schedules_some' : 'maintenance.kpis.overdue_schedules_none'), $overdueSchedules > 0 ? 'rose' : 'green', 'calendar-xmark', 'maintenance.schedules'),
                $this->kpi('upcoming_schedules', $this->t('maintenance.kpis.upcoming_schedules'), $upcomingSchedules, $this->t('maintenance.kpis.upcoming_schedules_desc'), 'blue', 'calendar-day', 'maintenance.schedules'),
                $this->kpi('open_work_orders', $this->t('maintenance.kpis.open_work_orders'), $openWorkOrders, $this->t($openWorkOrders > 0 ? 'maintenance.kpis.open_work_orders_some' : 'maintenance.kpis.open_work_orders_none'), $openWorkOrders > 0 ? 'amber' : 'green', 'clipboard-list', 'maintenance.work-orders'),
                $this->kpi('low_stock_parts', $this->t('maintenance.kpis.low_stock_parts'), $lowStockParts, $this->t($lowStockParts > 0 ? 'maintenance.kpis.low_stock_parts_some' : 'maintenance.kpis.low_stock_parts_none'), $lowStockParts > 0 ? 'amber' : 'green', 'cog', 'maintenance.parts'),
            ],
            'actions'  => $this->maintenanceActions($overdueSchedules, $upcomingSchedules, $openWorkOrders, $overdueWorkOrders, $highPriorityMaintenance, $lowStockParts, $equipment),
            'sections' => [
                [
                    'key'         => 'planning',
                    'title'       => $this->t('maintenance.sections.planning'),
                    'description' => $this->t('maintenance.sections.planning_desc'),
                    'links'       => [
                        $this->link($this->t('maintenance.links.schedules'), 'maintenance.schedules', 'calendar-alt', $upcomingSchedules + $overdueSchedules, $this->t('maintenance.links.schedules_desc')),
                        $this->link($this->t('maintenance.links.work_orders'), 'maintenance.work-orders', 'clipboard-list', $openWorkOrders, $this->t('maintenance.links.work_orders_desc')),
                    ],
                ],
                [
                    'key'         => 'records',
                    'title'       => $this->t('maintenance.sections.records'),
                    'description' => $this->t('maintenance.sections.records_desc'),
                    'links'       => [
                        $this->link($this->t('maintenance.links.maintenances'), 'maintenance.maintenances', 'history', $openMaintenance, $this->t('maintenance.links.maintenances_desc')),
                        $this->link($this->t('maintenance.links.equipment'), 'maintenance.equipment', 'trailer', $equipment, $this->t('maintenance.links.equipment_desc')),
                        $this->link($this->t('maintenance.links.parts'), 'maintenance.parts', 'cog', $lowStockParts, $this->t('maintenance.links.parts_desc')),
                    ],
                ],
            ],
            'docs'     => [
                $this->doc($this->t('maintenance.links.schedules'), 'calendar-alt', 'fleet-ops/maintenance/schedules/overview', $this->t('maintenance.docs.schedules'), $this->t('maintenance.docs.schedules_desc')),
                $this->doc($this->t('maintenance.links.work_orders'), 'clipboard-list', 'fleet-ops/maintenance/work-orders/overview', $this->t('maintenance.docs.work_orders'), $this->t('maintenance.docs.work_orders_desc')),
                $this->doc($this->t('maintenance.links.equipment'), 'trailer', 'fleet-ops/maintenance/equipment/overview', $this->t('maintenance.docs.equipment'), $this->t('maintenance.docs.equipment_desc')),
                $this->doc($this->t('maintenance.links.parts'), 'cog', 'fleet-ops/maintenance/parts/overview', $this->t('maintenance.docs.parts'), $this->t('maintenance.docs.parts_desc')),
            ],
        ]);
    }

    protected function resourceActions(array $counts, int $fuelRecords): array
    {
        $actions = [];

        if ($counts['drivers'] === 0) {
            $actions[] = $this->action('add_drivers', $this->t('resources.actions.add_drivers'), $this->t('resources.actions.add_drivers_desc'), 'warning', 'id-card', 'management.drivers');
        }

        if ($counts['vehicles'] === 0) {
            $actions[] = $this->action('add_vehicles', $this->t('resources.actions.add_vehicles'), $this->t('resources.actions.add_vehicles_desc'), 'warning', 'truck', 'management.vehicles');
        }

        if ($counts['drivers_without_vehicles'] > 0 && $counts['vehicles'] > 0) {
            $actions[] = $this->action('assign_vehicles_to_drivers', $this->t('resources.actions.assign_vehicles_to_drivers'), $this->tc('resources.actions.assign_vehicles_to_drivers_desc', $counts['drivers_without_vehicles']), 'warning', 'id-card', 'management.drivers', ['vehicle' => 'unassigned']);
        }

        if ($counts['vehicles_without_drivers'] > 0 && $counts['drivers'] > 0) {
            $actions[] = $this->action('assign_drivers_to_vehicles', $this->t('resources.actions.assign_drivers_to_vehicles'), $this->tc('resources.actions.assign_drivers_to_vehicles_desc', $counts['vehicles_without_drivers']), 'warning', 'truck', 'management.vehicles', ['driver' => 'unassigned']);
        }

        if ($counts['vehicles_without_devices'] > 0 && $counts['unattached_devices'] > 0) {
            $actions[] = $this->action('attach_devices_to_vehicles', $this->t('resources.actions.attach_devices_to_vehicles'), $this->tc('resources.actions.attach_devices_to_vehicles_desc', $counts['unattached_devices']), 'info', 'satellite-dish', 'connectivity.devices', ['attachment_state' => 'unattached']);
        }

        if ($counts['resource_issues'] > 0) {
            $actions[] = $this->action('review_resource_issues', $this->t('resources.actions.review_resource_issues'), $this->tc('resources.actions.review_resource_issues_desc', $counts['resource_issues']), 'warning', 'triangle-exclamation', 'management.issues', ['status' => 'open']);
        } elseif ($counts['issues'] > 0) {
            $actions[] = $this->action('review_issues', $this->t('resources.actions.review_issues'), $this->tc('resources.actions.review_issues_desc', $counts['issues']), 'warning', 'triangle-exclamation', 'management.issues', ['status' => 'open']);
        }

        if (($counts['overdue_vehicle_schedules'] + $counts['upcoming_vehicle_schedules']) > 0) {
            $serviceCount = $counts['overdue_vehicle_schedules'] + $counts['upcoming_vehicle_schedules'];
            $actions[]    = $this->action('prepare_vehicle_maintenance', $this->t('resources.actions.prepare_vehicle_maintenance'), $this->tc('resources.actions.prepare_vehicle_maintenance_desc', $serviceCount), $counts['overdue_vehicle_schedules'] > 0 ? 'warning' : 'info', 'calendar-day', 'maintenance.schedules', ['status' => 'active']);
        }

        if ($counts['overdue_resource_work_orders'] > 0) {
            $actions[] = $this->action('close_overdue_work_orders', $this->t('resources.actions.close_overdue_work_orders'), $this->tc('resources.actions.close_overdue_work_orders_desc', $counts['overdue_resource_work_orders']), 'warning', 'clipboard-list', 'maintenance.work-orders', ['status' => 'open']);
        } elseif ($counts['open_resource_work_orders'] > 0) {
            $actions[] = $this->action('review_open_work_orders', $this->t('resources.actions.review_open_work_orders'), $this->tc('resources.actions.review_open_work_orders_desc', $counts['open_resource_work_orders']), 'info', 'clipboard-list', 'maintenance.work-orders', ['status' => 'open']);
        }

        if ($counts['low_stock_parts'] > 0) {
            $actions[] = $this->action('replenish_low_stock_parts', $this->t('resources.actions.replenish_low_stock_parts'), $this->tc('resources.actions.replenish_low_stock_parts_desc', $counts['low_stock_parts']), 'warning', 'cog', 'maintenance.parts', ['status' => 'in_stock']);
        }

        if ($counts['unmatched_fuel_transactions'] > 0) {
            $actions[] = $this->action('review_unmatched_fuel_transactions', $this->t('resources.actions.review_unmatched_fuel_transactions'), $this->tc('resources.actions.review_unmatched_fuel_transactions_desc', $counts['unmatched_fuel_transactions']), 'warning', 'gas-pump', 'management.fuel-transactions', ['sync_status' => 'unmatched']);
        }

        if ($counts['fleets'] === 0 && $counts['drivers'] > 0 && $counts['vehicles'] > 0) {
            $actions[] = $this->action('create_fleets', $this->t('resources.actions.create_fleets'), $this->t('resources.actions.create_fleets_desc'), 'info', 'user-group', 'management.fleets');
        }

        if ($counts['places'] === 0) {
            $actions[] = $this->action('add_operating_places', $this->t('resources.actions.add_operating_places'), $this->t('resources.actions.add_operating_places_desc'), 'info', 'location-dot', 'management.places');
        }

        if ($counts['vendors'] === 0) {
            $actions[] = $this->action('add_service_vendors', $this->t('resources.actions.add_service_vendors'), $this->t('resources.actions.add_service_vendors_desc'), 'info', 'warehouse', 'management.vendors');
        }

        if ($counts['contacts'] === 0) {
            $actions[] = $this->action('add_contacts', $this->t('resources.actions.add_contacts'), $this->t('resources.actions.add_contacts_desc'), 'info', 'address-book', 'management.contacts');
        }

        if ($fuelRecords === 0) {
            $actions[] = $this->action('review_fuel', $this->t('resources.actions.review_fuel'), $this->t('resources.actions.review_fuel_desc'), 'info', 'gas-pump', 'management.fuel-reports');
        }

        return $actions ? array_slice($actions, 0, 6) : [$this->action('ready', $this->t('resources.actions.ready'), $this->t('resources.actions.ready_desc'), 'success', 'check-circle', null)];
    }

    protected function maintenanceActions(int $overdueSchedules, int $upcomingSchedules, int $openWorkOrders, int $overdueWorkOrders, int $highPriorityMaintenance, int $lowStockParts, int $equipment): array
    {
        $actions = [];

        if ($overdueSchedules > 0) {
            $actions[] = $this->action('overdue_schedules', $this->t('maintenance.actions.overdue_schedules'), $this->tc('maintenance.actions.overdue_schedules_desc', $overdueSchedules), 'warning', 'calendar-xmark', 'maintenance.schedules');
        }

        if ($overdueWorkOrders > 0) {
            $actions[] = $this->action('overdue_work_orders', $this->t('maintenance.actions.overdue_work_orders'), $this->tc('maintenance.actions.overdue_work_orders_desc', $overdueWorkOrders), 'warning', 'clipboard-list', 'maintenance.work-orders');
        }

        if ($highPriorityMaintenance > 0) {
            $actions[] = $this->action('high_priority_maintenance', $this->t('maintenance.actions.high_priority_maintenance'), $this->tc('maintenance.actions.high_priority_maintenance_desc', $highPriorityMaintenance), 'warning', 'wrench', 'maintenance.maintenances');
        }

        if ($upcomingSchedules > 0) {
            $actions[] = $this->action('upcoming_service', $this->t('maintenance.actions.upcoming_service'), $this->tc('maintenance.actions.upcoming_service_desc', $upcomingSchedules), 'info', 'calendar-day', 'maintenance.schedules');
        }

        if ($openWorkOrders === 0) {
            $actions[] = $this->action('no_open_work_orders', $this->t('maintenance.actions.no_open_work_orders'), $this->t('maintenance.actions.no_open_work_orders_desc'), 'success', 'check-circle', 'maintenance.work-orders');
        }

        if ($lowStockParts > 0) {
            $actions[] = $this->action('low_stock_parts', $this->t('maintenance.actions.low_stock_parts'), $this->tc('maintenance.actions.low_stock_parts_desc', $lowStockParts), 'warning', 'cog', 'maintenance.parts');
        }

        if ($equipment === 0) {
            $actions[] = $this->action('add_equipment', $this->t('maintenance.actions.add_equipment'), $this->t('maintenance.actions.add_equipment_desc'), 'info', 'trailer', 'maintenance.equipment');
        }

        return array_slice($actions, 0, 5);
    }

    /**
     * Translate a hub string (`fleetops::hub.*`) in the request locale.
     */
    protected function t(string $key, array $replace = []): string
    {
        return (string) __('fleetops::hub.' . $key, $replace);
    }

    /**
     * Translate a pluralized hub string with a count.
     */
    protected function tc(string $key, int $count, array $replace = []): string
    {
        return (string) trans_choice('fleetops::hub.' . $key, $count, array_merge(['count' => $count], $replace));
    }

    protected function count(Builder $query, ?string $companyUuid): int
    {
        return (int) $query->when($companyUuid, fn ($query) => $query->where('company_uuid', $companyUuid))->count();
    }

    protected function companyUuid(Request $request): ?string
    {
        return session('company') ?? $request->user()?->company_uuid ?? $request->user()?->company?->uuid;
    }

    protected function kpi(string $key, string $label, int $value, string $caption, string $tone, string $icon, string $route): array
    {
        return compact('key', 'label', 'value', 'caption', 'tone', 'icon', 'route');
    }

    protected function action(string $key, string $label, string $description, string $tone, string $icon, ?string $route, array $query = []): array
    {
        $query = (object) $query;

        return compact('key', 'label', 'description', 'tone', 'icon', 'route', 'query');
    }

    protected function link(string $label, string $route, string $icon, int $count, string $description): array
    {
        return compact('label', 'route', 'icon', 'count', 'description');
    }

    protected function doc(string $label, string $icon, string $slug, string $title, string $description = ''): array
    {
        return compact('label', 'icon', 'slug', 'title', 'description');
    }
}
