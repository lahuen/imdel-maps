import './style.css';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster';
import { APP_CONFIG } from './config';
import { CATEGORIES, COOPS, POI_KINDS, POIS, type Category, type Coop, type Poi, type PoiKind } from './data/seed';

type RoutePlan = {
  title: string;
  summary: string;
  origin: Coop | Poi;
  stops: Array<Coop | Poi>;
  distanceKm: number;
  lowCost: string;
  rideHail: string;
};

const state = {
  query: '',
  category: 'todas' as Category | 'todas',
  selectedId: COOPS[0].id,
  sortPoint: null as { lat: number; lng: number; label: string } | null,
  poiKinds: new Set<PoiKind>(['localidad', 'equipamiento']),
  plan: null as RoutePlan | null,
  assistantOpen: false,
};

const ASSISTANT_STORAGE_KEY = `${APP_CONFIG.appName.toLowerCase().replace(/\W+/g, '-')}-assistant-v1`;

function restoreAssistantSession(): void {
  try {
    const raw = localStorage.getItem(ASSISTANT_STORAGE_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw) as { prompt?: string; plan?: RoutePlan };
    if (saved.plan) state.plan = saved.plan;
    if (saved.prompt) {
      queueMicrotask(() => {
        const input = document.querySelector<HTMLInputElement>('#ask-input');
        if (input) input.value = saved.prompt ?? '';
      });
    }
  } catch {
    localStorage.removeItem(ASSISTANT_STORAGE_KEY);
  }
}

function saveAssistantSession(prompt: string): void {
  localStorage.setItem(ASSISTANT_STORAGE_KEY, JSON.stringify({
    prompt,
    plan: state.plan,
    savedAt: new Date().toISOString(),
  }));
}

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('Missing #app');

app.innerHTML = `
  <main class="app-shell">
    <header class="site-header">
      <a class="site-brand" href="#" aria-label="${APP_CONFIG.organizationName} ${APP_CONFIG.appName}">
        <img src="${APP_CONFIG.brandLogo}" alt="${APP_CONFIG.organizationName}" />
        <div>
          <strong>${APP_CONFIG.appName}</strong>
          <span>${APP_CONFIG.tagline}</span>
        </div>
      </a>
      <nav class="site-nav" aria-label="Navegacion principal">
        <a class="nav-primary" href="#admin">Sumar cooperativa</a>
      </nav>
    </header>
    <section class="map-stage" aria-label="Mapa de cooperativas">
      <div id="map"></div>
      <div class="map-intel" aria-label="Resumen territorial">
        <div>
          <strong>${COOPS.length}</strong>
          <span>cooperativas</span>
        </div>
        <div>
          <strong>${POIS.filter((poi) => poi.zone === 'primary').length}</strong>
          <span>puntos de interes</span>
        </div>
      </div>
      <section class="assistant-card assistant-dock" id="assistant" aria-label="Asistente">
        <button class="assistant-toggle" id="assistant-toggle" type="button" aria-expanded="false">
          <span class="gemini-mark" aria-label="${APP_CONFIG.aiProviderLabel}"></span>
          <div>
            <p class="context-title">Asistente</p>
            <p class="context-note">Abrir planificador con ${APP_CONFIG.aiProviderLabel}</p>
          </div>
        </button>
        <button class="assistant-close" id="assistant-close" type="button" aria-label="Cerrar asistente">×</button>
        <div class="assistant-body" id="assistant-body">
          <form class="ask-form" id="ask-form">
            <input id="ask-input" autocomplete="off" placeholder="Ej: Como llego a..." />
            <button type="submit">Planear</button>
          </form>
          <div class="route-result" id="route-result"></div>
        </div>
      </section>
      <header class="topbar">
        <button class="icon-button" id="locate-button" aria-label="Centrar en mi ubicacion">
          <span aria-hidden="true">⌖</span>
        </button>
      </header>
    </section>

    <aside class="panel" aria-label="Explorar cooperativas">
      <div class="grabber" aria-hidden="true"></div>
      <div class="panel-head">
        <div>
          <p class="eyebrow">Red productiva local</p>
          <h2>${APP_CONFIG.panelTitle}</h2>
          <p class="sort-hint" id="sort-hint"></p>
        </div>
        <span class="count-pill" id="count-pill"></span>
      </div>

      <p class="panel-copy">
        ${APP_CONFIG.territoryDescription}
      </p>

      <section class="context-layer" aria-label="Puntos de interes comunitarios">
        <div>
          <p class="context-title">Puntos de interes</p>
          <p class="context-note">Puntos de interes en ${APP_CONFIG.territoryName} y alrededores.</p>
        </div>
        <div class="layer-toggles" id="layer-toggles"></div>
      </section>

      <label class="search-field">
        <span aria-hidden="true">⌕</span>
        <input id="search-input" type="search" autocomplete="off" placeholder="Buscar por producto, barrio o nombre" />
      </label>

      <div class="chips" id="chips" aria-label="Filtros por rubro"></div>
      <div class="coop-list" id="coop-list"></div>
      <a class="kaizen-mark" href="${APP_CONFIG.poweredByUrl}" target="_blank" rel="noopener">
        ${APP_CONFIG.poweredByLabel}
      </a>
    </aside>
    <div class="admin-modal" id="admin-modal" aria-hidden="true">
      <section class="admin-card" role="dialog" aria-modal="true" aria-labelledby="admin-title">
        <button class="admin-close" id="admin-close" type="button" aria-label="Cerrar">×</button>
        <p class="eyebrow">Acceso restringido</p>
        <h2 id="admin-title">Sumar cooperativa</h2>
        <p>
          El alta y la edición requieren SSO con rol <strong>admin</strong> o <strong>maintain</strong>.
          Este POC deja preparado el flujo para Auth, whitelist y un CMS administrativo.
        </p>
        <button class="google-login" type="button"><span>G</span> Continuar con Google</button>
        <div class="admin-grid">
          <div><strong>Admin</strong><span>Roles, publicación, auditoría y configuración.</span></div>
          <div><strong>Maintain</strong><span>ABM operativo de cooperativas, puntos y blog.</span></div>
          <div><strong>Coope</strong><span>Perfil propio con cambios enviados a revisión.</span></div>
        </div>
      </section>
    </div>
  </main>
`;

