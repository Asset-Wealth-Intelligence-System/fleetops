<?php

namespace Fleetbase\FleetOps\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\App;
use Illuminate\Support\Str;

/**
 * Sets the application locale for the current request from the console's
 * `Accept-Language` header (sent by the Ember `fetch` service) so that any
 * server-generated UI copy (hub KPIs, action queues, notifications) is
 * returned in the language the operator selected.
 */
class SetRequestLocale
{
    /**
     * Locales that have server-side translations available.
     */
    public const SUPPORTED = ['en', 'es'];

    public function handle(Request $request, Closure $next)
    {
        $locale = static::resolve($request);

        if ($locale) {
            App::setLocale($locale);
        }

        $response = $next($request);
        if (method_exists($response, 'header')) {
            $response->header('Content-Language', App::getLocale());
        }

        return $response;
    }

    /**
     * Resolve a supported locale from the request, falling back to the app default.
     */
    public static function resolve(Request $request): ?string
    {
        $candidates = [];

        // Explicit override, useful for API consumers: ?locale=es
        if ($request->filled('locale')) {
            $candidates[] = (string) $request->input('locale');
        }

        $header = (string) $request->header('Accept-Language', '');
        foreach (explode(',', $header) as $part) {
            $tag = trim(Str::before($part, ';'));
            if ($tag !== '') {
                $candidates[] = $tag;
            }
        }

        foreach ($candidates as $candidate) {
            $lang = Str::lower(Str::before(str_replace('_', '-', $candidate), '-'));
            if (in_array($lang, static::SUPPORTED, true)) {
                return $lang;
            }
        }

        return null;
    }
}
