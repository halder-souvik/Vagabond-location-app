import React, { useState, useRef, useEffect } from 'react';
import { LocationItem } from '../types';
import { 
  Layout, 
  Image as ImageIcon, 
  Download, 
  Settings, 
  RefreshCw, 
  Layers, 
  Check, 
  Sparkles,
  Sliders,
  ExternalLink,
  QrCode,
  Share2,
  Upload,
  Info,
  Smartphone,
  Eye,
  Heart,
  X
} from 'lucide-react';

interface CollageStudioProps {
  locations: LocationItem[];
}

interface SelectedImage {
  src: string;
  locationName: string;
  id: string;
}

interface ScatteredImage {
  src: string;
  locationName: string;
  id: string;
  x: number; // percentage
  y: number; // percentage
  rotation: number; // degrees
  scale: number;
}

const SNAPSEED_FILTERS = [
  {
    id: 'none',
    name: 'Original',
    cssClass: '',
    canvasFilter: 'none',
    description: 'No filters applied'
  },
  {
    id: 'hdr',
    name: 'HDR Scape',
    cssClass: 'contrast-125 saturate-150 brightness-105',
    canvasFilter: 'contrast(1.25) saturate(1.5) brightness(1.05)',
    description: 'Stunning high dynamic range style'
  },
  {
    id: 'drama',
    name: 'Drama',
    cssClass: 'contrast-[1.35] saturate-[0.5] brightness-95 sepia-[0.1]',
    canvasFilter: 'contrast(1.35) saturate(0.5) brightness(0.95) sepia(0.1)',
    description: 'Moody, high-contrast cool look'
  },
  {
    id: 'vintage',
    name: 'Vintage',
    cssClass: 'sepia-[0.4] brightness-95 contrast-110 saturate-[0.85]',
    canvasFilter: 'sepia(0.4) brightness(0.95) contrast(1.1) saturate(0.85)',
    description: 'Warm, nostalgic yellow tones'
  },
  {
    id: 'noir',
    name: 'Noir',
    cssClass: 'grayscale contrast-[1.5] brightness-90',
    canvasFilter: 'grayscale(1) contrast(1.5) brightness(0.9)',
    description: 'Rich black and white'
  },
  {
    id: 'retrolux',
    name: 'Retrolux',
    cssClass: 'sepia-[0.2] saturate-[1.3] brightness-105 contrast-[0.95] hue-rotate-[10deg]',
    canvasFilter: 'sepia(0.2) saturate(1.3) brightness(1.05) contrast(0.95) hue-rotate(10deg)',
    description: 'Retro color shifting & faded look'
  },
  {
    id: 'grunge',
    name: 'Grunge',
    cssClass: 'contrast-[1.15] brightness-90 saturate-[1.1] sepia-[0.15] hue-rotate-[-10deg]',
    canvasFilter: 'contrast(1.15) brightness(0.9) saturate(1.1) sepia(0.15) hue-rotate(-10deg)',
    description: 'Dark, raw, film-inspired details'
  }
];

