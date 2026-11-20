<?php

use Fleetbase\FleetOps\Models\Telematic;
use Fleetbase\FleetOps\Support\Telematics\Providers\KarmaProvider;
use Illuminate\Support\Carbon;

class FleetOpsKarmaProviderUnitProbe extends KarmaProvider
{
    public array $posts     = [];
    public array $responses = [];

    public function setCredentialsForTest(array $credentials): void
    {
        $this->credentials = $credentials;
    }

    public function setTelematicForTest(Telematic $telematic): void
    {
        $this->telematic = $telematic;
    }

    public function prepareAuthenticationForTest(): void
    {
        $this->prepareAuthentication();
    }

    public function headersForTest(): array
    {
        return $this->headers;
    }

    public function resetSessionForTest(): void
    {
        $this->forgetSession();
    }

    public function baseUrlForTest(): string
    {
        return $this->baseUrl;
    }

    public function queueResponse(array $response): void
    {
        $this->responses[] = $response;
    }

    public array $knownVehicles = [];

    protected function knownCompanyVehicles()
    {
        return collect($this->knownVehicles);
    }

    protected function karmaPost(string $endpoint, array $payload): array
    {
        $this->posts[] = [$endpoint, $payload];

        return array_shift($this->responses) ?? [];
    }
}

function fleetopsKarmaProvider(array $credentials = []): FleetOpsKarmaProviderUnitProbe
{
    $provider = new FleetOpsKarmaProviderUnitProbe();
    $provider->setCredentialsForTest(array_merge([
        'karma_sid' => 'sid-test',
        'timezone'  => 'America/Santo_Domingo',
    ], $credentials));

    return $provider;
}

function fleetopsKarmaLocation(array $overrides = []): array
{
    return array_merge([
        'message_id' => 7001920564,
        'car_id'     => 13283,
        'carnumber'  => 'F4 / L546653',
        'device_id'  => '861157041867199',
        'edt'        => '2026-09-07 00:29:44',
        'latitude'   => 18.401113,
        'longitude'  => -70.03929,
        'spd'        => 12.5,
        'head'       => 217,
        'odo'        => 465234.218,
        'ign'        => 1,
        'alt'        => 39.6,
        'eng'        => 0,
    ], $overrides);
}

test('karma provider requires a session id and prepares json headers', function () {
    $provider = fleetopsKarmaProvider(['base_url' => 'https://karma.example.test/']);
    $provider->prepareAuthenticationForTest();

    expect($provider->baseUrlForTest())->toBe('https://karma.example.test')
        ->and($provider->headersForTest())->toBe([
            'Accept'       => 'application/json',
            'Content-Type' => 'application/json',
        ]);

    expect(fn () => fleetopsKarmaProvider(['karma_sid' => ''])->prepareAuthenticationForTest())
        ->toThrow(InvalidArgumentException::class, 'Karma credentials are required: provide a user and password (or a karma_sid).');

    // user + password is enough on its own
    fleetopsKarmaProvider(['karma_sid' => '', 'user' => 'sfuentes', 'password' => 'secret'])->prepareAuthenticationForTest();
});

test('karma provider logs in with user and password and reuses the session', function () {
    $provider = fleetopsKarmaProvider(['karma_sid' => '', 'user' => 'sfuentes', 'password' => 'secret']);
    $provider->prepareAuthenticationForTest();
    $provider->setTelematicForTest(new Telematic());
    $provider->knownVehicles = [
        (object) ['uuid' => 'vehicle-uuid-1', 'internal_id' => '13283', 'serial_number' => '861157041867199'],
    ];
    $provider->resetSessionForTest();
    $provider->queueResponse(['session_id' => 'fresh-session']);
    $provider->queueResponse([fleetopsKarmaLocation()]);
    $provider->queueResponse([fleetopsKarmaLocation()]);

    $first  = $provider->fetchDevices();
    $second = $provider->fetchDevices();

    expect($provider->posts)->toHaveCount(3)
        ->and($provider->posts[0])->toBe(['/login', ['user' => 'sfuentes', 'password' => 'secret']])
        ->and($provider->posts[1][0])->toBe('/location')
        ->and($provider->posts[1][1]['karma_sid'])->toBe('fresh-session')
        ->and($provider->posts[2][0])->toBe('/location')
        ->and($provider->posts[2][1]['karma_sid'])->toBe('fresh-session')
        ->and($first['devices'])->toHaveCount(1)
        ->and($second['devices'])->toHaveCount(1);
});

