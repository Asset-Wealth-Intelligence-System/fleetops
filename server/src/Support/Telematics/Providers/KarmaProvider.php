<?php

namespace Fleetbase\FleetOps\Support\Telematics\Providers;

use Fleetbase\FleetOps\Models\Vehicle;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

/**
 * Karma GPS poll provider.
 *
 * Pulls last-known locations from karma.online and maps them onto Fleetbase
 * vehicles that already exist for the company (matched by Karma car_id /
 * IMEI). Cars that are not in Fleetbase are ignored.
 *
 * Authentication: with `user` + `password` credentials the provider calls
 * POST /login itself, caches the returned session id and transparently logs in
 * again when Karma answers "Not logged in". A manually pasted `karma_sid` is
 * still accepted as a fallback when no user/password is configured.
 */
class KarmaProvider extends AbstractProvider
{
    protected string $baseUrl        = 'https://karma.online/apiv2';
    protected int $requestsPerMinute = 30;
    protected int $burstSize         = 5;
    protected string $timezone       = 'America/Santo_Domingo';

    /**
     * How long a Karma session obtained via /login is reused before logging in again.
     * A stale session is also replaced on the fly whenever Karma answers "Not logged in".
     */
    protected int $sessionTtlSeconds = 1800;

    /** Process-local fallback when the Laravel cache is not available (unit tests). */
    protected static array $sessionMemo = [];

    protected function prepareAuthentication(): void
    {
        $this->baseUrl  = rtrim($this->credentials['base_url'] ?? $this->baseUrl, '/');
        $this->timezone = $this->credentials['timezone'] ?? $this->timezone;

        if (!$this->hasLoginCredentials() && empty($this->credentials['karma_sid'])) {
            throw new \InvalidArgumentException('Karma credentials are required: provide a user and password (or a karma_sid).');
        }

        $this->headers = [
            'Accept'       => 'application/json',
            'Content-Type' => 'application/json',
        ];
    }

    protected function hasLoginCredentials(): bool
    {
        return !empty($this->credentials['user']) && !empty($this->credentials['password']);
    }

    /**
     * Resolve a usable Karma session id.
     *
     * With user/password credentials the provider logs in itself and caches the session;
     * pass `$fresh = true` to discard the cached session and log in again. Without login
     * credentials the manually supplied `karma_sid` is used as-is.
     */
    protected function sessionId(bool $fresh = false): string
    {
        if (!$this->hasLoginCredentials()) {
            $sid = (string) ($this->credentials['karma_sid'] ?? '');
            if ($sid === '') {
                throw new \RuntimeException('Karma session id is missing.');
            }

            return $sid;
        }

        $key = $this->sessionCacheKey();

        if (!$fresh) {
            $cached = $this->cacheGet($key);
            if (is_string($cached) && $cached !== '') {
                return $cached;
            }
        }

        $sid = $this->login();
        $this->cachePut($key, $sid, $this->sessionTtlSeconds);

        return $sid;
    }

    /**
     * POST /login and return the new session id.
     */
    protected function login(): string
    {
        $response = $this->karmaPost('/login', [
            'user'     => $this->credentials['user'],
            'password' => $this->credentials['password'],
        ]);

        $sid = $response['session_id'] ?? $response['karma_sid'] ?? null;
        if (is_string($sid) && $sid !== '') {
            return $sid;
        }

        $error = $response['error'] ?? $response['message'] ?? $response['msg'] ?? null;

        throw new \RuntimeException('Karma login failed: ' . (is_string($error) && $error !== '' ? $error : 'no session id returned'));
    }

    protected function forgetSession(): void
    {
        if ($this->hasLoginCredentials()) {
            $this->cacheForget($this->sessionCacheKey());
        }
    }

    protected function sessionCacheKey(): string
    {
        return 'fleetops:telematics:karma:session:' . sha1($this->baseUrl . '|' . ($this->credentials['user'] ?? ''));
    }

    protected function isNotLoggedInError(?string $error): bool
    {
        if (!is_string($error) || $error === '') {
            return false;
        }

        $error = strtolower($error);

        return str_contains($error, 'not logged in')
            || str_contains($error, 'invalid session')
            || str_contains($error, 'session expired')
            || str_contains($error, 'karma_sid');
    }

    protected function cacheGet(string $key): mixed
    {
        try {
            if (function_exists('app') && app()->bound('cache')) {
                return Cache::get($key);
            }
        } catch (\Throwable) {
            // fall through to the process-local memo
        }

        return static::$sessionMemo[$key] ?? null;
    }

