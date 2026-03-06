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
const PACKAGE_NAME = "rwanda-location-lookup";
const PACKAGE_VERSION = "1.1.1";
const HIERARCHY_LEVELS = ["province", "district", "sector", "cell", "village"];
const HIERARCHY_CONFIG = {
  province: { nameKeys: PROVINCE_NAME_KEYS, idKeys: PROVINCE_ID_KEYS },
  district: { nameKeys: DISTRICT_NAME_KEYS, idKeys: DISTRICT_ID_KEYS },
  sector: { nameKeys: SECTOR_NAME_KEYS, idKeys: SECTOR_ID_KEYS },
  cell: { nameKeys: CELL_NAME_KEYS, idKeys: CELL_ID_KEYS },
  village: { nameKeys: VILLAGE_NAME_KEYS, idKeys: VILLAGE_ID_KEYS },
};
const PROVINCE_ALIAS_COLLECTIONS = ["sectors", "cells", "villages"];

const bboxCache = new WeakMap();
const provinceAliasIndexCache = new WeakMap();
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

function hasValue(value) {
  return value !== undefined && value !== null && String(value).trim() !== "";
}

function normalizeComparable(value) {
  if (!hasValue(value)) return null;
  return String(value).trim().toLowerCase();
}

function matchesFeatureProperty(feature, keys, expectedValue) {
  const expected = normalizeComparable(expectedValue);
  if (expected === null) return true;

  const props = feature?.properties || {};
  for (const key of keys) {
    const actual = normalizeComparable(props[key]);
    if (actual !== null && actual === expected) {
      return true;
    }
  }

  return false;
}

function buildProvinceAliasIndex(data) {
  if (provinceAliasIndexCache.has(data)) {
    return provinceAliasIndexCache.get(data);
  }

  const aliasToIds = new Map();

  for (const collectionName of PROVINCE_ALIAS_COLLECTIONS) {
    const collection = data?.[collectionName];
    if (!isFeatureCollection(collection)) continue;

    for (const feature of collection.features) {
      const provinceId = normalizeComparable(getFeatureId(feature, PROVINCE_ID_KEYS));
      const provinceName = normalizeComparable(getFeatureName(feature, PROVINCE_NAME_KEYS));
      if (!provinceId || !provinceName) continue;

      const ids = aliasToIds.get(provinceName) || new Set();
      ids.add(provinceId);
      aliasToIds.set(provinceName, ids);
    }
  }

  provinceAliasIndexCache.set(data, aliasToIds);
  return aliasToIds;
}

function matchesProvinceValue(feature, expectedValue, data) {
  if (matchesFeatureProperty(feature, getHierarchyLevelKeys("province"), expectedValue)) {
    return true;
  }

  const expected = normalizeComparable(expectedValue);
  if (expected === null) return true;

  const featureProvinceId = normalizeComparable(getFeatureId(feature, PROVINCE_ID_KEYS));
  if (!featureProvinceId) return false;

  const provinceAliasIndex = buildProvinceAliasIndex(data);
  const matchingIds = provinceAliasIndex.get(expected);
  return Boolean(matchingIds && matchingIds.has(featureProvinceId));
}

function matchesHierarchyValue(feature, level, expectedValue, data) {
  if (level === "province") {
    return matchesProvinceValue(feature, expectedValue, data);
  }
  return matchesFeatureProperty(feature, getHierarchyLevelKeys(level), expectedValue);
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

function getFeaturesCombinedBbox(features) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const feature of features) {
    const bbox = getFeatureBbox(feature);
    if (!bbox) continue;
    if (bbox[0] < minX) minX = bbox[0];
    if (bbox[1] < minY) minY = bbox[1];
    if (bbox[2] > maxX) maxX = bbox[2];
    if (bbox[3] > maxY) maxY = bbox[3];
  }

  return Number.isFinite(minX) ? [minX, minY, maxX, maxY] : null;
}

function getBboxCenter(bbox) {
  if (!bbox) return null;
  return {
    latitude: (bbox[1] + bbox[3]) / 2,
    longitude: (bbox[0] + bbox[2]) / 2,
  };
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

  if (typeof response.text === "function") {
    const raw = await response.text();
    try {
      return JSON.parse(raw);
    } catch {
      throw new Error(`Invalid JSON response from ${url}`);
    }
  }

  if (typeof response.json === "function") {
    return response.json();
  }

  throw new Error(`Unsupported fetch response shape for ${url}`);
}

