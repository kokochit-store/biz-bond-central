import { useRef, useState } from 'react';
import { useStore } from '@/store/StoreContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Plus, X, Download, Upload, RotateCcw, Palette } from 'lucide-react';
import { SortableList } from '@/components/SortableList';
import { toast } from 'sonner';

const FONTS_DISPLAY = ['Playfair Display', 'DM Sans', 'Inter', 'Noto Sans Myanmar'] as const;
const FONTS_BODY = ['DM Sans', 'Inter', 'Noto Sans Myanmar'] as const;
const CURRENCIES = ['Ks', 'MMK', 'USD', 'THB', '€', '£', '¥', '₹'];

const SWATCHES = [
  { label: 'Orange', h: 24, s: 80, l: 50 },
  { label: 'Red', h: 0, s: 75, l: 50 },
  { label: 'Green', h: 142, s: 60, l: 40 },
  { label: 'Blue', h: 217, s: 80, l: 50 },
  { label: 'Purple', h: 270, s: 60, l: 50 },
  { label: 'Teal', h: 180, s: 65, l: 40 },
  { label: 'Pink', h: 330, s: 75, l: 55 },
  { label: 'Amber', h: 38, s: 92, l: 50 },
];

export function CustomizationAdmin() {
  const { theme, updateTheme, prefs, updatePrefs, categories, setCategories, exportData, importData, resetAll } = useStore();
  const [newCat, setNewCat] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const addCat = () => {
    const v = newCat.trim();
    if (!v) return;
    if (categories.includes(v)) return toast.error('Category exists');
    setCategories([...categories, v]);
    setNewCat('');
    toast.success('Category added');
  };
  const removeCat = (c: string) => setCategories(categories.filter((x) => x !== c));

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    // 5 MB cap — guards against accidental huge files
    if (f.size > 5 * 1024 * 1024) {
      toast.error('Backup file is too large (max 5 MB)');
      e.target.value = '';
      return;
    }
    if (!confirm('Importing will overwrite store data, settings, theme, and categories on this device. Admin login is preserved. Continue?')) {
      e.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = importData(String(reader.result));
      if (result.ok) toast.success('Data restored');
      else toast.error(result.error || 'Invalid backup file');
    };
    reader.readAsText(f);
    e.target.value = '';
  };

  return (
    <div className="space-y-4">
      {/* THEME */}
      <Card className="p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
            <Palette className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-semibold">Theme & Branding</h4>
            <p className="text-xs text-muted-foreground">အရောင်၊ စာလုံးဖြင့် စိတ်တိုင်းကျ ပြင်ဆင်ရန်</p>
          </div>
        </div>

        <div className="space-y-5">
          <div>
            <label className="text-xs font-medium mb-2 block">Quick Color Themes</label>
            <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
              {SWATCHES.map((sw) => (
                <button
                  key={sw.label}
                  type="button"
                  onClick={() => updateTheme({ primaryHue: sw.h, primarySat: sw.s, primaryLight: sw.l })}
                  className="aspect-square rounded-lg border-2 transition-all hover:scale-105"
                  style={{
                    backgroundColor: `hsl(${sw.h} ${sw.s}% ${sw.l}%)`,
                    borderColor: theme.primaryHue === sw.h ? 'hsl(var(--foreground))' : 'transparent',
                  }}
                  title={sw.label}
                />
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="font-medium">Hue (အရောင်)</span>
                <span className="text-muted-foreground">{theme.primaryHue}°</span>
              </div>
              <Slider value={[theme.primaryHue]} max={360} step={1} onValueChange={(v) => updateTheme({ primaryHue: v[0] })} />
            </div>
            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="font-medium">Saturation</span>
                <span className="text-muted-foreground">{theme.primarySat}%</span>
              </div>
              <Slider value={[theme.primarySat]} max={100} step={1} onValueChange={(v) => updateTheme({ primarySat: v[0] })} />
            </div>
            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="font-medium">Lightness</span>
                <span className="text-muted-foreground">{theme.primaryLight}%</span>
              </div>
              <Slider value={[theme.primaryLight]} min={20} max={70} step={1} onValueChange={(v) => updateTheme({ primaryLight: v[0] })} />
            </div>
            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="font-medium">Corner Radius</span>
                <span className="text-muted-foreground">{theme.radius}px</span>
              </div>
              <Slider value={[theme.radius]} min={0} max={24} step={1} onValueChange={(v) => updateTheme({ radius: v[0] })} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium">Heading Font</label>
              <select
                className="w-full mt-1 h-10 px-3 rounded-md border bg-background text-sm"
                value={theme.fontDisplay}
                onChange={(e) => updateTheme({ fontDisplay: e.target.value as any })}
              >
                {FONTS_DISPLAY.map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium">Body Font</label>
              <select
                className="w-full mt-1 h-10 px-3 rounded-md border bg-background text-sm"
                value={theme.fontBody}
                onChange={(e) => updateTheme({ fontBody: e.target.value as any })}
              >
                {FONTS_BODY.map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
          </div>

          <Button variant="outline" size="sm" onClick={() => updateTheme({
            primaryHue: 24, primarySat: 80, primaryLight: 50, radius: 12,
            fontDisplay: 'Playfair Display', fontBody: 'DM Sans',
          })}>
            <RotateCcw className="w-3.5 h-3.5 mr-1.5" /> Reset Theme
          </Button>
        </div>
      </Card>

      {/* CURRENCY & LANGUAGE */}
      <Card className="p-5">
        <h4 className="font-semibold mb-3">Currency & Language</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="text-xs font-medium">Currency Symbol</label>
            <select
              className="w-full mt-1 h-10 px-3 rounded-md border bg-background text-sm"
              value={prefs.currency}
              onChange={(e) => updatePrefs({ currency: e.target.value })}
            >
              {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium">Position</label>
            <select
              className="w-full mt-1 h-10 px-3 rounded-md border bg-background text-sm"
              value={prefs.currencyPosition}
              onChange={(e) => updatePrefs({ currencyPosition: e.target.value as any })}
            >
              <option value="after">After (1,000 Ks)</option>
              <option value="before">Before (Ks 1,000)</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium">Language</label>
            <select
              className="w-full mt-1 h-10 px-3 rounded-md border bg-background text-sm"
              value={prefs.language}
              onChange={(e) => updatePrefs({ language: e.target.value as any })}
            >
              <option value="my">မြန်မာ</option>
              <option value="en">English</option>
            </select>
          </div>
        </div>
      </Card>

      {/* CATEGORIES */}
      <Card className="p-5">
        <h4 className="font-semibold mb-1">Custom Categories</h4>
        <p className="text-xs text-muted-foreground mb-3">Drag handle ဖြင့် အစီအစဉ် ပြောင်းနိုင်ပါတယ်</p>
        {categories.length === 0 ? (
          <p className="text-sm text-muted-foreground mb-3">No categories yet.</p>
        ) : (
          <SortableList
            className="space-y-1.5 mb-3"
            items={categories}
            getId={(c) => c}
            onReorder={setCategories}
            renderItem={(c) => (
              <div className="flex items-center justify-between px-3 py-2 rounded-md bg-muted/50">
                <span className="text-sm">{c}</span>
                <button
                  type="button"
                  onClick={() => removeCat(c)}
                  className="hover:bg-destructive/20 rounded p-1 text-muted-foreground hover:text-destructive"
                  aria-label={`Remove ${c}`}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          />
        )}
        <form onSubmit={(e) => { e.preventDefault(); addCat(); }} className="flex gap-2">
          <Input placeholder="Category name (e.g. Garden Tools)" value={newCat} onChange={(e) => setNewCat(e.target.value)} />
          <Button type="submit" size="sm">
            <Plus className="w-4 h-4 mr-1" /> Add
          </Button>
        </form>
      </Card>

      {/* BACKUP & RESTORE */}
      <Card className="p-5">
        <h4 className="font-semibold mb-1">Backup & Restore</h4>
        <p className="text-xs text-muted-foreground mb-4">
          Data အားလုံးကို JSON file အဖြစ် download/upload လုပ်နိုင်ပါတယ်။ Offline backup အတွက် သုံးပါ။
        </p>
        <div className="flex flex-wrap gap-2">
          <Button onClick={exportData} variant="outline">
            <Download className="w-4 h-4 mr-1.5" /> Export Backup
          </Button>
          <Button onClick={() => fileRef.current?.click()} variant="outline">
            <Upload className="w-4 h-4 mr-1.5" /> Import Backup
          </Button>
          <input ref={fileRef} type="file" accept="application/json" hidden onChange={handleImport} />
          <Button onClick={resetAll} variant="destructive">
            <RotateCcw className="w-4 h-4 mr-1.5" /> Reset All Data
          </Button>
        </div>
      </Card>
    </div>
  );
}
