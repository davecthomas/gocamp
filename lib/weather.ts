import { CLIMATE, MONTHS } from './data/climate';
import { lapseAdjustmentF } from './trip';
import type { Leg } from './types';

export interface StopWeather {
  station: string;
  month: string;
  highF: number;
  lowF: number;
  precipIn: number;
  /** Short read on the month's precipitation. */
  note: string;
  freezes: boolean;
  /** Feet this stop sits above its station, zero when it sits at it. */
  liftFt: number;
  /** Degrees subtracted for that lift. */
  liftF: number;
}

function precipNote(inches: number): string {
  if (inches >= 3) return 'wet month';
  if (inches >= 2) return 'showers likely';
  if (inches >= 1) return 'scattered showers';
  return 'dry';
}

/**
 * Typical conditions for a stop on a given date, from monthly normals. Stops well
 * above their station are corrected by lapse rate rather than reported as if they
 * sat at station elevation: Trail Ridge summit is 4,661 ft above Estes Park.
 */
export function weatherFor(leg: Leg, date: Date | undefined): StopWeather | null {
  if (!leg.station || !date) return null;
  const station = CLIMATE[leg.station];
  if (!station) return null;

  const monthIndex = date.getMonth();
  const normals = station.months[monthIndex];
  if (!normals) return null;

  const liftFt = leg.stationLiftFt ?? 0;
  const liftF = liftFt ? lapseAdjustmentF(liftFt) : 0;
  const highF = Math.round(normals[0] - liftF);
  const lowF = Math.round(normals[1] - liftF);

  return {
    station: station.name,
    month: MONTHS[monthIndex] ?? '',
    highF,
    lowF,
    precipIn: normals[2],
    note: precipNote(normals[2]),
    freezes: lowF <= 32,
    liftFt,
    liftF: Math.round(liftF),
  };
}
