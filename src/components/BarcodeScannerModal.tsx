import { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader, IScannerControls } from '@zxing/browser';
import { BarcodeFormat, DecodeHintType } from '@zxing/library';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { X } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  onScan: (code: string) => void;
  onClose: () => void;
  open?: boolean;
}

/**
 * Standalone camera barcode scanner dialog. Uses @zxing/browser with hints
 * limited to retail 1D formats for faster decoding. Auto-picks the rear camera.
 */
export function BarcodeScannerModal({ onScan, onClose, open = true }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scannedRef = useRef(false);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState<string>('');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    scannedRef.current = false;
    setReady(false);

    // Limit to common retail 1D + QR formats → much faster than scanning all formats
    const hints = new Map();
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [
      BarcodeFormat.EAN_13,
      BarcodeFormat.EAN_8,
      BarcodeFormat.UPC_A,
      BarcodeFormat.UPC_E,
      BarcodeFormat.CODE_128,
      BarcodeFormat.CODE_39,
      BarcodeFormat.ITF,
      BarcodeFormat.QR_CODE,
    ]);
    hints.set(DecodeHintType.TRY_HARDER, true);

    const reader = new BrowserMultiFormatReader(hints, {
      delayBetweenScanAttempts: 100,
      delayBetweenScanSuccess: 500,
    });

    (async () => {
      try {
        // Request camera permission first so labels populate
        const tmp = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
        });
        tmp.getTracks().forEach((t) => t.stop());

        const list = await BrowserMultiFormatReader.listVideoInputDevices();
        if (cancelled) return;
        setDevices(list);
        const preferred =
          list.find((d) => /back|rear|environment/i.test(d.label))?.deviceId ||
          list[0]?.deviceId ||
          '';
        const id = deviceId || preferred;
        if (!deviceId) setDeviceId(id);

        if (!videoRef.current) return;

        // Use a higher-resolution rear-camera stream for sharper decoding
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            deviceId: id ? { exact: id } : undefined,
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
        setReady(true);

        controlsRef.current = await reader.decodeFromVideoElement(
          videoRef.current,
          (result, _err, controls) => {
            if (result && !scannedRef.current) {
              scannedRef.current = true;
              const code = result.getText();
              controls.stop();
              try {
                if ('vibrate' in navigator) navigator.vibrate?.(60);
              } catch {}
              onScan(code);
            }
          },
        );
      } catch (e: any) {
        toast.error(e?.message || 'Camera access denied');
        onClose();
      }
    })();

    return () => {
      cancelled = true;
      controlsRef.current?.stop();
      controlsRef.current = null;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, deviceId]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Scan Barcode</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {devices.length > 1 && (
            <select
              className="w-full h-9 px-3 rounded-md border bg-background text-sm"
              value={deviceId}
              onChange={(e) => setDeviceId(e.target.value)}
            >
              {devices.map((d) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label || `Camera ${d.deviceId.slice(0, 6)}`}
                </option>
              ))}
            </select>
          )}
          <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
            <video ref={videoRef} className="w-full h-full object-cover" muted playsInline autoPlay />
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div className="w-3/4 h-1/3 border-2 border-primary/80 rounded-lg shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
            </div>
            {!ready && (
              <div className="absolute inset-0 flex items-center justify-center text-white text-sm">
                Camera စတင်နေသည်...
              </div>
            )}
          </div>
          <p className="text-xs text-muted-foreground text-center">
            ဘားကုဒ်ကို frame ထဲမှာ ထားပြီး အလင်းရောင်ကောင်းအောင် ထားပေးပါ
          </p>
          <Button variant="outline" className="w-full" onClick={onClose}>
            <X className="w-4 h-4 mr-1" /> Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
