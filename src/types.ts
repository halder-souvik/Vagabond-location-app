export interface VoiceNote {
  id: string;
  name: string;
  base64: string; // Stored in IndexedDB
  duration: number; // in seconds
  transcription?: string; // AI generated transcription
  createdAt: string;
}

export interface LocationItem {
  id: string;
  name: string;
  address?: string;
  latitude: number;
  longitude: number;
  notes: string;
  tripId?: string;
  images: string[]; // Base64 strings of images
  voiceNotes: VoiceNote[];
  tags: string[];
  createdAt: string;
}

export interface ItineraryItem {
  id: string;
  date: string;
  time: string;
  title: string;
  description: string;
  locationId?: string;
}

export interface Trip {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  description: string;
  itinerary: ItineraryItem[];
  aiItinerary?: string; // AI generated markdown travel guide
  createdAt: string;
}

export interface SecureDocument {
  id: string;
  tripId: string;
  name: string;
  type: 'ticket' | 'hotel' | 'id_document' | 'receipt' | 'other';
  fileBase64: string;
  fileType: string; // image/jpeg, image/png, application/pdf
  isSecure: boolean;
  createdAt: string;
  notes?: string;
}

export interface Expense {
  id: string;
  tripId: string;
  locationId?: string;
  title: string;
  amount: number;
  currency: string;
  category: 'food' | 'transport' | 'accommodation' | 'activities' | 'shopping' | 'other';
  date: string;
  notes: string;
  receiptBase64?: string;
  createdAt: string;
}
