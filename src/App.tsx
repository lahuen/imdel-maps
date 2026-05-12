import { useEffect, useMemo, useRef, useState } from 'react';
import {
  IonApp,
  IonBadge,
  IonButton,
  IonButtons,
  IonCard,
  IonChip,
  IonContent,
  IonHeader,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonModal,
  IonPage,
  IonSearchbar,
  IonSegment,
  IonSegmentButton,
  IonToolbar,
} from '@ionic/react';
import {
  addOutline,
  addSharp,
  chevronDownOutline,
  chevronUpOutline,
  closeOutline,
  heart,
  heartOutline,
  informationCircleOutline,
  locateOutline,
  mapOutline,
  removeSharp,
  navigateOutline,
  shareOutline,
  sparklesOutline,
} from 'ionicons/icons';
import L from 'leaflet';
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
  insights: string[];
};

type SortPoint = { lat: number; lng: number; label: string } | null;
type SheetView = 'profile' | 'coops' | 'territory';

const ASSISTANT_STORAGE_KEY = `${APP_CONFIG.appName.toLowerCase().replace(/\W+/g, '-')}-assistant-v2`;
const FAVORITES_STORAGE_KEY = `${APP_CONFIG.appName.toLowerCase().replace(/\W+/g, '-')}-favorites-v1`;
const DEFAULT_POI_KINDS: PoiKind[] = ['localidad', 'equipamiento'];

function normalize(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
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

function buildAssistantInsights(prompt: string): string[] {
  const q = normalize(prompt);
  const insights = new Set<string>();

  if (q.includes('cooperativa') || q.includes('coope') || q.includes('perfil')) {
    insights.add('Cooperativa: perfil productivo, propuesta de valor, zona de cobertura, capacidad operativa y contacto validado.');
  }
  if (q.includes('municipio') || q.includes('tramite') || q.includes('habilitacion') || q.includes('programa')) {
    insights.add('Municipio: cruzar con páginas oficiales, áreas de atención, programas vigentes y referencias territoriales no editables.');
  }
  if (q.includes('colectivo') || q.includes('tren') || q.includes('transporte') || q.includes('viatico') || q.includes('costo')) {
    insights.add('Transporte: estimar viáticos con distancia, combinaciones, caminata y horario; validar tarifas con dataset o API actualizada.');
  }
  if (q.includes('uber') || q.includes('didi') || q.includes('app') || q.includes('viaje')) {
    insights.add('App de viaje: ETA/costo real requiere API aprobada; mientras tanto usamos estimación orientativa y deeplink externo.');
  }
  if (q.includes('redes') || q.includes('instagram') || q.includes('facebook') || q.includes('noticia')) {
    insights.add('Fuentes oficiales: incorporar novedades web/redes como contexto fechado, con fuente visible y revisión.');
  }
  if (insights.size === 0) {
    insights.add('Contexto territorial: combinar mapa, cooperativas, puntos de interés, transporte y fuentes oficiales.');
  }
  return [...insights];
}

function buildPlan(prompt: string): RoutePlan {
  const q = normalize(prompt);
  const insights = buildAssistantInsights(prompt);
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
      title: `Estación central → ${APP_CONFIG.featuredCoopLabel}`,
      summary: `Recorrido directo desde Estación central hasta ${APP_CONFIG.featuredCoopLabel}, usando la dirección interna exacta del mapa.`,
      origin,
      stops: [featuredCoop],
      distanceKm: directKm,
      lowCost: `${money(850)}-${money(1400)}`,
      rideHail: `${money(directKm * 760 + 900)}-${money(directKm * 1050 + 1600)}`,
      insights,
    };
  }

  if (mentionsFeaturedCoop && mentionsStation) {
    const featuredCoop = COOPS.find((coop) => coop.id === 'featured-cooperative')!;
    const feria = POIS.find((poi) => poi.id === 'station-market')!;
    const directKm = distanceKm(featuredCoop, feria) * 1.28;
    return {
      title: `${APP_CONFIG.featuredCoopLabel} + feria de la estación`,
      summary: `Recorrido acotado a ${APP_CONFIG.territoryName}: salida por ${APP_CONFIG.featuredCoopLabel} y cierre en la feria de la estación.`,
      origin,
      stops: [featuredCoop, feria],
      distanceKm: directKm,
      lowCost: `${money(850)}-${money(1400)}`,
      rideHail: `${money(directKm * 760 + 900)}-${money(directKm * 1050 + 1600)}`,
      insights,
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
      summary: `${APP_CONFIG.territoryName} sigue como prioridad. Sumamos referencias regionales sólo cuando la consulta lo pide o la cobertura local no alcanza.`,
      origin,
      stops: [...candidates, ...fallbackStops],
      distanceKm: 18.6,
      lowCost: `${money(1500)}-${money(2600)}`,
      rideHail: `${money(14500)}-${money(22500)}`,
      insights,
    };
  }
  if (candidates.length < 2) candidates = COOPS;

  const stops = candidates
    .slice()
    .sort((a, b) => distanceKm(origin, a) - distanceKm(origin, b))
    .slice(0, 3);
  const legs = [origin, ...stops];
  const distance = legs.slice(1).reduce((total, stop, index) => total + distanceKm(legs[index], stop), 0) * 1.28;

  return {
    title: wantsAgro ? 'Recorrido agro territorial' : wantsFood ? 'Recorrido de alimentos locales' : 'Recorrido productivo sugerido',
    summary: `Salida sugerida desde ${origin.name}. Priorizamos cercanía, rubro y puntos útiles para una visita de campo.`,
    origin,
    stops,
    distanceKm: distance,
    lowCost: `${money(900 + stops.length * 420)}-${money(1400 + stops.length * 620)}`,
    rideHail: `${money(distance * 760 + 900)}-${money(distance * 1050 + 1600)}`,
    insights,
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
    html: `<div class="poi-pin" style="--poi:${meta.color}"></div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });
}

function mapsUrl(plan: RoutePlan): string {
  const destination = plan.stops[plan.stops.length - 1];
  const waypoints = plan.stops.slice(0, -1).map((stop) => mapsTarget(stop)).join('|');
  return `https://www.google.com/maps/dir/?api=1&origin=${mapsTarget(plan.origin)}&destination=${mapsTarget(destination)}&waypoints=${waypoints}`;
}