    protected function cachePut(string $key, string $value, int $ttl): void
    {
        static::$sessionMemo[$key] = $value;

        try {
            if (function_exists('app') && app()->bound('cache')) {
                Cache::put($key, $value, $ttl);
            }
        } catch (\Throwable) {
            // cache unavailable; the memo above still applies for this process
        }
    }

    protected function cacheForget(string $key): void
    {
        unset(static::$sessionMemo[$key]);

        try {
            if (function_exists('app') && app()->bound('cache')) {
                Cache::forget($key);
            }
        } catch (\Throwable) {
            // ignore
        }
    }

    public function testConnection(array $credentials): array
    {
        try {
            $this->credentials = $credentials;
            $this->prepareAuthentication();

            $locations = $this->fetchLocations();

            return [
                'success'  => true,
                'message'  => 'Connection successful',
                'metadata' => [
                    'locations_returned' => count($locations),
                ],
            ];
        } catch (\Throwable $e) {
            return [
                'success'  => false,
                'message'  => $e->getMessage(),
                'metadata' => [],
            ];
        }
    }

    public function fetchDevices(array $options = []): array
    {
        $vehicles = $this->knownCompanyVehicles();
        $carIds   = $this->carIdsForVehicles($vehicles);

        if ($carIds === []) {
            return [
                'devices'     => [],
                'next_cursor' => null,
                'has_more'    => false,
                'sync_meta'   => [
                    'karma_locations_returned' => 0,
                    'karma_vehicles_matched'   => 0,
                    'karma_requested_car_ids'  => 0,
                ],
            ];
        }

        $locations = $this->fetchLocations(['car_id' => $carIds]);
        $matched   = $this->filterLocationsToKnownVehicles($locations, $vehicles);

        return [
            'devices'     => $matched,
            'next_cursor' => null,
            'has_more'    => false,
            'sync_meta'   => [
                'karma_locations_returned' => count($locations),
                'karma_vehicles_matched'   => count($matched),
                'karma_requested_car_ids'  => count($carIds),
            ],
        ];
    }

    public function fetchDeviceDetails(string $externalId): array
    {
        $filter = strlen($externalId) >= 14
            ? ['device_id' => [$externalId]]
            : ['car_id' => [(int) $externalId]];

        $locations = $this->fetchLocations($filter);

        return $locations[0] ?? [];
    }

    public function normalizeDevice(array $payload): array
    {
        $carId = $this->carId($payload);
        $imei  = $this->imei($payload);
        $edt   = $this->parseTimestamp($payload['edt'] ?? null);

        return [
            'device_id'      => $carId,
            'external_id'    => $carId,
            'internal_id'    => $carId,
            'name'           => $payload['carnumber'] ?? $payload['car_number'] ?? ('Karma ' . $carId),
            'provider'       => 'karma',
            'type'           => 'gps',
            'imei'           => $imei,
            'serial_number'  => $imei,
            'online'         => $this->isRecentlyReported($edt),
            'last_seen_at'   => $edt?->toDateTimeString(),
            'last_online_at' => $edt?->toDateTimeString(),
            'location'       => $this->location($payload),
            'speed'          => $this->numeric($payload['spd'] ?? $payload['speed'] ?? null),
            'heading'        => $this->numeric($payload['head'] ?? $payload['heading'] ?? null),
            'altitude'       => $this->numeric($payload['alt'] ?? $payload['altitude'] ?? null),
            'odometer'       => $this->numeric($payload['odo'] ?? $payload['odometer'] ?? null),
            'ignition'       => $this->flag($payload['ign'] ?? null),
            'auto_attach'    => true,
            'vehicle_uuid'   => $payload['_fleetbase_vehicle_uuid'] ?? null,
            'meta'           => [
                'source_car_id' => $carId !== '' ? (int) $carId : null,
                'imei'          => $imei,
                'sim_imsi'      => $payload['sim_imsi'] ?? null,
                'message_id'    => $payload['message_id'] ?? null,
            ],
        ];
    }

