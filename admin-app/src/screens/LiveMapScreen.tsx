import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import ScreenContainer from '../components/ScreenContainer';
import { listDriverCurrentStatus, type DriverCurrentStatus } from '../lib/db/liveStatus';

const DEFAULT_CENTER = { lat: -33.8688, lng: 151.2093 };

function buildMapHtml(pins: DriverCurrentStatus[]) {
  const center = pins.length > 0 ? { lat: pins[0].lat as number, lng: pins[0].lng as number } : DEFAULT_CENTER;
  const markers = pins
    .map((p) => {
      const color = p.is_online ? '#22C55E' : '#4B5563';
      const label = (p.driver_id ?? '').replace(/'/g, "\\'");
      const status = (p.status_state ?? '').replace(/'/g, "\\'");
      return `L.circleMarker([${p.lat}, ${p.lng}], { radius: 9, color: '${color}', fillColor: '${color}', fillOpacity: 0.9, weight: 2 }).addTo(map).bindPopup('${label}${status ? ' — ' + status : ''}');`;
    })
    .join('\n');

  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>html, body, #map { height: 100%; margin: 0; padding: 0; background: #0B0B0B; }</style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    var map = L.map('map', { zoomControl: true }).setView([${center.lat}, ${center.lng}], ${pins.length > 0 ? 11 : 10});
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);
    ${markers}
  </script>
</body>
</html>`;
}

export default function LiveMapScreen() {
  const [statuses, setStatuses] = useState<DriverCurrentStatus[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setStatuses(await listDriverCurrentStatus());
    } catch (err) {
      console.error('[LiveMap] load failed', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, [load]);

  const pins = statuses.filter((s) => s.lat != null && s.lng != null);
  const html = useMemo(() => buildMapHtml(pins), [pins]);

  if (loading) {
    return (
      <ScreenContainer title="Live Map">
        <ActivityIndicator color="#FF6B35" />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer title="Live Map" subtitle={`${pins.length} drivers with location`}>
      <View style={styles.mapWrap}>
        <WebView source={{ html }} style={styles.map} />
      </View>
      {pins.length === 0 ? <Text style={styles.empty}>No driver locations available.</Text> : null}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  mapWrap: { flex: 1, borderRadius: 12, overflow: 'hidden' },
  map: { flex: 1, backgroundColor: '#0B0B0B' },
  empty: { color: '#9CA3AF', fontSize: 13, marginTop: 12 },
});
