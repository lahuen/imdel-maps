export type Category = 'agro' | 'alimentos' | 'textil' | 'servicios' | 'construccion';
export type PoiKind = 'localidad' | 'equipamiento' | 'educacion';

export type Coop = {
  id: string;
  name: string;
  category: Category;
  neighborhood: string;
  locality: string;
  address?: string;
  mapsQuery?: string;
  value: string;
  products: string[];
  lat: number;
  lng: number;
  contact?: string;
  verified: boolean;
};

export type Poi = {
  id: string;
  name: string;
  kind: PoiKind;
  zone: 'primary' | 'fallback';
  mapsQuery?: string;
  lat: number;
  lng: number;
};

export const CATEGORIES: Record<Category, { label: string; color: string }> = {
  agro: { label: 'Agro', color: '#64bda7' },
  alimentos: { label: 'Alimentos', color: '#00b6ed' },
  textil: { label: 'Textil', color: '#bd197a' },
  servicios: { label: 'Servicios', color: '#014b86' },
  construccion: { label: 'Construccion', color: '#26336b' },
};

export const COOPS: Coop[] = [
  {
    id: 'featured-cooperative',
    name: 'Cooperativa Semilla',
    category: 'agro',
    neighborhood: 'Zona Norte',
    locality: 'Territorio local',
    address: 'Direccion configurable',
    mapsQuery: 'Cooperativa Semilla',
    value: 'Cultivo cooperativo y produccion local con perfil publico configurable.',
    products: ['cultivo', 'agroecologia', 'comunidad'],
    lat: -34.5487,
    lng: -58.8099,
    verified: true,
  },
  {
    id: 'huerta-cuervo',
    name: 'Huerta Comunitaria Norte',
    category: 'agro',
    neighborhood: 'Zona Norte',
    locality: 'Territorio local',
    value: 'Produccion agroecologica para bolsones locales, comedores y ferias barriales.',
    products: ['verduras', 'aromaticas', 'plantines'],
    lat: -34.5878,
    lng: -58.8212,
    contact: '11 2345 8011',
    verified: true,
  },
  {
    id: 'sabores-locales',
    name: 'Sabores Locales',
    category: 'alimentos',
    neighborhood: 'Paso del Rey',
    locality: 'Territorio local',
    value: 'Elaboracion de panificados y viandas para comercios, eventos y familias.',
    products: ['panificados', 'viandas', 'pasteleria'],
    lat: -34.6494,
    lng: -58.7634,
    contact: '11 2345 8033',
    verified: false,
  },
  {
    id: 'manos-del-oeste',
    name: 'Manos Productivas',
    category: 'textil',
    neighborhood: 'Zona Este',
    locality: 'Territorio local',
    value: 'Confeccion textil por pedido para escuelas, clubes y emprendimientos locales.',
    products: ['guardapolvos', 'bolsas', 'uniformes'],
    lat: -34.6127,
    lng: -58.7559,
    contact: '11 2345 8022',
    verified: true,
  },
  {
    id: 'raices-productivas',
    name: 'Raices Productivas',
    category: 'agro',
    neighborhood: 'Zona Oeste',
    locality: 'Territorio local',
    value: 'Produccion de frutas, huevos y verduras de estacion con venta comunitaria.',
    products: ['frutas', 'huevos', 'verduras'],
    lat: -34.6385,
    lng: -58.8278,
    contact: '11 2345 8044',
    verified: true,
  },
  {
    id: 'obra-colectiva',
    name: 'Obra Colectiva',
    category: 'construccion',
    neighborhood: 'Centro',
    locality: 'Territorio local',
    value: 'Cuadrillas de mantenimiento, pintura y pequenas obras para instituciones.',
    products: ['pintura', 'mantenimiento', 'albanileria'],
    lat: -34.6537,
    lng: -58.7907,
    contact: '11 2345 8055',
    verified: true,
  },
  {
    id: 'red-verde',
    name: 'Red Verde',
    category: 'servicios',
    neighborhood: 'Zona Sur',
    locality: 'Territorio local',
    value: 'Servicios ambientales, recuperacion de materiales y educacion comunitaria.',
    products: ['reciclado', 'capacitacion', 'logistica'],
    lat: -34.6237,
    lng: -58.8018,
    contact: '11 2345 8066',
    verified: false,
  },
];

export const POI_KINDS: Record<PoiKind, { label: string; color: string }> = {
  localidad: { label: 'Localidades', color: '#00b6ed' },
  equipamiento: { label: 'Equipamientos', color: '#64bda7' },
  educacion: { label: 'Escolares', color: '#bd197a' },
};

export const POIS: Poi[] = [
  { id: 'central-area', name: 'Centro', kind: 'localidad', zone: 'primary', lat: -34.6534, lng: -58.7896 },
  { id: 'east-area', name: 'Zona Este', kind: 'localidad', zone: 'primary', lat: -34.5958, lng: -58.7551 },
  { id: 'north-area', name: 'Zona Norte', kind: 'localidad', zone: 'primary', lat: -34.5852, lng: -58.8234 },
  { id: 'south-area', name: 'Zona Sur', kind: 'localidad', zone: 'primary', lat: -34.6237, lng: -58.8018 },
  { id: 'west-area', name: 'Zona Oeste', kind: 'localidad', zone: 'primary', lat: -34.6439, lng: -58.8285 },
  { id: 'market-area', name: 'Zona Feria', kind: 'localidad', zone: 'primary', lat: -34.6505, lng: -58.7586 },
  { id: 'city-hall', name: 'Sede municipal', kind: 'equipamiento', zone: 'primary', lat: -34.6531, lng: -58.7904 },
  { id: 'central-station', name: 'Estacion central', kind: 'equipamiento', zone: 'primary', mapsQuery: 'Estacion central', lat: -34.6539, lng: -58.7909 },
  { id: 'station-market', name: 'Feria de la estacion', kind: 'equipamiento', zone: 'primary', mapsQuery: 'Feria de la estacion', lat: -34.6535, lng: -58.7916 },
  { id: 'local-university', name: 'Universidad local', kind: 'educacion', zone: 'primary', lat: -34.6683, lng: -58.7769 },
  { id: 'merlo', name: 'Merlo', kind: 'localidad', zone: 'fallback', lat: -34.6685, lng: -58.7283 },
  { id: 'rodriguez', name: 'General Rodriguez', kind: 'localidad', zone: 'fallback', lat: -34.6084, lng: -58.9525 },
];
