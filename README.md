# rwanda-location-lookup

Convert map coordinates to Rwanda's full administrative hierarchy in one call.

Give the package a latitude and longitude, and it returns:

- Province
- District
- Sector
- Cell
- Village

Bundled boundary data is included, so developers can install and use it directly without downloading shapefiles.

`lookup()` auto-loads bundled GeoJSON and now handles Vite optimized-deps paths without manual `public/geo` copy steps.

## Install

```bash
npm install rwanda-location-lookup
```

## Demo

Live demo: [rwanda-location-lookup.vercel.app](https://rwanda-location-lookup.vercel.app)

Use it to test:

- Coordinates to Province, District, Sector, Cell, Village
- Current device location lookup
- Reverse lookup from hierarchy to center coordinates

## Quick Start

```js
import { lookup } from "rwanda-location-lookup";

const result = await lookup({
  latitude: -1.944,
  longitude: 30.062,
});

console.log(result);
```

Example output:

```js
{
  province: "Kigali City",
  district: "Nyarugenge",
  sector: "Nyarugenge",
  cell: "Kiyovu",
  village: "Ishema",
  ids: {
    province: 1,
    district: 11,
    sector: 1109,
    cell: 110903,
    village: "11090308"
  }
}
```

## API (Short and Clean)

- `lookup(...)`
: Async one-call lookup using bundled Rwanda data.

- `loadData()`
: Async load + cache bundled data once.

- `lookupByCoords(...)`
: Sync lookup using coordinates and already-loaded data.

- `lookupByPoint(...)`
: Sync lookup using a GeoJSON Point and already-loaded data.

- `toPoint(...)`
: Convert `{ latitude, longitude }` (or `{ lat, lng }`) to a GeoJSON Point.

- `validateData(...)`
: Validate the `districts/sectors/cells/villages` FeatureCollections.

- `center(...)`
: Async reverse lookup using bundled data. Provide hierarchy names/ids and get center coordinates.

- `centerBy(...)`
: Sync reverse lookup using already-loaded data.

## High-Performance Usage (Many Requests)

```js
import { loadData, lookupByCoords } from "rwanda-location-lookup";

const data = await loadData();

const a = lookupByCoords({ latitude: -1.944, longitude: 30.062, data });
const b = lookupByCoords({ lat: -1.95, lng: 30.06, data });
```

## Reverse Lookup (Hierarchy -> Center Coordinates)

```js
import { center } from "rwanda-location-lookup";

const result = await center({
  province: "Kigali City",
  district: "Nyarugenge",
  sector: "Nyarugenge",
  cell: "Kiyovu",
  village: "Ishema",
});

console.log(result.center); // { latitude: ..., longitude: ... }
```

## Use Your Own GeoJSON Source

```js
import { loadDataFromUrl, lookupByCoords } from "rwanda-location-lookup";

const data = await loadDataFromUrl({ baseUrl: "/geo" });
const result = lookupByCoords({ latitude: -1.944, longitude: 30.062, data });
```

## Contributing

Repository: `https://github.com/kozera920/rwanda-location-lookup.git`

1. Fork the repository on GitHub.
2. Clone your fork:
```bash
git clone https://github.com/kozera920/rwanda-location-lookup.git
cd rwanda-location-lookup
```
3. Add upstream remote:
```bash
git remote add upstream https://github.com/kozera920/rwanda-location-lookup.git
```
4. Install dependencies:
```bash
cd packages/rwanda-location-lookup
npm install
```
5. Create a branch for your fix:
```bash
git checkout -b fixes/<short-fix-name>
```
6. Make changes, test, then commit:
```bash
git add .
git commit -m "fix: short description of your fix"
```
7. Push your fixes branch:
```bash
git push origin fixes/<short-fix-name>
```
8. Open a Pull Request from your `fixes/...` branch to `main`.

## Author

Built and maintained by [Kozera Isaie](https://github.com/kozera920)
Found a bug or have a suggestion? [Open an issue](https://github.com/kozera920/rwanda-location-lookup/issues).

## Note

Bundled GeoJSON (especially villages) is large, so package install size is bigger than a typical utility package.
