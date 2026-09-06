import React, { useMemo } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { WebView } from 'react-native-webview';

export interface MapMarker {
  lat: number;
  lng: number;
  color?: string;
  radius?: number;
  label?: string; // popup text
  heading?: number | null; // when set, render a rotated arrow instead of a dot
  kind?: 'dot' | 'arrow' | 'start' | 'latest' | 'stop';
}

export interface MapRoute {
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
  color?: string;
  completed?: boolean;
}

export interface MapWebViewProps {
  markers?: MapMarker[];
  route?: MapRoute | null;
  center?: { lat: number; lng: number } | null;
  zoom?: number;
  tiles?: 'osm' | 'dark';
  style?: ViewStyle;
}

const DEFAULT_CENTER = { lat: -25.2744, lng: 133.7751 }; // Australia

function escapeText(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, ' ');
}

function buildHtml(props: MapWebViewProps): string {
  const markers = props.markers ?? [];
  const route = props.route ?? null;
  const tiles = props.tiles ?? 'osm';
  const explicitCenter = props.center ?? null;

  const firstMarker = markers.find((m) => m.lat != null && m.lng != null) ?? null;
  const center =
    explicitCenter ??
    (route ? { lat: route.startLat, lng: route.startLng } : null) ??
    (firstMarker ? { lat: firstMarker.lat, lng: firstMarker.lng } : DEFAULT_CENTER);
  const zoom = props.zoom ?? (firstMarker || route ? 13 : 4);

  const tileLayer =
    tiles === 'dark'
      ? "L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { subdomains: 'abcd', maxZoom: 19 })"
      : "L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap' })";

  const markersJson = JSON.stringify(
    markers.map((m) => ({
      lat: m.lat,
      lng: m.lng,
      color: m.color ?? '#BE1C2D',
      radius: m.radius ?? 9,
      label: m.label ? escapeText(m.label) : null,
      heading: m.heading ?? null,
      kind: m.kind ?? (m.heading != null ? 'arrow' : 'dot'),
    }))
  );
  const routeJson = route ? JSON.stringify(route) : 'null';

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
    var map = L.map('map', { zoomControl: true, attributionControl: false }).setView([${center.lat}, ${center.lng}], ${zoom});
    ${tileLayer}.addTo(map);

    var markers = ${markersJson};
    var route = ${routeJson};
    var bounds = [];

    function arrowIcon(color, heading) {
      return L.divIcon({
        className: '',
        iconSize: [30, 30],
        iconAnchor: [15, 15],
        html: '<div style="width:30px;height:30px;background:' + color + ';border-radius:50%;display:flex;align-items:center;justify-content:center;border:3px solid #fff;box-shadow:0 0 10px rgba(0,0,0,0.5);transform:rotate(' + (heading || 0) + 'deg)"><svg viewBox="0 0 24 24" width="15" height="15" fill="white"><path d="M12 2L4 20l8-4 8 4L12 2z"/></svg></div>'
      });
    }

    function addMarker(m) {
      var mk;
      if (m.kind === 'arrow' && m.heading !== null) {
        mk = L.marker([m.lat, m.lng], { icon: arrowIcon(m.color, m.heading) });
      } else {
        mk = L.circleMarker([m.lat, m.lng], { radius: m.radius, color: m.color, fillColor: m.color, fillOpacity: 0.9, weight: 2 });
      }
      mk.addTo(map);
      if (m.label) mk.bindPopup(m.label);
      bounds.push([m.lat, m.lng]);
      return mk;
    }

    markers.forEach(addMarker);

    function fit() {
      if (bounds.length === 1) { map.setView(bounds[0], Math.max(map.getZoom(), 14)); }
      else if (bounds.length > 1) { map.fitBounds(bounds, { padding: [30, 30] }); }
    }

    if (route) {
      var url = 'https://router.project-osrm.org/route/v1/driving/' + route.startLng + ',' + route.startLat + ';' + route.endLng + ',' + route.endLat + '?overview=full&geometries=geojson';
      var routeColor = route.color || (route.completed ? '#1a1a2e' : '#ff6b35');
      fetch(url).then(function (r) { return r.json(); }).then(function (data) {
        var coords = data && data.routes && data.routes[0] && data.routes[0].geometry && data.routes[0].geometry.coordinates;
        if (coords && coords.length) {
          var latlngs = coords.map(function (c) { return [c[1], c[0]]; });
          var line = L.polyline(latlngs, { color: routeColor, weight: 5, opacity: 0.88 }).addTo(map);
          latlngs.forEach(function (p) { bounds.push(p); });
          L.circleMarker([route.startLat, route.startLng], { radius: 8, color: '#22c55e', fillColor: '#22c55e', fillOpacity: 1, weight: 2 }).addTo(map).bindPopup('Start');
          L.circleMarker([route.endLat, route.endLng], { radius: 8, color: '#ef4444', fillColor: '#ef4444', fillOpacity: 1, weight: 2 }).addTo(map).bindPopup(route.completed ? 'End' : 'Latest');
          map.fitBounds(line.getBounds(), { padding: [30, 30] });
        } else { fit(); }
      }).catch(function () {
        // Fallback: straight line if OSRM is unreachable.
        L.polyline([[route.startLat, route.startLng], [route.endLat, route.endLng]], { color: routeColor, weight: 4, opacity: 0.7, dashArray: '6 8' }).addTo(map);
        bounds.push([route.startLat, route.startLng]); bounds.push([route.endLat, route.endLng]);
        fit();
      });
    } else {
      fit();
    }
  </script>
</body>
</html>`;
}

export default function MapWebView(props: MapWebViewProps) {
  const html = useMemo(
    () => buildHtml(props),
    // Rebuild when inputs change.
    [JSON.stringify(props.markers), JSON.stringify(props.route), JSON.stringify(props.center), props.zoom, props.tiles]
  );

  return (
    <View style={[styles.wrap, props.style]}>
      <WebView
        source={{ html }}
        style={styles.web}
        originWhitelist={['*']}
        javaScriptEnabled
        domStorageEnabled
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, overflow: 'hidden', borderRadius: 12, backgroundColor: '#0B0B0B' },
  web: { flex: 1, backgroundColor: '#0B0B0B' },
});
