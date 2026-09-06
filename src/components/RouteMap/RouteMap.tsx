import { useEffect, useId, useRef, useState, type PointerEvent } from 'react';
import { Minus, Plus, RotateCcw, Layers3, Pause, Play } from 'lucide-react';
import geography from '../../data/australia.json';
import history from '../../data/approved-deliveries.json';
import './RouteMap.css';

export type RouteMapVariant = 'hero' | 'portal' | 'tracking';
export interface DeliveryPoint { id: string; locality: string; state: string; latitude: number; longitude: number }
interface ReferencePoint { locality: string; latitude: number; longitude: number }
interface RouteMapProps { variant?: RouteMapVariant; theme?: 'dark' | 'light'; className?: string; referencePoint?: ReferencePoint; points?: DeliveryPoint[] }
export const approvedDeliveryPoints = history.points as DeliveryPoint[];

// Equirectangular geographic projection, with horizontal scale corrected at 27°S.
export function projectPoint(longitude: number, latitude: number): [number, number] { return [(longitude - 110) * 18.5, (-latitude - 7.5) * 20.8]; }
const polygons = geography.features[0].geometry.coordinates;
const coast = polygons.map(polygon => polygon.map(ring => ring.map(([longitude, latitude], i) => { const [x,y] = projectPoint(longitude, latitude); return `${i ? 'L' : 'M'}${x.toFixed(2)},${y.toFixed(2)}`; }).join(' ') + 'Z').join(' ')).join(' ');
const labels = [{ name: 'WA', longitude: 121, latitude: -25.5 }, { name: 'NT', longitude: 133.5, latitude: -20 }, { name: 'SA', longitude: 135, latitude: -29 }, { name: 'QLD', longitude: 144, latitude: -22 }, { name: 'NSW', longitude: 146, latitude: -32 }, { name: 'VIC', longitude: 144, latitude: -37 }, { name: 'TAS', longitude: 148.5, latitude: -43.5 }];
const [perthX, perthY] = projectPoint(115.8613, -31.9523);