restoreAssistantSession();

const map = L.map('map', {
  center: [-34.634, -58.795],
  zoom: 12,
  zoomControl: false,
  attributionControl: false,
});

L.control.zoom({ position: 'bottomright' }).addTo(map);
L.control.attribution({ position: 'bottomleft', prefix: false }).addTo(map);

L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
  attribution: '© OpenStreetMap · © CARTO',
  subdomains: 'abcd',
  maxZoom: 20,
}).addTo(map);

const clusterGroup = (L as unknown as { markerClusterGroup: (opts?: object) => L.MarkerClusterGroup })
  .markerClusterGroup({
    maxClusterRadius: 48,
    showCoverageOnHover: false,
    spiderfyOnMaxZoom: true,
  });
map.addLayer(clusterGroup);

const markerById = new Map<string, L.Marker>();
const poiLayer = L.layerGroup().addTo(map);
const routeLayer = L.layerGroup().addTo(map);
const focusLayer = L.layerGroup().addTo(map);

function normalize(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function filteredCoops(): Coop[] {
  const q = normalize(state.query.trim());
  const result = COOPS.filter((coop) => {
    const byCategory = state.category === 'todas' || coop.category === state.category;
    const haystack = normalize([
      coop.name,
      coop.neighborhood,
      coop.locality,
      coop.value,
      ...coop.products,
    ].join(' '));
    return byCategory && (!q || haystack.includes(q));
  });

  if (state.sortPoint) {
    result.sort((a, b) => distanceKm(state.sortPoint!, a) - distanceKm(state.sortPoint!, b));
  }

  return result;
}

function distanceKm(a: Pick<Coop | Poi, 'lat' | 'lng'>, b: Pick<Coop | Poi, 'lat' | 'lng'>): number {
  const earthKm = 6371;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;
  const lat1 = a.lat * Math.PI / 180;
  const lat2 = b.lat * Math.PI / 180;
  const x = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * earthKm * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function money(value: number): string {
  return `$${Math.round(value).toLocaleString('es-AR')}`;
}

function mapsTarget(place: Coop | Poi): string {
  return encodeURIComponent(place.mapsQuery ?? `${place.lat},${place.lng}`);
}

function buildPlan(prompt: string): RoutePlan {
  const q = normalize(prompt);
  const mentionsFeaturedCoop = q.includes(normalize(APP_CONFIG.featuredCoopKeyword))
    || q.includes(normalize(APP_CONFIG.featuredCoopLabel));
  const mentionsStation = q.includes('estacion') || q.includes('feria') || q.includes('plaza');
  const asksDirections = q.includes('como llegar') || q.includes('ir a') || q.includes('llegar a') || q.includes('desde');
  const wantsFallbackZone = q.includes('fuera de zona') || q.includes('fuera del territorio') || q.includes('regional');
  const wantsFood = q.includes('alimento') || q.includes('comida') || q.includes('pan') || q.includes('vianda');
  const wantsAgro = q.includes('agro') || q.includes('verdura') || q.includes('huerta') || q.includes('cuartel');
  const wantsVerified = q.includes('verificada') || q.includes('validada');
  const origin = q.includes('estacion') || q.includes('desde el centro')
    ? POIS.find((poi) => poi.id === 'central-station')!
    : POIS.find((poi) => poi.id === 'central-area')!;

  if (mentionsFeaturedCoop && asksDirections && !q.includes('feria')) {
    const featuredCoop = COOPS.find((coop) => coop.id === 'featured-cooperative')!;
    const directKm = distanceKm(origin, featuredCoop) * 1.28;
    return {
      title: `Estacion central → ${APP_CONFIG.featuredCoopLabel}`,
      summary: `Recorrido directo desde Estacion central hasta ${APP_CONFIG.featuredCoopLabel}, usando la direccion interna exacta del mapa.`,
      origin,
      stops: [featuredCoop],
      distanceKm: directKm,
      lowCost: `${money(850)}-${money(1400)}`,
      rideHail: `${money(directKm * 760 + 900)}-${money(directKm * 1050 + 1600)}`,
    };
  }

  if (mentionsFeaturedCoop && mentionsStation) {
    const featuredCoop = COOPS.find((coop) => coop.id === 'featured-cooperative')!;
    const feria = POIS.find((poi) => poi.id === 'station-market')!;
    const directKm = distanceKm(featuredCoop, feria) * 1.28;
    return {
      title: `${APP_CONFIG.featuredCoopLabel} + Feria de la estacion`,
      summary: `Recorrido acotado a ${APP_CONFIG.territoryName}: salida por ${APP_CONFIG.featuredCoopLabel} y cierre en la feria de la estacion.`,
      origin,
      stops: [featuredCoop, feria],
      distanceKm: directKm,
      lowCost: `${money(850)}-${money(1400)}`,
      rideHail: `${money(directKm * 760 + 900)}-${money(directKm * 1050 + 1600)}`,
    };
  }

  let candidates = COOPS.filter((coop) => {
    if (wantsFood) return coop.category === 'alimentos' || coop.products.some((p) => ['viandas', 'panificados', 'verduras', 'frutas', 'huevos'].includes(p));
    if (wantsAgro) return coop.category === 'agro';
    return true;
  });

  if (wantsVerified) candidates = candidates.filter((coop) => coop.verified);
  if (candidates.length < 2 && wantsFallbackZone) {
    const fallbackStops = POIS.filter((poi) => poi.zone === 'fallback').slice(0, 2);
    candidates = COOPS.slice(0, 2);
    return {
      title: 'Recorrido ampliado regional',
      summary: `${APP_CONFIG.territoryName} sigue como prioridad. Sumamos referencias regionales solo cuando la consulta lo pide o la cobertura local no alcanza.`,
      origin,
      stops: [...candidates, ...fallbackStops],
      distanceKm: 18.6,
      lowCost: `${money(1500)}-${money(2600)}`,
      rideHail: `${money(14500)}-${money(22500)}`,
    };
  }
  if (candidates.length < 2) candidates = COOPS;

  const stops: Array<Coop | Poi> = candidates
    .slice()
    .sort((a, b) => distanceKm(origin, a) - distanceKm(origin, b))
    .slice(0, 3);

  const legs = [origin, ...stops];
  const distance = legs.slice(1).reduce((total, stop, index) => total + distanceKm(legs[index], stop), 0);
  const adjusted = distance * 1.28;
  const transitLow = 900 + stops.length * 420;
  const transitHigh = 1400 + stops.length * 620;
  const rideLow = adjusted * 760 + 900;
  const rideHigh = adjusted * 1050 + 1600;

  return {
    title: wantsAgro ? 'Recorrido agro territorial' : wantsFood ? 'Recorrido de alimentos locales' : 'Recorrido productivo sugerido',
    summary: `Salida sugerida desde ${origin.name}. Priorizamos cercania, rubro y puntos utiles para una visita de campo.`,
    origin,
    stops,
    distanceKm: adjusted,
    lowCost: `${money(transitLow)}-${money(transitHigh)}`,
    rideHail: `${money(rideLow)}-${money(rideHigh)}`,
  };
}

function makeIcon(coop: Coop): L.DivIcon {
  const meta = CATEGORIES[coop.category];
  return L.divIcon({
    className: '',
    html: `<div class="marker-pin" style="--pin:${meta.color}"><span>${coop.name.slice(0, 1)}</span></div>`,
    iconSize: [38, 46],
    iconAnchor: [19, 44],
  });
}

function makePoiIcon(poi: Poi): L.DivIcon {
  const meta = POI_KINDS[poi.kind];
  return L.divIcon({
    className: '',
    html: `<div class="poi-pin" style="--poi:${meta.color}" title="${poi.name}"></div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });
}

function renderMarkers(coops: Coop[]): void {
  clusterGroup.clearLayers();
  markerById.clear();

  coops.forEach((coop) => {
    const marker = L.marker([coop.lat, coop.lng], {
      icon: makeIcon(coop),
      title: coop.name,
    });
    marker.on('click', (event) => {
      L.DomEvent.stopPropagation(event);
      selectCoop(coop.id, true);
    });
    markerById.set(coop.id, marker);
    clusterGroup.addLayer(marker);
  });
}

function renderFocusPoint(): void {
  focusLayer.clearLayers();
  if (!state.sortPoint) return;

  L.circleMarker([state.sortPoint.lat, state.sortPoint.lng], {
    radius: 12,
    color: '#26336b',
    weight: 3,
    fillColor: '#00b6ed',
    fillOpacity: 0.18,
  })
    .bindTooltip(state.sortPoint.label, { direction: 'top', offset: [0, -10], opacity: 0.92 })
    .addTo(focusLayer);
}

function renderRoute(): void {
  routeLayer.clearLayers();
  if (!state.plan) return;

  const coordinates = [state.plan.origin, ...state.plan.stops].map((stop) => [stop.lat, stop.lng] as L.LatLngExpression);
  L.polyline(coordinates, {
    color: '#26336b',
    weight: 5,
    opacity: 0.72,
    dashArray: '8 10',
  }).addTo(routeLayer);

  const bounds = L.latLngBounds(coordinates);
  map.fitBounds(bounds.pad(0.34), { animate: true });
}

function renderPoiLayer(): void {
  poiLayer.clearLayers();

  POIS.filter((poi) => poi.zone === 'primary' && state.poiKinds.has(poi.kind)).forEach((poi) => {
    const marker = L.marker([poi.lat, poi.lng], {
      icon: makePoiIcon(poi),
      interactive: true,
      title: poi.name,
      keyboard: false,
    });

    marker.on('click', (event) => {
      L.DomEvent.stopPropagation(event);
      state.sortPoint = { lat: poi.lat, lng: poi.lng, label: poi.name };
      state.selectedId = filteredCoops()[0]?.id ?? state.selectedId;
      update(false);
    });

    marker.bindTooltip(`${POI_KINDS[poi.kind].label}: ${poi.name}`, {
      direction: 'top',
      offset: [0, -8],
      opacity: 0.92,
    });

    poiLayer.addLayer(marker);
  });
}

function renderLayerToggles(): void {
  const wrap = document.querySelector<HTMLDivElement>('#layer-toggles')!;
  wrap.innerHTML = Object.entries(POI_KINDS).map(([kind, meta]) => `
    <button class="layer-toggle ${state.poiKinds.has(kind as PoiKind) ? 'active' : ''}" data-kind="${kind}" style="--layer:${meta.color}">
      <span></span>${meta.label}
    </button>
  `).join('');

  wrap.querySelectorAll<HTMLButtonElement>('.layer-toggle').forEach((button) => {
    button.addEventListener('click', () => {
      const kind = button.dataset.kind as PoiKind;
      if (state.poiKinds.has(kind)) state.poiKinds.delete(kind);
      else state.poiKinds.add(kind);
      renderLayerToggles();
      renderPoiLayer();
    });
  });
}

function renderChips(): void {
  const chips = document.querySelector<HTMLDivElement>('#chips')!;
  const items: Array<{ id: Category | 'todas'; label: string }> = [
    { id: 'todas', label: 'Todas' },
    ...Object.entries(CATEGORIES).map(([id, meta]) => ({ id: id as Category, label: meta.label })),
  ];

  chips.innerHTML = items.map((item) => `
    <button class="chip ${state.category === item.id ? 'active' : ''}" data-category="${item.id}">
      ${item.label}
    </button>
  `).join('');

  chips.querySelectorAll<HTMLButtonElement>('.chip').forEach((button) => {
    button.addEventListener('click', () => {
      state.category = button.dataset.category as Category | 'todas';
      update();
    });
  });
}

function renderList(coops: Coop[]): void {
  const list = document.querySelector<HTMLDivElement>('#coop-list')!;
  const count = document.querySelector<HTMLSpanElement>('#count-pill')!;
  const sortHint = document.querySelector<HTMLParagraphElement>('#sort-hint')!;
  count.textContent = `${coops.length} visibles`;
  sortHint.textContent = state.sortPoint ? `Ordenado por cercania a ${state.sortPoint.label}` : 'Tocá el mapa para ordenar por cercania';

  if (!coops.length) {
    list.innerHTML = `
      <div class="empty-state">
        <strong>No hay resultados</strong>
        <span>Probá limpiar la busqueda o cambiar el rubro.</span>
      </div>
    `;
    return;
  }

  list.innerHTML = coops.map((coop) => {
    const meta = CATEGORIES[coop.category];
    return `
      <article class="coop-card ${state.selectedId === coop.id ? 'selected' : ''}" data-id="${coop.id}">
        <div class="card-main">
          <span class="category-dot" style="--dot:${meta.color}"></span>
          <div>
            <div class="card-kicker">${meta.label} · ${coop.neighborhood}</div>
            <h3>${coop.name}</h3>
            ${state.sortPoint ? `<div class="distance-note">${distanceKm(state.sortPoint, coop).toFixed(1)} km aprox.</div>` : ''}
          </div>
        </div>
        <p>${coop.value}</p>
        <div class="tags">
          ${coop.products.slice(0, 4).map((product) => `<span>${product}</span>`).join('')}
        </div>
        <div class="card-actions">
          <a href="https://www.google.com/maps/dir/?api=1&destination=${mapsTarget(coop)}" target="_blank" rel="noopener">Como llegar</a>
          ${coop.contact ? `<a href="https://wa.me/549${coop.contact.replace(/\D/g, '')}" target="_blank" rel="noopener">Contactar</a>` : ''}
          ${coop.verified ? '<span class="verified">Verificada</span>' : '<span class="pending">A validar</span>'}
        </div>
      </article>
    `;
  }).join('');

  list.querySelectorAll<HTMLElement>('.coop-card').forEach((card) => {
    card.addEventListener('click', (event) => {
      if ((event.target as HTMLElement).closest('a')) return;
      selectCoop(card.dataset.id!, true);
    });
  });
}

function renderPlan(): void {
  const el = document.querySelector<HTMLDivElement>('#route-result')!;
  if (!state.plan) {
    el.innerHTML = '';
    return;
  }

  const destination = state.plan.stops[state.plan.stops.length - 1];
  const waypoints = state.plan.stops.slice(0, -1).map((stop) => mapsTarget(stop)).join('|');
  const mapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${mapsTarget(state.plan.origin)}&destination=${mapsTarget(destination)}&waypoints=${waypoints}`;

  el.innerHTML = `
    <div class="route-card">
      <div class="route-topline">
        <strong>${state.plan.title}</strong>
        <span>${state.plan.distanceKm.toFixed(1)} km estimados</span>
      </div>
      <p>${state.plan.summary}</p>
      <ol>
        <li>${state.plan.origin.name}<span>Origen</span></li>
        ${state.plan.stops.map((stop) => `<li>${stop.name}<span>${'neighborhood' in stop ? stop.neighborhood : POI_KINDS[stop.kind].label}</span></li>`).join('')}
      </ol>
      <div class="cost-grid">
        <div><span>Colectivo/tren</span><strong>${state.plan.lowCost}</strong></div>
        <div><span>App viaje</span><strong>${state.plan.rideHail}</strong></div>
      </div>
      <a href="${mapsUrl}" target="_blank" rel="noopener">Abrir recorrido real</a>
    </div>
  `;
}

function renderAssistant(): void {
  const dock = document.querySelector<HTMLElement>('#assistant')!;
  const toggle = document.querySelector<HTMLButtonElement>('#assistant-toggle')!;
  const note = toggle.querySelector<HTMLElement>('.context-note')!;
  dock.classList.toggle('open', state.assistantOpen);
  toggle.setAttribute('aria-expanded', String(state.assistantOpen));
  note.textContent = state.plan ? 'Continuar último recorrido' : `Abrir planificador con ${APP_CONFIG.aiProviderLabel}`;
}

function selectCoop(id: string, moveMap: boolean): void {
  state.selectedId = id;
  const coop = COOPS.find((item) => item.id === id);
  if (coop && moveMap) map.flyTo([coop.lat, coop.lng], 15, { duration: 0.55 });
  update(false);
  document.querySelector<HTMLElement>(`.coop-card[data-id="${id}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

function update(refreshMarkers = true): void {
  const coops = filteredCoops();
  if (!coops.some((coop) => coop.id === state.selectedId)) state.selectedId = coops[0]?.id ?? '';
  renderChips();
  renderLayerToggles();
  renderList(coops);
  renderPlan();
  renderAssistant();
  if (refreshMarkers) renderMarkers(coops);
  renderPoiLayer();
  renderRoute();
  renderFocusPoint();
}

document.querySelector<HTMLInputElement>('#search-input')!.addEventListener('input', (event) => {
  state.query = (event.target as HTMLInputElement).value;
  update();
});

document.querySelector<HTMLAnchorElement>('a[href="#admin"]')!.addEventListener('click', (event) => {
  event.preventDefault();
  document.querySelector<HTMLElement>('#admin-modal')!.classList.add('open');
  document.querySelector<HTMLElement>('#admin-modal')!.setAttribute('aria-hidden', 'false');
});

document.querySelector<HTMLButtonElement>('#admin-close')!.addEventListener('click', () => {
  document.querySelector<HTMLElement>('#admin-modal')!.classList.remove('open');
  document.querySelector<HTMLElement>('#admin-modal')!.setAttribute('aria-hidden', 'true');
});

map.on('click', (event: L.LeafletMouseEvent) => {
  state.sortPoint = {
    lat: event.latlng.lat,
    lng: event.latlng.lng,
    label: 'punto seleccionado',
  };
  state.selectedId = filteredCoops()[0]?.id ?? state.selectedId;
  update(false);
});

document.querySelector<HTMLButtonElement>('#assistant-toggle')!.addEventListener('click', () => {
  state.assistantOpen = !state.assistantOpen;
  renderAssistant();
  if (state.assistantOpen) document.querySelector<HTMLInputElement>('#ask-input')!.focus();
});

document.querySelector<HTMLButtonElement>('#assistant-close')!.addEventListener('click', () => {
  state.assistantOpen = false;
  renderAssistant();
});

document.addEventListener('pointerdown', (event) => {
  const assistant = document.querySelector<HTMLElement>('#assistant')!;
  if (!state.assistantOpen || assistant.contains(event.target as Node)) return;
  state.assistantOpen = false;
  renderAssistant();
});

document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape' || !state.assistantOpen) return;
  state.assistantOpen = false;
  renderAssistant();
});

document.querySelector<HTMLFormElement>('#ask-form')!.addEventListener('submit', (event) => {
  event.preventDefault();
  const input = document.querySelector<HTMLInputElement>('#ask-input')!;
  state.plan = buildPlan(input.value || input.placeholder);
  saveAssistantSession(input.value || input.placeholder);
  state.assistantOpen = true;
  state.category = 'todas';
  state.query = '';
  document.querySelector<HTMLInputElement>('#search-input')!.value = '';
  update();
});

document.querySelector<HTMLButtonElement>('#locate-button')!.addEventListener('click', () => {
  if (!navigator.geolocation) return;
  navigator.geolocation.getCurrentPosition((position) => {
    map.flyTo([position.coords.latitude, position.coords.longitude], 15, { duration: 0.6 });
  });
});

update();
