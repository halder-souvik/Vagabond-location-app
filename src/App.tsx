import React, { useState, useEffect } from 'react';
import { getAllFromStore, saveToStore, deleteFromStore } from './db';
import { LocationItem, Trip, VoiceNote } from './types';
import MapComponent from './components/MapComponent';
import AudioRecorder from './components/AudioRecorder';
import ItineraryPlanner from './components/ItineraryPlanner';
import CollageStudio from './components/CollageStudio';
import ExpenseTracker from './components/ExpenseTracker';
import BackupManager from './components/BackupManager';
import { 
  Map, Calendar, Image as ImageIcon, CreditCard, CloudLightning, 
  Plus, Search, Tag, X, FileText, ChevronRight, Compass, Sparkles, 
  ArrowUpRight, Play, Pause, Trash2, Camera, MapPin, Check
} from 'lucide-react';

export default function App() {
  const [activeNav, setActiveNav] = useState<'map' | 'itinerary' | 'collage' | 'expenses' | 'backup'>('map');
  const [locations, setLocations] = useState<LocationItem[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
  
  // Location adding/editing modal
  const [isAddingLocation, setIsAddingLocation] = useState(false);
  const [activeLocationForDetail, setActiveLocationForDetail] = useState<LocationItem | null>(null);
  const [mapSelectedCoords, setMapSelectedCoords] = useState<{ lat: number; lng: number } | null>(null);

  // New location form fields
  const [newLocName, setNewLocName] = useState('');
  const [newLocAddress, setNewLocAddress] = useState('');
  const [newLocLat, setNewLocLat] = useState('');
  const [newLocLng, setNewLocLng] = useState('');
  const [newLocNotes, setNewLocNotes] = useState('');
  const [newLocTagInput, setNewLocTagInput] = useState('');
  const [newLocTags, setNewLocTags] = useState<string[]>([]);
  const [newLocImages, setNewLocImages] = useState<string[]>([]);
  const [newLocTripId, setNewLocTripId] = useState('');
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [voiceNotesList, setVoiceNotesList] = useState<VoiceNote[]>([]);

  // Quick import link box
  const [importText, setImportText] = useState('');
  const [importSuccessMsg, setImportSuccessMsg] = useState('');

  // Audio player state
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const audioPlayerRef = useState<HTMLAudioElement | null>(null);
  const [audioPlayerInstance, setAudioPlayerInstance] = useState<HTMLAudioElement | null>(null);
  const [transcribingIds, setTranscribingIds] = useState<string[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const allLocs = await getAllFromStore<LocationItem>('locations');
      const allTrips = await getAllFromStore<Trip>('trips');
      setLocations(allLocs.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
      setTrips(allTrips);
    } catch (e) {
      console.error('Failed to init IndexedDB storage. Using empty state.');
    }
  };

  const parseLocationText = (text: string) => {
    if (!text) return;
    
    // 1. Check for coordinates format like: 12.3456, 78.9101 or @12.3456,78.9101
    const coordRegex = /@?(-?\d+\.\d+),\s*(-?\d+\.\d+)/;
    const coordMatch = text.match(coordRegex);

    // 2. Try to parse Google Maps shared links
    // e.g. https://www.google.com/maps/place/Louvre+Museum/@48.8606111,2.337644
    const urlCoordsRegex = /@(-?\d+\.\d+),(-?\d+\.\d+)/;
    const urlCoordsMatch = text.match(urlCoordsRegex);

    let parsedLat = '';
    let parsedLng = '';
    let parsedName = '';

    if (urlCoordsMatch) {
      parsedLat = urlCoordsMatch[1];
      parsedLng = urlCoordsMatch[2];
    } else if (coordMatch) {
      parsedLat = coordMatch[1];
      parsedLng = coordMatch[2];
    }

    // Try to extract name from shared text
    // E.g., "Check this out: Louvre Museum on Google Maps" or "Louvre Cafe, Paris"
    if (text.includes('google.com/maps')) {
      const parts = text.split('/');
      const placePart = parts.find(p => p.includes('place'));
      if (placePart) {
        const placeName = parts[parts.indexOf(placePart) + 1];
        if (placeName) {
          parsedName = decodeURIComponent(placeName.replace(/\+/g, ' '));
        }
      }
    }

    if (!parsedName) {
      // General fallbacks: first sentence or first 25 characters
      const lines = text.split('\n');
      parsedName = lines[0]?.substring(0, 30) || 'Imported Spot';
    }

    setNewLocName(parsedName);
    setNewLocLat(parsedLat);
    setNewLocLng(parsedLng);
    setNewLocAddress(text.substring(0, 100)); // paste text as initial address hint
    setNewLocNotes(text);

    setImportSuccessMsg(`Detected Spot: "${parsedName}" at [${parsedLat || '?'}, ${parsedLng || '?'}]`);
    setTimeout(() => setImportSuccessMsg(''), 4000);

    // Open add modal
    setIsAddingLocation(true);
  };

  const handleMapClick = (lat: number, lng: number) => {
    setMapSelectedCoords({ lat, lng });
    setNewLocLat(lat.toFixed(6));
    setNewLocLng(lng.toFixed(6));
    setIsAddingLocation(true);
  };

  const handleAddTag = () => {
    const tag = newLocTagInput.trim().toLowerCase();
    if (tag && !newLocTags.includes(tag)) {
      setNewLocTags([...newLocTags, tag]);
    }
    setNewLocTagInput('');
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setNewLocTags(newLocTags.filter(t => t !== tagToRemove));
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    (Array.from(files) as File[]).forEach((file) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onloadend = () => {
        setNewLocImages((prev) => [...prev, reader.result as string]);
      };
    });
  };

  const handleRemoveImage = (indexToRemove: number) => {
    setNewLocImages(newLocImages.filter((_, idx) => idx !== indexToRemove));
  };

  const handleSaveVoiceNote = async (base64: string, duration: number) => {
    const tempId = `voice-${Date.now()}`;
    const newVoice: VoiceNote = {
      id: tempId,
      name: `Memo ${voiceNotesList.length + 1}`,
      base64,
      duration,
      createdAt: new Date().toISOString(),
    };
    
    setVoiceNotesList((prev) => [...prev, newVoice]);
    setIsRecordingVoice(false);

    // Auto-transcribe recording using Gemini
    setTranscribingIds((prev) => [...prev, tempId]);
    try {
      const response = await fetch("/api/gemini/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audioBase64: base64 }),
      });
      const data = await response.json();
      if (data.text) {
        setVoiceNotesList((prev) =>
          prev.map((v) => (v.id === tempId ? { ...v, transcription: data.text } : v))
        );
      } else {
        setVoiceNotesList((prev) =>
          prev.map((v) => (v.id === tempId ? { ...v, transcription: "No audible speech detected." } : v))
        );
      }
    } catch (err) {
      console.error("Transcription background sync failed:", err);
      setVoiceNotesList((prev) =>
        prev.map((v) => (v.id === tempId ? { ...v, transcription: "Transcription failed." } : v))
      );
    } finally {
      setTranscribingIds((prev) => prev.filter((id) => id !== tempId));
    }
  };

  const handleSaveLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLocName || !newLocLat || !newLocLng) return;

    const newLocation: LocationItem = {
      id: activeLocationForDetail?.id || `loc-${Date.now()}`,
      name: newLocName,
      address: newLocAddress || undefined,
      latitude: parseFloat(newLocLat),
      longitude: parseFloat(newLocLng),
      notes: newLocNotes,
      tripId: newLocTripId || undefined,
      images: newLocImages,
      voiceNotes: voiceNotesList,
      tags: newLocTags,
      createdAt: activeLocationForDetail?.createdAt || new Date().toISOString(),
    };

    await saveToStore('locations', newLocation);
    loadData();
    setIsAddingLocation(false);
    setActiveLocationForDetail(null);
    resetForm();
  };

  const handleDeleteLocation = async (locId: string) => {
    if (confirm('Delete this saved spot from your travel journal?')) {
      await deleteFromStore('locations', locId);
      loadData();
      setActiveLocationForDetail(null);
    }
  };

  const resetForm = () => {
    setNewLocName('');
    setNewLocAddress('');
    setNewLocLat('');
    setNewLocLng('');
    setNewLocNotes('');
    setNewLocTags([]);
    setNewLocImages([]);
    setNewLocTripId('');
    setVoiceNotesList([]);
    setMapSelectedCoords(null);
    setIsRecordingVoice(false);
    setActiveLocationForDetail(null);
  };

  const openEditLocation = (loc: LocationItem) => {
    setActiveLocationForDetail(null); // Close detail view
    setNewLocName(loc.name);
    setNewLocAddress(loc.address || '');
    setNewLocLat(loc.latitude.toString());
    setNewLocLng(loc.longitude.toString());
    setNewLocNotes(loc.notes);
    setNewLocTags(loc.tags);
    setNewLocImages(loc.images);
    setNewLocTripId(loc.tripId || '');
    setVoiceNotesList(loc.voiceNotes);
    setActiveLocationForDetail(loc); // Keep reference to replace
    setIsAddingLocation(true);
  };

  const playVoiceNote = (vn: VoiceNote) => {
    if (audioPlayerInstance) {
      audioPlayerInstance.pause();
    }

    if (playingVoiceId === vn.id) {
      setPlayingVoiceId(null);
      setAudioPlayerInstance(null);
      return;
    }

    const player = new Audio(vn.base64);
    player.onended = () => {
      setPlayingVoiceId(null);
      setAudioPlayerInstance(null);
    };
    player.play();
    setPlayingVoiceId(vn.id);
    setAudioPlayerInstance(player);
  };

  const filteredLocations = locations.filter((loc) => {
    const matchesSearch = 
      loc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      loc.notes.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (loc.address && loc.address.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesTag = selectedTag ? loc.tags.includes(selectedTag) : true;
    
    return matchesSearch && matchesTag;
  });

  // Extract all unique tags
  const uniqueTags: string[] = [];
  locations.forEach((loc) => {
    loc.tags.forEach((tag) => {
      if (!uniqueTags.includes(tag)) uniqueTags.push(tag);
    });
  });

  return (
    <div className="flex flex-col lg:flex-row h-screen w-screen overflow-hidden bg-[#f4f7fb] font-sans antialiased text-gray-800">
      
      {/* Brand Navigation Sidebar */}
      <aside className="w-full lg:w-64 bg-slate-900 text-slate-100 flex flex-col shrink-0 border-r border-slate-800">
        <div className="p-6 border-b border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Compass className="w-6 h-6 text-emerald-400 shrink-0" />
            <div>
              <h1 className="font-extrabold tracking-tight text-white text-base">VAGABOND</h1>
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest font-mono">Location Journal</span>
            </div>
          </div>
          <span className="bg-slate-800/80 border border-slate-700/50 text-slate-400 font-mono text-[9px] px-2 py-0.5 rounded-full font-bold">
            v1.0
          </span>
        </div>

        {/* Nav Links */}
        <nav className="flex-1 px-4 py-6 flex flex-col gap-1.5">
          <button
            onClick={() => { setActiveNav('map'); loadData(); }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-semibold tracking-wide transition-all ${
              activeNav === 'map'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/10'
                : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
            }`}
          >
            <Map className="w-4 h-4 shrink-0" />
            Location Board
          </button>

          <button
            onClick={() => { setActiveNav('itinerary'); loadData(); }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-semibold tracking-wide transition-all ${
              activeNav === 'itinerary'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/10'
                : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
            }`}
          >
            <Calendar className="w-4 h-4 shrink-0" />
            Trip Planner
          </button>

          <button
            onClick={() => { setActiveNav('collage'); loadData(); }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-semibold tracking-wide transition-all ${
              activeNav === 'collage'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/10'
                : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
            }`}
          >
            <ImageIcon className="w-4 h-4 shrink-0" />
            Memories Collage
          </button>

          <button
            onClick={() => { setActiveNav('expenses'); loadData(); }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-semibold tracking-wide transition-all ${
              activeNav === 'expenses'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/10'
                : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
            }`}
          >
            <CreditCard className="w-4 h-4 shrink-0" />
            Expenditure Ledger
          </button>

          <button
            onClick={() => { setActiveNav('backup'); loadData(); }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-semibold tracking-wide transition-all ${
              activeNav === 'backup'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/10'
                : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
            }`}
          >
            <CloudLightning className="w-4 h-4 shrink-0" />
            Backup & Sync
          </button>
        </nav>

        {/* Sidebar Footer */}
        <div className="p-5 border-t border-slate-800 bg-slate-950/40 text-slate-500 font-serif text-[10px] italic flex flex-col gap-1 text-center">
          <p>“To travel is to live.”</p>
          <span className="text-[9px] font-mono uppercase tracking-widest text-emerald-500 font-bold">Hans Christian Andersen</span>
        </div>
      </aside>

      {/* Main Workspace Frame */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <header className="bg-white border-b border-gray-100 py-4 px-6 flex justify-between items-center shrink-0">
          <h2 className="font-extrabold text-slate-800 text-sm tracking-wide uppercase font-sans">
            {activeNav === 'map' && 'Location Board & Journal'}
            {activeNav === 'itinerary' && 'Travel Timeline & Itinerary'}
            {activeNav === 'collage' && 'Memories Photo Collage Studio'}
            {activeNav === 'expenses' && 'Receipt Locker & Expenditure Logs'}
            {activeNav === 'backup' && 'System Backup & Security Sync'}
          </h2>
          
          {/* Quick Stats on header */}
          <div className="flex gap-4 text-xs font-mono">
            <span className="text-gray-400 font-semibold">📍 <strong className="text-slate-700">{locations.length}</strong> spots</span>
            <span className="text-gray-400 font-semibold">🚢 <strong className="text-slate-700">{trips.length}</strong> trips</span>
          </div>
        </header>

        <div className="flex-1 p-6 min-h-0">
          
          {/* 1. LOCATION BOARD VIEW */}
          {activeNav === 'map' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full">
              
              {/* Journal sidebar of location logs */}
              <div className="lg:col-span-4 bg-white border border-gray-200/80 p-5 rounded-2xl shadow-sm flex flex-col gap-4 max-h-[750px]">
                
                {/* Search / Filters */}
                <div className="flex flex-col gap-3">
                  <div>
                    <h3 className="font-bold text-gray-900 text-sm">Travel Diary Log</h3>
                    <p className="text-xs text-gray-500 mt-0.5">Explore pinned markers or import shared spots.</p>
                  </div>

                  {/* WhatsApp/Telegram Paste Input */}
                  <div className="flex flex-col gap-1.5 bg-slate-50/50 p-3 rounded-xl border border-gray-100">
                    <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider font-mono">
                      WhatsApp / Maps Import
                    </span>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Paste shared text or link..."
                        value={importText}
                        onChange={(e) => setImportText(e.target.value)}
                        className="flex-1 text-xs px-2.5 py-1.5 border border-gray-200 bg-white rounded-lg focus:outline-emerald-600"
                      />
                      <button
                        onClick={() => { parseLocationText(importText); setImportText(''); }}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-3 py-1.5 rounded-lg shrink-0"
                      >
                        Import
                      </button>
                    </div>
                    {importSuccessMsg && (
                      <p className="text-[10px] text-emerald-700 font-bold animate-pulse">{importSuccessMsg}</p>
                    )}
                  </div>

                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-3" />
                    <input
                      type="text"
                      placeholder="Search locations..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full text-xs pl-9 pr-3 py-2 border border-gray-200 rounded-xl focus:outline-emerald-600 font-medium"
                    />
                  </div>

                  {/* Filter tags panel */}
                  {uniqueTags.length > 0 && (
                    <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
                      <button
                        onClick={() => setSelectedTag(null)}
                        className={`text-[10px] font-bold px-2.5 py-1 rounded-full border shrink-0 ${
                          !selectedTag
                            ? 'bg-emerald-600 border-emerald-600 text-white'
                            : 'bg-white border-gray-200 hover:bg-gray-50 text-gray-600'
                        }`}
                      >
                        All
                      </button>
                      {uniqueTags.map((tag) => (
                        <button
                          key={tag}
                          onClick={() => setSelectedTag(tag === selectedTag ? null : tag)}
                          className={`text-[10px] font-bold px-2.5 py-1 rounded-full border shrink-0 flex items-center gap-1 ${
                            tag === selectedTag
                              ? 'bg-emerald-600 border-emerald-600 text-white'
                              : 'bg-white border-gray-200 hover:bg-gray-50 text-gray-600'
                          }`}
                        >
                          <Tag className="w-2.5 h-2.5" />
                          {tag}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Trip Route Visualizer Selector */}
                  {trips.length > 0 && (
                    <div className="flex flex-col gap-1.5 bg-slate-50/70 p-2.5 rounded-xl border border-gray-100 mt-1">
                      <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider font-mono">
                        Visualize Trip Route (D3 Path)
                      </label>
                      <select
                        value={selectedTripId || ''}
                        onChange={(e) => setSelectedTripId(e.target.value || null)}
                        className="w-full text-xs px-2.5 py-1.5 border border-gray-200 bg-white rounded-lg focus:outline-emerald-600 font-semibold text-slate-700"
                      >
                        <option value="">-- Select Trip Path --</option>
                        {trips.map((t) => (
                          <option key={t.id} value={t.id}>
                            ✈️ {t.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                {/* Locations list */}
                <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-2.5">
                  {filteredLocations.length === 0 ? (
                    <div className="py-12 text-center text-gray-400 border border-dashed border-gray-100 rounded-2xl">
                      <MapPin className="w-6 h-6 text-gray-300 mx-auto" />
                      <p className="text-xs font-semibold mt-2">No travel logs found.</p>
                      <button
                        onClick={() => setIsAddingLocation(true)}
                        className="text-xs text-emerald-600 font-bold hover:underline mt-1"
                      >
                        Add Spot Manually
                      </button>
                    </div>
                  ) : (
                    filteredLocations.map((loc) => (
                      <div
                        key={loc.id}
                        onClick={() => setActiveLocationForDetail(loc)}
                        className={`p-3 rounded-xl border border-gray-100 hover:bg-gray-50/40 text-left cursor-pointer transition-all flex gap-3 ${
                          activeLocationForDetail?.id === loc.id ? 'border-emerald-600 bg-emerald-50/30' : ''
                        }`}
                      >
                        {/* Thumbnail */}
                        <div className="w-12 h-12 rounded-lg bg-gray-50 overflow-hidden shrink-0 border border-gray-100 flex items-center justify-center">
                          {loc.images.length > 0 ? (
                            <img src={loc.images[0]} className="w-full h-full object-cover" />
                          ) : (
                            <MapPin className="w-4 h-4 text-gray-400" />
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <h4 className="font-bold text-gray-800 text-xs truncate">{loc.name}</h4>
                          <p className="text-[10px] text-gray-400 truncate mt-0.5">{loc.address || 'No address logged'}</p>
                          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                            <span className="text-[9px] font-mono text-gray-400 uppercase font-semibold">
                              {new Date(loc.createdAt).toLocaleDateString()}
                            </span>
                            {loc.tags.slice(0, 2).map((t) => (
                              <span key={t} className="bg-emerald-50 border border-emerald-100 text-emerald-800 text-[8px] font-extrabold px-1.5 py-0.5 rounded">
                                {t}
                              </span>
                            ))}
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-gray-400 my-auto" />
                      </div>
                    ))
                  )}
                </div>

                {/* Add Spot Manual button */}
                <button
                  onClick={() => setIsAddingLocation(true)}
                  className="w-full mt-auto bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2.5 px-4 rounded-xl shadow-sm text-xs flex items-center justify-center gap-2 transition-all"
                >
                  <Plus className="w-4 h-4" /> Add Pinned Location
                </button>
              </div>

              {/* Map Canvas */}
              <div className="lg:col-span-8 flex flex-col h-[500px] lg:h-full min-h-[450px]">
                <MapComponent
                  locations={locations}
                  selectedLocation={activeLocationForDetail}
                  onMapClick={handleMapClick}
                  onMarkerClick={(loc) => setActiveLocationForDetail(loc)}
                  selectedTripId={selectedTripId}
                  trips={trips}
                  onSelectTrip={setSelectedTripId}
                />
              </div>
            </div>
          )}

          {/* 2. TRIP TIMELINE VIEW */}
          {activeNav === 'itinerary' && (
            <ItineraryPlanner 
              locations={locations} 
              trips={trips} 
              onTripsUpdated={loadData} 
              selectedTripId={selectedTripId}
              onSelectTrip={setSelectedTripId}
            />
          )}

          {/* 3. MEMORIES COLLAGE VIEW */}
          {activeNav === 'collage' && (
            <CollageStudio locations={locations} />
          )}

          {/* 4. EXPENDITURE LEDGER VIEW */}
          {activeNav === 'expenses' && (
            <ExpenseTracker trips={trips} locations={locations} />
          )}

          {/* 5. BACKUP & SYNC VIEW */}
          {activeNav === 'backup' && (
            <BackupManager onRestored={loadData} />
          )}
        </div>
      </main>

      {/* LOCATION DETAILS DRAWER MODAL */}
      {activeLocationForDetail && !isAddingLocation && (
        <div className="fixed inset-y-0 right-0 w-full max-w-md bg-white border-l border-gray-100 shadow-2xl z-40 flex flex-col animate-slide-in">
          {/* Header */}
          <div className="p-5 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MapPin className="w-5 h-5 text-emerald-600 shrink-0" />
              <div>
                <h3 className="font-extrabold text-gray-900 text-sm">Travel Log Detail</h3>
                <p className="text-[10px] text-gray-400 font-mono mt-0.5">ID: {activeLocationForDetail.id}</p>
              </div>
            </div>
            <button
              onClick={() => setActiveLocationForDetail(null)}
              className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <X className="w-4 h-4 text-gray-500" />
            </button>
          </div>

          {/* Scrollable details */}
          <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-5">
            {/* Images Showcase Carousel/Strip */}
            {activeLocationForDetail.images.length > 0 ? (
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
                {activeLocationForDetail.images.map((img, idx) => (
                  <div key={idx} className="relative w-full aspect-[4/3] rounded-xl overflow-hidden bg-gray-50 shrink-0 border border-gray-100">
                    <img src={img} className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="w-full aspect-[16/9] bg-gray-50 border border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center gap-1.5 text-center p-4">
                <Camera className="w-6 h-6 text-gray-300" />
                <span className="text-xs text-gray-500 font-semibold">No pictures uploaded</span>
              </div>
            )}

            {/* Basic Info */}
            <div className="flex flex-col gap-1">
              <h2 className="font-extrabold text-gray-900 text-base">{activeLocationForDetail.name}</h2>
              {activeLocationForDetail.address && (
                <p className="text-xs text-gray-500 flex items-start gap-1">
                  <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0 mt-0.5" />
                  <span>{activeLocationForDetail.address}</span>
                </p>
              )}
              <code className="text-[10px] text-gray-400 font-mono mt-1">
                Coords: {activeLocationForDetail.latitude.toFixed(6)}, {activeLocationForDetail.longitude.toFixed(6)}
              </code>
            </div>

            {/* Tags */}
            {activeLocationForDetail.tags.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider font-mono">Category Tags</span>
                <div className="flex flex-wrap gap-1.5">
                  {activeLocationForDetail.tags.map((tag) => (
                    <span key={tag} className="bg-emerald-50 border border-emerald-100 text-emerald-800 text-[10px] font-extrabold px-2.5 py-1 rounded-full">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Voice Memos List */}
            {activeLocationForDetail.voiceNotes.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider font-mono">Voice Notes</span>
                <div className="flex flex-col gap-2">
                  {activeLocationForDetail.voiceNotes.map((vn) => {
                    const isPlaying = playingVoiceId === vn.id;
                    const isTranscribing = transcribingIds.includes(vn.id);
                    return (
                      <div key={vn.id} className="p-2.5 bg-gray-50 rounded-xl border border-gray-200/60 flex flex-col gap-1.5">
                        <div className="flex justify-between items-center w-full">
                          <span className="text-xs font-semibold text-gray-700">{vn.name}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-gray-400 font-mono">{vn.duration}s</span>
                            <button
                              onClick={() => playVoiceNote(vn)}
                              className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors"
                            >
                              {isPlaying ? <Pause className="w-3.5 h-3.5 fill-emerald-600" /> : <Play className="w-3.5 h-3.5 fill-emerald-600" />}
                            </button>
                          </div>
                        </div>
                        {isTranscribing ? (
                          <div className="flex items-center gap-1 text-[9px] text-emerald-600 font-bold italic animate-pulse">
                            <span className="w-1 h-1 bg-emerald-500 rounded-full animate-ping"></span>
                            Transcribing audio...
                          </div>
                        ) : vn.transcription ? (
                          <div className="text-[10px] text-slate-500 bg-white border border-slate-100 p-2 rounded-xl italic font-normal leading-relaxed">
                            "{vn.transcription}"
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Journal Notes */}
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider font-mono">Journal Note</span>
              <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl text-xs text-gray-700 whitespace-pre-wrap leading-relaxed">
                {activeLocationForDetail.notes || 'No journal entries noted yet.'}
              </div>
            </div>
          </div>

          {/* Footer controls */}
          <div className="p-5 border-t border-gray-100 flex gap-2.5 bg-gray-50/50">
            <button
              onClick={() => openEditLocation(activeLocationForDetail)}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2 px-3 rounded-xl shadow-sm text-xs transition-all"
            >
              Edit Log
            </button>
            <button
              onClick={() => handleDeleteLocation(activeLocationForDetail.id)}
              className="bg-white border border-gray-200 hover:bg-red-50 hover:border-red-200 hover:text-red-600 text-gray-500 font-semibold py-2 px-3 rounded-xl shadow-sm text-xs transition-all"
            >
              Delete
            </button>
          </div>
        </div>
      )}

      {/* ADD / EDIT LOCATION MODAL */}
      {isAddingLocation && (
        <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-gray-100 max-h-[90vh] overflow-y-auto flex flex-col gap-4">
            <div className="flex justify-between items-center">
              <h4 className="font-extrabold text-gray-900 text-sm">
                {activeLocationForDetail ? 'Edit Saved Travel Spot' : 'Pin New Travel Spot'}
              </h4>
              <button onClick={() => { setIsAddingLocation(false); resetForm(); }} className="p-1.5 rounded-lg hover:bg-gray-100">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>

            <form onSubmit={handleSaveLocation} className="flex flex-col gap-3.5">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-gray-600">Spot Name / Title</label>
                <input
                  type="text"
                  required
                  value={newLocName}
                  onChange={(e) => setNewLocName(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-gray-200 rounded-xl focus:outline-emerald-600 font-medium"
                  placeholder="E.g., Eiffel Tower, Louvre Cafe"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-gray-600">Latitude</label>
                  <input
                    type="number"
                    step="0.000001"
                    required
                    value={newLocLat}
                    onChange={(e) => setNewLocLat(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-gray-200 rounded-xl focus:outline-emerald-600 font-medium font-mono"
                    placeholder="0.0000"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-gray-600">Longitude</label>
                  <input
                    type="number"
                    step="0.000001"
                    required
                    value={newLocLng}
                    onChange={(e) => setNewLocLng(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-gray-200 rounded-xl focus:outline-emerald-600 font-medium font-mono"
                    placeholder="0.0000"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-gray-600">Address Details (Optional)</label>
                <input
                  type="text"
                  value={newLocAddress}
                  onChange={(e) => setNewLocAddress(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-gray-200 rounded-xl focus:outline-emerald-600 font-medium"
                  placeholder="Street, City, State..."
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-gray-600">Link to Trip Itinerary</label>
                  <select
                    value={newLocTripId}
                    onChange={(e) => setNewLocTripId(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-gray-200 rounded-xl focus:outline-emerald-600 font-medium"
                  >
                    <option value="">-- No Association --</option>
                    {trips.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
                
                {/* Category tags */}
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-gray-600">Add Tags</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="e.g. food, hike"
                      value={newLocTagInput}
                      onChange={(e) => setNewLocTagInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddTag(); } }}
                      className="flex-1 text-xs px-3 py-2 border border-gray-200 rounded-xl focus:outline-emerald-600"
                    />
                    <button
                      type="button"
                      onClick={handleAddTag}
                      className="bg-emerald-50 text-emerald-600 border border-emerald-100 font-bold px-3 py-1.5 rounded-xl text-xs hover:bg-emerald-100"
                    >
                      Add
                    </button>
                  </div>
                </div>
              </div>

              {/* Display tags list */}
              {newLocTags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 p-1">
                  {newLocTags.map((tag) => (
                    <span key={tag} className="bg-emerald-50 border border-emerald-100 text-emerald-800 text-[10px] font-extrabold px-2 py-0.5 rounded-full flex items-center gap-1">
                      {tag}
                      <button type="button" onClick={() => handleRemoveTag(tag)} className="text-emerald-700 font-bold hover:text-red-600">
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}

              {/* Upload pictures */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-gray-600">Upload Pictures</label>
                <div className="flex items-center gap-3">
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="text-xs text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100 file:cursor-pointer"
                  />
                </div>
                {newLocImages.length > 0 && (
                  <div className="flex gap-2 overflow-x-auto py-2 scrollbar-thin">
                    {newLocImages.map((img, idx) => (
                      <div key={idx} className="relative w-14 h-14 rounded-lg overflow-hidden shrink-0 border border-gray-200">
                        <img src={img} className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => handleRemoveImage(idx)}
                          className="absolute top-0 right-0 bg-red-600 text-white rounded-full p-0.5 hover:bg-red-700"
                        >
                          <X className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Audio voice memos */}
              <div className="flex flex-col gap-1">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-semibold text-gray-600">Voice Memos ({voiceNotesList.length})</label>
                  <button
                    type="button"
                    onClick={() => setIsRecordingVoice(!isRecordingVoice)}
                    className="text-[10px] font-bold text-emerald-600 hover:text-emerald-700"
                  >
                    {isRecordingVoice ? 'Hide Recorder' : 'Record Memo'}
                  </button>
                </div>

                {isRecordingVoice && (
                  <AudioRecorder onSave={handleSaveVoiceNote} onCancel={() => setIsRecordingVoice(false)} />
                )}

                {voiceNotesList.length > 0 && (
                  <div className="flex flex-col gap-1.5 py-1">
                    {voiceNotesList.map((vn, idx) => {
                      const isTranscribing = transcribingIds.includes(vn.id);
                      return (
                        <div key={vn.id} className="text-[10px] font-semibold bg-gray-50 border border-gray-150 rounded-xl p-2 flex flex-col gap-1">
                          <div className="flex justify-between items-center">
                            <span className="text-gray-700 font-bold">{vn.name} ({vn.duration}s)</span>
                            <button
                              type="button"
                              onClick={() => setVoiceNotesList(voiceNotesList.filter((v) => v.id !== vn.id))}
                              className="text-red-500 font-bold hover:text-red-700 px-1"
                            >
                              ×
                            </button>
                          </div>
                          {isTranscribing ? (
                            <div className="flex items-center gap-1 text-[9px] text-emerald-600 font-bold italic animate-pulse">
                              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping text-[6px]">●</span>
                              Transcribing audio with Gemini...
                            </div>
                          ) : vn.transcription ? (
                            <p className="text-[10px] text-gray-500 bg-white border border-gray-100 p-1.5 rounded-lg italic font-normal leading-normal">
                              "{vn.transcription}"
                            </p>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Journal Notes */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-gray-600">Journal Note / Logs</label>
                <textarea
                  value={newLocNotes}
                  onChange={(e) => setNewLocNotes(e.target.value)}
                  className="w-full h-20 text-xs px-3 py-2 border border-gray-200 rounded-xl focus:outline-emerald-600 font-medium resize-none"
                  placeholder="Record your thoughts, cafe recommendations, tickets..."
                />
              </div>

              <div className="flex justify-end gap-2.5 mt-2">
                <button
                  type="button"
                  onClick={() => { setIsAddingLocation(false); resetForm(); }}
                  className="text-xs font-bold text-gray-500 hover:text-gray-700 px-3 py-2 rounded-xl border border-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 px-4 py-2 rounded-xl"
                >
                  {activeLocationForDetail ? 'Save Changes' : 'Pin Spot'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
