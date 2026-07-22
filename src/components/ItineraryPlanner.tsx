import React, { useState, useEffect } from 'react';
import { Trip, ItineraryItem, SecureDocument, LocationItem } from '../types';
import { saveToStore, deleteFromStore, getAllFromStore } from '../db';
import { Calendar, Plus, Trash2, Clock, MapPin, Eye, FileText, Lock, Unlock, FileDown, ShieldAlert, Check } from 'lucide-react';

interface ItineraryPlannerProps {
  locations: LocationItem[];
  trips: Trip[];
  onTripsUpdated: () => void;
  selectedTripId?: string | null;
  onSelectTrip?: (tripId: string | null) => void;
}

export default function ItineraryPlanner({ 
  locations, 
  trips, 
  onTripsUpdated,
  selectedTripId,
  onSelectTrip,
}: ItineraryPlannerProps) {
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(() => {
    if (selectedTripId) {
      return trips.find(t => t.id === selectedTripId) || trips[0] || null;
    }
    return trips[0] || null;
  });

  // Sync selectedTrip state with prop selectedTripId
  useEffect(() => {
    if (selectedTripId) {
      const matched = trips.find(t => t.id === selectedTripId);
      if (matched && (!selectedTrip || selectedTrip.id !== selectedTripId)) {
        setSelectedTrip(matched);
      }
    } else if (selectedTripId === null && selectedTrip) {
      setSelectedTrip(null);
    }
  }, [selectedTripId, trips]);

  // Sync prop selectedTripId with local selectedTrip changes
  useEffect(() => {
    if (selectedTrip) {
      onSelectTrip?.(selectedTrip.id);
    } else {
      onSelectTrip?.(null);
    }
  }, [selectedTrip]);

  const [documents, setDocuments] = useState<SecureDocument[]>([]);
  const [isCreatingTrip, setIsCreatingTrip] = useState(false);
  const [isAddingItinerary, setIsAddingItinerary] = useState(false);
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);

  // New Trip form state
  const [newTripName, setNewTripName] = useState('');
  const [newTripStart, setNewTripStart] = useState('');
  const [newTripEnd, setNewTripEnd] = useState('');
  const [newTripDesc, setNewTripDesc] = useState('');

  // New Itinerary Event state
  const [eventDate, setEventDate] = useState('');
  const [eventTime, setEventTime] = useState('');
  const [eventTitle, setEventTitle] = useState('');
  const [eventDesc, setEventDesc] = useState('');
  const [eventLocId, setEventLocId] = useState('');

  // New Document Upload state
  const [docName, setDocName] = useState('');
  const [docType, setDocType] = useState<'ticket' | 'hotel' | 'id_document' | 'other'>('ticket');
  const [docFileBase64, setDocFileBase64] = useState<string | null>(null);
  const [docFileType, setDocFileType] = useState('');
  const [docIsSecure, setDocIsSecure] = useState(false);
  const [docNotes, setDocNotes] = useState('');

  // Passcode Vault state
  const [vaultPasscode, setVaultPasscode] = useState<string | null>(localStorage.getItem('vault_passcode'));
  const [isSettingPasscode, setIsSettingPasscode] = useState(false);
  const [passcodeInput, setPasscodeInput] = useState('');
  const [passcodeConfirm, setPasscodeConfirm] = useState('');
  const [passcodeVerified, setPasscodeVerified] = useState(false);
  const [unlockingDocId, setUnlockingDocId] = useState<string | null>(null);
  const [unlockError, setUnlockError] = useState(false);

  // Gemini AI Travel Planner States
  const [itineraryTab, setItineraryTab] = useState<'timeline' | 'ai'>('timeline');
  const [isGeneratingItinerary, setIsGeneratingItinerary] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [selectedLocsForAI, setSelectedLocsForAI] = useState<string[]>([]);

  // Automatically pre-check locations that are linked to the selected trip
  useEffect(() => {
    if (selectedTrip) {
      const linkedLocIds = locations.filter(l => l.tripId === selectedTrip.id).map(l => l.id);
      setSelectedLocsForAI(linkedLocIds);
    }
  }, [selectedTrip, locations]);

  const generateAIGuide = async () => {
    if (!selectedTrip) return;
    setIsGeneratingItinerary(true);
    setGenerationError(null);

    const chosenLocs = locations.filter(l => selectedLocsForAI.includes(l.id));

    try {
      const response = await fetch("/api/gemini/generate-itinerary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          locations: chosenLocs,
          tripDetails: {
            name: selectedTrip.name,
            description: selectedTrip.description,
            startDate: selectedTrip.startDate,
            endDate: selectedTrip.endDate,
          }
        })
      });

      if (!response.ok) {
        throw new Error("Failed to contact Gemini routing backend. Make sure your network is online.");
      }

      const data = await response.json();
      if (data.itinerary) {
        const updatedTrip = { ...selectedTrip, aiItinerary: data.itinerary };
        await saveToStore('trips', updatedTrip);
        onTripsUpdated();
        setSelectedTrip(updatedTrip);
      } else {
        throw new Error("No itinerary generated in response");
      }
    } catch (err: any) {
      console.error(err);
      setGenerationError(err.message || "Something went wrong.");
    } finally {
      setIsGeneratingItinerary(false);
    }
  };

  // Custom regex-based Markdown to JSX renderer
  const renderMarkdown = (md: string) => {
    if (!md) return null;
    return md.split('\n').map((line, idx) => {
      let trimmed = line.trim();
      if (trimmed.startsWith('### ')) {
        return <h4 key={idx} className="font-bold text-gray-800 text-sm mt-4 mb-2">{trimmed.replace('### ', '')}</h4>;
      }
      if (trimmed.startsWith('## ')) {
        return <h3 key={idx} className="font-bold text-gray-950 text-base mt-5 mb-2.5 border-b border-slate-100 pb-1">{trimmed.replace('## ', '')}</h3>;
      }
      if (trimmed.startsWith('# ')) {
        return <h2 key={idx} className="font-extrabold text-gray-950 text-lg mt-6 mb-3">{trimmed.replace('# ', '')}</h2>;
      }
      if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        let content = trimmed.substring(2);
        return (
          <li key={idx} className="ml-4 list-disc text-xs text-gray-600 mb-1 leading-relaxed">
            {parseBoldText(content)}
          </li>
        );
      }
      if (/^\d+\.\s/.test(trimmed)) {
        let content = trimmed.replace(/^\d+\.\s/, '');
        return (
          <li key={idx} className="ml-4 list-decimal text-xs text-slate-700 mb-1 leading-relaxed">
            {parseBoldText(content)}
          </li>
        );
      }
      if (trimmed === '') {
        return <div key={idx} className="h-2"></div>;
      }
      return <p key={idx} className="text-xs text-slate-600 mb-2 leading-relaxed">{parseBoldText(trimmed)}</p>;
    });
  };

  const parseBoldText = (text: string) => {
    const parts = text.split(/\*\*([^*]+)\*\*/g);
    return parts.map((part, i) => i % 2 === 1 ? <strong key={i} className="text-slate-900 font-bold">{part}</strong> : part);
  };

  // Sync selected trip when trips list updates
  useEffect(() => {
    if (trips.length > 0 && (!selectedTrip || !trips.find(t => t.id === selectedTrip.id))) {
      setSelectedTrip(trips[0]);
    }
  }, [trips]);

  // Fetch documents for the selected trip
  useEffect(() => {
    if (selectedTrip) {
      loadDocuments();
    } else {
      setDocuments([]);
    }
  }, [selectedTrip]);

  const loadDocuments = async () => {
    const allDocs = await getAllFromStore<SecureDocument>('documents');
    if (selectedTrip) {
      setDocuments(allDocs.filter(d => d.tripId === selectedTrip.id));
    }
  };

  const handleCreateTrip = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTripName || !newTripStart || !newTripEnd) return;

    const newTrip: Trip = {
      id: `trip-${Date.now()}`,
      name: newTripName,
      startDate: newTripStart,
      endDate: newTripEnd,
      description: newTripDesc,
      itinerary: [],
      createdAt: new Date().toISOString(),
    };

    await saveToStore('trips', newTrip);
    onTripsUpdated();
    setSelectedTrip(newTrip);
    setIsCreatingTrip(false);
    
    // Clear form
    setNewTripName('');
    setNewTripStart('');
    setNewTripEnd('');
    setNewTripDesc('');
  };

  const handleDeleteTrip = async (tripId: string) => {
    if (confirm('Are you sure you want to delete this trip and all its contents?')) {
      await deleteFromStore('trips', tripId);
      
      // Also delete associated documents
      const tripDocs = documents.filter(d => d.tripId === tripId);
      for (const d of tripDocs) {
        await deleteFromStore('documents', d.id);
      }

      onTripsUpdated();
      setSelectedTrip(null);
    }
  };

  const handleAddItinerary = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTrip || !eventTitle || !eventDate) return;

    const newEvent: ItineraryItem = {
      id: `event-${Date.now()}`,
      date: eventDate,
      time: eventTime,
      title: eventTitle,
      description: eventDesc,
      locationId: eventLocId || undefined,
    };

    const updatedTrip: Trip = {
      ...selectedTrip,
      itinerary: [...selectedTrip.itinerary, newEvent].sort((a, b) => {
        // Sort itinerary items by date and then by time
        const dateCompare = a.date.localeCompare(b.date);
        if (dateCompare !== 0) return dateCompare;
        return a.time.localeCompare(b.time);
      }),
    };

    await saveToStore('trips', updatedTrip);
    onTripsUpdated();
    setSelectedTrip(updatedTrip);
    setIsAddingItinerary(false);

    // Clear event form
    setEventDate('');
    setEventTime('');
    setEventTitle('');
    setEventDesc('');
    setEventLocId('');
  };

  const handleDeleteEvent = async (eventId: string) => {
    if (!selectedTrip) return;

    const updatedTrip: Trip = {
      ...selectedTrip,
      itinerary: selectedTrip.itinerary.filter((evt) => evt.id !== eventId),
    };

    await saveToStore('trips', updatedTrip);
    onTripsUpdated();
    setSelectedTrip(updatedTrip);
  };

  // Convert uploaded files to base64
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setDocFileType(file.type);
    if (!docName) {
      setDocName(file.name.split('.')[0]);
    }

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onloadend = () => {
      setDocFileBase64(reader.result as string);
    };
  };

  const handleUploadDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTrip || !docFileBase64 || !docName) return;

    const newDoc: SecureDocument = {
      id: `doc-${Date.now()}`,
      tripId: selectedTrip.id,
      name: docName,
      type: docType,
      fileBase64: docFileBase64,
      fileType: docFileType,
      isSecure: docIsSecure,
      notes: docNotes,
      createdAt: new Date().toISOString(),
    };

    await saveToStore('documents', newDoc);
    loadDocuments();
    setIsUploadingDoc(false);

    // Reset doc form
    setDocName('');
    setDocType('ticket');
    setDocFileBase64(null);
    setDocFileType('');
    setDocIsSecure(false);
    setDocNotes('');
  };

  const handleDeleteDocument = async (docId: string) => {
    if (confirm('Delete this travel document?')) {
      await deleteFromStore('documents', docId);
      loadDocuments();
    }
  };

  // Setup security passcode
  const handleSetPasscode = (e: React.FormEvent) => {
    e.preventDefault();
    if (passcodeInput.length !== 4 || passcodeInput !== passcodeConfirm) {
      alert('Passcodes must match and be exactly 4 digits.');
      return;
    }
    localStorage.setItem('vault_passcode', passcodeInput);
    setVaultPasscode(passcodeInput);
    setIsSettingPasscode(false);
    setPasscodeInput('');
    setPasscodeConfirm('');
    setPasscodeVerified(true);
  };

  const handleUnlockDocument = (e: React.FormEvent) => {
    e.preventDefault();
    if (passcodeInput === vaultPasscode) {
      setPasscodeVerified(true);
      setUnlockError(false);
      setUnlockingDocId(null);
      setPasscodeInput('');
    } else {
      setUnlockError(true);
      setPasscodeInput('');
    }
  };

  const initiateUnlock = (docId: string) => {
    if (passcodeVerified) {
      // Already verified session
      return;
    }
    setUnlockingDocId(docId);
    setUnlockError(false);
  };

  const lockVault = () => {
    setPasscodeVerified(false);
  };

  const formatEventDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full">
      {/* List of Trips Sidebar */}
      <div className="lg:col-span-4 bg-white border border-gray-200/80 p-5 rounded-2xl shadow-sm flex flex-col gap-4">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="font-bold text-gray-900 text-sm">Travel Itineraries</h3>
            <p className="text-xs text-gray-500 mt-0.5">Plan days and manage trip files.</p>
          </div>
          <button
            onClick={() => setIsCreatingTrip(true)}
            className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors"
            title="Create Trip"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {/* List */}
        <div className="flex flex-col gap-2 overflow-y-auto max-h-[300px] lg:max-h-[500px]">
          {trips.length === 0 ? (
            <div className="p-6 text-center border border-dashed border-gray-100 rounded-xl">
              <Calendar className="w-6 h-6 text-gray-300 mx-auto" />
              <p className="text-xs text-gray-500 font-medium mt-2">No itineraries created yet.</p>
              <button
                onClick={() => setIsCreatingTrip(true)}
                className="text-xs text-emerald-600 font-bold hover:underline mt-1"
              >
                Create a Trip
              </button>
            </div>
          ) : (
            trips.map((trip) => {
              const isSelected = selectedTrip?.id === trip.id;
              return (
                <div
                  key={trip.id}
                  onClick={() => setSelectedTrip(trip)}
                  className={`p-3.5 rounded-xl border text-left cursor-pointer transition-all flex justify-between items-center group ${
                    isSelected
                      ? 'border-emerald-600 bg-emerald-50/50 shadow-sm'
                      : 'border-gray-100 hover:bg-gray-50/50'
                  }`}
                >
                  <div className="min-w-0">
                    <h4 className="font-semibold text-gray-800 text-xs truncate">{trip.name}</h4>
                    <p className="text-[10px] text-gray-500 font-mono mt-0.5">
                      {new Date(trip.startDate).toLocaleDateString()} - {new Date(trip.endDate).toLocaleDateString()}
                    </p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteTrip(trip.id);
                    }}
                    className="p-1 text-gray-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* Create Trip Form Modal */}
        {isCreatingTrip && (
          <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-gray-100">
              <h4 className="font-bold text-gray-900 text-sm mb-4">Create New Travel Itinerary</h4>
              <form onSubmit={handleCreateTrip} className="flex flex-col gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-gray-600">Trip Name</label>
                  <input
                    type="text"
                    required
                    value={newTripName}
                    onChange={(e) => setNewTripName(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-gray-200 rounded-xl focus:outline-emerald-600 font-medium"
                    placeholder="E.g., Summer in Europe"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-gray-600">Start Date</label>
                    <input
                      type="date"
                      required
                      value={newTripStart}
                      onChange={(e) => setNewTripStart(e.target.value)}
                      className="w-full text-xs px-3 py-2 border border-gray-200 rounded-xl focus:outline-emerald-600 font-medium"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-gray-600">End Date</label>
                    <input
                      type="date"
                      required
                      value={newTripEnd}
                      onChange={(e) => setNewTripEnd(e.target.value)}
                      className="w-full text-xs px-3 py-2 border border-gray-200 rounded-xl focus:outline-emerald-600 font-medium"
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-gray-600">Description</label>
                  <textarea
                    value={newTripDesc}
                    onChange={(e) => setNewTripDesc(e.target.value)}
                    className="w-full h-16 text-xs px-3 py-2 border border-gray-200 rounded-xl focus:outline-emerald-600 font-medium resize-none"
                    placeholder="Notes, targets, goals..."
                  />
                </div>
                <div className="flex justify-end gap-2 mt-2">
                  <button
                    type="button"
                    onClick={() => setIsCreatingTrip(false)}
                    className="text-xs font-bold text-gray-500 hover:text-gray-700 px-3 py-2 rounded-xl border border-gray-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 px-4 py-2 rounded-xl"
                  >
                    Save Itinerary
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>

      {/* Trip Details Area */}
      <div className="lg:col-span-8 flex flex-col gap-6">
        {selectedTrip ? (
          <>
            {/* Header info */}
            <div className="bg-white border border-gray-200/80 p-5 rounded-2xl shadow-sm flex flex-col gap-1.5 relative">
              <h2 className="font-bold text-gray-900 text-base">{selectedTrip.name}</h2>
              <p className="text-xs text-gray-500 italic">{selectedTrip.description || 'No description provided.'}</p>
              <div className="flex items-center gap-3 mt-2 text-xs font-mono text-gray-400">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                  {formatEventDate(selectedTrip.startDate)} – {formatEventDate(selectedTrip.endDate)}
                </span>
              </div>
            </div>

            {/* Tabs Selector */}
            <div className="flex border-b border-gray-100 gap-1 mt-1 bg-white p-1 rounded-xl border border-gray-200/60 shadow-sm w-fit shrink-0">
              <button
                type="button"
                onClick={() => setItineraryTab('timeline')}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  itineraryTab === 'timeline'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                Timeline & Documents
              </button>
              <button
                type="button"
                onClick={() => setItineraryTab('ai')}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  itineraryTab === 'ai'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                <span>✨</span>
                Gemini AI Travel Guide
              </button>
            </div>

            {itineraryTab === 'timeline' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in">
                {/* Daily timeline */}
                <div className="bg-white border border-gray-200/80 p-5 rounded-2xl shadow-sm flex flex-col gap-4">
                  <div className="flex justify-between items-center">
                    <h3 className="font-bold text-gray-900 text-xs flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-emerald-600" />
                      Trip Timeline
                    </h3>
                    <button
                      onClick={() => setIsAddingItinerary(true)}
                      className="text-[10px] font-bold text-emerald-600 hover:text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg"
                    >
                      Add Event
                    </button>
                  </div>

                  {/* Itinerary Timeline List */}
                  <div className="flex-1 overflow-y-auto max-h-[350px] pr-1 flex flex-col gap-4 relative before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-gray-100">
                    {selectedTrip.itinerary.length === 0 ? (
                      <div className="py-12 text-center text-gray-400 flex flex-col items-center gap-2">
                        <Clock className="w-5 h-5 text-gray-300" />
                        <p className="text-xs">No events added to the timeline yet.</p>
                      </div>
                    ) : (
                      selectedTrip.itinerary.map((evt) => {
                        const linkedLoc = locations.find((l) => l.id === evt.locationId);
                        return (
                          <div key={evt.id} className="relative pl-7 group">
                            {/* Circle node indicator */}
                            <div className="absolute left-[9px] top-1.5 w-2.5 h-2.5 rounded-full border-2 border-white bg-emerald-500 ring-2 ring-emerald-500/20 shadow-sm"></div>

                            <div className="flex justify-between items-start">
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] font-bold text-emerald-600 font-mono uppercase bg-emerald-50 px-1.5 py-0.5 rounded">
                                    {evt.time || 'All Day'}
                                  </span>
                                  <span className="text-[10px] text-gray-400 font-mono">
                                    {new Date(evt.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                  </span>
                                </div>
                                <h4 className="font-semibold text-gray-800 text-xs mt-1">{evt.title}</h4>
                                {evt.description && (
                                  <p className="text-[11px] text-gray-500 mt-0.5">{evt.description}</p>
                                )}
                                {linkedLoc && (
                                  <div className="flex items-center gap-1 text-[10px] font-semibold text-emerald-700 mt-1.5 bg-emerald-50/50 rounded px-1.5 py-0.5 w-fit">
                                    <MapPin className="w-3 h-3 text-emerald-600" />
                                    <span>{linkedLoc.name}</span>
                                  </div>
                                )}
                              </div>
                              <button
                                onClick={() => handleDeleteEvent(evt.id)}
                                className="text-gray-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity p-1"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Secure Document Locker */}
                <div className="bg-white border border-gray-200/80 p-5 rounded-2xl shadow-sm flex flex-col gap-4">
                  <div className="flex justify-between items-center">
                    <h3 className="font-bold text-gray-900 text-xs flex items-center gap-1.5">
                      <Lock className="w-4 h-4 text-emerald-600" />
                      Trip Tickets & IDs
                    </h3>
                    <div className="flex gap-2">
                      {vaultPasscode && passcodeVerified && (
                        <button
                          onClick={lockVault}
                          className="text-[10px] font-bold text-rose-600 hover:text-rose-700 bg-rose-50 px-2 py-1 rounded"
                          title="Lock Sensitive Documents"
                        >
                          Lock
                        </button>
                      )}
                      <button
                        onClick={() => setIsUploadingDoc(true)}
                        className="text-[10px] font-bold text-emerald-600 hover:text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg"
                      >
                        Upload File
                      </button>
                    </div>
                  </div>

                  {/* Setup Passcode notice if sensitive items are saved but no passcode setup */}
                  {!vaultPasscode && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-2.5 text-[10px] text-amber-700 flex items-start gap-1.5">
                      <ShieldAlert className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold">ID Passcode is Unset</p>
                        <button
                          onClick={() => setIsSettingPasscode(true)}
                          className="underline font-semibold text-amber-800 hover:text-amber-900 mt-1 block"
                        >
                          Set up a security passcode now.
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Documents List */}
                  <div className="flex-1 overflow-y-auto max-h-[350px] pr-1 flex flex-col gap-2">
                    {documents.length === 0 ? (
                      <div className="py-12 text-center text-gray-400 flex flex-col items-center gap-2">
                        <FileText className="w-5 h-5 text-gray-300" />
                        <p className="text-xs">No documents uploaded for this trip yet.</p>
                      </div>
                    ) : (
                      documents.map((doc) => {
                        const isLocked = doc.isSecure && !passcodeVerified;
                        return (
                          <div
                            key={doc.id}
                            className="p-2.5 rounded-xl border border-gray-100 flex items-center justify-between gap-3 group relative hover:bg-gray-50/40"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center shrink-0 text-gray-500 border border-gray-100">
                                {isLocked ? (
                                  <Lock className="w-4 h-4 text-amber-600" />
                                ) : (
                                  <FileText className="w-4 h-4 text-emerald-600" />
                                )}
                              </div>
                              <div className="min-w-0">
                                <h4 className="font-bold text-gray-800 text-xs truncate flex items-center gap-1">
                                  {doc.name}
                                  {doc.isSecure && (
                                    <span className="bg-amber-100 text-amber-800 text-[8px] font-bold px-1 py-0.5 rounded shrink-0">
                                      Secure
                                    </span>
                                  )}
                                </h4>
                                <p className="text-[10px] text-gray-400 font-mono uppercase shrink-0">{doc.type}</p>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              {isLocked ? (
                                <button
                                  onClick={() => initiateUnlock(doc.id)}
                                  className="p-1.5 rounded-lg text-amber-600 hover:bg-amber-50 transition-colors"
                                  title="Unlock Document"
                                >
                                  <Lock className="w-3.5 h-3.5" />
                                </button>
                              ) : (
                                <a
                                  href={doc.fileBase64}
                                  download={`${doc.name}`}
                                  className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 transition-colors"
                                  title="Download Document"
                                >
                                  <FileDown className="w-3.5 h-3.5" />
                                </a>
                              )}
                              <button
                                onClick={() => handleDeleteDocument(doc.id)}
                                className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                                title="Delete Document"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            )}

            {itineraryTab === 'ai' && (
              <div className="bg-white border border-gray-200/80 p-5 rounded-2xl shadow-sm flex flex-col gap-4 animate-fade-in">
                <div className="flex justify-between items-start gap-4 flex-wrap">
                  <div>
                    <h3 className="font-bold text-gray-900 text-xs flex items-center gap-2">
                      <span className="text-emerald-600">✨</span>
                      Gemini Intelligent Travel Planner
                    </h3>
                    <p className="text-[11px] text-gray-500 mt-0.5">
                      Select your travel spots. Gemini will cluster them geographically and design an optimized itinerary.
                    </p>
                  </div>
                  <button
                    onClick={generateAIGuide}
                    disabled={isGeneratingItinerary || selectedLocsForAI.length === 0}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed text-white font-bold text-[11px] rounded-xl shadow-sm transition-all flex items-center gap-1.5"
                  >
                    {isGeneratingItinerary ? (
                      <>
                        <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        Planning Itinerary...
                      </>
                    ) : (
                      <>
                        <span>✨</span>
                        Generate Itinerary
                      </>
                    )}
                  </button>
                </div>

                {generationError && (
                  <div className="p-3 bg-red-50 border border-red-100 text-[11px] text-red-600 rounded-xl">
                    ⚠️ {generationError}
                  </div>
                )}

                {/* Spot Selection Box */}
                <div className="flex flex-col gap-1.5">
                  <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider font-mono">
                    Select Spots to Plan ({selectedLocsForAI.length} selected)
                  </span>
                  {locations.length === 0 ? (
                    <p className="text-[11px] text-gray-400 italic">No saved journal locations available.</p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-[140px] overflow-y-auto p-1.5 border border-gray-100 rounded-xl bg-gray-50/50">
                      {locations.map((loc) => {
                        const isChecked = selectedLocsForAI.includes(loc.id);
                        return (
                          <label
                            key={loc.id}
                            className={`p-2 rounded-lg border text-left text-[11px] cursor-pointer flex items-center gap-2.5 transition-all ${
                              isChecked
                                ? "border-emerald-500/30 bg-emerald-50/40 text-emerald-950 font-semibold"
                                : "border-gray-100 bg-white hover:bg-gray-50 text-gray-600"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedLocsForAI([...selectedLocsForAI, loc.id]);
                                } else {
                                  setSelectedLocsForAI(selectedLocsForAI.filter(id => id !== loc.id));
                                }
                              }}
                              className="accent-emerald-600 rounded"
                            />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-xs font-semibold">{loc.name}</p>
                              {loc.address && <p className="text-[9px] text-gray-400 truncate mt-0.5">{loc.address}</p>}
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Output Display Box */}
                <div className="border border-slate-100 rounded-xl bg-slate-50/40 p-4 flex flex-col gap-3 min-h-[200px]">
                  {isGeneratingItinerary ? (
                    <div className="flex-1 flex flex-col items-center justify-center py-12 gap-3 text-center">
                      <div className="relative w-10 h-10 flex items-center justify-center">
                        <div className="absolute inset-0 border-3 border-emerald-500/15 border-t-emerald-600 rounded-full animate-spin"></div>
                        <span className="text-base">✈️</span>
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-800">Gemini is planning your adventure...</p>
                        <p className="text-[10px] text-slate-400 mt-1 animate-pulse">
                          Clustering locations, predicting times, and compiling custom explorer tips
                        </p>
                      </div>
                    </div>
                  ) : selectedTrip.aiItinerary ? (
                    <div className="flex flex-col gap-3">
                      <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                        <span className="text-[9px] font-bold text-emerald-600 uppercase tracking-wider font-mono bg-emerald-50 px-2 py-0.5 rounded">
                          AI TRAVEL GUIDE PREVIEW
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(selectedTrip.aiItinerary || "");
                            alert("Bespoke AI Itinerary copied to clipboard!");
                          }}
                          className="text-[9px] font-bold text-slate-600 hover:text-slate-900 border border-slate-200 px-2 py-1 rounded-lg bg-white shadow-sm transition-all"
                        >
                          Copy Guide Markdown
                        </button>
                      </div>
                      <div className="text-slate-800 text-xs leading-relaxed max-h-[300px] overflow-y-auto pr-1">
                        {renderMarkdown(selectedTrip.aiItinerary)}
                      </div>
                    </div>
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center py-10 text-center text-slate-400 gap-1.5">
                      <span className="text-xl">🎒</span>
                      <p className="text-xs font-semibold">Ready to map your custom itinerary?</p>
                      <p className="text-[10px] text-slate-400 max-w-xs leading-normal">
                        Select your stops and click the "Generate Itinerary" button at the top right to build a bespoke day-by-day travel guide with Gemini AI.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="bg-white border border-gray-200/80 p-12 rounded-2xl shadow-sm text-center flex flex-col items-center justify-center gap-3">
            <Calendar className="w-10 h-10 text-emerald-600/40 animate-pulse" />
            <h3 className="font-bold text-gray-800 text-sm">Select or Create an Itinerary</h3>
            <p className="text-xs text-gray-500 max-w-sm">Use the left sidebar to select an itinerary or create a new trip to manage schedules and documents.</p>
          </div>
        )}

        {/* Add Itinerary Event Modal */}
        {isAddingItinerary && selectedTrip && (
          <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-gray-100">
              <h4 className="font-bold text-gray-900 text-sm mb-4">Add Event to Itinerary</h4>
              <form onSubmit={handleAddItinerary} className="flex flex-col gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-gray-600">Event Title</label>
                  <input
                    type="text"
                    required
                    value={eventTitle}
                    onChange={(e) => setEventTitle(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-gray-200 rounded-xl focus:outline-emerald-600 font-medium"
                    placeholder="E.g., Flight departure, Dinner"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-gray-600">Date</label>
                    <input
                      type="date"
                      required
                      min={selectedTrip.startDate}
                      max={selectedTrip.endDate}
                      value={eventDate}
                      onChange={(e) => setEventDate(e.target.value)}
                      className="w-full text-xs px-3 py-2 border border-gray-200 rounded-xl focus:outline-emerald-600 font-medium"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-gray-600">Time</label>
                    <input
                      type="time"
                      value={eventTime}
                      onChange={(e) => setEventTime(e.target.value)}
                      className="w-full text-xs px-3 py-2 border border-gray-200 rounded-xl focus:outline-emerald-600 font-medium"
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-gray-600">Link to Saved Location</label>
                  <select
                    value={eventLocId}
                    onChange={(e) => setEventLocId(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-gray-200 rounded-xl focus:outline-emerald-600 font-medium"
                  >
                    <option value="">-- Optional Location Pin --</option>
                    {locations.map((loc) => (
                      <option key={loc.id} value={loc.id}>
                        {loc.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-gray-600">Event Description</label>
                  <textarea
                    value={eventDesc}
                    onChange={(e) => setEventDesc(e.target.value)}
                    className="w-full h-16 text-xs px-3 py-2 border border-gray-200 rounded-xl focus:outline-emerald-600 font-medium resize-none"
                    placeholder="Terminal 2, Table reservation notes, etc."
                  />
                </div>
                <div className="flex justify-end gap-2 mt-2">
                  <button
                    type="button"
                    onClick={() => setIsAddingItinerary(false)}
                    className="text-xs font-bold text-gray-500 hover:text-gray-700 px-3 py-2 rounded-xl border border-gray-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 px-4 py-2 rounded-xl"
                  >
                    Add Event
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Upload Document Modal */}
        {isUploadingDoc && selectedTrip && (
          <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-gray-100">
              <h4 className="font-bold text-gray-900 text-sm mb-4">Upload Travel Document</h4>
              <form onSubmit={handleUploadDocument} className="flex flex-col gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-gray-600">File Attachment (PDF, Ticket Image, Passport photo)</label>
                  <input
                    type="file"
                    required
                    accept=".pdf,image/*"
                    onChange={handleFileChange}
                    className="w-full text-xs px-3 py-2 border border-gray-200 rounded-xl"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-gray-600">Document Name</label>
                  <input
                    type="text"
                    required
                    value={docName}
                    onChange={(e) => setDocName(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-gray-200 rounded-xl focus:outline-emerald-600 font-medium"
                    placeholder="E.g., Flight Ticket, Hotel Booking"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-gray-600">Document Category</label>
                    <select
                      value={docType}
                      onChange={(e) => setDocType(e.target.value as any)}
                      className="w-full text-xs px-3 py-2 border border-gray-200 rounded-xl focus:outline-emerald-600 font-medium"
                    >
                      <option value="ticket">Ticket</option>
                      <option value="hotel">Hotel Confirmation</option>
                      <option value="id_document">Identity Document</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1 justify-center pl-2">
                    <label className="flex items-center gap-2 cursor-pointer mt-4">
                      <input
                        type="checkbox"
                        checked={docIsSecure}
                        onChange={(e) => setDocIsSecure(e.target.checked)}
                        className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                      />
                      <span className="text-xs font-semibold text-gray-700">Lock with Passcode</span>
                    </label>
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-gray-600">Notes / Details</label>
                  <textarea
                    value={docNotes}
                    onChange={(e) => setDocNotes(e.target.value)}
                    className="w-full h-16 text-xs px-3 py-2 border border-gray-200 rounded-xl focus:outline-emerald-600 font-medium resize-none"
                    placeholder="Confirmation numbers, support phone, etc."
                  />
                </div>
                <div className="flex justify-end gap-2 mt-2">
                  <button
                    type="button"
                    onClick={() => setIsUploadingDoc(false)}
                    className="text-xs font-bold text-gray-500 hover:text-gray-700 px-3 py-2 rounded-xl border border-gray-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!docFileBase64}
                    className="text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 px-4 py-2 rounded-xl disabled:opacity-50"
                  >
                    Upload Document
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Set Passcode Modal */}
        {isSettingPasscode && (
          <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl max-w-xs w-full p-6 shadow-xl border border-gray-100 text-center">
              <Lock className="w-8 h-8 text-emerald-600 mx-auto mb-3" />
              <h4 className="font-bold text-gray-900 text-sm mb-2">Set Security Passcode</h4>
              <p className="text-xs text-gray-500 mb-4">Create a 4-digit numeric passcode to guard identity documents and booking files locally.</p>
              <form onSubmit={handleSetPasscode} className="flex flex-col gap-3">
                <input
                  type="password"
                  required
                  maxLength={4}
                  pattern="[0-9]{4}"
                  value={passcodeInput}
                  onChange={(e) => setPasscodeInput(e.target.value)}
                  className="w-full text-center text-lg tracking-widest py-2 border border-gray-200 rounded-xl focus:outline-emerald-600 font-bold"
                  placeholder="••••"
                />
                <input
                  type="password"
                  required
                  maxLength={4}
                  pattern="[0-9]{4}"
                  value={passcodeConfirm}
                  onChange={(e) => setPasscodeConfirm(e.target.value)}
                  className="w-full text-center text-lg tracking-widest py-2 border border-gray-200 rounded-xl focus:outline-emerald-600 font-bold"
                  placeholder="Confirm passcode"
                />
                <div className="flex justify-end gap-2 mt-2">
                  <button
                    type="button"
                    onClick={() => setIsSettingPasscode(false)}
                    className="text-xs font-bold text-gray-500 hover:text-gray-700 px-3 py-2 rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 px-4 py-2 rounded-xl"
                  >
                    Set Code
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Unlock Passcode Modal */}
        {unlockingDocId !== null && (
          <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl max-w-xs w-full p-6 shadow-xl border border-gray-100 text-center">
              <Lock className="w-8 h-8 text-amber-500 mx-auto mb-3 animate-bounce" />
              <h4 className="font-bold text-gray-900 text-sm mb-1">Enter Security Passcode</h4>
              <p className="text-xs text-gray-500 mb-4">Verify ownership to unlock travel identity files.</p>
              <form onSubmit={handleUnlockDocument} className="flex flex-col gap-3">
                <input
                  type="password"
                  required
                  maxLength={4}
                  pattern="[0-9]{4}"
                  autoFocus
                  value={passcodeInput}
                  onChange={(e) => setPasscodeInput(e.target.value)}
                  className="w-full text-center text-lg tracking-widest py-2 border border-gray-200 rounded-xl focus:outline-emerald-600 font-bold"
                  placeholder="••••"
                />
                {unlockError && (
                  <p className="text-[10px] text-red-600 font-bold">Incorrect passcode. Try again.</p>
                )}
                <div className="flex justify-end gap-2 mt-1">
                  <button
                    type="button"
                    onClick={() => setUnlockingDocId(null)}
                    className="text-xs font-bold text-gray-500 hover:text-gray-700 px-3 py-2 rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 px-4 py-2 rounded-xl"
                  >
                    Unlock
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