const BUNDLED_GEOJSON_URLS = {
  districts: new URL("./data/districts.geojson", import.meta.url),
  sectors: new URL("./data/sectors.geojson", import.meta.url),
  cells: new URL("./data/cells.geojson", import.meta.url),
  villages: new URL("./data/villages.geojson", import.meta.url),
};
const BUNDLED_GEOJSON_FILES = {
  districts: "districts.geojson",
  sectors: "sectors.geojson",
  cells: "cells.geojson",
  villages: "villages.geojson",
};

function getBundledGeoJsonUrl(level) {
  const url = BUNDLED_GEOJSON_URLS[level];
  if (!url) {
    throw new Error(`Unknown bundled GeoJSON level: ${String(level)}`);
  }
  return url;
}

function getBundledGeoJsonFileName(level) {
  const fileName = BUNDLED_GEOJSON_FILES[level];
  if (!fileName) {
    throw new Error(`Unknown bundled GeoJSON level: ${String(level)}`);
  }
  return fileName;
}

function getBundledGeoJsonFetchCandidates(level) {
  const candidates = [];
  const fileUrl = getBundledGeoJsonUrl(level);
  const fileName = getBundledGeoJsonFileName(level);

  candidates.push(fileUrl.toString());

  const importMetaUrl = String(import.meta.url || "");
  if (importMetaUrl.includes("/node_modules/.vite/deps/")) {
    candidates.push(new URL(`../../${PACKAGE_NAME}/data/${fileName}`, import.meta.url).toString());
  }

  candidates.push(`/node_modules/${PACKAGE_NAME}/data/${fileName}`);
  candidates.push(`https://cdn.jsdelivr.net/npm/${PACKAGE_NAME}@${PACKAGE_VERSION}/data/${fileName}`);

  return [...new Set(candidates)];
}

