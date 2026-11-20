/**
 * Resolves the `language` query param for the Google Maps JS API loader from the
 * console's persisted locale, so Google's own map UI (attribution, "Report a map error",
 * keyboard shortcuts, place names) follows the active app language.
 *
 * @return {String} e.g. `es`, `en`
 */
export default function googleMapsLanguage() {
    let locale = 'en-us';

    try {
        const raw = window.localStorage?.getItem('@fleetbase/storage:user-options');
        const options = raw ? JSON.parse(raw) : null;
        const found = options && Object.keys(options).find((key) => key.endsWith('locale'));
        if (found && options[found]) {
            locale = String(options[found]);
        } else if (typeof navigator !== 'undefined' && navigator.language) {
            locale = navigator.language;
        }
    } catch {
        // ignore, fall back to english
    }

    return locale.toLowerCase().split(/[-_]/)[0] || 'en';
}