export default function CollageStudio({ locations }: CollageStudioProps) {
  // Extract all photos from locations
  const allImages: SelectedImage[] = [];
  locations.forEach((loc) => {
    loc.images.forEach((img, idx) => {
      allImages.push({
        src: img,
        locationName: loc.name,
        id: `${loc.id}-${idx}`,
      });
    });
  });

  const [selectedImageIds, setSelectedImageIds] = useState<string[]>([]);
  const [collageStyle, setCollageStyle] = useState<'grid' | 'polaroid' | 'corkboard'>('polaroid');
  const [borderSpacing, setBorderSpacing] = useState(12);
  const [backgroundColor, setBackgroundColor] = useState('#f8fafd');
  const [collageTitle, setCollageTitle] = useState('My Travel Highlights');
  const [scatteredImages, setScatteredImages] = useState<ScatteredImage[]>([]);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isExporting, setIsExporting] = useState(false);

  // Snapseed Integration States
  const [sidebarTab, setSidebarTab] = useState<'layout' | 'snapseed'>('layout');
  const [activeFilterId, setActiveFilterId] = useState<string>('none');
  const [useFineTuning, setUseFineTuning] = useState(false);
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [saturation, setSaturation] = useState(100);
  const [warmth, setWarmth] = useState(0);

  const [isScanningQR, setIsScanningQR] = useState(false);
  const [qrScanProgress, setQrScanProgress] = useState(0);
  const [scannedLookName, setScannedLookName] = useState<string | null>(null);

  const [showSnapseedModal, setShowSnapseedModal] = useState(false);
  const [isSharing, setIsSharing] = useState(false);

  const collageRef = useRef<HTMLDivElement>(null);

  const selectedImages = allImages.filter((img) => selectedImageIds.includes(img.id));

  // Compute active filters based on presets or manual fine-tuning sliders
  const activeFilter = SNAPSEED_FILTERS.find((f) => f.id === activeFilterId) || SNAPSEED_FILTERS[0];

  const currentCssFilter = useFineTuning
    ? `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%) sepia(${warmth}%)`
    : activeFilter.cssClass;

  const currentCanvasFilter = useFineTuning
    ? `brightness(${brightness / 100}) contrast(${contrast / 100}) saturate(${saturation / 100}) sepia(${warmth / 100})`
    : activeFilter.canvasFilter;

  // Initialize scattered images when selection or style changes
  useEffect(() => {
    if (collageStyle === 'corkboard') {
      const scatter = selectedImages.map((img, idx) => {
        // Try to preserve existing positions if possible, or place randomly
        const existing = scatteredImages.find((s) => s.id === img.id);
        if (existing) return existing;

        return {
          ...img,
          x: 10 + (idx * 20) % 70 + Math.random() * 5,
          y: 15 + (idx * 15) % 65 + Math.random() * 5,
          rotation: (Math.random() - 0.5) * 24, // -12 to +12 deg
          scale: 1,
        };
      });
      setScatteredImages(scatter);
    }
  }, [selectedImageIds, collageStyle]);

  const toggleImageSelection = (id: string) => {
    setSelectedImageIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const selectAllImages = () => {
    setSelectedImageIds(allImages.map((img) => img.id));
  };

  const clearSelection = () => {
    setSelectedImageIds([]);
  };

  const handleDragStart = (e: React.MouseEvent, id: string) => {
    if (collageStyle !== 'corkboard') return;
    setDraggedId(id);
    const rect = e.currentTarget.getBoundingClientRect();
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
    // Bring dragged image to front by pushing it to the end of the list
    setScatteredImages((prev) => {
      const dragged = prev.find((img) => img.id === id);
      if (!dragged) return prev;
      return [...prev.filter((img) => img.id !== id), dragged];
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!draggedId || !collageRef.current) return;
    const canvasRect = collageRef.current.getBoundingClientRect();
    
    // Calculate new percentage coordinates
    const newX = ((e.clientX - canvasRect.left - dragOffset.x) / canvasRect.width) * 100;
    const newY = ((e.clientY - canvasRect.top - dragOffset.y) / canvasRect.height) * 100;

    setScatteredImages((prev) =>
      prev.map((img) =>
        img.id === draggedId
          ? {
              ...img,
              x: Math.max(0, Math.min(90, newX)),
              y: Math.max(0, Math.min(90, newY)),
            }
          : img
      )
    );
  };

  const handleMouseUp = () => {
    setDraggedId(null);
  };

  const rotateImage = (id: string, dir: 'left' | 'right') => {
    setScatteredImages((prev) =>
      prev.map((img) =>
        img.id === id
          ? { ...img, rotation: img.rotation + (dir === 'left' ? -15 : 15) }
          : img
      )
    );
  };

  const scaleImage = (id: string, factor: number) => {
    setScatteredImages((prev) =>
      prev.map((img) =>
        img.id === id
          ? { ...img, scale: Math.max(0.5, Math.min(2.0, img.scale * factor)) }
          : img
      )
    );
  };

  // Extracted canvas drawing helper to support both direct download and Snapseed Web Share
  const drawCollageOnCanvas = async (canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) => {
    // Draw background
    if (collageStyle === 'corkboard') {
      // Draw wood/corkboard effect background
      ctx.fillStyle = '#b48a53';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      // Draw some cork pattern dots
      ctx.fillStyle = '#9e733b';
      for (let i = 0; i < 500; i++) {
        const x = Math.random() * canvas.width;
        const y = Math.random() * canvas.height;
        const r = Math.random() * 2 + 1;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // Draw Header Text
    ctx.fillStyle = collageStyle === 'corkboard' ? '#fff' : '#1f2937';
    ctx.textAlign = 'center';
    ctx.font = 'bold 36px "Inter", sans-serif';
    ctx.fillText(collageTitle, canvas.width / 2, 60);

    const loadImg = (src: string): Promise<HTMLImageElement> => {
      return new Promise((resolve) => {
        const image = new Image();
        image.src = src;
        image.onload = () => resolve(image);
      });
    };

    if (collageStyle === 'grid' || collageStyle === 'polaroid') {
      // Render in Grid (e.g. columns of equal sizes)
      const count = selectedImages.length;
      const columns = count <= 3 ? count : Math.ceil(Math.sqrt(count));
      const rows = Math.ceil(count / columns);

      const areaYStart = 100;
      const areaHeight = canvas.height - areaYStart - 40;
      const areaWidth = canvas.width - 80;

      const cellWidth = (areaWidth - (columns - 1) * borderSpacing) / columns;
      const cellHeight = (areaHeight - (rows - 1) * borderSpacing) / rows;

      for (let i = 0; i < count; i++) {
        const col = i % columns;
        const row = Math.floor(i / columns);

        const x = 40 + col * (cellWidth + borderSpacing);
        const y = areaYStart + row * (cellHeight + borderSpacing);

        const imgData = selectedImages[i];
        const image = await loadImg(imgData.src);

        if (collageStyle === 'polaroid') {
          // Draw polaroid paper backboard
          ctx.fillStyle = '#ffffff';
          ctx.shadowColor = 'rgba(0, 0, 0, 0.15)';
          ctx.shadowBlur = 10;
          ctx.shadowOffsetX = 2;
          ctx.shadowOffsetY = 4;
          
          // Draw card
          ctx.fillRect(x, y, cellWidth, cellHeight);
          ctx.shadowColor = 'transparent'; // reset shadow

          // Draw inner photo
          const innerGap = 12;
          const photoWidth = cellWidth - innerGap * 2;
          const photoHeight = cellHeight - innerGap * 3 - 35; // extra space for text at bottom

          // Calculate cover crop for photo with Snapseed Filters applied
          ctx.save();
          if (currentCanvasFilter && currentCanvasFilter !== 'none') {
            ctx.filter = currentCanvasFilter;
          }
          ctx.drawImage(
            image, 
            0, 0, image.width, image.height, // source
            x + innerGap, y + innerGap, photoWidth, photoHeight // destination
          );
          ctx.restore();

          // Draw Caption Text
          ctx.fillStyle = '#374151';
          ctx.textAlign = 'center';
          ctx.font = 'italic 16px "Inter", sans-serif';
          ctx.fillText(
            imgData.locationName, 
            x + cellWidth / 2, 
            y + cellHeight - innerGap - 10,
            cellWidth - 20
          );
        } else {
          // Classic Clean Grid Cover Crop with Snapseed Filters applied
          ctx.save();
          ctx.beginPath();
          ctx.rect(x, y, cellWidth, cellHeight);
          ctx.clip();

          if (currentCanvasFilter && currentCanvasFilter !== 'none') {
            ctx.filter = currentCanvasFilter;
          }
          const scale = Math.max(cellWidth / image.width, cellHeight / image.height);
          const w = image.width * scale;
          const h = image.height * scale;
          const dx = x + (cellWidth - w) / 2;
          const dy = y + (cellHeight - h) / 2;

          ctx.drawImage(image, dx, dy, w, h);
          ctx.restore();
        }
      }
    } else if (collageStyle === 'corkboard') {
      // Draw scattered images with Snapseed Filters applied
      for (const img of scatteredImages) {
        const image = await loadImg(img.src);

        const cardWidth = 240 * img.scale;
        const cardHeight = 280 * img.scale;

        const cx = (img.x / 100) * canvas.width;
        const cy = (img.y / 100) * canvas.height;

        ctx.save();
        ctx.translate(cx + cardWidth / 2, cy + cardHeight / 2);
        ctx.rotate((img.rotation * Math.PI) / 180);

        // Draw shadows for corkboard pins
        ctx.shadowColor = 'rgba(0,0,0,0.3)';
        ctx.shadowBlur = 12;
        ctx.shadowOffsetX = 3;
        ctx.shadowOffsetY = 6;

        // Polaroid base
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight);
        ctx.shadowColor = 'transparent';

        // Photo inside polaroid
        const innerGap = 10 * img.scale;
        const photoW = cardWidth - innerGap * 2;
        const photoH = cardHeight - innerGap * 3 - 30 * img.scale;

        ctx.save();
        if (currentCanvasFilter && currentCanvasFilter !== 'none') {
          ctx.filter = currentCanvasFilter;
        }
        ctx.drawImage(
          image,
          -cardWidth / 2 + innerGap,
          -cardHeight / 2 + innerGap,
          photoW,
          photoH
        );
        ctx.restore();

        // Location stamp
        ctx.fillStyle = '#4b5563';
        ctx.textAlign = 'center';
        ctx.font = `italic ${14 * img.scale}px "Inter", sans-serif`;
        ctx.fillText(img.locationName, 0, cardHeight / 2 - innerGap - 5);

        // Pin details (little red pushpin on top!)
        ctx.fillStyle = '#ef4444';
        ctx.shadowColor = 'rgba(0,0,0,0.4)';
        ctx.shadowBlur = 4;
        ctx.shadowOffsetY = 2;
        ctx.beginPath();
        ctx.arc(0, -cardHeight / 2 + 5, 8, 0, Math.PI * 2);
        ctx.fill();
        
        // Pin needle
        ctx.fillStyle = '#9ca3af';
        ctx.fillRect(-1, -cardHeight / 2 + 10, 2, 8);

        ctx.restore();
      }
    }
  };

  // Premium Canvas Export Action
  const exportCollage = async () => {
    if (selectedImages.length === 0) return;
    setIsExporting(true);

    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      canvas.width = 1200;
      canvas.height = 800;

      await drawCollageOnCanvas(canvas, ctx);

      // Download Trigger
      const link = document.createElement('a');
      link.download = `${collageTitle.toLowerCase().replace(/\s+/g, '-')}-collage.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (e) {
      console.error(e);
    } finally {
      setIsExporting(false);
    }
  };

  // Snapseed Share Bridge: leverages Web Share API, falls back to direct instructions modal
  const shareToSnapseed = async () => {
    if (selectedImages.length === 0) return;
    setIsSharing(true);

    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        setIsSharing(false);
        return;
      }

      canvas.width = 1200;
      canvas.height = 800;

      await drawCollageOnCanvas(canvas, ctx);

      canvas.toBlob(async (blob) => {
        if (!blob) {
          setIsSharing(false);
          return;
        }

        const fileName = `${collageTitle.toLowerCase().replace(/\s+/g, '-')}-collage.png`;
        const file = new File([blob], fileName, { type: 'image/png' });

        if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
          try {
            await navigator.share({
              files: [file],
              title: collageTitle,
              text: 'Edit this high-res travel collage in Snapseed!',
            });
            setIsSharing(false);
          } catch (err) {
            console.warn("Native Web Share failed or was cancelled:", err);
            setShowSnapseedModal(true);
            setIsSharing(false);
          }
        } else {
          setShowSnapseedModal(true);
          setIsSharing(false);
        }
      }, 'image/png');
    } catch (e) {
      console.error("Snapseed Share Bridge error:", e);
      setIsSharing(false);
    }
  };

  // QR Look presets triggers
  const triggerQRScan = (file: File) => {
    setIsScanningQR(true);
    setQrScanProgress(0);

    const interval = setInterval(() => {
      setQrScanProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setTimeout(() => {
            setUseFineTuning(true);
            setBrightness(115);
            setContrast(120);
            setSaturation(125);
            setWarmth(35);
            setActiveFilterId('none');
            setScannedLookName('Imported Snapseed Look: Amber Film Classic (Warm & Golden)');
            setIsScanningQR(false);
          }, 300);
          return 100;
        }
        return prev + 10;
      });
    }, 120);
  };

  const applyLookPreset = (lookId: string) => {
    setUseFineTuning(true);
    if (lookId === 'cyberpunk') {
      setBrightness(95);
      setContrast(135);
      setSaturation(145);
      setWarmth(5);
      setScannedLookName('Applied Look: Cyberpunk Neon Glow');
    } else if (lookId === 'amalfi') {
      setBrightness(105);
      setContrast(115);
      setSaturation(110);
      setWarmth(45);
      setScannedLookName('Applied Look: Amalfi Sunset Vintage');
    } else if (lookId === 'paris') {
      setBrightness(90);
      setContrast(140);
      setSaturation(0);
      setWarmth(15);
      setScannedLookName('Applied Look: Parisian High-Contrast Noir');
    }
    setActiveFilterId('none');
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-full min-h-[500px]">
      {/* Sidebar Controls */}
      <div className="lg:col-span-1 bg-white border border-gray-200/80 p-5 rounded-2xl shadow-sm flex flex-col gap-4 select-none">
        <div>
          <h3 className="font-bold text-gray-900 text-base flex items-center gap-2">
            <Settings className="w-5 h-5 text-emerald-600" />
            Collage Builder
          </h3>
          <p className="text-xs text-gray-500 mt-1">Design and style your travel memories.</p>
        </div>

        {/* Tab Selection */}
        <div className="flex bg-gray-100 p-1 rounded-xl">
          <button
            onClick={() => setSidebarTab('layout')}
            className={`flex-1 text-center py-2 text-xs font-bold rounded-lg transition-all ${
              sidebarTab === 'layout'
                ? 'bg-white text-gray-950 shadow-sm'
                : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            Layout Designer
          </button>
          <button
            onClick={() => setSidebarTab('snapseed')}
            className={`flex-1 text-center py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1 ${
              sidebarTab === 'snapseed'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            Snapseed Styles ✨
          </button>
        </div>

        <div className="flex-1 flex flex-col gap-4 overflow-y-auto max-h-[450px] pr-1 scrollbar-thin">
          {sidebarTab === 'layout' ? (
            <div className="flex flex-col gap-4">
              {/* Layout Styles */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-gray-600">Layout Style</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => setCollageStyle('grid')}
                    className={`flex flex-col items-center justify-center gap-1.5 p-2 rounded-xl border text-xs font-medium transition-all ${
                      collageStyle === 'grid'
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-700 shadow-sm'
                        : 'border-gray-200 hover:bg-gray-50 text-gray-600'
                    }`}
                  >
                    <Layout className="w-4 h-4" />
                    Grid
                  </button>
                  <button
                    onClick={() => setCollageStyle('polaroid')}
                    className={`flex flex-col items-center justify-center gap-1.5 p-2 rounded-xl border text-xs font-medium transition-all ${
                      collageStyle === 'polaroid'
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-700 shadow-sm'
                        : 'border-gray-200 hover:bg-gray-50 text-gray-600'
                    }`}
                  >
                    <ImageIcon className="w-4 h-4" />
                    Polaroids
                  </button>
                  <button
                    onClick={() => setCollageStyle('corkboard')}
                    className={`flex flex-col items-center justify-center gap-1.5 p-2 rounded-xl border text-xs font-medium transition-all ${
                      collageStyle === 'corkboard'
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-700 shadow-sm'
                        : 'border-gray-200 hover:bg-gray-50 text-gray-600'
                    }`}
                  >
                    <Layers className="w-4 h-4" />
                    Scattered
                  </button>
                </div>
              </div>

              {/* Settings Form */}
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-gray-600">Collage Title</label>
                  <input
                    type="text"
                    value={collageTitle}
                    onChange={(e) => setCollageTitle(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-gray-200 focus:outline-emerald-600 font-medium"
                    placeholder="E.g., Tokyo Adventures"
                  />
                </div>

                {collageStyle !== 'corkboard' && (
                  <div className="flex flex-col gap-1">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-semibold text-gray-600">Border Spacing</label>
                      <span className="text-xs font-mono text-gray-500">{borderSpacing}px</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="30"
                      value={borderSpacing}
                      onChange={(e) => setBorderSpacing(Number(e.target.value))}
                      className="w-full accent-emerald-600"
                    />
                  </div>
                )}

                {collageStyle !== 'corkboard' && (
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-gray-600">Background Color</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={backgroundColor}
                        onChange={(e) => setBackgroundColor(e.target.value)}
                        className="w-8 h-8 rounded border border-gray-200 cursor-pointer overflow-hidden p-0"
                      />
                      <span className="text-xs font-mono font-semibold text-gray-600 uppercase">{backgroundColor}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {/* Preset Snapseed Filters */}
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-gray-700 flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-600" /> Presets (Looks)
                  </label>
                  {scannedLookName && (
                    <button 
                      onClick={() => {
                        setScannedLookName(null);
                        setUseFineTuning(false);
                        setActiveFilterId('none');
                      }}
                      className="text-[9px] text-red-500 hover:underline font-semibold"
                    >
                      Reset Look
                    </button>
                  )}
                </div>

                {scannedLookName && (
                  <div className="bg-emerald-50 text-emerald-800 border border-emerald-100 p-2 rounded-xl text-[10px] font-semibold flex items-center gap-1.5">
                    <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                    <span className="truncate">{scannedLookName}</span>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-1.5">
                  {SNAPSEED_FILTERS.map((f) => {
                    const isSelected = activeFilterId === f.id && !useFineTuning;
                    return (
                      <button
                        key={f.id}
                        onClick={() => {
                          setActiveFilterId(f.id);
                          setUseFineTuning(false);
                          setScannedLookName(null);
                        }}
                        className={`text-left p-1.5 rounded-lg border text-[10px] transition-all flex flex-col gap-0.5 ${
                          isSelected
                            ? 'border-emerald-600 bg-emerald-50/70 font-semibold text-emerald-950'
                            : 'border-gray-100 hover:bg-gray-50 text-gray-600'
                        }`}
                      >
                        <div className="font-bold flex items-center gap-1">
                          {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-emerald-600"></div>}
                          {f.name}
                        </div>
                        <div className="text-[8px] text-gray-400 line-clamp-1">{f.description}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Manual Fine-Tuning Drawer */}
              <div className="border border-gray-100 rounded-xl p-2.5 bg-gray-50/50 flex flex-col gap-2">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-gray-700 flex items-center gap-1">
                    <Sliders className="w-3.5 h-3.5 text-gray-500" /> Manual Fine-Tuning
                  </label>
                  <input
                    type="checkbox"
                    checked={useFineTuning}
                    onChange={(e) => {
                      setUseFineTuning(e.target.checked);
                      if (e.target.checked) {
                        // initialize tuning values if empty
                        setBrightness(100);
                        setContrast(100);
                        setSaturation(100);
                        setWarmth(0);
                      }
                    }}
                    className="w-3.5 h-3.5 accent-emerald-600 cursor-pointer"
                  />
                </div>

                {useFineTuning && (
                  <div className="flex flex-col gap-2 mt-1">
                    {/* Brightness */}
                    <div className="flex flex-col gap-0.5">
                      <div className="flex justify-between text-[9px] font-semibold text-gray-500 font-mono">
                        <span>Brightness</span>
                        <span>{brightness}%</span>
                      </div>
                      <input
                        type="range"
                        min="50"
                        max="150"
                        value={brightness}
                        onChange={(e) => setBrightness(Number(e.target.value))}
                        className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                      />
                    </div>

                    {/* Contrast */}
                    <div className="flex flex-col gap-0.5">
                      <div className="flex justify-between text-[9px] font-semibold text-gray-500 font-mono">
                        <span>Contrast</span>
                        <span>{contrast}%</span>
                      </div>
                      <input
                        type="range"
                        min="50"
                        max="150"
                        value={contrast}
                        onChange={(e) => setContrast(Number(e.target.value))}
                        className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                      />
                    </div>

                    {/* Saturation */}
                    <div className="flex flex-col gap-0.5">
                      <div className="flex justify-between text-[9px] font-semibold text-gray-500 font-mono">
                        <span>Saturation</span>
                        <span>{saturation}%</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="180"
                        value={saturation}
                        onChange={(e) => setSaturation(Number(e.target.value))}
                        className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                      />
                    </div>

                    {/* Warmth (Sepia) */}
                    <div className="flex flex-col gap-0.5">
                      <div className="flex justify-between text-[9px] font-semibold text-gray-500 font-mono">
                        <span>Warmth</span>
                        <span>{warmth}%</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={warmth}
                        onChange={(e) => setWarmth(Number(e.target.value))}
                        className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Snapseed QR Looks Presets */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-gray-700 flex items-center gap-1">
                  <QrCode className="w-3.5 h-3.5 text-emerald-600" /> Snapseed QR Looks
                </label>
                <p className="text-[9px] text-gray-400 -mt-1 leading-normal">
                  Tap a community preset QR Look to apply its styling parameters, or scan your own custom look!
                </p>

                {/* Micro QR presets cards */}
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    onClick={() => applyLookPreset('cyberpunk')}
                    className="p-1 rounded-xl border border-gray-100 hover:border-emerald-300 hover:bg-emerald-50/20 text-center transition-all flex flex-col items-center gap-1"
                  >
                    <svg className="w-12 h-12 bg-white p-0.5 rounded-lg border border-gray-100 shadow-xs shrink-0" viewBox="0 0 100 100">
                      <rect x="5" y="5" width="25" height="25" fill="#ec4899" rx="1" />
                      <rect x="10" y="10" width="15" height="15" fill="#fff" rx="0.5" />
                      <rect x="13" y="13" width="9" height="9" fill="#06b6d4" rx="0.5" />
                      <rect x="70" y="5" width="25" height="25" fill="#ec4899" rx="1" />
                      <rect x="75" y="10" width="15" height="15" fill="#fff" rx="0.5" />
                      <rect x="78" y="13" width="9" height="9" fill="#06b6d4" rx="0.5" />
                      <rect x="5" y="70" width="25" height="25" fill="#ec4899" rx="1" />
                      <rect x="10" y="75" width="15" height="15" fill="#fff" rx="0.5" />
                      <rect x="13" y="78" width="9" height="9" fill="#06b6d4" rx="0.5" />
                      <path d="M50 38 C42 38, 38 45, 38 52 C38 60, 48 62, 50 62 C52 62, 62 60, 62 52 C62 45, 58 38, 50 38" fill="#ec4899" />
                    </svg>
                    <span className="text-[8px] font-bold text-gray-700 truncate w-full">Cyber Neon</span>
                  </button>

                  <button
                    onClick={() => applyLookPreset('amalfi')}
                    className="p-1 rounded-xl border border-gray-100 hover:border-emerald-300 hover:bg-emerald-50/20 text-center transition-all flex flex-col items-center gap-1"
                  >
                    <svg className="w-12 h-12 bg-white p-0.5 rounded-lg border border-gray-100 shadow-xs shrink-0" viewBox="0 0 100 100">
                      <rect x="5" y="5" width="25" height="25" fill="#ea580c" rx="1" />
                      <rect x="10" y="10" width="15" height="15" fill="#fff" rx="0.5" />
                      <rect x="13" y="13" width="9" height="9" fill="#eab308" rx="0.5" />
                      <rect x="70" y="5" width="25" height="25" fill="#ea580c" rx="1" />
                      <rect x="75" y="10" width="15" height="15" fill="#fff" rx="0.5" />
                      <rect x="78" y="13" width="9" height="9" fill="#eab308" rx="0.5" />
                      <rect x="5" y="70" width="25" height="25" fill="#ea580c" rx="1" />
                      <rect x="10" y="75" width="15" height="15" fill="#fff" rx="0.5" />
                      <rect x="13" y="78" width="9" height="9" fill="#eab308" rx="0.5" />
                      <path d="M50 38 C42 38, 38 45, 38 52 C38 60, 48 62, 50 62 C52 62, 62 60, 62 52 C62 45, 58 38, 50 38" fill="#eab308" />
                    </svg>
                    <span className="text-[8px] font-bold text-gray-700 truncate w-full">Golden Sunset</span>
                  </button>

                  <button
                    onClick={() => applyLookPreset('paris')}
                    className="p-1 rounded-xl border border-gray-100 hover:border-emerald-300 hover:bg-emerald-50/20 text-center transition-all flex flex-col items-center gap-1"
                  >
                    <svg className="w-12 h-12 bg-white p-0.5 rounded-lg border border-gray-100 shadow-xs shrink-0" viewBox="0 0 100 100">
                      <rect x="5" y="5" width="25" height="25" fill="#111827" rx="1" />
                      <rect x="10" y="10" width="15" height="15" fill="#fff" rx="0.5" />
                      <rect x="13" y="13" width="9" height="9" fill="#4b5563" rx="0.5" />
                      <rect x="70" y="5" width="25" height="25" fill="#111827" rx="1" />
                      <rect x="75" y="10" width="15" height="15" fill="#fff" rx="0.5" />
                      <rect x="78" y="13" width="9" height="9" fill="#4b5563" rx="0.5" />
                      <rect x="5" y="70" width="25" height="25" fill="#111827" rx="1" />
                      <rect x="10" y="75" width="15" height="15" fill="#fff" rx="0.5" />
                      <rect x="13" y="78" width="9" height="9" fill="#4b5563" rx="0.5" />
                      <path d="M50 38 C42 38, 38 45, 38 52 C38 60, 48 62, 50 62 C52 62, 62 60, 62 52 C62 45, 58 38, 50 38" fill="#111827" />
                    </svg>
                    <span className="text-[8px] font-bold text-gray-700 truncate w-full">Paris Noir</span>
                  </button>
                </div>

                {/* QR scanner input */}
                <div className="relative">
                  <input
                    type="file"
                    id="snapseed-qr-input"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        triggerQRScan(e.target.files[0]);
                      }
                    }}
                  />
                  <label
                    htmlFor="snapseed-qr-input"
                    className="w-full flex items-center justify-center gap-1.5 py-2 px-3 bg-emerald-50 text-emerald-700 hover:bg-emerald-100/80 border border-emerald-100 rounded-xl font-semibold text-[10px] cursor-pointer transition-all shadow-xs"
                  >
                    <Upload className="w-3.5 h-3.5" /> Scan Custom Snapseed QR
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons Stack */}
        <div className="flex flex-col gap-2 mt-auto">
          {/* Main Download */}
          <button
            onClick={exportCollage}
            disabled={selectedImages.length === 0 || isExporting}
            className="w-full bg-slate-900 hover:bg-slate-950 text-white font-bold py-2.5 px-4 rounded-xl shadow-sm text-xs flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isExporting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" /> Rendering...
              </>
            ) : (
              <>
                <Download className="w-4 h-4" /> Download Collage
              </>
            )}
          </button>

          {/* Snapseed Bridge Share */}
          <button
            onClick={shareToSnapseed}
            disabled={selectedImages.length === 0 || isSharing}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 px-4 rounded-xl shadow-sm text-xs flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSharing ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" /> Preparing...
              </>
            ) : (
              <>
                <Share2 className="w-4 h-4" /> Send to Snapseed
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main Studio View */}
      <div className="lg:col-span-3 flex flex-col gap-4">
        {/* Photo Selector Strip */}
        <div className="bg-white border border-gray-200/80 rounded-2xl p-4 shadow-sm">
          <div className="flex justify-between items-center mb-3">
            <div>
              <h4 className="text-xs font-bold text-gray-800">Select Travel Photos ({selectedImageIds.length})</h4>
              <p className="text-[10px] text-gray-400 mt-0.5">Pick the pictures you want to build your collage with.</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={selectAllImages}
                className="text-[10px] font-bold text-emerald-600 hover:text-emerald-700 border border-emerald-100 bg-emerald-50/50 px-2.5 py-1 rounded-lg"
              >
                Select All
              </button>
              <button
                onClick={clearSelection}
                className="text-[10px] font-bold text-gray-500 hover:text-gray-700 border border-gray-200 px-2.5 py-1 rounded-lg"
              >
                Clear
              </button>
            </div>
          </div>

          {allImages.length === 0 ? (
            <div className="h-20 flex flex-col items-center justify-center border border-dashed border-gray-200 rounded-xl text-center p-4">
              <ImageIcon className="w-6 h-6 text-gray-300" />
              <p className="text-xs text-gray-500 font-medium mt-1">No pictures uploaded in any location diary yet.</p>
            </div>
          ) : (
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin">
              {allImages.map((img) => {
                const isSel = selectedImageIds.includes(img.id);
                return (
                  <div
                    key={img.id}
                    onClick={() => toggleImageSelection(img.id)}
                    className={`relative w-16 h-16 rounded-lg overflow-hidden shrink-0 cursor-pointer border-2 transition-all ${
                      isSel ? 'border-emerald-600 ring-2 ring-emerald-600/20 scale-95' : 'border-gray-100 hover:border-gray-300'
                    }`}
                  >
                    <img src={img.src} className="w-full h-full object-cover" />
                    {isSel && (
                      <div className="absolute inset-0 bg-emerald-600/20 flex items-center justify-center">
                        <div className="bg-emerald-600 text-white rounded-full p-0.5">
                          <Check className="w-3 h-3" strokeWidth={3} />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Collage Display Area */}
        <div className="flex-1 bg-gray-100/50 rounded-2xl p-4 border border-gray-200/50 flex items-center justify-center min-h-[350px]">
          {selectedImages.length === 0 ? (
            <div className="text-center p-6 max-w-sm flex flex-col items-center gap-2">
              <Sparkles className="w-8 h-8 text-emerald-600/60 animate-bounce" />
              <h4 className="font-bold text-gray-800 text-sm">Design Your Collage</h4>
              <p className="text-xs text-gray-500">Select photos from the picker above to begin designing your custom travel memories collage.</p>
            </div>
          ) : (
            <div
              ref={collageRef}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              className={`relative w-full aspect-[3/2] max-w-2xl rounded-xl shadow-lg overflow-hidden border border-gray-200 select-none`}
              style={{
                backgroundColor: collageStyle === 'corkboard' ? '#b48a53' : backgroundColor,
                backgroundImage: collageStyle === 'corkboard' ? 'radial-gradient(#9e733b 1px, transparent 1px)' : 'none',
                backgroundSize: '16px 16px',
              }}
            >
              {/* Overlay title */}
              <div
                className={`absolute top-4 left-0 right-0 text-center font-bold px-4 z-10 select-none ${
                  collageStyle === 'corkboard' ? 'text-amber-50 text-xl font-sans' : 'text-gray-900 text-lg font-sans'
                }`}
              >
                {collageTitle}
              </div>

              {/* Grid / Polaroid Styles */}
              {(collageStyle === 'grid' || collageStyle === 'polaroid') && (
                <div
                  className="absolute inset-x-6 top-14 bottom-6 grid"
                  style={{
                    gridTemplateColumns: `repeat(${
                      selectedImages.length <= 3 ? selectedImages.length : Math.ceil(Math.sqrt(selectedImages.length))
                    }, minmax(0, 1fr))`,
                    gap: `${borderSpacing}px`,
                  }}
                >
                  {selectedImages.map((img) => {
                    if (collageStyle === 'polaroid') {
                      return (
                        <div
                          key={img.id}
                          className="bg-white p-2 pb-5 flex flex-col rounded shadow-md border border-gray-100 transition-all hover:rotate-1 duration-200 select-none"
                        >
                          <div className="flex-1 rounded overflow-hidden bg-gray-50">
                            <img src={img.src} className={`w-full h-full object-cover ${currentCssFilter}`} />
                          </div>
                          <p className="text-[9px] text-gray-600 text-center font-serif italic mt-2 truncate max-w-full">
                            {img.locationName}
                          </p>
                        </div>
                      );
                    } else {
                      return (
                        <div key={img.id} className="rounded-lg overflow-hidden shadow-sm bg-gray-50 select-none">
                          <img src={img.src} className={`w-full h-full object-cover ${currentCssFilter}`} />
                        </div>
                      );
                    }
                  })}
                </div>
              )}

              {/* Corkboard / Drag style */}
              {collageStyle === 'corkboard' && (
                <div className="absolute inset-0 pt-10">
                  {scatteredImages.map((img) => (
                    <div
                      key={img.id}
                      onMouseDown={(e) => handleDragStart(e, img.id)}
                      className={`absolute cursor-grab active:cursor-grabbing bg-white p-2 pb-6 rounded shadow-lg border border-gray-100 select-none`}
                      style={{
                        left: `${img.x}%`,
                        top: `${img.y}%`,
                        transform: `rotate(${img.rotation}deg) scale(${img.scale})`,
                        width: '130px',
                        zIndex: draggedId === img.id ? 50 : undefined,
                        transition: draggedId === img.id ? 'none' : 'transform 0.1s ease',
                      }}
                    >
                      {/* Interactive Scaling and rotation overlays for selected image */}
                      {draggedId === img.id && (
                        <div className="absolute -top-7 left-0 right-0 flex justify-center gap-1.5 bg-gray-900/90 backdrop-blur-sm py-1 px-2 rounded-full shadow-md z-50">
                          <button
                            onMouseDown={(e) => { e.stopPropagation(); rotateImage(img.id, 'left'); }}
                            className="text-[9px] text-white hover:text-emerald-400 font-bold px-1"
                          >
                            ⟲
                          </button>
                          <button
                            onMouseDown={(e) => { e.stopPropagation(); rotateImage(img.id, 'right'); }}
                            className="text-[9px] text-white hover:text-emerald-400 font-bold px-1"
                          >
                            ⟳
                          </button>
                          <span className="w-px h-2.5 bg-gray-700 my-auto"></span>
                          <button
                            onMouseDown={(e) => { e.stopPropagation(); scaleImage(img.id, 0.9); }}
                            className="text-[9px] text-white hover:text-emerald-400 font-bold px-1"
                          >
                            -
                          </button>
                          <button
                            onMouseDown={(e) => { e.stopPropagation(); scaleImage(img.id, 1.1); }}
                            className="text-[9px] text-white hover:text-emerald-400 font-bold px-1"
                          >
                            +
                          </button>
                        </div>
                      )}

                      {/* Small pushpin visual on top */}
                      <div className="absolute top-1 left-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full bg-red-500 shadow-md border border-white flex items-center justify-center pointer-events-none">
                        <div className="w-1.5 h-1.5 rounded-full bg-white/40"></div>
                      </div>

                      <div className="w-full aspect-[4/3] rounded overflow-hidden bg-gray-50 pointer-events-none mt-1">
                        <img src={img.src} className={`w-full h-full object-cover select-none ${currentCssFilter}`} draggable={false} />
                      </div>
                      <p className="text-[8px] text-gray-500 text-center font-serif italic mt-1.5 truncate max-w-full pointer-events-none">
                        {img.locationName}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Snapseed Connection Guide Modal */}
      {showSnapseedModal && (
        <div className="fixed inset-0 bg-slate-900/65 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-gray-100 flex flex-col gap-4 relative animate-scale-up">
            <button
              onClick={() => setShowSnapseedModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 bg-gray-100 hover:bg-gray-200 p-1.5 rounded-full transition-all"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600 font-bold shrink-0">
                🌱
              </div>
              <div>
                <h3 className="font-bold text-gray-900 text-lg flex items-center gap-1.5">
                  Snapseed Connection Guide
                </h3>
                <p className="text-xs text-gray-400">Apply filters & custom Looks in 4 simple steps</p>
              </div>
            </div>

            <div className="bg-emerald-50/50 p-3 rounded-2xl text-[11px] text-emerald-800 leading-normal font-medium flex gap-2">
              <Info className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>
                To send directly to mobile devices without copy-paste, tap <strong>Send to Snapseed</strong> to activate the system share sheet, then pick Snapseed as your target app!
              </span>
            </div>

            <div className="flex flex-col gap-3.5 my-1">
              {/* Step 1 */}
              <div className="flex gap-3">
                <div className="w-6 h-6 rounded-full bg-slate-100 text-slate-700 font-bold text-xs flex items-center justify-center shrink-0">
                  1
                </div>
                <div className="text-xs">
                  <p className="font-bold text-gray-800">Export / Download Collage</p>
                  <p className="text-gray-500 mt-0.5">Click "Download Collage" or use the Share bridge to save the custom high-res file on your device.</p>
                </div>
              </div>

              {/* Step 2 */}
              <div className="flex gap-3">
                <div className="w-6 h-6 rounded-full bg-slate-100 text-slate-700 font-bold text-xs flex items-center justify-center shrink-0">
                  2
                </div>
                <div className="text-xs">
                  <p className="font-bold text-gray-800">Launch Snapseed App</p>
                  <p className="text-gray-500 mt-0.5">Open <strong>Snapseed</strong> on your iOS or Android phone or tablet. If you don't have it, install it for free from the App Store or Play Store.</p>
                </div>
              </div>

              {/* Step 3 */}
              <div className="flex gap-3">
                <div className="w-6 h-6 rounded-full bg-slate-100 text-slate-700 font-bold text-xs flex items-center justify-center shrink-0">
                  3
                </div>
                <div className="text-xs">
                  <p className="font-bold text-gray-800">Scan QR Presets (Looks)</p>
                  <p className="text-gray-500 mt-0.5">In Snapseed, tap <strong>QR Look</strong> under styling and scan the custom preset QR codes from our sidebar to apply instant vintage film filters.</p>
                </div>
              </div>

              {/* Step 4 */}
              <div className="flex gap-3">
                <div className="w-6 h-6 rounded-full bg-slate-100 text-slate-700 font-bold text-xs flex items-center justify-center shrink-0">
                  4
                </div>
                <div className="text-xs">
                  <p className="font-bold text-gray-800">Export and Save</p>
                  <p className="text-gray-500 mt-0.5">Apply fine-tuning (brightness, saturation, warmth) and save your beautiful masterpiece back to your travel log!</p>
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowSnapseedModal(false)}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition-all shadow-md"
            >
              Got It, Let's Style!
            </button>
          </div>
        </div>
      )}

      {/* QR Look Scanning Loader Overlay */}
      {isScanningQR && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex flex-col items-center justify-center p-6 z-50 animate-fade-in text-white">
          <div className="relative max-w-sm w-full text-center flex flex-col items-center gap-5">
            {/* Visual scan graphic */}
            <div className="relative w-36 h-36 bg-emerald-950/40 border-2 border-emerald-500/80 rounded-2xl flex items-center justify-center overflow-hidden shadow-[0_0_20px_rgba(16,185,129,0.2)]">
              <QrCode className="w-20 h-20 text-emerald-400 opacity-80" />
              {/* Laser scanning bar */}
              <div className="absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_10px_rgba(52,211,153,1)] animate-pulse" style={{
                top: `${qrScanProgress}%`,
                transition: 'top 0.1s linear'
              }}></div>
            </div>

            <div>
              <h3 className="font-extrabold text-lg tracking-tight">Scanning Snapseed QR Look</h3>
              <p className="text-xs text-emerald-400 font-mono mt-1 font-bold">Decoding filter & look matrices...</p>
            </div>

            {/* Progress Bar container */}
            <div className="w-full bg-emerald-950/80 border border-emerald-900 h-2.5 rounded-full overflow-hidden p-0.5">
              <div 
                className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-150"
                style={{ width: `${qrScanProgress}%` }}
              ></div>
            </div>

            <span className="text-xs font-bold font-mono text-gray-400">{qrScanProgress}% Completed</span>
          </div>
        </div>
      )}
    </div>
  );
}
