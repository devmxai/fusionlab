import { useState, useCallback } from "react";
import Cropper from "react-easy-crop";
import type { Area } from "react-easy-crop";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";

interface CropDialogProps {
  open: boolean;
  imageSrc: string;
  aspectRatio: number;
  onConfirm: (croppedBlob: Blob) => void;
  onCancel: () => void;
}

async function getCroppedImg(imageSrc: string, pixelCrop: Area): Promise<Blob> {
  const image = new Image();
  image.crossOrigin = "anonymous";
  image.src = imageSrc;
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("Failed to load image"));
  });
  const canvas = document.createElement("canvas");
  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(
    image,
    pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height,
    0, 0, pixelCrop.width, pixelCrop.height
  );
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Canvas is empty"));
    }, "image/png");
  });
}

export default function CropDialog({ open, imageSrc, aspectRatio, onConfirm, onCancel }: CropDialogProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

  const onCropComplete = useCallback((_croppedArea: Area, croppedPixels: Area) => {
    setCroppedAreaPixels(croppedPixels);
  }, []);

  const handleConfirm = async () => {
    if (!croppedAreaPixels) return;
    try {
      const blob = await getCroppedImg(imageSrc, croppedAreaPixels);
      onConfirm(blob);
    } catch (e) {
      console.error("Crop failed:", e);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onCancel(); }}>
      <DialogContent className="max-w-lg p-0 overflow-hidden bg-card border-primary/20" dir="rtl">
        <div className="p-4 pb-2">
          <h3 className="text-sm font-bold text-foreground">قص الصورة</h3>
          <p className="text-xs text-muted-foreground mt-0.5">اضبط الصورة لتتناسب مع قياس الفيديو المختار</p>
        </div>
        <div className="relative w-full bg-black/90" style={{ height: "350px" }}>
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={aspectRatio}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
          />
        </div>
        <div className="px-4 py-2">
          <div className="flex items-center gap-3">
            <span className="text-[10px] text-muted-foreground shrink-0">تكبير</span>
            <Slider
              value={[zoom]}
              min={1}
              max={3}
              step={0.1}
              onValueChange={([v]) => setZoom(v)}
              className="flex-1"
            />
          </div>
        </div>
        <div className="flex gap-2 p-4 pt-2 justify-start">
          <Button onClick={handleConfirm} size="sm">تأكيد القص</Button>
          <Button variant="outline" size="sm" onClick={onCancel}>إلغاء</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
