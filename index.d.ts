export type FeatureCollectionLike = {
  type: "FeatureCollection";
  features: Array<any>;
};

export type RwandaAdministrativeData = {
  districts: FeatureCollectionLike;
  sectors: FeatureCollectionLike;
  cells: FeatureCollectionLike;
  villages: FeatureCollectionLike;
};

export type RwandaAdministrativeLookupResult = {
  province: string | null;
  district: string | null;
  sector: string | null;
  cell: string | null;
  village: string | null;
  ids: {
    province: string | number | null;
    district: string | number | null;
    sector: string | number | null;
    cell: string | number | null;
    village: string | number | null;
  };
} | null;

export type RwandaAdministrativeHierarchyInput = {
  province?: string | number;
  district?: string | number;
  sector?: string | number;
  cell?: string | number;
  village?: string | number;
};

export type RwandaAdministrativeCenterResult = {
  level: "province" | "district" | "sector" | "cell" | "village";
  matchCount: number;
  province: string | null;
  district: string | null;
  sector: string | null;
  cell: string | null;
  village: string | null;
  ids: {
    province: string | number | null;
    district: string | number | null;
    sector: string | number | null;
    cell: string | number | null;
    village: string | number | null;
  };
  center: {
    latitude: number;
    longitude: number;
  };
  latitude: number;
  longitude: number;
  bbox: {
    minLongitude: number;
    minLatitude: number;
    maxLongitude: number;
    maxLatitude: number;
  };
} | null;

export type CoordinateInput = {
  latitude?: number;
  longitude?: number;
  lat?: number;
  lng?: number;
};

export type FetchLike = (
  input: string | URL,
  init?: any
) => Promise<{
  ok: boolean;
  status: number;
  statusText: string;
  text?: () => Promise<string>;
  json: () => Promise<any>;
}>;

export function validateRwandaAdministrativeData(
  data: RwandaAdministrativeData
): void;

export function createPointFeatureFromCoordinates(input: CoordinateInput): any;

export function lookupRwandaAdministrativeHierarchyByPoint(input: {
  pointFeature: any;
  data: RwandaAdministrativeData;
  requireDistrict?: boolean;
}): RwandaAdministrativeLookupResult;

export function lookupRwandaAdministrativeHierarchyByCoordinates(
  input: CoordinateInput & {
    data: RwandaAdministrativeData;
    requireDistrict?: boolean;
  }
): RwandaAdministrativeLookupResult;

export function loadRwandaAdministrativeDataFromBaseUrl(input?: {
  baseUrl?: string;
  fetchImpl?: FetchLike;
}): Promise<RwandaAdministrativeData>;

export function loadBundledRwandaAdministrativeData(input?: {
  fetchImpl?: FetchLike;
}): Promise<RwandaAdministrativeData>;

export function lookupRwandaAdministrativeHierarchy(
  input?: CoordinateInput & {
    requireDistrict?: boolean;
    fetchImpl?: FetchLike;
  }
): Promise<RwandaAdministrativeLookupResult>;

export function centerByHierarchy(
  input: RwandaAdministrativeHierarchyInput & {
    data: RwandaAdministrativeData;
  }
): RwandaAdministrativeCenterResult;

export function centerLookup(
  input?: RwandaAdministrativeHierarchyInput & {
    fetchImpl?: FetchLike;
  }
): Promise<RwandaAdministrativeCenterResult>;

export const validateData: typeof validateRwandaAdministrativeData;
export const toPoint: typeof createPointFeatureFromCoordinates;
export const lookupByPoint: typeof lookupRwandaAdministrativeHierarchyByPoint;
export const lookupByCoords: typeof lookupRwandaAdministrativeHierarchyByCoordinates;
export const loadDataFromUrl: typeof loadRwandaAdministrativeDataFromBaseUrl;
export const loadData: typeof loadBundledRwandaAdministrativeData;
export const lookup: typeof lookupRwandaAdministrativeHierarchy;
export const centerBy: typeof centerByHierarchy;
export const center: typeof centerLookup;
export const reverseBy: typeof centerByHierarchy;
export const reverseLookup: typeof centerLookup;

export const validateRwandaAdminData: typeof validateRwandaAdministrativeData;
export const createLookupPoint: typeof createPointFeatureFromCoordinates;
export const lookupRwandaAdminByPoint: typeof lookupRwandaAdministrativeHierarchyByPoint;
export const lookupRwandaAdminByCoords: typeof lookupRwandaAdministrativeHierarchyByCoordinates;
export const loadRwandaAdminData: typeof loadRwandaAdministrativeDataFromBaseUrl;
