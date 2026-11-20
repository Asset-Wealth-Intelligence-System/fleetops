/* global google */
/**
 * Rotatable image marker for Google Maps built on `google.maps.OverlayView`.
 *
 * `google.maps.Marker` cannot rotate raster icons, and `AdvancedMarkerElement`
 * requires a Map ID. When no Map ID is configured Fleet-Ops falls back to this
 * overlay so vehicle/driver icons still follow their heading.
 *
 * The class mimics the subset of the `google.maps.Marker` API the adapter
 * relies on (`setPosition`, `getPosition`, `setMap`, `getMap`, `setZIndex`,
 * `setTitle`, `setIcon`, `setVisible`, `addListener`) and emits the same
 * mouse events (`click`, `rightclick`, `mouseover`, `mousemove`, `mouseout`)
 * with a `domEvent` and `latLng` payload.
 */
let RotatableMarkerClass = null;

export function getRotatableMarkerClass() {
    if (RotatableMarkerClass) return RotatableMarkerClass;
    if (typeof window === 'undefined' || !window.google?.maps?.OverlayView) return null;

    class RotatableImageMarker extends google.maps.OverlayView {
        constructor({ map, position, iconUrl, iconSize = [24, 24], title = '', zIndex = 0, rotation = 0 } = {}) {
            super();
            this._position = position instanceof google.maps.LatLng ? position : new google.maps.LatLng(position.lat, position.lng);
            this._iconUrl = iconUrl;
            this._iconSize = iconSize;
            this._title = title;
            this._zIndex = zIndex;
            this._rotation = Number.isFinite(rotation) ? rotation : 0;
            this._visible = true;
            this._el = null;
            this._img = null;
            this._domListeners = [];

            if (map) this.setMap(map);
        }

        // ─── OverlayView lifecycle ─────────────────────────────────────────

        onAdd() {
            const [w, h] = this._iconSize;
            const el = document.createElement('div');
            el.className = 'fleetops-map-marker fleetops-map-marker--overlay';
            el.style.cssText = `position:absolute; width:${w}px; height:${h}px; margin-left:${-w / 2}px; margin-top:${-h / 2}px; line-height:0; cursor:pointer; transform-origin:center center; will-change:transform; z-index:${this._zIndex};`;
            el.title = this._title ?? '';

            const img = document.createElement('img');
            img.src = this._iconUrl;
            img.alt = this._title ?? '';
            img.draggable = false;
            img.style.cssText = `width:${w}px; height:${h}px; max-width:none; max-height:none; object-fit:contain; display:block; pointer-events:none; user-select:none;`;
            el.appendChild(img);

            this._el = el;
            this._img = img;
            this.#applyRotation();
            this.#applyVisibility();

            const forward = (name) => (domEvent) => {
                if (name === 'rightclick') domEvent.preventDefault();
                domEvent.stopPropagation();
                google.maps.event.trigger(this, name, { domEvent, latLng: this._position });
            };

            const bind = (type, name) => {
                const handler = forward(name);
                el.addEventListener(type, handler);
                this._domListeners.push([type, handler]);
            };

            bind('click', 'click');
            bind('contextmenu', 'rightclick');
            bind('mouseover', 'mouseover');
            bind('mousemove', 'mousemove');
            bind('mouseout', 'mouseout');

            this.getPanes().overlayMouseTarget.appendChild(el);
        }

        draw() {
            if (!this._el) return;
            const projection = this.getProjection();
            if (!projection) return;
            const point = projection.fromLatLngToDivPixel(this._position);
            if (!point) return;
            this._el.style.left = `${point.x}px`;
            this._el.style.top = `${point.y}px`;
        }

        onRemove() {
            if (!this._el) return;
            for (const [type, handler] of this._domListeners) {
                this._el.removeEventListener(type, handler);
            }
            this._domListeners = [];
            this._el.remove();
            this._el = null;
            this._img = null;
        }

        // ─── google.maps.Marker-compatible API ─────────────────────────────

        getPosition() {
            return this._position;
        }

        setPosition(position) {
            if (!position) return;
            this._position = position instanceof google.maps.LatLng ? position : new google.maps.LatLng(position.lat, position.lng);
            this.draw();
        }

        setZIndex(zIndex) {
            this._zIndex = zIndex ?? 0;
            if (this._el) this._el.style.zIndex = String(this._zIndex);
        }

        getZIndex() {
            return this._zIndex;
        }

        setTitle(title) {
            this._title = title ?? '';
            if (this._el) this._el.title = this._title;
            if (this._img) this._img.alt = this._title;
        }

        getTitle() {
            return this._title;
        }

        setIcon(icon) {
            const url = typeof icon === 'string' ? icon : icon?.url;
            if (!url) return;
            this._iconUrl = url;
            if (this._img) this._img.src = url;
        }

        getIcon() {
            return { url: this._iconUrl };
        }

        setVisible(visible) {
            this._visible = Boolean(visible);
            this.#applyVisibility();
        }

        getVisible() {
            return this._visible;
        }

        setRotation(degrees) {
            this._rotation = Number.isFinite(degrees) ? degrees : 0;
            this.#applyRotation();
        }

        getRotation() {
            return this._rotation;
        }

        /** Marker-compatible alias so generic code that reads `.content` keeps working. */
        get content() {
            return this._el;
        }

        #applyRotation() {
            if (this._el) this._el.style.transform = `rotate(${this._rotation}deg)`;
        }

        #applyVisibility() {
            if (this._el) this._el.style.display = this._visible ? 'block' : 'none';
        }
    }

    RotatableMarkerClass = RotatableImageMarker;
    return RotatableMarkerClass;
}