    public function normalizeEvent(array $payload): array
    {
        $carId = $this->carId($payload);
        $edt   = $this->parseTimestamp($payload['edt'] ?? null);

        return [
            'device_id'         => $carId,
            'external_id'       => $carId,
            'event_id'          => $payload['message_id'] ?? null,
            'external_event_id' => $payload['message_id'] ?? null,
            'ident'             => $payload['message_id'] ?? null,
            'event_type'        => 'telemetry_update',
            'occurred_at'       => $edt?->toDateTimeString(),
            'online'            => $this->isRecentlyReported($edt),
            'location'          => $this->location($payload),
            'speed'             => $this->numeric($payload['spd'] ?? $payload['speed'] ?? null),
            'heading'           => $this->numeric($payload['head'] ?? $payload['heading'] ?? null),
            'altitude'          => $this->numeric($payload['alt'] ?? $payload['altitude'] ?? null),
            'odometer'          => $this->numeric($payload['odo'] ?? $payload['odometer'] ?? null),
            'ignition'          => $this->flag($payload['ign'] ?? null),
            'meta'              => [
                'source_car_id' => $carId !== '' ? (int) $carId : null,
                'imei'          => $this->imei($payload),
                'engine'        => $this->flag($payload['eng'] ?? null),
                'eid'           => $payload['eid'] ?? null,
                'extra'         => $payload['extra'] ?? null,
            ],
        ];
    }

    public function normalizeSensor(array $payload): array
    {
        throw new \InvalidArgumentException('Karma location sync does not ingest standalone sensors.');
    }

    public function getCredentialSchema(): array
    {
        return [
            [
                'name'        => 'user',
                'label'       => 'Karma user',
                'type'        => 'text',
                'placeholder' => 'Karma API user',
                'required'    => false,
                'help_text'   => 'Karma API user. When a user and password are set the provider logs in automatically and renews expired sessions.',
                'validation'  => 'nullable|string|max:191',
            ],
            [
                'name'        => 'password',
                'label'       => 'Karma password',
                'type'        => 'password',
                'placeholder' => 'Karma API password',
                'required'    => false,
                'help_text'   => 'Karma API password (stored encrypted).',
                'validation'  => 'nullable|string|max:191',
            ],
            [
                'name'        => 'karma_sid',
                'label'       => 'Karma Session ID (manual fallback)',
                'type'        => 'password',
                'placeholder' => 'Paste your karma_sid',
                'required'    => false,
                'advanced'    => true,
                'help_text'   => 'Only needed when no user/password is configured. Sessions expire, so prefer user/password.',
                'validation'  => 'nullable|string|min:8',
            ],
            [
                'name'          => 'base_url',
                'label'         => 'Base URL',
                'type'          => 'text',
                'placeholder'   => 'https://karma.online/apiv2',
                'required'      => false,
                'advanced'      => true,
                'is_endpoint'   => true,
                'default_value' => 'https://karma.online/apiv2',
                'help_text'     => 'Leave blank to use the default Karma API host.',
                'validation'    => 'nullable|url',
            ],
            [
                'name'          => 'timezone',
                'label'         => 'Timestamp timezone',
                'type'          => 'text',
                'placeholder'   => 'America/Santo_Domingo',
                'required'      => false,
                'advanced'      => true,
                'default_value' => 'America/Santo_Domingo',
                'help_text'     => 'Timezone Karma uses for edt timestamps.',
            ],
        ];
    }

    /**
     * Keep only Karma rows that already exist as Fleetbase vehicles.
     *
     * @param  array<int, array<string, mixed>>  $locations
     * @param  iterable<int, object>|null        $vehicles
     * @return array<int, array<string, mixed>>
     */
    public function filterLocationsToKnownVehicles(array $locations, iterable $vehicles): array
    {
        $byCarId = [];
        $byImei  = [];

        foreach ($vehicles as $vehicle) {
            $internalId = isset($vehicle->internal_id) ? (string) $vehicle->internal_id : '';
            $serial     = isset($vehicle->serial_number) ? (string) $vehicle->serial_number : '';

            if ($internalId !== '') {
                $byCarId[$internalId] = $vehicle;
            }

            if ($serial !== '') {
                $byImei[$serial] = $vehicle;
            }
        }

        $matched = [];

        foreach ($locations as $row) {
            if (!is_array($row)) {
                continue;
            }

            $carId = $this->carId($row);
            $imei  = $this->imei($row);
            $hit   = ($carId !== '' ? ($byCarId[$carId] ?? null) : null)
                ?? ($imei !== '' ? ($byImei[$imei] ?? null) : null);

            if (!$hit) {
                continue;
            }

            $row['_fleetbase_vehicle_uuid'] = $hit->uuid ?? null;
            $matched[]                      = $row;
        }

        return $matched;
    }