export function App() {
  const mapNode = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const coopLayerRef = useRef<L.MarkerClusterGroup | null>(null);
  const poiLayerRef = useRef<L.LayerGroup | null>(null);
  const routeLayerRef = useRef<L.LayerGroup | null>(null);
  const selectedMarkerRef = useRef<L.CircleMarker | null>(null);
  const sheetModalRef = useRef<HTMLIonModalElement>(null);

  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<Category | 'todas'>('todas');
  const [selectedId, setSelectedId] = useState(COOPS[0].id);
  const [sortPoint, setSortPoint] = useState<SortPoint>(null);
  const [poiKinds, setPoiKinds] = useState<Set<PoiKind>>(new Set(DEFAULT_POI_KINDS));
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [sheetExpanded, setSheetExpanded] = useState(false);
  const [sheetView, setSheetView] = useState<SheetView>('profile');
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [prompt, setPrompt] = useState('');
  const [plan, setPlan] = useState<RoutePlan | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(ASSISTANT_STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as { prompt?: string; plan?: RoutePlan };
      setPrompt(saved.prompt ?? '');
      setPlan(saved.plan ?? null);
    } catch {
      localStorage.removeItem(ASSISTANT_STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    const media = window.matchMedia('(max-width: 780px)');
    const sync = () => setIsMobile(media.matches);
    sync();
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(FAVORITES_STORAGE_KEY);
      if (raw) setFavoriteIds(new Set(JSON.parse(raw) as string[]));
    } catch {
      localStorage.removeItem(FAVORITES_STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    const syncHash = () => setAdminOpen(window.location.hash === '#admin');
    syncHash();
    window.addEventListener('hashchange', syncHash);
    return () => window.removeEventListener('hashchange', syncHash);
  }, []);

  const filteredCoops = useMemo(() => {
    const needle = normalize(query.trim());
    let items = COOPS.filter((coop) => {
      const matchesCategory = category === 'todas' || coop.category === category;
      const searchable = normalize(`${coop.name} ${coop.neighborhood} ${coop.locality} ${coop.value} ${coop.products.join(' ')}`);
      return matchesCategory && (!needle || searchable.includes(needle));
    });
    if (sortPoint) {
      items = items.slice().sort((a, b) => distanceKm(sortPoint, a) - distanceKm(sortPoint, b));
    }
    return items;
  }, [category, query, sortPoint]);

  useEffect(() => {
    if (!filteredCoops.some((coop) => coop.id === selectedId)) setSelectedId(filteredCoops[0]?.id ?? '');
  }, [filteredCoops, selectedId]);

  useEffect(() => {
    if (!mapNode.current || mapRef.current) return;
    const map = L.map(mapNode.current, {
      center: [-34.634, -58.795],
      zoom: 12,
      zoomControl: false,
      attributionControl: false,
    });
    mapRef.current = map;
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap &copy; CARTO',
    }).addTo(map);
    L.control.attribution({ position: 'bottomleft' }).addTo(map);
    L.tileLayer.wms('https://mapas.moreno.gob.ar/cgi-bin/mapserv?map=mapfilepath', {
      layers: 'localidades7',
      format: 'image/png',
      transparent: true,
      version: '1.1.1',
      opacity: 0.28,
      attribution: 'Moreno GIS',
    }).addTo(map);
    coopLayerRef.current = L.markerClusterGroup({ showCoverageOnHover: false, maxClusterRadius: 42 }).addTo(map);
    poiLayerRef.current = L.layerGroup().addTo(map);
    routeLayerRef.current = L.layerGroup().addTo(map);
    map.on('click', (event: L.LeafletMouseEvent) => {
      setSortPoint({ lat: event.latlng.lat, lng: event.latlng.lng, label: 'punto seleccionado' });
    });
    setTimeout(() => map.invalidateSize(), 0);
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const layer = coopLayerRef.current;
    if (!layer) return;
    layer.clearLayers();
    filteredCoops.forEach((coop) => {
      L.marker([coop.lat, coop.lng], { icon: makeIcon(coop) })
        .bindTooltip(coop.name, { direction: 'top', offset: [0, -34] })
        .on('click', () => setSelectedId(coop.id))
        .addTo(layer);
    });
  }, [filteredCoops]);

  useEffect(() => {
    const layer = poiLayerRef.current;
    if (!layer) return;
    layer.clearLayers();
    POIS.filter((poi) => poi.zone === 'primary' && poiKinds.has(poi.kind)).forEach((poi) => {
      L.marker([poi.lat, poi.lng], { icon: makePoiIcon(poi) })
        .bindTooltip(poi.name, { direction: 'top' })
        .addTo(layer);
    });
  }, [poiKinds]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    selectedMarkerRef.current?.remove();
    const selected = COOPS.find((coop) => coop.id === selectedId);
    if (!selected) return;
    selectedMarkerRef.current = L.circleMarker([selected.lat, selected.lng], {
      radius: 18,
      color: '#26336b',
      weight: 2,
      fillOpacity: 0.08,
      interactive: false,
    }).addTo(map);
  }, [selectedId]);

  useEffect(() => {
    const map = mapRef.current;
    const layer = routeLayerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();
    if (!plan) return;
    const points = [plan.origin, ...plan.stops].map((item) => [item.lat, item.lng] as [number, number]);
    L.polyline(points, { color: '#26336b', weight: 4, opacity: 0.78, dashArray: '8 9' }).addTo(layer);
    map.fitBounds(L.latLngBounds(points), { padding: [42, 42], maxZoom: 14 });
  }, [plan]);

  const selectedCoop = COOPS.find((coop) => coop.id === selectedId) ?? filteredCoops[0];

  function focusCoop(coop: Coop): void {
    setSelectedId(coop.id);
    setSheetView('profile');
    mapRef.current?.flyTo([coop.lat, coop.lng], 15, { duration: 0.55 });
  }

  function submitPrompt(event: React.FormEvent): void {
    event.preventDefault();
    const nextPrompt = prompt.trim() || 'Como llego a...';
    const nextPlan = buildPlan(nextPrompt);
    setPlan(nextPlan);
    setCategory('todas');
    setQuery('');
    setAssistantOpen(false);
    localStorage.setItem(ASSISTANT_STORAGE_KEY, JSON.stringify({
      prompt: nextPrompt,
      plan: nextPlan,
      savedAt: new Date().toISOString(),
    }));
  }

  function togglePoiKind(kind: PoiKind): void {
    setPoiKinds((current) => {
      const next = new Set(current);
      if (next.has(kind)) next.delete(kind);
      else next.add(kind);
      return next;
    });
  }

  function toggleFavorite(coopId: string): void {
    setFavoriteIds((current) => {
      const next = new Set(current);
      if (next.has(coopId)) next.delete(coopId);
      else next.add(coopId);
      localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify([...next]));
      return next;
    });
  }

  async function shareCoop(coop: Coop): Promise<void> {
    const shareUrl = `https://www.google.com/maps/search/?api=1&query=${mapsTarget(coop)}`;
    if (navigator.share) {
      await navigator.share({ title: coop.name, text: coop.value, url: shareUrl });
      return;
    }
    await navigator.clipboard?.writeText(shareUrl);
  }

  function toggleSheet(): void {
    const nextExpanded = !sheetExpanded;
    setSheetExpanded(nextExpanded);
    void sheetModalRef.current?.setCurrentBreakpoint(nextExpanded ? 0.92 : 0.24);
  }

  function openSheetView(view: SheetView, breakpoint = 0.55): void {
    setSheetView(view);
    setSheetExpanded(true);
    void sheetModalRef.current?.setCurrentBreakpoint(breakpoint);
  }

  const browsePanel = (
    <div className={sheetExpanded ? 'browse-sheet expanded' : 'browse-sheet'} aria-label="Explorar cooperativas">
      <div className="sheet-title">
        <div>
          <p>Red productiva local</p>
          <h1>{APP_CONFIG.panelTitle}</h1>
          {sortPoint && <small className="sort-chip">Ordenado por cercanía</small>}
        </div>
        <div className="sheet-actions">
          <IonBadge>{filteredCoops.length} visibles</IonBadge>
          {isMobile && (
            <IonButton
              fill="clear"
              aria-label={sheetExpanded ? 'Contraer listado' : 'Expandir listado'}
              title={sheetExpanded ? 'Contraer listado' : 'Expandir listado'}
              onClick={toggleSheet}
            >
              <IonIcon icon={sheetExpanded ? chevronDownOutline : chevronUpOutline} />
            </IonButton>
          )}
        </div>
      </div>

      <section className="sheet-section intro-section">
        <p className="territory-copy">{APP_CONFIG.territoryDescription}</p>
      </section>

      {selectedCoop && (
        <section className="sheet-section place-card">
          <div className="place-topline">
            <span className="category-dot" style={{ background: CATEGORIES[selectedCoop.category].color }} />
            <div>
              <p>{CATEGORIES[selectedCoop.category].label} · {selectedCoop.neighborhood}</p>
              <h2>{selectedCoop.name}</h2>
            </div>
          </div>
          <p>{selectedCoop.value}</p>
          <div className="place-actions">
            <IonButton size="small" shape="round" href={`https://www.google.com/maps/search/?api=1&query=${mapsTarget(selectedCoop)}`} target="_blank">
              <IonIcon icon={navigateOutline} slot="start" />
              Cómo llegar
            </IonButton>
            <IonButton size="small" shape="round" fill="outline" className="details-action" onClick={() => openSheetView('profile')}>
              <IonIcon icon={informationCircleOutline} slot="start" />
              Perfil
            </IonButton>
            <IonButton
              size="small"
              shape="round"
              fill="outline"
              aria-label={favoriteIds.has(selectedCoop.id) ? 'Quitar de guardadas' : 'Guardar cooperativa'}
              title={favoriteIds.has(selectedCoop.id) ? 'Quitar de guardadas' : 'Guardar cooperativa'}
              onClick={() => toggleFavorite(selectedCoop.id)}
            >
              <IonIcon icon={favoriteIds.has(selectedCoop.id) ? heart : heartOutline} />
            </IonButton>
            <IonButton size="small" shape="round" fill="outline" aria-label="Compartir cooperativa" title="Compartir cooperativa" onClick={() => void shareCoop(selectedCoop)}>
              <IonIcon icon={shareOutline} />
            </IonButton>
          </div>
        </section>
      )}

      <IonSegment className="sheet-nav" value={sheetView} onIonChange={(event) => setSheetView(event.detail.value as SheetView)}>
        <IonSegmentButton value="profile">Perfil</IonSegmentButton>
        <IonSegmentButton value="coops">Buscar</IonSegmentButton>
        <IonSegmentButton value="territory">Territorio</IonSegmentButton>
      </IonSegment>

      {selectedCoop && sheetView === 'profile' && (
        <section className="sheet-section profile-section">
          <div className="section-row">
            <strong>Ficha pública</strong>
            <IonBadge color={selectedCoop.verified ? 'success' : 'warning'}>{selectedCoop.verified ? 'Verificada' : 'A validar'}</IonBadge>
          </div>
          <div className="profile-grid">
            <div>
              <span>Rubro</span>
              <strong>{CATEGORIES[selectedCoop.category].label}</strong>
            </div>
            <div>
              <span>Zona</span>
              <strong>{selectedCoop.neighborhood}</strong>
            </div>
            <div>
              <span>Localidad</span>
              <strong>{selectedCoop.locality}</strong>
            </div>
          </div>
          <div className="tag-row">
            {selectedCoop.products.map((product) => <IonChip key={product}>{product}</IonChip>)}
          </div>
          <IonButton fill="outline" expand="block" onClick={() => openSheetView('coops', 0.92)}>
            <IonIcon icon={mapOutline} slot="start" />
            Ver cooperativas cercanas
          </IonButton>
        </section>
      )}

      {sheetView === 'territory' && (
        <section className="sheet-section poi-card">
          <strong>Territorio</strong>
          <span>Localidades oficiales desde el geoportal municipal. Ciudades vecinas quedan sólo como mapa base.</span>
          <div>
            {Object.entries(POI_KINDS).map(([kind, meta]) => (
              <IonChip
                key={kind}
                className={poiKinds.has(kind as PoiKind) ? 'selected' : ''}
                style={{ '--chip-color': meta.color }}
                onClick={() => togglePoiKind(kind as PoiKind)}
              >
                {meta.label}
              </IonChip>
            ))}
          </div>
        </section>
      )}

      {sheetView === 'coops' && (
        <>
          <section className="sheet-section filter-section">
            <IonSearchbar
              value={query}
              placeholder="Buscar producto, barrio o nombre"
              debounce={120}
              onIonInput={(event) => setQuery(event.detail.value ?? '')}
            />

            <IonSegment value={category} scrollable onIonChange={(event) => setCategory(event.detail.value as Category | 'todas')}>
              <IonSegmentButton value="todas">Todas</IonSegmentButton>
              {Object.entries(CATEGORIES).map(([key, meta]) => (
                <IonSegmentButton key={key} value={key}>{meta.label}</IonSegmentButton>
              ))}
            </IonSegment>
          </section>

          <section className="sheet-section list-section">
            <div className="section-row">
              <strong>Cooperativas</strong>
              <span>{filteredCoops.length} resultados</span>
            </div>
            <div className="coop-list">
              {filteredCoops.map((coop) => {
                const meta = CATEGORIES[coop.category];
                return (
                  <IonCard
                    button
                    key={coop.id}
                    className={coop.id === selectedCoop?.id ? 'coop-card selected' : 'coop-card'}
                    onClick={() => focusCoop(coop)}
                  >
                    <div className="coop-head">
                      <span className="category-dot" style={{ background: meta.color }} />
                      <div>
                        <p>{meta.label} · {coop.neighborhood}</p>
                        <h2>{coop.name}</h2>
                      </div>
                    </div>
                    <p className="coop-value">{coop.value}</p>
                  </IonCard>
                );
              })}
            </div>
          </section>
        </>
      )}
    </div>
  );

  return (
    <IonApp>
      <IonPage>
        <IonHeader className="app-header">
          <IonToolbar>
            <a className="brand-lockup" href="#" aria-label={`${APP_CONFIG.organizationName} ${APP_CONFIG.appName}`}>
              <img src={APP_CONFIG.brandLogo} alt={APP_CONFIG.organizationName} />
              <span>
                <strong>{APP_CONFIG.appName}</strong>
                <small>{APP_CONFIG.tagline}</small>
              </span>
            </a>
            <IonButtons slot="end">
              <IonButton className="desktop-only" shape="round" fill="solid" onClick={() => setAdminOpen(true)}>
                <IonIcon icon={addOutline} slot="start" />
                Sumar cooperativa
              </IonButton>
            </IonButtons>
          </IonToolbar>
        </IonHeader>

        <IonContent fullscreen scrollY={false}>
          <main className="product-shell">
            <section className="map-pane" aria-label="Mapa de cooperativas">
              <div ref={mapNode} className="leaflet-host" />
              <div className="map-tools" aria-label="Herramientas del mapa">
                <IonButton fill="clear" aria-label="Centrar en mi ubicación" title="Centrar en mi ubicación" data-tooltip="Mi ubicación" onClick={() => {
                  navigator.geolocation?.getCurrentPosition((position) => {
                    mapRef.current?.flyTo([position.coords.latitude, position.coords.longitude], 15, { duration: 0.6 });
                  });
                }}>
                  <IonIcon icon={locateOutline} />
                </IonButton>
                <IonButton fill="clear" aria-label="Abrir asistente" title="Abrir asistente" data-tooltip="Asistente" onClick={() => setAssistantOpen(true)}>
                  <IonIcon icon={sparklesOutline} />
                </IonButton>
                <IonButton fill="clear" aria-label="Acercar mapa" title="Acercar mapa" data-tooltip="Acercar" onClick={() => mapRef.current?.zoomIn()}>
                  <IonIcon icon={addSharp} />
                </IonButton>
                <IonButton fill="clear" aria-label="Alejar mapa" title="Alejar mapa" data-tooltip="Alejar" onClick={() => mapRef.current?.zoomOut()}>
                  <IonIcon icon={removeSharp} />
                </IonButton>
              </div>
              <div className="map-stats">
                <IonCard><strong>{COOPS.length}</strong><span>cooperativas</span></IonCard>
                <IonCard><strong>{POIS.filter((poi) => poi.zone === 'primary').length}</strong><span>puntos</span></IonCard>
              </div>
            </section>

            {!isMobile && <aside className="desktop-panel">{browsePanel}</aside>}

          </main>
        </IonContent>

        {isMobile && (
          <IonModal
            ref={sheetModalRef}
            className="map-sheet-modal"
            isOpen
            canDismiss={false}
            backdropDismiss={false}
            breakpoints={[0.24, 0.55, 0.92]}
            initialBreakpoint={0.24}
            backdropBreakpoint={0.92}
            handle
            onIonBreakpointDidChange={(event) => setSheetExpanded(event.detail.breakpoint >= 0.55)}
          >
            <IonContent className="sheet-modal-content" scrollY>
              {browsePanel}
            </IonContent>
          </IonModal>
        )}

        <IonModal className="app-modal assistant-modal" isOpen={assistantOpen} onDidDismiss={() => setAssistantOpen(false)}>
          <IonHeader>
            <IonToolbar>
              <IonLabel className="modal-title">Asistente</IonLabel>
              <IonButtons slot="end">
                <IonButton onClick={() => setAssistantOpen(false)}>
                  <IonIcon icon={closeOutline} />
                </IonButton>
              </IonButtons>
            </IonToolbar>
          </IonHeader>
          <IonContent className="assistant-content">
            <form onSubmit={submitPrompt} className="assistant-form">
              <IonItem lines="none">
                <IonInput value={prompt} placeholder="Ej: Como llego a..." onIonInput={(event) => setPrompt(String(event.detail.value ?? ''))} />
              </IonItem>
              <IonButton type="submit" expand="block">Planear</IonButton>
            </form>
            {plan && (
              <IonCard className="route-card">
                <div className="route-topline">
                  <strong>{plan.title}</strong>
                  <span>{plan.distanceKm.toFixed(1)} km estimados</span>
                </div>
                <p>{plan.summary}</p>
                <ol>
                  <li>{plan.origin.name}<span>Origen</span></li>
                  {plan.stops.map((stop) => <li key={stop.id}>{stop.name}<span>{'neighborhood' in stop ? stop.neighborhood : POI_KINDS[stop.kind].label}</span></li>)}
                </ol>
                <div className="cost-grid">
                  <div><span>Colectivo/tren</span><strong>{plan.lowCost}</strong></div>
                  <div><span>App viaje</span><strong>{plan.rideHail}</strong></div>
                </div>
                <div className="insight-list">
                  {plan.insights.map((insight) => <p key={insight}>{insight}</p>)}
                </div>
                <IonButton expand="block" href={mapsUrl(plan)} target="_blank">Abrir recorrido real</IonButton>
              </IonCard>
            )}
          </IonContent>
        </IonModal>

        <IonModal className="app-modal admin-modal" isOpen={adminOpen} onDidDismiss={() => setAdminOpen(false)}>
          <IonHeader>
            <IonToolbar>
              <IonLabel className="modal-title">Sumar cooperativa</IonLabel>
              <IonButtons slot="end">
                <IonButton onClick={() => setAdminOpen(false)}>
                  <IonIcon icon={closeOutline} />
                </IonButton>
              </IonButtons>
            </IonToolbar>
          </IonHeader>
          <IonContent className="admin-content">
            <IonCard className="admin-card">
              <p className="eyebrow">Acceso restringido</p>
              <h2>Alta y edición con roles</h2>
              <p>SSO Google con whitelist para admin y maintain. Las cooperativas podrían editar su perfil y enviar cambios a revisión.</p>
              <IonButton expand="block">Continuar con Google</IonButton>
            </IonCard>
          </IonContent>
        </IonModal>
      </IonPage>
    </IonApp>
  );
}
