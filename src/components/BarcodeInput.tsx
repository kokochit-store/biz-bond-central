import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScanLine } from 'lucide-react';
import { BarcodeScannerModal } from './BarcodeScannerModal';
import { toast } from 'sonner';

interface Props {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  onScan?: (code: string) => void;
}

/** Manual number input + camera scan. Used in admin item/purchase forms. */
export function BarcodeInput({ value, onChange, placeholder = 'Barcode', className, onScan }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className={`flex gap-2 ${className || ''}`}>
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          inputMode="numeric"
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => setOpen(true)}
          title="Scan with camera"
          aria-label="Scan barcode with camera"
        >
          <ScanLine className="w-4 h-4" />
        </Button>
      </div>
      {open && (
        <BarcodeScannerModal
          onClose={() => setOpen(false)}
          onScan={(code) => {
            onChange(code);
            onScan?.(code);
            toast.success(`Scanned: ${code}`);
            setOpen(false);
          }}
        />
      )}
    </>
  );
}