test('karma provider logs in again and retries when the session is rejected', function () {
    $provider = fleetopsKarmaProvider(['karma_sid' => '', 'user' => 'sfuentes', 'password' => 'secret']);
    $provider->prepareAuthenticationForTest();
    $provider->setTelematicForTest(new Telematic());
    $provider->knownVehicles = [
        (object) ['uuid' => 'vehicle-uuid-1', 'internal_id' => '13283', 'serial_number' => '861157041867199'],
    ];
    $provider->resetSessionForTest();
    $provider->queueResponse(['session_id' => 'stale-session']);
    $provider->queueResponse(['error' => 'Not logged in']);
    $provider->queueResponse(['session_id' => 'renewed-session']);
    $provider->queueResponse([fleetopsKarmaLocation()]);

    $result = $provider->fetchDevices();

    expect($provider->posts)->toHaveCount(4)
        ->and($provider->posts[0][0])->toBe('/login')
        ->and($provider->posts[1][1]['karma_sid'])->toBe('stale-session')
        ->and($provider->posts[2][0])->toBe('/login')
        ->and($provider->posts[3][1]['karma_sid'])->toBe('renewed-session')
        ->and($result['devices'])->toHaveCount(1);
});

test('karma provider surfaces a failed login', function () {
    $provider = fleetopsKarmaProvider(['karma_sid' => '', 'user' => 'sfuentes', 'password' => 'wrong']);
    $provider->prepareAuthenticationForTest();
    $provider->setTelematicForTest(new Telematic());
    $provider->knownVehicles = [
        (object) ['uuid' => 'vehicle-uuid-1', 'internal_id' => '13283', 'serial_number' => '861157041867199'],
    ];
    $provider->resetSessionForTest();
    $provider->queueResponse(['error' => 'Invalid user/password']);

    expect(fn () => $provider->fetchDevices())
        ->toThrow(RuntimeException::class, 'Karma login failed: Invalid user/password');
});

test('karma provider does not retry a manual session id', function () {
    $provider = fleetopsKarmaProvider();
    $provider->prepareAuthenticationForTest();
    $provider->setTelematicForTest(new Telematic());
    $provider->knownVehicles = [
        (object) ['uuid' => 'vehicle-uuid-1', 'internal_id' => '13283', 'serial_number' => '861157041867199'],
    ];
    $provider->queueResponse(['error' => 'Not logged in']);

    expect(fn () => $provider->fetchDevices())->toThrow(RuntimeException::class, 'Not logged in');
    expect($provider->posts)->toHaveCount(1);
});

test('karma provider normalizes a location row onto a fleetbase vehicle identity', function () {
    Carbon::setTestNow(Carbon::parse('2026-09-07 00:35:00', 'America/Santo_Domingo'));

    $provider = fleetopsKarmaProvider();
    $row      = fleetopsKarmaLocation();

    $device = $provider->normalizeDevice($row);
    $event  = $provider->normalizeEvent($row);

    expect($device['device_id'])->toBe('13283')
        ->and($device['internal_id'])->toBe('13283')
        ->and($device['imei'])->toBe('861157041867199')
        ->and($device['serial_number'])->toBe('861157041867199')
        ->and($device['auto_attach'])->toBeTrue()
        ->and($device['location']['lat'])->toBe(18.401113)
        ->and($device['location']['lng'])->toBe(-70.03929)
        ->and($event['event_id'])->toBe(7001920564)
        ->and($event['speed'])->toBe(12.5)
        ->and($event['heading'])->toBe(217.0)
        ->and($event['odometer'])->toBe(465234.218)
        ->and($event['ignition'])->toBe(1)
        ->and($device['online'])->toBeTrue();

    Carbon::setTestNow();
});

