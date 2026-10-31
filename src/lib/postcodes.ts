// Full postcodes (John, 31 October): every postcode's position, one file per postcode area (scripts/build-postcodes.ts), loaded
// only when a full postcode is typed, so the website sees no more than the area, and the full postcode stays on the device.

const STEP = 1e4; // positions in units of 0.0001 degrees

// One district's string ("514668,-9654|5AA0,0;5AB14,-11;…") into a look-up from inward code ("7HN") to latitude and longitude.
export function decodeDistrict(s: string): Map<string, [number, number]> {
  const out = new Map<string, [number, number]>();
  const [start, rest] = s.split('|');
  let [lat, lon] = start.split(',').map(Number);
  for (const part of rest ? rest.split(';') : []) {
    const inward = part.slice(0, 3);
    const [dLat, dLon] = part.slice(3).split(',').map(Number);
    lat += dLat;
    lon += dLon;
    out.set(inward, [lat / STEP, lon / STEP]);
  }
  return out;
}

// "RG4 7HN" as typed in the address after "#": "RG4-7HN".
export const fullHash = (outcode: string, inward: string) => `${outcode}-${inward}`;
