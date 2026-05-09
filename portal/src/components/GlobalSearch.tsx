import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { Search, Loader, X } from 'lucide-react';
import { Input } from '@/app/components/ui/input';
import { supabase } from '@/lib/supabase';

type ResultKind = 'shift' | 'driver' | 'vehicle';

interface SearchResult {
  kind: ResultKind;
  id: string;
  label: string;
  sublabel?: string;
}

// UUID v4 pattern (loose match)
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function GlobalSearch() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback(async (q: string) => {
    const trimmed = q.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }

    setLoading(true);
    setOpen(true);

    try {
      const found: SearchResult[] = [];

      // If it looks like a UUID — direct shift lookup
      if (UUID_RE.test(trimmed)) {
        const { data } = await supabase
          .from('shifts_full')
          .select('id, driver_name, vehicle_rego, started_at')
          .eq('id', trimmed)
          .limit(1);
        (data ?? []).forEach((row: any) =>
          found.push({
            kind: 'shift',
            id: row.id,
            label: `Shift ${row.id.slice(0, 8)}…`,
            sublabel: `${row.driver_name ?? '—'} · ${row.vehicle_rego ?? '—'}`,
          })
        );
      } else {
        // Parallel: drivers + vehicles + shifts (by vehicle rego / driver name)
        const [driversRes, vehiclesRes, shiftsRes] = await Promise.all([
          supabase
            .from('drivers')
            .select('id, full_name')
            .ilike('full_name', `%${trimmed}%`)
            .limit(5),
          supabase
            .from('vehicles')
            .select('id, rego, make, model')
            .ilike('rego', `%${trimmed}%`)
            .limit(5),
          supabase
            .from('shifts_full')
            .select('id, driver_name, vehicle_rego, started_at')
            .or(`driver_name.ilike.%${trimmed}%,vehicle_rego.ilike.%${trimmed}%`)
            .order('started_at', { ascending: false })
            .limit(5),
        ]);

        (driversRes.data ?? []).forEach((row: any) =>
          found.push({ kind: 'driver', id: row.id, label: row.full_name ?? row.id })
        );

        (vehiclesRes.data ?? []).forEach((row: any) =>
          found.push({
            kind: 'vehicle',
            id: row.id,
            label: row.rego,
            sublabel: [row.make, row.model].filter(Boolean).join(' ') || undefined,
          })
        );

        (shiftsRes.data ?? []).forEach((row: any) =>
          found.push({
            kind: 'shift',
            id: row.id,
            label: `Shift ${row.id.slice(0, 8)}…`,
            sublabel: `${row.driver_name ?? '—'} · ${row.vehicle_rego ?? '—'}`,
          })
        );
      }

      setResults(found);
      setOpen(true);
    } catch (err) {
      console.error('GlobalSearch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(query), 280);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, search]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const go = (result: SearchResult) => {
    setQuery('');
    setOpen(false);
    setResults([]);
    if (result.kind === 'shift') navigate(`/shifts/${result.id}`);
    else if (result.kind === 'driver') navigate(`/drivers/${result.id}`);
    else navigate(`/vehicles/${result.id}`);
  };

  const kindLabel: Record<ResultKind, string> = {
    shift: 'Shift',
    driver: 'Driver',
    vehicle: 'Vehicle',
  };
  const kindColors: Record<ResultKind, string> = {
    shift: 'text-blue-400',
    driver: 'text-green-400',
    vehicle: 'text-orange-400',
  };

  return (
    <div ref={wrapperRef} className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
      <Input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => query.trim().length >= 2 && setOpen(true)}
        placeholder="Search shifts, drivers, vehicles…"
        className="w-64 pl-10 pr-8 bg-[#0F0F0F] border-gray-700 text-white placeholder:text-gray-500"
      />
      {query && (
        <button
          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
          onClick={() => { setQuery(''); setResults([]); setOpen(false); }}
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}

      {open && (
        <div className="absolute left-0 top-full mt-1 w-80 bg-[#1a1a1a] border border-gray-700 rounded-lg shadow-xl z-50 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-4 text-sm text-gray-400">
              <Loader className="w-4 h-4 animate-spin" />
              Searching…
            </div>
          ) : results.length === 0 ? (
            <p className="py-4 text-center text-sm text-gray-500">No results</p>
          ) : (
            <ul>
              {results.map((r) => (
                <li key={`${r.kind}-${r.id}`}>
                  <button
                    className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-[#272727] transition-colors"
                    onClick={() => go(r)}
                  >
                    <span className={`mt-0.5 text-xs font-semibold uppercase tracking-wide w-14 shrink-0 ${kindColors[r.kind]}`}>
                      {kindLabel[r.kind]}
                    </span>
                    <span>
                      <p className="text-sm text-white">{r.label}</p>
                      {r.sublabel && <p className="text-xs text-gray-400 mt-0.5">{r.sublabel}</p>}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
