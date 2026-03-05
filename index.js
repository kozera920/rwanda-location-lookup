import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import { point } from "@turf/helpers";

const DISTRICT_NAME_KEYS = ["District", "DISTRICT", "district", "Name", "NAME", "name"];
const SECTOR_NAME_KEYS = ["Sector", "SECTOR", "sector", "Name", "NAME", "name"];
const CELL_NAME_KEYS = ["Cell", "CELL", "cell", "Name", "NAME", "name"];
const VILLAGE_NAME_KEYS = ["Village", "VILLAGE", "village", "Name", "NAME", "name"];
const PROVINCE_NAME_KEYS = ["Province", "PROVINCE", "province", "Prov_Nam", "PROV_NAME"];

const DISTRICT_ID_KEYS = ["Dist_ID", "DIST_ID", "district_id", "Distr_ID"];
const SECTOR_ID_KEYS = ["Sect_ID", "SECT_ID", "Sector_ID", "sector_id"];
const CELL_ID_KEYS = ["Cell_ID", "CELL_ID", "cell_id"];
const VILLAGE_ID_KEYS = ["Village_ID", "VILLAGE_ID", "village_id"];
const PROVINCE_ID_KEYS = ["Prov_ID", "PROV_ID", "province_id"];

const bboxCache = new WeakMap();
let bundledDataPromise = null;

function isFeatureCollection(value) {
  return Boolean(value && value.type === "FeatureCollection" && Array.isArray(value.features));
}

function pickFirstProp(props, keys) {
  if (!props || !Array.isArray(keys)) return null;
  for (const key of keys) {
    const value = props[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return value;
    }
  }
  return null;
}

function normalizeCoordinates(input) {
  if (!input || typeof input !== "object") {
    throw new Error("coordinates input must be an object");
  }

  const latitude = Number.isFinite(input.latitude) ? input.latitude : input.lat;
  const longitude = Number.isFinite(input.longitude) ? input.longitude : input.lng;

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    throw new Error("latitude/longitude (or lat/lng) must be finite numbers");
  }

  return { latitude, longitude };
}

function getFeatureName(feature, keys) {
  return pickFirstProp(feature?.properties, keys);
}

function getFeatureId(feature, keys) {
  return pickFirstProp(feature?.properties, keys);
}

function getProvinceName(features) {
  for (const feature of features) {
    const province = pickFirstProp(feature?.properties, PROVINCE_NAME_KEYS);
    if (province !== null) return province;
  }
  return null;
}

function getProvinceId(features) {
  for (const feature of features) {
    const provinceId = pickFirstProp(feature?.properties, PROVINCE_ID_KEYS);
    if (provinceId !== null) return provinceId;
  }
  return null;
}

function forEachPosition(value, visit) {
  if (!Array.isArray(value)) return;
  if (value.length >= 2 && typeof value[0] === "number" && typeof value[1] === "number") {
    visit(value);
    return;
  }
  for (const nested of value) forEachPosition(nested, visit);
}

function getFeatureBbox(feature) {
  if (!feature?.geometry?.coordinates) return null;
  if (bboxCache.has(feature)) return bboxCache.get(feature);

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  forEachPosition(feature.geometry.coordinates, ([x, y]) => {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  });

  const bbox = Number.isFinite(minX) ? [minX, minY, maxX, maxY] : null;
  bboxCache.set(feature, bbox);
  return bbox;
}

function isPointInBbox(longitude, latitude, bbox) {
  return longitude >= bbox[0] && longitude <= bbox[2] && latitude >= bbox[1] && latitude <= bbox[3];
}

function findContainingFeature(pointFeature, featureCollection) {
  if (!isFeatureCollection(featureCollection)) return null;
  const [longitude, latitude] = pointFeature.geometry.coordinates;

  for (const feature of featureCollection.features) {
    const bbox = getFeatureBbox(feature);
    if (bbox && !isPointInBbox(longitude, latitude, bbox)) continue;
    if (booleanPointInPolygon(pointFeature, feature)) return feature;
  }

  return null;
}

function assertFeatureCollection(value, fieldName) {
  if (!isFeatureCollection(value)) {
    throw new Error(`${fieldName} must be a GeoJSON FeatureCollection`);
  }
}

async function fetchJson(url, fetchImpl) {
  if (typeof fetchImpl !== "function") {
    throw new Error("fetchImpl is required");
  }
  const response = await fetchImpl(url);
  if (!response.ok) {
    throw new Error(`Failed to load ${url} (${response.status} ${response.statusText})`);
  }
  return response.json();
}

async function loadBundledGeoJsonFile(fileName, fetchImpl) {
  const fileUrl = new URL(`./data/${fileName}`, import.meta.url);

  if (fileUrl.protocol === "file:") {
    const moduleName = "node:fs/promises";
    const { readFile } = await import(moduleName);
    const raw = await readFile(fileUrl, "utf8");
    return JSON.parse(raw);
  }

  return fetchJson(fileUrl.toString(), fetchImpl);
}

