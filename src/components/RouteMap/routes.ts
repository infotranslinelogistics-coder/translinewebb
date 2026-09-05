export type ServiceType = 'general' | 'express' | 'refrigerated' | 'heavy';

export interface RouteHub {
  id: string;
  name: string;
  x: number;
  y: number;
}

export interface FreightRoute {
  id: string;
  from: string;
  to: string;
  distance: string;
  frequency: string;
  transit: string;
  service: ServiceType;
  path: string;
  duration: number;
}

export const hubs: RouteHub[] = [
  { id: 'perth', name: 'Perth', x: 146, y: 378 },
  { id: 'kalgoorlie', name: 'Kalgoorlie', x: 246, y: 345 },
  { id: 'port-hedland', name: 'Port Hedland', x: 205, y: 195 },
  { id: 'darwin', name: 'Darwin', x: 380, y: 92 },
  { id: 'alice-springs', name: 'Alice Springs', x: 390, y: 265 },
  { id: 'mount-isa', name: 'Mount Isa', x: 520, y: 220 },
  { id: 'adelaide', name: 'Adelaide', x: 506, y: 390 },
  { id: 'melbourne', name: 'Melbourne', x: 595, y: 438 },
  { id: 'sydney', name: 'Sydney', x: 664, y: 365 },
  { id: 'brisbane', name: 'Brisbane', x: 684, y: 292 },
];

export const freightRoutes: FreightRoute[] = [
  { id: 'per-mel', from: 'perth', to: 'melbourne', distance: '3,400 km', frequency: '2× weekly', transit: '72h', service: 'general', path: 'M146 378 C270 440 440 465 595 438', duration: 11200 },
  { id: 'per-syd', from: 'perth', to: 'sydney', distance: '3,930 km', frequency: 'On request', transit: '84h', service: 'express', path: 'M146 378 C300 300 520 315 664 365', duration: 12600 },
  { id: 'per-adl', from: 'perth', to: 'adelaide', distance: '2,690 km', frequency: '3× weekly', transit: '56h', service: 'general', path: 'M146 378 C270 405 390 412 506 390', duration: 9200 },
  { id: 'per-kal', from: 'perth', to: 'kalgoorlie', distance: '595 km', frequency: 'Daily', transit: '8h', service: 'express', path: 'M146 378 Q190 344 246 345', duration: 5600 },
  { id: 'per-hed', from: 'perth', to: 'port-hedland', distance: '1,640 km', frequency: '3× weekly', transit: '24h', service: 'heavy', path: 'M146 378 Q118 260 205 195', duration: 7600 },
  { id: 'adl-dar', from: 'adelaide', to: 'darwin', distance: '3,030 km', frequency: 'Weekly', transit: '68h', service: 'refrigerated', path: 'M506 390 C420 340 342 205 380 92', duration: 11800 },
  { id: 'adl-bne', from: 'adelaide', to: 'brisbane', distance: '2,030 km', frequency: '2× weekly', transit: '42h', service: 'general', path: 'M506 390 Q610 330 684 292', duration: 8800 },
  { id: 'dar-isa', from: 'darwin', to: 'mount-isa', distance: '1,600 km', frequency: 'Weekly', transit: '30h', service: 'heavy', path: 'M380 92 Q485 118 520 220', duration: 8200 },
];

export const getHub = (id: string) => hubs.find((hub) => hub.id === id);

