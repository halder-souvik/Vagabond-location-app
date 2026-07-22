import { useState, useRef, useEffect } from 'react';
import { Mic, Square, Play, Pause, Trash2, Check, AlertCircle } from 'lucide-react';

interface AudioRecorderProps {
  onSave: (base64: string, duration: number) => void;
  onCancel?: () => void;
}

export default function AudioRecorder({ onSave, onCancel }: AudioRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    return () => {
      stopTimer();
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl]);

  const startTimer = () => {
    setRecordingDuration(0);
    timerRef.current = setInterval(() => {
      setRecordingDuration((prev) => prev + 1);
    }, 1000);
  };

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const startRecording = async () => {
    setError(null);
    audioChunksRef.current = [];
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Determine support for modern formats
      let options = { mimeType: 'audio/webm' };
      if (!MediaRecorder.isTypeSupported('audio/webm')) {
        options = { mimeType: 'audio/mp4' };
      }

      const recorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: options.mimeType });
        setAudioBlob(blob);
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        
        // Stop all stream tracks to release microphone lock
        stream.getTracks().forEach((track) => track.stop());
      };

      recorder.start();
      setIsRecording(true);
      startTimer();
    } catch (err: any) {
      console.error('Microphone access denied:', err);
      setError('Could not access microphone. Please grant permissions and try again.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      stopTimer();
    }
  };

  const handlePlayPause = () => {
    if (!audioUrl) return;

    if (!audioPlayerRef.current) {
      audioPlayerRef.current = new Audio(audioUrl);
      audioPlayerRef.current.onended = () => {
        setIsPlaying(false);
      };
    }

    if (isPlaying) {
      audioPlayerRef.current.pause();
      setIsPlaying(false);
    } else {
      audioPlayerRef.current.play();
      setIsPlaying(true);
    }
  };

  const handleSave = () => {
    if (!audioBlob) return;

    const reader = new FileReader();
    reader.readAsDataURL(audioBlob);
    reader.onloadend = () => {
      const base64 = reader.result as string;
      onSave(base64, recordingDuration);
      resetRecorder();
    };
  };

  const resetRecorder = () => {
    stopTimer();
    setIsRecording(false);
    setRecordingDuration(0);
    setAudioBlob(null);
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
    setAudioUrl(null);
    setIsPlaying(false);
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      audioPlayerRef.current = null;
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="bg-gray-50 border border-gray-200/80 rounded-2xl p-4 flex flex-col items-center justify-center gap-4 shadow-inner">
      <div className="text-center">
        <h4 className="font-semibold text-gray-800 text-sm">Add Voice Note</h4>
        <p className="text-xs text-gray-500 mt-1">Record memos, sounds, or notes for this spot.</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-600 flex items-start gap-2 max-w-sm">
          <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Recording Display */}
      {isRecording && (
        <div className="flex flex-col items-center gap-2">
          <div className="flex items-center gap-1.5 h-8">
            <span className="w-1.5 bg-rose-600 voice-bar rounded-full"></span>
            <span className="w-1.5 bg-rose-600 voice-bar rounded-full"></span>
            <span className="w-1.5 bg-rose-600 voice-bar rounded-full"></span>
            <span className="w-1.5 bg-rose-600 voice-bar rounded-full"></span>
            <span className="w-1.5 bg-rose-600 voice-bar rounded-full"></span>
          </div>
          <span className="text-rose-600 font-mono text-sm font-semibold animate-pulse">
            Recording • {formatTime(recordingDuration)}
          </span>
        </div>
      )}

      {/* Review Display */}
      {audioUrl && !isRecording && (
        <div className="flex flex-col items-center gap-2">
          <span className="text-xs text-emerald-600 font-medium">Recording saved ({formatTime(recordingDuration)})</span>
          <button
            onClick={handlePlayPause}
            className="flex items-center gap-2 bg-white border border-gray-200 hover:bg-gray-50 px-4 py-2 rounded-full text-xs font-semibold text-gray-700 shadow-sm transition-all"
          >
            {isPlaying ? (
              <>
                <Pause className="w-4 h-4 text-gray-600 fill-gray-600" /> Pause Memo
              </>
            ) : (
              <>
                <Play className="w-4 h-4 text-emerald-600 fill-emerald-600" /> Play Memo
              </>
            )}
          </button>
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center gap-3">
        {!isRecording && !audioUrl && (
          <button
            onClick={startRecording}
            className="w-12 h-12 rounded-full bg-rose-600 hover:bg-rose-700 text-white flex items-center justify-center shadow-md hover:shadow-lg transition-all"
            title="Start Recording"
          >
            <Mic className="w-5 h-5" />
          </button>
        )}

        {isRecording && (
          <button
            onClick={stopRecording}
            className="w-12 h-12 rounded-full bg-gray-800 hover:bg-gray-900 text-white flex items-center justify-center shadow-md transition-all animate-pulse"
            title="Stop Recording"
          >
            <Square className="w-5 h-5" />
          </button>
        )}

        {audioUrl && (
          <>
            <button
              onClick={resetRecorder}
              className="w-10 h-10 rounded-full border border-gray-200 hover:border-red-200 hover:bg-red-50 text-gray-500 hover:text-red-600 flex items-center justify-center transition-all"
              title="Discard Recording"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              onClick={handleSave}
              className="w-12 h-12 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center shadow-md hover:shadow-lg transition-all"
              title="Save Voice Note"
            >
              <Check className="w-5 h-5" />
            </button>
          </>
        )}

        {onCancel && !isRecording && !audioUrl && (
          <button
            onClick={onCancel}
            className="text-xs font-semibold text-gray-500 hover:text-gray-700"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