function buildLookupResult({
  districtFeature,
  sectorFeature,
  cellFeature,
  villageFeature,
}) {
  const orderedFeatures = [districtFeature, sectorFeature, cellFeature, villageFeature];

  return {
    province: getProvinceName(orderedFeatures),
    district: getFeatureName(districtFeature, DISTRICT_NAME_KEYS),
    sector: getFeatureName(sectorFeature, SECTOR_NAME_KEYS),
    cell: getFeatureName(cellFeature, CELL_NAME_KEYS),
    village: getFeatureName(villageFeature, VILLAGE_NAME_KEYS),
    ids: {
      province: getProvinceId(orderedFeatures),
      district: getFeatureId(districtFeature, DISTRICT_ID_KEYS),
      sector: getFeatureId(sectorFeature, SECTOR_ID_KEYS),
      cell: getFeatureId(cellFeature, CELL_ID_KEYS),
      village: getFeatureId(villageFeature, VILLAGE_ID_KEYS),
    },
  };
}

export function validateRwandaAdministrativeData(data) {
  if (!data || typeof data !== "object") {
    throw new Error("data must be an object with districts, sectors, cells, villages");
  }

  assertFeatureCollection(data.districts, "districts");
  assertFeatureCollection(data.sectors, "sectors");
  assertFeatureCollection(data.cells, "cells");
  assertFeatureCollection(data.villages, "villages");
}

export function createPointFeatureFromCoordinates(input) {
  const { latitude, longitude } = normalizeCoordinates(input);
  return point([longitude, latitude]);
}

export function lookupRwandaAdministrativeHierarchyByPoint({
  pointFeature,
  data,
  requireDistrict = true,
}) {
  validateRwandaAdministrativeData(data);

  if (!pointFeature?.geometry?.coordinates) {
    throw new Error("pointFeature must be a GeoJSON Point feature");
  }

  const districtFeature = findContainingFeature(pointFeature, data.districts);
  if (requireDistrict && !districtFeature) return null;

  const sectorFeature = findContainingFeature(pointFeature, data.sectors);
  const cellFeature = findContainingFeature(pointFeature, data.cells);
  const villageFeature = findContainingFeature(pointFeature, data.villages);

  return buildLookupResult({
    districtFeature,
    sectorFeature,
    cellFeature,
    villageFeature,
  });
}

export function lookupRwandaAdministrativeHierarchyByCoordinates({
  latitude,
  longitude,
  lat,
  lng,
  data,
  requireDistrict = true,
}) {
  const pointFeature = createPointFeatureFromCoordinates({
    latitude,
    longitude,
    lat,
    lng,
  });
  return lookupRwandaAdministrativeHierarchyByPoint({
    pointFeature,
    data,
    requireDistrict,
  });
}

export async function loadRwandaAdministrativeDataFromBaseUrl({
  baseUrl = "/geo",
  fetchImpl = globalThis.fetch,
} = {}) {
  const [districts, sectors, cells, villages] = await Promise.all([
    fetchJson(`${baseUrl}/districts.geojson`, fetchImpl),
    fetchJson(`${baseUrl}/sectors.geojson`, fetchImpl),
    fetchJson(`${baseUrl}/cells.geojson`, fetchImpl),
    fetchJson(`${baseUrl}/villages.geojson`, fetchImpl),
  ]);

  const data = { districts, sectors, cells, villages };
  validateRwandaAdministrativeData(data);
  return data;
}

export async function loadBundledRwandaAdministrativeData({
  fetchImpl = globalThis.fetch,
} = {}) {
  if (!bundledDataPromise) {
    bundledDataPromise = Promise.all([
      loadBundledGeoJsonFile("districts.geojson", fetchImpl),
      loadBundledGeoJsonFile("sectors.geojson", fetchImpl),
      loadBundledGeoJsonFile("cells.geojson", fetchImpl),
      loadBundledGeoJsonFile("villages.geojson", fetchImpl),
    ]).then(([districts, sectors, cells, villages]) => {
      const data = { districts, sectors, cells, villages };
      validateRwandaAdministrativeData(data);
      return data;
    });
  }

  return bundledDataPromise;
}

export async function lookupRwandaAdministrativeHierarchy({
  latitude,
  longitude,
  lat,
  lng,
  requireDistrict = true,
  fetchImpl = globalThis.fetch,
} = {}) {
  const data = await loadBundledRwandaAdministrativeData({ fetchImpl });
  return lookupRwandaAdministrativeHierarchyByCoordinates({
    latitude,
    longitude,
    lat,
    lng,
    data,
    requireDistrict,
  });
}

// Short API names (recommended).
export const validateData = validateRwandaAdministrativeData;
export const toPoint = createPointFeatureFromCoordinates;
export const lookupByPoint = lookupRwandaAdministrativeHierarchyByPoint;
export const lookupByCoords = lookupRwandaAdministrativeHierarchyByCoordinates;
export const loadDataFromUrl = loadRwandaAdministrativeDataFromBaseUrl;
export const loadData = loadBundledRwandaAdministrativeData;
export const lookup = lookupRwandaAdministrativeHierarchy;

// Backward-compatible aliases.
export const validateRwandaAdminData = validateRwandaAdministrativeData;
export const createLookupPoint = createPointFeatureFromCoordinates;
export const lookupRwandaAdminByPoint = lookupRwandaAdministrativeHierarchyByPoint;
export const lookupRwandaAdminByCoords = lookupRwandaAdministrativeHierarchyByCoordinates;
export const loadRwandaAdminData = loadRwandaAdministrativeDataFromBaseUrl;