test('karma provider keeps only locations for vehicles already in fleetbase', function () {
    $provider = fleetopsKarmaProvider();
    $known    = (object) [
        'uuid'          => 'vehicle-uuid-1',
        'internal_id'   => '13283',
        'serial_number' => '861157041867199',
    ];

    $matched = $provider->filterLocationsToKnownVehicles([
        fleetopsKarmaLocation(),
        fleetopsKarmaLocation(['car_id' => 99999, 'device_id' => '000', 'carnumber' => 'OTHER']),
    ], [$known]);

    expect($matched)->toHaveCount(1)
        ->and($matched[0]['car_id'])->toBe(13283)
        ->and($matched[0]['_fleetbase_vehicle_uuid'])->toBe('vehicle-uuid-1');
});

test('karma provider fetchDevices posts only fleetbase car ids', function () {
    $provider = fleetopsKarmaProvider();
    $provider->setTelematicForTest(new Telematic());
    $provider->knownVehicles = [
        (object) ['uuid' => 'vehicle-uuid-1', 'internal_id' => '13283', 'serial_number' => '861157041867199'],
        (object) ['uuid' => 'vehicle-uuid-2', 'internal_id' => '13435', 'serial_number' => '865235056105428'],
    ];
    $provider->queueResponse([
        fleetopsKarmaLocation(),
        fleetopsKarmaLocation(['car_id' => 13435, 'device_id' => '865235056105428']),
        fleetopsKarmaLocation(['car_id' => 11964, 'device_id' => '861157040593267', 'carnumber' => 'OTHER']),
    ]);

    $result = $provider->fetchDevices();

    expect($provider->posts)->toHaveCount(1)
        ->and($provider->posts[0][0])->toBe('/location')
        ->and($provider->posts[0][1]['karma_sid'])->toBe('sid-test')
        ->and($provider->posts[0][1]['fields'])->toBe(['ALT', 'SPD', 'ODO', 'HEAD', 'ENG', 'IGN'])
        ->and($provider->posts[0][1]['car_id'])->toBe([13283, 13435])
        ->and($result['devices'])->toHaveCount(2)
        ->and($result['sync_meta']['karma_requested_car_ids'])->toBe(2)
        ->and($result['sync_meta']['karma_locations_returned'])->toBe(3)
        ->and($result['sync_meta']['karma_vehicles_matched'])->toBe(2)
        ->and($result['has_more'])->toBeFalse();
});

test('karma provider fetchDevices skips karma when no fleetbase vehicles exist', function () {
    $provider = fleetopsKarmaProvider();
    $provider->setTelematicForTest(new Telematic());

    $result = $provider->fetchDevices();

    expect($provider->posts)->toBe([])
        ->and($result['devices'])->toBe([])
        ->and($result['sync_meta']['karma_requested_car_ids'])->toBe(0);
});

test('karma provider testConnection reports locations returned on success', function () {
    $provider = fleetopsKarmaProvider();
    $provider->queueResponse([
        fleetopsKarmaLocation(),
    ]);

    $result = $provider->testConnection(['karma_sid' => 'sid-test']);

    expect($result['success'])->toBeTrue()
        ->and($result['metadata']['locations_returned'])->toBe(1);
});

test('karma provider testConnection reports a failed karma error payload', function () {
    $provider = fleetopsKarmaProvider();
    $provider->queueResponse(['error' => 'invalid session']);

    $result = $provider->testConnection(['karma_sid' => 'sid-test']);

    expect($result['success'])->toBeFalse()
        ->and($result['message'])->toBe('invalid session');
});
