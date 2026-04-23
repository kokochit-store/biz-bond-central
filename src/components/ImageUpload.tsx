import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Upload, X, Image as ImageIcon } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  value?: string;
  onChange: (dataUrl: string) => void;
  label?: string;
  className?: string;
  /** Max output dimension in pixels (keeps aspect ratio). Default 800 */
  maxDim?: number;
  /** JPEG quality 0–1. Default 0.82 */
  quality?: number;
  aspect?: 'square' | 'wide';
}

/**
 * File picker that converts the chosen image to a compressed base64 data URL.
 * No backend / URL needed — images are stored inline with the rest of local data.
 */
export function ImageUpload({
  value,
  onChange,
  label = 'Upload image',
  className = '',
  maxDim = 800,
  quality = 0.82,
  aspect = 'square',
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const pick = () => inputRef.current?.click();

  const handleFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Image file only');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Max 10MB');
      return;
    }
    setBusy(true);
    try {
      const dataUrl = await compressImage(file, maxDim, quality);
      onChange(dataUrl);
    } catch (err) {
      console.error(err);
      toast.error('Could not read image');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`space-y-2 ${className}`}>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = '';
        }}
      />
      {value ? (
        <div className="relative inline-block">
          <img
            src={value}
            alt="preview"
            className={`rounded-md border object-cover ${
              aspect === 'wide' ? 'h-32 w-full max-w-md' : 'h-28 w-28'
            }`}
          />
          <button
            type="button"
            onClick={() => onChange('')}
            className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center shadow"
            aria-label="remove"
          >
            <X className="w-3.5 h-3.5" />
          </button>
          <div className="mt-2">
            <Button type="button" size="sm" variant="outline" onClick={pick} disabled={busy}>
              <Upload className="w-3.5 h-3.5 mr-1" />
              Change
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={pick}
          disabled={busy}
          className={`flex items-center justify-center gap-2 rounded-md border border-dashed bg-muted/30 hover:bg-muted text-sm text-muted-foreground transition-colors w-full ${
            aspect === 'wide' ? 'h-32' : 'h-28'
          }`}
        >
          {busy ? (
            <span>Loading…</span>
          ) : (
            <>
              <ImageIcon className="w-4 h-4" />
              <span>{label}</span>
            </>
          )}
        </button>
      )}
    </div>
  );
}

function compressImage(file: File, maxDim: number, quality: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('decode failed'));
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          const ratio = Math.min(maxDim / width, maxDim / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('no canvas ctx'));
        ctx.drawImage(img, 0, 0, width, height);
        // PNG for transparency, JPEG otherwise (smaller)
        const isPng = file.type === 'image/png';
        resolve(canvas.toDataURL(isPng ? 'image/png' : 'image/jpeg', quality));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}