export function RouteMap({ variant = 'hero', theme = variant === 'hero' ? 'dark' : 'light', className = '', referencePoint, points = approvedDeliveryPoints }: RouteMapProps) {
  const id = useId().replace(/:/g, '');
  const stage = useRef<HTMLDivElement>(null);
  const [depth, setDepth] = useState(variant === 'hero');
  const [paused, setPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [selected, setSelected] = useState<string | null>(null);
  const active = points.find(point => point.id === selected);
  const focus = referencePoint || active;
  const [focusX, focusY] = focus ? projectPoint(focus.longitude, focus.latitude) : [perthX, perthY];
  useEffect(() => { const media = window.matchMedia('(prefers-reduced-motion: reduce)'); const change = () => setReducedMotion(media.matches); change(); media.addEventListener('change', change); return () => media.removeEventListener('change', change); }, []);
  const move = (event: PointerEvent<HTMLDivElement>) => {
    if (!depth || paused || reducedMotion || event.pointerType !== 'mouse') return;
    const bounds = event.currentTarget.getBoundingClientRect();
    stage.current?.style.setProperty('--pointer-x', `${((event.clientX - bounds.left) / bounds.width - .5) * 8}deg`);
    stage.current?.style.setProperty('--pointer-y', `${((event.clientY - bounds.top) / bounds.height - .5) * -8}deg`);
  };
  return <div className={`routeMap routeMap--${variant} ${className}`} data-theme={theme} data-depth={depth} data-paused={paused || reducedMotion} aria-label={referencePoint ? `${referencePoint.locality} locality reference on Australia map` : 'Australia map showing approved past delivery locations'}>
    <div className="routeMap__toolbar"><span>{referencePoint ? 'Locality reference' : 'Australia / Delivery points'}</span><div>
      <button type="button" aria-label="Zoom out map" onClick={() => setZoom(value => Math.max(1, value - .25))} disabled={zoom === 1}><Minus /></button>
      <button type="button" aria-label="Zoom in map" onClick={() => setZoom(value => Math.min(2, value + .25))} disabled={zoom === 2}><Plus /></button>
      <button type="button" aria-label="Reset map zoom" onClick={() => { setZoom(1); setSelected(null); }}><RotateCcw /></button>
      <button type="button" aria-label="Toggle map depth" aria-pressed={depth} onClick={() => setDepth(value => !value)}><Layers3 /><span>{depth ? '3D' : '2D'}</span></button>
      {depth && <button type="button" aria-label={paused ? 'Resume map motion' : 'Pause map motion'} onClick={() => setPaused(value => !value)}>{paused ? <Play /> : <Pause />}</button>}
    </div></div>
    <div className="routeMap__viewport" onPointerMove={move} onPointerLeave={() => { stage.current?.style.setProperty('--pointer-x', '0deg'); stage.current?.style.setProperty('--pointer-y', '0deg'); }}>
      <div className="routeMap__stage" ref={stage}>
        <svg viewBox="0 0 870 825" className="routeMap__svg" role="img" aria-labelledby={`${id}-title ${id}-description`}>
          <title id={`${id}-title`}>Australia, including Tasmania</title><desc id={`${id}-description`}>{referencePoint ? `Approximate location of ${referencePoint.locality}. This is a locality reference, not evidence of a delivery.` : `${points.length} approved past delivery locations. Perth operations base is marked separately. Coastline derived from Natural Earth.`}</desc>
          <defs><path id={`${id}-coast`} d={coast} /><clipPath id={`${id}-clip`}><use href={`#${id}-coast`} /></clipPath><linearGradient id={`${id}-surface`} x1="0" y1="0" x2="1" y2="1"><stop className="routeMap__gradientStart" /><stop offset="1" className="routeMap__gradientEnd" /></linearGradient><pattern id={`${id}-grid`} width="80" height="80" patternUnits="userSpaceOnUse"><path d="M80 0H0V80" fill="none" stroke="currentColor" strokeWidth=".6" /></pattern></defs>
          <g transform={zoom === 1 ? 'translate(0,0)' : `translate(${435 - focusX * zoom},${412 - focusY * zoom}) scale(${zoom})`}>
            <rect x="20" y="40" width="830" height="740" fill={`url(#${id}-grid)`} className="routeMap__grid" />
            <g className="routeMap__extrusion" aria-hidden="true">{[24,20,16,12,8,4].map(offset => <use key={offset} href={`#${id}-coast`} transform={`translate(0 ${offset})`} />)}</g>
            <use href={`#${id}-coast`} fill={`url(#${id}-surface)`} className="routeMap__land" />
            <g clipPath={`url(#${id}-clip)`}><rect x="0" y="0" width={projectPoint(129, 0)[0]} height="820" className="routeMap__wa" /><path d={`M${projectPoint(129, 0)[0]} 0V820`} className="routeMap__waBorder" /></g>
            <use href={`#${id}-coast`} className="routeMap__coastline" />
            <g className="routeMap__stateNames" aria-hidden="true">{labels.map(label => { const [x,y] = projectPoint(label.longitude, label.latitude); return <text key={label.name} x={x} y={y}>{label.name}</text>; })}</g>
            {!referencePoint && <g className="routeMap__base" aria-label="Perth operations base, not a delivery point"><rect x={perthX - 5} y={perthY - 5} width="10" height="10" /><text x={perthX + 17} y={perthY + 4}>PERTH</text><text className="routeMap__baseCaption" x={perthX + 17} y={perthY + 22}>OPERATIONS BASE</text></g>}
            {referencePoint && (() => { const [x,y] = projectPoint(referencePoint.longitude, referencePoint.latitude); return <g className="routeMap__reference"><circle cx={x} cy={y} r="15" /><circle cx={x} cy={y} r="5" /><text x={x + 22} y={y + 6}>{referencePoint.locality}</text></g>; })()}
            {!referencePoint && points.map(point => { const [x,y] = projectPoint(point.longitude, point.latitude); return <g className="routeMap__delivery" key={point.id} role="button" tabIndex={0} aria-label={`Past delivery location: ${point.locality}, ${point.state}`} aria-pressed={point.id === selected} onClick={() => setSelected(point.id)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelected(point.id); } }}><circle className="routeMap__hitArea" cx={x} cy={y} r="23" /><circle className="routeMap__pin" cx={x} cy={y} r="7" /><circle className="routeMap__pinHalo" cx={x} cy={y} r="15" /></g>; })}
          </g>
        </svg>
      </div>
      <span className="routeMap__ocean" aria-hidden="true">INDIAN OCEAN</span>
    </div>
    <div className="routeMap__caption" aria-live="polite"><div><span className="routeMap__captionLabel">{referencePoint ? 'Approximate locality position' : active ? 'Past delivery location' : 'Past delivery points'}</span><strong>{referencePoint ? referencePoint.locality : active ? `${active.locality}, ${active.state}` : points.length ? `${points.length} confirmed locations` : 'No delivery history published yet'}</strong>{!points.length && !referencePoint && <p>Past delivery locations will appear here once added.</p>}</div>{!referencePoint && <span className="routeMap__baseKey">■ Perth base</span>}</div>
    {points.length > 0 && !referencePoint && <div className="routeMap__pointList" aria-label="Choose a past delivery location">{points.map(point => <button key={point.id} onClick={() => setSelected(point.id)} aria-pressed={selected === point.id}>{point.locality}</button>)}</div>}
    <a className="routeMap__attribution" href="https://www.naturalearthdata.com/" target="_blank" rel="noreferrer">Map geography: Natural Earth</a>
  </div>;
}
export default RouteMap;
