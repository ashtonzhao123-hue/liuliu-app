import { SERVICE_CENTER, SERVICE_RADIUS_METERS, calculateDistanceMeters } from '../api/owner';
import type { OrderTrack } from '../types';
import { formatDistance } from '../utils/format';

interface MockMapProps {
  lat?: number;
  lng?: number;
  tracks?: OrderTrack[];
  selectable?: boolean;
  onSelect?: (lat: number, lng: number) => void;
}

const presetPoints = [
  { label: '小区中心', lat: SERVICE_CENTER.lat, lng: SERVICE_CENTER.lng },
  { label: '东门', lat: SERVICE_CENTER.lat + 0.006, lng: SERVICE_CENTER.lng + 0.005 },
  { label: '超出范围', lat: SERVICE_CENTER.lat + 0.042, lng: SERVICE_CENTER.lng + 0.038 }
];

export function MockMap({ lat = SERVICE_CENTER.lat, lng = SERVICE_CENTER.lng, tracks = [], selectable, onSelect }: MockMapProps) {
  const distance = calculateDistanceMeters(SERVICE_CENTER.lat, SERVICE_CENTER.lng, lat, lng);
  const isOut = distance > SERVICE_RADIUS_METERS;

  return (
    <section className={`mock-map ${isOut ? 'mock-map--danger' : ''}`} aria-label="地图选点">
      <div className="mock-map__canvas">
        <div className="mock-map__radius" />
        <div className="mock-map__path">
          {tracks.length > 1 ? tracks.map((track) => `${pointX(track.lng)}% ${pointY(track.lat)}%`).join(', ') : null}
        </div>
        {tracks.map((track, index) => (
          <span
            key={track.id}
            className={`mock-map__dot ${index === tracks.length - 1 ? 'mock-map__dot--current' : ''}`}
            style={{ left: `${pointX(track.lng)}%`, top: `${pointY(track.lat)}%` }}
          />
        ))}
        <span className="mock-map__pin" style={{ left: `${pointX(lng)}%`, top: `${pointY(lat)}%` }} />
      </div>
      <div className="mock-map__info">
        <span>{isOut ? '超出服务范围' : '服务范围内'}</span>
        <span>距试点中心 {formatDistance(distance)}</span>
      </div>
      {selectable ? (
        <div className="mock-map__points">
          {presetPoints.map((point) => (
            <button key={point.label} type="button" onClick={() => onSelect?.(point.lat, point.lng)}>
              {point.label}
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function pointX(lng: number): number {
  return Math.max(8, Math.min(92, 50 + (lng - SERVICE_CENTER.lng) * 2600));
}

function pointY(lat: number): number {
  return Math.max(8, Math.min(92, 50 - (lat - SERVICE_CENTER.lat) * 2600));
}
