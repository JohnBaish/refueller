// Copied from JohnBaish/hindcaster scripts/lib/grid.ts (2026-10-30), with fromBritishGrid added for Refueller.
// Latitude and longitude (WGS84, as GPS and the Environment Agency's live feed give
// them) to British National Grid eastings and northings (as OS Open Names and the
// EA's Hydrology list give them). The standard Ordnance Survey method: a Helmert
// shift from WGS84 to OSGB36, then a Transverse Mercator projection. Accurate to
// about 5 metres, which is plenty for matching a gauge to a place name.
// `npm run check` compares it with the EA's own coordinates for every gauge.

const RAD = Math.PI / 180

// WGS84 and the Airy 1830 ellipsoid that OSGB36 uses
const WGS84 = { a: 6378137, b: 6356752.3142 }
const AIRY = { a: 6377563.396, b: 6356256.909 }

// Helmert transformation, WGS84 to OSGB36
const TX = -446.448
const TY = 125.157
const TZ = -542.06
const S = 20.4894e-6
const RX = (-0.1502 / 3600) * RAD
const RY = (-0.247 / 3600) * RAD
const RZ = (-0.8421 / 3600) * RAD

// The National Grid projection
const F0 = 0.9996012717
const PHI0 = 49 * RAD
const LAMBDA0 = -2 * RAD
const E0 = 400000
const N0 = -100000

export function toBritishGrid(latitude: number, longitude: number): { easting: number; northing: number } {
  const phi = latitude * RAD
  const lambda = longitude * RAD

  // To Cartesian on WGS84
  const e2w = 1 - (WGS84.b * WGS84.b) / (WGS84.a * WGS84.a)
  const nuw = WGS84.a / Math.sqrt(1 - e2w * Math.sin(phi) ** 2)
  const x1 = nuw * Math.cos(phi) * Math.cos(lambda)
  const y1 = nuw * Math.cos(phi) * Math.sin(lambda)
  const z1 = nuw * (1 - e2w) * Math.sin(phi)

  // Helmert shift
  const x2 = TX + (1 + S) * x1 - RZ * y1 + RY * z1
  const y2 = TY + RZ * x1 + (1 + S) * y1 - RX * z1
  const z2 = TZ - RY * x1 + RX * y1 + (1 + S) * z1

  // Back to latitude and longitude, on the Airy ellipsoid
  const e2 = 1 - (AIRY.b * AIRY.b) / (AIRY.a * AIRY.a)
  const p = Math.hypot(x2, y2)
  let lat = Math.atan2(z2, p * (1 - e2))
  for (let i = 0; i < 10; i++) {
    const nu = AIRY.a / Math.sqrt(1 - e2 * Math.sin(lat) ** 2)
    lat = Math.atan2(z2 + e2 * nu * Math.sin(lat), p)
  }
  const lon = Math.atan2(y2, x2)

  // Transverse Mercator
  const n = (AIRY.a - AIRY.b) / (AIRY.a + AIRY.b)
  const nu = AIRY.a * F0 / Math.sqrt(1 - e2 * Math.sin(lat) ** 2)
  const rho = (AIRY.a * F0 * (1 - e2)) / (1 - e2 * Math.sin(lat) ** 2) ** 1.5
  const eta2 = nu / rho - 1
  const dPhi = lat - PHI0
  const sPhi = lat + PHI0
  const M =
    AIRY.b * F0 *
    ((1 + n + (5 / 4) * n ** 2 + (5 / 4) * n ** 3) * dPhi -
      (3 * n + 3 * n ** 2 + (21 / 8) * n ** 3) * Math.sin(dPhi) * Math.cos(sPhi) +
      ((15 / 8) * n ** 2 + (15 / 8) * n ** 3) * Math.sin(2 * dPhi) * Math.cos(2 * sPhi) -
      (35 / 24) * n ** 3 * Math.sin(3 * dPhi) * Math.cos(3 * sPhi))
  const sin = Math.sin(lat)
  const cos = Math.cos(lat)
  const tan2 = Math.tan(lat) ** 2
  const I = M + N0
  const II = (nu / 2) * sin * cos
  const III = (nu / 24) * sin * cos ** 3 * (5 - tan2 + 9 * eta2)
  const IIIA = (nu / 720) * sin * cos ** 5 * (61 - 58 * tan2 + tan2 ** 2)
  const IV = nu * cos
  const V = (nu / 6) * cos ** 3 * (nu / rho - tan2)
  const VI = (nu / 120) * cos ** 5 * (5 - 18 * tan2 + tan2 ** 2 + 14 * eta2 - 58 * tan2 * eta2)
  const dl = lon - LAMBDA0

  return {
    northing: I + II * dl ** 2 + III * dl ** 4 + IIIA * dl ** 6,
    easting: E0 + IV * dl + V * dl ** 3 + VI * dl ** 5,
  }
}

// British National Grid eastings and northings (as OS Open Names gives them) back to latitude and longitude (WGS84), by
// stepping toBritishGrid towards the target. Converges to well under a metre in a few steps across Great Britain.
export function fromBritishGrid(easting: number, northing: number): { latitude: number; longitude: number } {
  let latitude = 49 + (northing + 100000) / 111_200
  let longitude = -2 + (easting - 400000) / (111_200 * Math.cos(latitude * RAD))
  for (let i = 0; i < 20; i++) {
    const g = toBritishGrid(latitude, longitude)
    const dn = northing - g.northing
    const de = easting - g.easting
    latitude += dn / 111_200
    longitude += de / (111_200 * Math.cos(latitude * RAD))
    if (Math.abs(dn) < 0.01 && Math.abs(de) < 0.01) break
  }
  return { latitude, longitude }
}