async function loadBundledGeoJsonFile(level, fetchImpl) {
  const fileUrl = getBundledGeoJsonUrl(level);

  if (fileUrl.protocol === "file:") {
    const moduleName = "node:fs/promises";
    const { readFile } = await import(moduleName);
    const raw = await readFile(fileUrl, "utf8");
    return JSON.parse(raw);
  }

  const candidates = getBundledGeoJsonFetchCandidates(level);
  let lastError = null;

  for (const candidate of candidates) {
    try {
      return await fetchJson(candidate, fetchImpl);
    } catch (error) {
      lastError = error;
    }
  }

  const tried = candidates.join(", ");
  throw new Error(`Failed to load bundled GeoJSON "${level}". Tried: ${tried}. ${lastError?.message || ""}`.trim());
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

function getHierarchyFromFeature(feature) {
  return {
    province: getFeatureName(feature, PROVINCE_NAME_KEYS),
    district: getFeatureName(feature, DISTRICT_NAME_KEYS),
    sector: getFeatureName(feature, SECTOR_NAME_KEYS),
    cell: getFeatureName(feature, CELL_NAME_KEYS),
    village: getFeatureName(feature, VILLAGE_NAME_KEYS),
    ids: {
      province: getFeatureId(feature, PROVINCE_ID_KEYS),
      district: getFeatureId(feature, DISTRICT_ID_KEYS),
      sector: getFeatureId(feature, SECTOR_ID_KEYS),
      cell: getFeatureId(feature, CELL_ID_KEYS),
      village: getFeatureId(feature, VILLAGE_ID_KEYS),
    },
  };
}

function applyHierarchyOutputShape({ hierarchy, input, level }) {
  const output = {
    ...hierarchy,
    ids: { ...hierarchy.ids },
  };
  const targetIndex = HIERARCHY_LEVELS.indexOf(level);

  for (let index = 0; index <= targetIndex; index += 1) {
    const currentLevel = HIERARCHY_LEVELS[index];
    if (output[currentLevel] === null && hasValue(input[currentLevel])) {
      output[currentLevel] = String(input[currentLevel]).trim();
    }
  }

  for (let index = targetIndex + 1; index < HIERARCHY_LEVELS.length; index += 1) {
    const currentLevel = HIERARCHY_LEVELS[index];
    output[currentLevel] = null;
    output.ids[currentLevel] = null;
  }

  return output;
}

function getTargetHierarchyLevel(input) {
  for (let index = HIERARCHY_LEVELS.length - 1; index >= 0; index -= 1) {
    const level = HIERARCHY_LEVELS[index];
    if (hasValue(input[level])) return level;
  }
  throw new Error("Provide at least one hierarchy field: province, district, sector, cell, or village");
}

function getCollectionForHierarchyLevel(level, data) {
  if (level === "province" || level === "sector") return data.sectors;
  if (level === "district") return data.districts;
  if (level === "cell") return data.cells;
  return data.villages;
}

function getHierarchyLevelKeys(level) {
  const config = HIERARCHY_CONFIG[level];
  return [...config.nameKeys, ...config.idKeys];
}

function getHierarchyParentLevels(targetLevel) {
  const targetLevelIndex = HIERARCHY_LEVELS.indexOf(targetLevel);
  return HIERARCHY_LEVELS.slice(0, targetLevelIndex);
}

function getFeatureRepresentativePoint(feature) {
  const bbox = getFeatureBbox(feature);
  if (!bbox) return null;
  const center = getBboxCenter(bbox);
  return point([center.longitude, center.latitude]);
}

function isFeatureInsideAnyParent(feature, parentFeatures) {
  const representativePoint = getFeatureRepresentativePoint(feature);
  if (!representativePoint) return false;

  const [longitude, latitude] = representativePoint.geometry.coordinates;
  for (const parentFeature of parentFeatures) {
    const parentBbox = getFeatureBbox(parentFeature);
    if (parentBbox && !isPointInBbox(longitude, latitude, parentBbox)) continue;
    if (booleanPointInPolygon(representativePoint, parentFeature)) return true;
  }

  return false;
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
      loadBundledGeoJsonFile("districts", fetchImpl),
      loadBundledGeoJsonFile("sectors", fetchImpl),
      loadBundledGeoJsonFile("cells", fetchImpl),
      loadBundledGeoJsonFile("villages", fetchImpl),
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

export function centerByHierarchy({
  province,
  district,
  sector,
  cell,
  village,
  data,
}) {
  validateRwandaAdministrativeData(data);

  const input = { province, district, sector, cell, village };
  const level = getTargetHierarchyLevel(input);
  const collection = getCollectionForHierarchyLevel(level, data);
  let matches = collection.features.filter((feature) =>
    matchesHierarchyValue(feature, level, input[level], data)
  );

  for (const parentLevel of getHierarchyParentLevels(level)) {
    const expectedValue = input[parentLevel];
    if (!hasValue(expectedValue) || matches.length === 0) continue;

    const parentCollection = getCollectionForHierarchyLevel(parentLevel, data);
    const parentMatches = parentCollection.features.filter((feature) =>
      matchesHierarchyValue(feature, parentLevel, expectedValue, data)
    );

    if (parentMatches.length === 0) {
      return null;
    }

    matches = matches.filter((feature) => {
      if (matchesHierarchyValue(feature, parentLevel, expectedValue, data)) {
        return true;
      }
      return isFeatureInsideAnyParent(feature, parentMatches);
    });
  }

  if (matches.length === 0) {
    return null;
  }

  const bbox = getFeaturesCombinedBbox(matches);
  const center = getBboxCenter(bbox);
  if (!center || !bbox) {
    return null;
  }

  const hierarchy = applyHierarchyOutputShape({
    hierarchy: getHierarchyFromFeature(matches[0]),
    input,
    level,
  });
  return {
    level,
    matchCount: matches.length,
    ...hierarchy,
    center,
    latitude: center.latitude,
    longitude: center.longitude,
    bbox: {
      minLongitude: bbox[0],
      minLatitude: bbox[1],
      maxLongitude: bbox[2],
      maxLatitude: bbox[3],
    },
  };
}

export async function centerLookup({
  province,
  district,
  sector,
  cell,
  village,
  fetchImpl = globalThis.fetch,
} = {}) {
  const data = await loadBundledRwandaAdministrativeData({ fetchImpl });
  return centerByHierarchy({
    province,
    district,
    sector,
    cell,
    village,
    data,
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
export const centerBy = centerByHierarchy;
export const center = centerLookup;
export const reverseBy = centerByHierarchy;
export const reverseLookup = centerLookup;

// Backward-compatible aliases.
export const validateRwandaAdminData = validateRwandaAdministrativeData;
export const createLookupPoint = createPointFeatureFromCoordinates;
export const lookupRwandaAdminByPoint = lookupRwandaAdministrativeHierarchyByPoint;
export const lookupRwandaAdminByCoords = lookupRwandaAdministrativeHierarchyByCoordinates;
export const loadRwandaAdminData = loadRwandaAdministrativeDataFromBaseUrl;