    /**
     * POST /location. When Karma reports the session is no longer valid and we hold
     * login credentials, log in again and retry once with the fresh session.
     */
    protected function fetchLocations(array $extra = []): array
    {
        $payload = array_filter(array_merge([
            'fields' => ['ALT', 'SPD', 'ODO', 'HEAD', 'ENG', 'IGN'],
        ], $extra), fn ($value) => $value !== null && $value !== '');

        $response = $this->karmaPost('/location', ['karma_sid' => $this->sessionId()] + $payload);
        $error    = $this->responseError($response);

        if ($this->isNotLoggedInError($error) && $this->hasLoginCredentials()) {
            $this->forgetSession();
            $response = $this->karmaPost('/location', ['karma_sid' => $this->sessionId(true)] + $payload);
            $error    = $this->responseError($response);
        }

        if ($error !== null) {
            throw new \RuntimeException($error);
        }

        if (array_is_list($response)) {
            return array_values(array_filter($response, 'is_array'));
        }

        $rows = $response['data'] ?? $response['locations'] ?? [];

        return is_array($rows) ? array_values(array_filter($rows, 'is_array')) : [];
    }

    protected function responseError(array $response): ?string
    {
        if (array_is_list($response)) {
            return null;
        }

        $error = $response['error'] ?? $response['message'] ?? $response['msg'] ?? null;

        return is_string($error) && $error !== '' ? $error : null;
    }

    /**
     * Fleetbase vehicles already synced for this company.
     *
     * @return \Illuminate\Support\Collection<int, object>
     */
    protected function knownCompanyVehicles()
    {
        if (!$this->telematic?->company_uuid) {
            return collect();
        }

        return Vehicle::query()
            ->where('company_uuid', $this->telematic->company_uuid)
            ->whereNotNull('internal_id')
            ->where('internal_id', '!=', '')
            ->get(['uuid', 'internal_id', 'serial_number']);
    }

    /**
     * @param  iterable<int, object>  $vehicles
     * @return array<int, int>
     */
    protected function carIdsForVehicles(iterable $vehicles): array
    {
        $carIds = [];

        foreach ($vehicles as $vehicle) {
            $internalId = isset($vehicle->internal_id) ? (string) $vehicle->internal_id : '';
            if ($internalId === '' || !is_numeric($internalId)) {
                continue;
            }

            $carIds[] = (int) $internalId;
        }

        return array_values(array_unique($carIds));
    }

    protected function karmaPost(string $endpoint, array $payload): array
    {
        $this->checkRateLimit();

        $url      = $this->baseUrl . $endpoint;
        $response = Http::withHeaders($this->headers)
            ->timeout(30)
            ->asJson()
            ->post($url, $payload);

        $this->recordRequest();

        if ($response->failed()) {
            $json    = $response->json();
            $message = is_array($json)
                ? ($json['error'] ?? $json['message'] ?? $json['msg'] ?? null)
                : null;

            throw new \RuntimeException(
                is_string($message) && $message !== ''
                    ? $message
                    : 'Karma API request failed with status ' . $response->status()
            );
        }

        $json = $response->json();

        return is_array($json) ? $json : [];
    }

    protected function carId(array $payload): string
    {
        $value = $payload['car_id'] ?? $payload['carId'] ?? null;

        return $value === null || $value === '' ? '' : (string) $value;
    }

    protected function imei(array $payload): ?string
    {
        $value = $payload['device_id'] ?? $payload['imei'] ?? null;

        return $value === null || $value === '' ? null : (string) $value;
    }

    protected function location(array $payload): array
    {
        return [
            'lat' => $this->numeric($payload['latitude'] ?? $payload['lat'] ?? null),
            'lng' => $this->numeric($payload['longitude'] ?? $payload['lng'] ?? $payload['lon'] ?? null),
        ];
    }

    protected function numeric(mixed $value): ?float
    {
        if ($value === null || $value === '') {
            return null;
        }

        return is_numeric($value) ? (float) $value : null;
    }

    protected function flag(mixed $value): ?int
    {
        if ($value === null || $value === '') {
            return null;
        }

        return (int) ((bool) $value);
    }

    protected function parseTimestamp(mixed $value): ?Carbon
    {
        if (!$value) {
            return null;
        }

        try {
            return Carbon::parse((string) $value, $this->timezone);
        } catch (\Throwable) {
            return null;
        }
    }

    protected function isRecentlyReported(?Carbon $edt): bool
    {
        if (!$edt) {
            return false;
        }

        return $edt->greaterThan(now()->subMinutes(30));
    }
}
