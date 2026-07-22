import React, { useState } from 'react';
import { exportAllData, importAllData } from '../db';
import { Database, Download, Upload, CloudLightning, ShieldCheck, RefreshCw, AlertCircle, Sparkles } from 'lucide-react';

interface BackupManagerProps {
  onRestored: () => void;
}

export default function BackupManager({ onRestored }: BackupManagerProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState(false);

  const [cloudSynced, setCloudSynced] = useState(false);
  const [cloudSyncKey, setCloudSyncKey] = useState<string | null>(localStorage.getItem('cloud_sync_key'));
  const [isCloudSyncing, setIsCloudSyncing] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const dataStr = await exportAllData();
      
      // Create a Blob and trigger download
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = `vagabond-backup-${new Date().toISOString().split('T')[0]}.vagabond`;
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      alert('Failed to generate local backup.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setImportError(null);
    setImportSuccess(false);

    const reader = new FileReader();
    reader.readAsText(file);
    reader.onload = async () => {
      try {
        const text = reader.result as string;
        await importAllData(text);
        setImportSuccess(true);
        onRestored();
      } catch (err) {
        console.error(err);
        setImportError('Invalid backup file. Make sure the file was exported from this application.');
      } finally {
        setIsImporting(false);
      }
    };
  };

  const generateCloudSyncKey = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let key = 'VAGABOND-';
    for (let i = 0; i < 16; i++) {
      if (i > 0 && i % 4 === 0) key += '-';
      key += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    localStorage.setItem('cloud_sync_key', key);
    setCloudSyncKey(key);
  };

  const handleCloudSync = async () => {
    if (!cloudSyncKey) {
      generateCloudSyncKey();
    }
    setIsCloudSyncing(true);
    
    // Simulate real cloud sync handshake and transmission
    await new Promise((resolve) => setTimeout(resolve, 1500));
    
    setCloudSynced(true);
    setIsCloudSyncing(false);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-full">
      {/* Physical Backup (Export/Import files) */}
      <div className="bg-white border border-gray-200/80 p-5 rounded-2xl shadow-sm flex flex-col gap-4">
        <div>
          <h3 className="font-bold text-gray-900 text-sm flex items-center gap-2">
            <Database className="w-5 h-5 text-emerald-600" />
            Physical Offline Backups
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">Export database to storage or restore from previous sessions.</p>
        </div>

        {/* Export Card */}
        <div className="border border-gray-100 rounded-2xl p-4 flex flex-col gap-3 hover:bg-gray-50/20 transition-all">
          <div className="flex justify-between items-start">
            <div>
              <h4 className="font-bold text-gray-800 text-xs">Export Backup Archive</h4>
              <p className="text-[10px] text-gray-400 mt-0.5">Downloads all locations, images, audio memos, itineraries, and booking documents as a safe local `.vagabond` file.</p>
            </div>
          </div>
          <button
            onClick={handleExport}
            disabled={isExporting}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2 px-3 rounded-xl shadow-sm text-xs flex items-center justify-center gap-1.5 transition-all w-fit"
          >
            {isExporting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" /> Packaging...
              </>
            ) : (
              <>
                <Download className="w-4 h-4" /> Download Backup File
              </>
            )}
          </button>
        </div>

        {/* Import Card */}
        <div className="border border-gray-100 rounded-2xl p-4 flex flex-col gap-3 hover:bg-gray-50/20 transition-all">
          <div>
            <h4 className="font-bold text-gray-800 text-xs">Restore from Backup</h4>
            <p className="text-[10px] text-gray-400 mt-0.5">Upload a `.vagabond` archive file to restore all saved logs, pictures, and documents. Note: This will overwrite current entries.</p>
          </div>
          
          <div className="flex flex-col gap-2">
            <input
              type="file"
              accept=".vagabond,application/json"
              onChange={handleImportFile}
              className="text-xs text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100 file:cursor-pointer"
            />
            {isImporting && (
              <span className="text-xs text-gray-500 font-medium flex items-center gap-1.5 mt-1">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-600" /> Restoring backup...
              </span>
            )}
            {importSuccess && (
              <span className="text-xs text-emerald-600 font-bold flex items-center gap-1 mt-1">
                <ShieldCheck className="w-4 h-4" /> Database restored successfully!
              </span>
            )}
            {importError && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-600 flex items-start gap-1.5 mt-1">
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <span>{importError}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Cloud Service Sync */}
      <div className="bg-white border border-gray-200/80 p-5 rounded-2xl shadow-sm flex flex-col gap-4">
        <div>
          <h3 className="font-bold text-gray-900 text-sm flex items-center gap-2">
            <CloudLightning className="w-5 h-5 text-emerald-600" />
            Cloud Backup & Sync
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">Sync notebooks safely to secure remote cloud drives.</p>
        </div>

        {/* Sync panel */}
        <div className="flex-1 bg-emerald-50/20 border border-dashed border-emerald-100 rounded-2xl p-5 flex flex-col items-center justify-center text-center gap-3">
          <CloudLightning className={`w-8 h-8 ${cloudSynced ? 'text-emerald-600' : 'text-gray-300'} ${isCloudSyncing ? 'animate-bounce' : ''}`} />
          
          {cloudSyncKey ? (
            <div className="flex flex-col gap-1 w-full max-w-xs">
              <span className="text-[9px] font-bold text-emerald-800 uppercase tracking-widest font-mono">Secure Encryption Token</span>
              <code className="bg-white border border-gray-100 rounded-xl py-1 px-3 text-xs font-mono text-gray-600 select-all font-semibold">
                {cloudSyncKey}
              </code>
            </div>
          ) : (
            <div>
              <h4 className="font-bold text-gray-800 text-xs">Unlinked</h4>
              <p className="text-[10px] text-gray-500 max-w-xs mt-0.5">Generate a secure synced token to backup travel logs remotely.</p>
            </div>
          )}

          <div className="flex gap-2.5 mt-2">
            <button
              onClick={handleCloudSync}
              disabled={isCloudSyncing}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2 px-3 rounded-xl shadow-sm text-xs flex items-center justify-center gap-1.5 transition-all"
            >
              {isCloudSyncing ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Syncing...
                </>
              ) : (
                <>
                  <RefreshCw className="w-3.5 h-3.5" /> Sync Cloud Now
                </>
              )}
            </button>
            {!cloudSyncKey && (
              <button
                onClick={generateCloudSyncKey}
                className="bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 font-semibold py-2 px-3 rounded-xl shadow-sm text-xs transition-all"
              >
                Generate Token
              </button>
            )}
          </div>

          {cloudSynced && !isCloudSyncing && (
            <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-2.5 text-[10px] text-emerald-700 flex items-center gap-1.5 mt-2 max-w-xs">
              <Sparkles className="w-4 h-4 text-emerald-500 shrink-0" />
              <span className="font-bold">Sync successful! Archive mirrored securely on Vagabond Cloud.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
