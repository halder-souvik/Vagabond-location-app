import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { X } from 'lucide-react';
import { LocationItem, Trip } from '../types';

interface MapComponentProps {
  locations: LocationItem[];
  selectedLocation: LocationItem | null;
  onMapClick: (lat: number, lng: number) => void;
  onMarkerClick: (location: LocationItem) => void;
  selectedTripId?: string | null;
  trips?: Trip[];
  onSelectTrip?: (tripId: string | null) => void;
}

declare const L: any; // Leaflet is loaded in index.html

export default function MapComponent({
  locations,
  selectedLocation,
  onMapClick,
  onMarkerClick,
  selectedTripId,
  trips = [],
  onSelectTrip,
}: MapComponentProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);

  // Find active trip
  const activeTrip = trips.find(t => t.id === selectedTripId) || null;

  // Resolve the sequence of locations for the selected trip
  const tripLocations = (() => {
    if (!selectedTripId || trips.length === 0) return [];
    if (!activeTrip) return [];
    
    // 1. Get locations from itinerary events in order
    const itineraryLocs = activeTrip.itinerary
      .map(event => locations.find(l => l.id === event.locationId))
      .filter((loc): loc is LocationItem => !!loc);
      
    if (itineraryLocs.length > 0) {
      const uniqueSeq: LocationItem[] = [];
      itineraryLocs.forEach(loc => {
        if (uniqueSeq.length === 0 || uniqueSeq[uniqueSeq.length - 1].id !== loc.id) {
          uniqueSeq.push(loc);
        }
      });
      return uniqueSeq;
    }
    
    // 2. Fallback: locations directly linked
    return locations
      .filter(l => l.tripId === selectedTripId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  })();

  // Initialize Leaflet map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapRef.current) {
      const initialLat = selectedLocation ? selectedLocation.latitude : 48.8566;
      const initialLng = selectedLocation ? selectedLocation.longitude : 2.3522;
      const initialZoom = selectedLocation ? 13 : 3;

      mapRef.current = L.map(mapContainerRef.current, {
        center: [initialLat, initialLng],
        zoom: initialZoom,
        zoomControl: false,
      });

      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 20,
      }).addTo(mapRef.current);

      L.control.zoom({
        position: 'bottomright',
      }).addTo(mapRef.current);

      mapRef.current.on('click', (e: any) => {
        onMapClick(e.latlng.lat, e.latlng.lng);
      });
    }
  }, []);

  // Update map center when selectedLocation changes
  useEffect(() => {
    if (mapRef.current && selectedLocation) {
      mapRef.current.setView([selectedLocation.latitude, selectedLocation.longitude], 14, {
        animate: true,
        duration: 1.0,
      });
    }
  }, [selectedLocation]);

  // Sync markers with locations (including step numbers if location belongs to selected trip)
  useEffect(() => {
    if (!mapRef.current) return;

    // Clear existing markers
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];

    // Add pins for all locations
    locations.forEach((loc) => {
      // Check if location is part of the selected trip sequence
      const tripIndex = tripLocations.findIndex(l => l.id === loc.id);
      const stepBadgeHtml = tripIndex !== -1 
        ? `<div class="absolute -top-2.5 -right-2.5 bg-slate-900 border border-white text-white text-[9px] font-extrabold w-5 h-5 rounded-full flex items-center justify-center shadow-md z-30">${tripIndex + 1}</div>`
        : '';

      const customPinIcon = L.divIcon({
        className: 'custom-div-icon',
        html: `
          <div class="relative flex items-center justify-center">
            <span class="absolute inline-flex h-8 w-8 animate-ping rounded-full bg-emerald-400 opacity-30"></span>
            <div class="relative flex items-center justify-center h-6 w-6 rounded-full bg-emerald-600 border-2 border-white shadow-md text-white text-xs font-semibold">
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-map-pin"><path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
            </div>
            ${stepBadgeHtml}
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
        popupAnchor: [0, -10],
      });

      const marker = L.marker([loc.latitude, loc.longitude], { icon: customPinIcon })
        .addTo(mapRef.current);

      const imageTag = loc.images.length > 0 
        ? `<img src="${loc.images[0]}" class="w-full h-20 object-cover rounded-md mb-2" />` 
        : '';
        
      const popupContent = `
        <div class="font-sans text-xs w-48">
          ${imageTag}
          <h4 class="font-semibold text-gray-900 text-sm mb-1">${loc.name}</h4>
          ${loc.address ? `<p class="text-gray-500 mb-1 line-clamp-2">${loc.address}</p>` : ''}
          <div class="flex justify-between items-center mt-2 pt-2 border-t border-gray-100">
            <span class="text-[10px] text-gray-400 font-mono">${loc.latitude.toFixed(4)}, ${loc.longitude.toFixed(4)}</span>
            <button id="view-loc-${loc.id}" class="text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-2 py-1 rounded transition-colors">
              Details
            </button>
          </div>
        </div>
      `;

      marker.bindPopup(popupContent);

      marker.on('popupopen', () => {
        const btn = document.getElementById(`view-loc-${loc.id}`);
        if (btn) {
          btn.addEventListener('click', () => {
            onMarkerClick(loc);
            marker.closePopup();
          });
        }
      });

      markersRef.current.push(marker);
    });

    // Fit bounds if no specific location is selected and no trip is selected
    if (locations.length > 0 && !selectedLocation && !selectedTripId && mapRef.current) {
      const bounds = L.latLngBounds(locations.map(l => [l.latitude, l.longitude]));
      mapRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
    }
  }, [locations, selectedLocation, tripLocations, selectedTripId]);

  // Fit bounds specifically for the trip locations when a trip is selected
  useEffect(() => {
    if (!mapRef.current || !selectedTripId || tripLocations.length === 0) return;
    
    const bounds = L.latLngBounds(tripLocations.map(l => [l.latitude, l.longitude]));
    mapRef.current.fitBounds(bounds, { padding: [80, 80], maxZoom: 14 });
  }, [selectedTripId, trips]);

  // Render the D3 sequence polyline path on the SVG overlay
  const updatePath = () => {
    if (!mapRef.current || !svgRef.current) return;

    const points = tripLocations.map(loc => {
      try {
        const latlng = L.latLng(loc.latitude, loc.longitude);
        const containerPoint = mapRef.current.latLngToContainerPoint(latlng);
        return { x: containerPoint.x, y: containerPoint.y, id: loc.id };
      } catch (err) {
        return null;
      }
    }).filter((p): p is { x: number; y: number; id: string } => p !== null);

    const svg = d3.select(svgRef.current);

    if (points.length < 2) {
      // Remove all route visuals if fewer than 2 points are rendered
      svg.selectAll('.trip-path-bg').remove();
      svg.selectAll('.trip-path-fg').remove();
      svg.selectAll('.trip-path-point-pulse').remove();
      return;
    }

    const lineGenerator = d3.line<{ x: number; y: number }>()
      .x(d => d.x)
      .y(d => d.y)
      .curve(d3.curveCatmullRom.alpha(0.5));

    const pathData = lineGenerator(points) || '';

    // Thick blurred background glow path
    const bgPath = svg.selectAll<SVGPathElement, any>('.trip-path-bg').data([points]);
    bgPath.enter()
      .append('path')
      .attr('class', 'trip-path-bg')
      .merge(bgPath as any)
      .attr('d', pathData)
      .attr('fill', 'none')
      .attr('stroke', '#10b981')
      .attr('stroke-width', 7)
      .attr('stroke-linecap', 'round')
      .attr('opacity', 0.22)
      .style('filter', 'blur(3px)');
    bgPath.exit().remove();

    // Foreground traveling-dashed path
    const fgPath = svg.selectAll<SVGPathElement, any>('.trip-path-fg').data([points]);
    fgPath.enter()
      .append('path')
      .attr('class', 'trip-path-fg')
      .merge(fgPath as any)
      .attr('d', pathData)
      .attr('fill', 'none')
      .attr('stroke', 'url(#trip-gradient)')
      .attr('stroke-width', 3.5)
      .attr('stroke-linecap', 'round')
      .attr('stroke-linejoin', 'round')
      .attr('stroke-dasharray', '10, 8')
      .style('animation', 'travel-dash 2s linear infinite');
    fgPath.exit().remove();

    // Small pulsing indicator on the final destination spot
    const lastPoint = [points[points.length - 1]];
    const endPulse = svg.selectAll<SVGCircleElement, any>('.trip-path-point-pulse').data(lastPoint, (d: any) => d.id);
    endPulse.enter()
      .append('circle')
      .attr('class', 'trip-path-point-pulse')
      .merge(endPulse as any)
      .attr('cx', d => d.x)
      .attr('cy', d => d.y)
      .attr('r', 12)
      .attr('fill', 'none')
      .attr('stroke', '#3b82f6')
      .attr('stroke-width', 2)
      .style('transform-origin', d => `${d.x}px ${d.y}px`)
      .style('animation', 'ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite');
    endPulse.exit().remove();
  };

  // Bind D3 updating to Leaflet map events for perfect alignment on zoom/panning
  useEffect(() => {
    if (!mapRef.current) return;

    updatePath();

    const handleMove = () => updatePath();
    mapRef.current.on('move', handleMove);
    mapRef.current.on('zoom', handleMove);
    mapRef.current.on('viewreset', handleMove);

    return () => {
      if (mapRef.current) {
        mapRef.current.off('move', handleMove);
        mapRef.current.off('zoom', handleMove);
        mapRef.current.off('viewreset', handleMove);
      }
    };
  }, [locations, selectedTripId, trips, tripLocations]);

  return (
    <div className="relative w-full h-full rounded-2xl overflow-hidden border border-gray-200/80 shadow-sm">
      <style>{`
        @keyframes travel-dash {
          to {
            stroke-dashoffset: -36;
          }
        }
        @keyframes ping {
          75%, 100% {
            transform: scale(1.8);
            opacity: 0;
          }
        }
      `}</style>

      {/* Leaflet Map */}
      <div ref={mapContainerRef} className="w-full h-full min-h-[350px]" id="map" />
      
      {/* Absolute SVG overlay layer for custom D3 polyline */}
      <svg 
        ref={svgRef} 
        className="absolute inset-0 pointer-events-none z-[400] w-full h-full"
      >
        <defs>
          <linearGradient id="trip-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#10b981" />
            <stop offset="50%" stopColor="#06b6d4" />
            <stop offset="100%" stopColor="#3b82f6" />
          </linearGradient>
        </defs>
      </svg>

      {/* Active Trip Path HUD overlay */}
      {selectedTripId && activeTrip && (
        <div className="absolute top-4 left-4 bg-white/95 backdrop-blur-md shadow-lg border border-gray-100 p-3.5 rounded-2xl text-xs text-gray-800 z-[500] max-w-[240px] flex flex-col gap-2 transition-all animate-fade-in pointer-events-auto">
          <div className="flex justify-between items-center gap-3">
            <span className="text-[10px] font-extrabold text-emerald-600 uppercase tracking-wider font-mono bg-emerald-50 px-2 py-0.5 rounded">
              Active Trip Route
            </span>
            {onSelectTrip && (
              <button 
                onClick={() => onSelectTrip(null)}
                className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-all cursor-pointer"
                title="Clear path"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <div>
            <h4 className="font-bold text-gray-900 truncate text-xs">{activeTrip.name}</h4>
            <p className="text-[10px] text-gray-400 mt-0.5 flex items-center gap-1">
              <span>✈️ {tripLocations.length} spots in sequence</span>
              {tripLocations.length > 1 && <span className="text-emerald-500 font-bold">• D3 Animated</span>}
            </p>
          </div>
        </div>
      )}

      {locations.length === 0 && (
        <div className="absolute top-4 left-4 bg-white/95 backdrop-blur-sm shadow-sm border border-gray-100 px-3 py-2 rounded-xl text-xs text-gray-600 flex items-center gap-2 pointer-events-none z-10">
          <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
          <span>Click anywhere on the map to pin a new location.</span>
        </div>
      )}
    </div>
  );
}
