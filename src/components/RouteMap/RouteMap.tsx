import { useEffect, useMemo, useRef, useState } from 'react';
import { freightRoutes, getHub, hubs, type FreightRoute, type ServiceType } from './routes';
import './RouteMap.css';

export type RouteMapVariant = 'hero' | 'portal' | 'tracking';

interface RouteMapProps {
  variant?: RouteMapVariant;
  routeIds?: string[];
  service?: ServiceType | 'all';
  theme?: 'dark' | 'light';
  className?: string;
}

const mainland = [
  [92, 190], [130, 132], [208, 112], [278, 72], [382, 74], [456, 112],
  [520, 126], [585, 168], [640, 214], [704, 280], [710, 340], [680, 402],
  [614, 454], [552, 458], [490, 425], [410, 440], [340, 420], [268, 432],
  [198, 414], [132, 424], [92, 392], [76, 330], [82, 258],
];

const tasmania = [[582, 480], [620, 474], [644, 504], [623, 536], [590, 526], [574, 500]];

function isInside(x: number, y: number, polygon: number[][]) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    const intersects = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  return reduced;
}

export function RouteMap({
  variant = 'hero',
  routeIds,
  service = 'all',
  theme = variant === 'hero' ? 'dark' : 'light',
  className = '',
}: RouteMapProps) {
  const [activeHub, setActiveHub] = useState<string | null>(variant === 'tracking' ? 'melbourne' : null);
  const [activeRoute, setActiveRoute] = useState<FreightRoute | null>(null);
  const [interacting, setInteracting] = useState(false);
  const pathRefs = useRef<Record<string, SVGPathElement | null>>({});
  const travellerRefs = useRef<Record<string, SVGCircleElement | null>>({});
  const reducedMotion = useReducedMotion();

  const dots = useMemo(() => {
    const points: { x: number; y: number; r: number }[] = [];
    for (let y = 76; y <= 536; y += 13) {
      for (let x = 76; x <= 714; x += 13) {
        const jitterX = ((x * 17 + y * 11) % 7) - 3;
        const jitterY = ((x * 7 + y * 19) % 7) - 3;
        if (isInside(x, y, mainland) || isInside(x, y, tasmania)) {
          points.push({ x: x + jitterX, y: y + jitterY, r: ((x + y) % 5) / 10 + 1.05 });
        }
      }
    }
    return points;
  }, []);

  const routes = useMemo(() => freightRoutes.filter((route) => {
    const inSelection = !routeIds || routeIds.includes(route.id);
    const inService = service === 'all' || route.service === service;
    return inSelection && inService;
  }), [routeIds, service]);

  useEffect(() => {
    if (reducedMotion || interacting) return;
    let frame = 0;
    const startedAt = performance.now();
    const animate = (time: number) => {
      routes.forEach((route, index) => {
        const path = pathRefs.current[route.id];
        const traveller = travellerRefs.current[route.id];
        if (!path || !traveller) return;
        const length = path.getTotalLength();
        const phase = ((time - startedAt + index * 1600) % route.duration) / route.duration;
        const point = path.getPointAtLength(length * phase);
        traveller.setAttribute('cx', String(point.x));
        traveller.setAttribute('cy', String(point.y));
      });
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [interacting, reducedMotion, routes]);

  const selectedRoute = activeRoute ?? routes.find((route) => route.from === activeHub || route.to === activeHub) ?? routes[0];

  const selectHub = (hubId: string) => {
    const route = routes.find((item) => item.from === hubId || item.to === hubId) ?? null;
    setActiveHub(hubId);
    setActiveRoute(route);
    setInteracting(true);
  };

  return (
    <div
      className={`routeMap routeMap--${variant} ${className}`}
      data-theme={theme}
      onMouseLeave={() => { setInteracting(false); if (variant === 'hero') setActiveHub(null); }}
      aria-label="Transline freight routes across Australia"
    >
      <svg className="routeMap__svg" viewBox="40 45 710 520" role="img" aria-labelledby={`route-map-${variant}-title`}>
        <title id={`route-map-${variant}-title`}>Australian freight route network</title>
        <g aria-hidden="true">
          {dots.map((dot, index) => <circle className="routeMap__landDot" key={index} cx={dot.x} cy={dot.y} r={dot.r} />)}
        </g>
        <g aria-hidden="true">
          {routes.map((route, index) => {
            const highlighted = !activeHub || route.from === activeHub || route.to === activeHub;
            return (
              <path
                key={route.id}
                ref={(node) => { pathRefs.current[route.id] = node; }}
                d={route.path}
                className={`routeMap__path ${highlighted ? 'is-active' : 'is-dimmed'}`}
                style={{ '--route-delay': `${index * 130}ms` } as React.CSSProperties}
              />
            );
          })}
          {!reducedMotion && routes.map((route) => (
            <circle key={`${route.id}-traveller`} ref={(node) => { travellerRefs.current[route.id] = node; }} className="routeMap__traveller" r={variant === 'hero' ? 3.5 : 3} />
          ))}
        </g>
        <g>
          {hubs.filter((hub) => routes.some((route) => route.from === hub.id || route.to === hub.id)).map((hub) => (
            <g
              key={hub.id}
              className={`routeMap__hub ${activeHub === hub.id ? 'is-active' : ''}`}
              role="button"
              tabIndex={0}
              aria-label={`Show routes serving ${hub.name}`}
              onMouseEnter={() => selectHub(hub.id)}
              onFocus={() => selectHub(hub.id)}
              onClick={() => selectHub(hub.id)}
              onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') selectHub(hub.id); }}
            >
              <circle className="routeMap__hubHalo" cx={hub.x} cy={hub.y} r="10" />
              <circle className="routeMap__hubCore" cx={hub.x} cy={hub.y} r={hub.id === 'perth' ? 6 : 4.5} />
              {variant !== 'portal' && <text className="routeMap__hubLabel" x={hub.x + 10} y={hub.y - 9}>{hub.name}</text>}
            </g>
          ))}
        </g>
      </svg>
      {selectedRoute && (
        <div className="routeMap__detail" aria-live="polite">
          <div className="routeMap__detailEyebrow">Active corridor</div>
          <div className="routeMap__detailRoute">{getHub(selectedRoute.from)?.name} → {getHub(selectedRoute.to)?.name}</div>
          <div className="routeMap__detailData">{selectedRoute.distance} · {selectedRoute.frequency} · {selectedRoute.transit} transit</div>
        </div>
      )}
    </div>
  );
}

export default RouteMap;

