import { useRef } from 'react';

interface Props {
  image?: string | null;
  testId?: string;
  size?: number;
  onChange: (dataUrl: string) => void;
}

function cropToSquare(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const side = Math.min(img.width, img.height);
      const sx = (img.width - side) / 2;
      const sy = (img.height - side) / 2;
      const canvas = document.createElement('canvas');
      canvas.width = 200;
      canvas.height = 200;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, sx, sy, side, side, 0, 0, 200, 200);
      resolve(canvas.toDataURL('image/jpeg', 0.75));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Image load failed')); };
    img.src = url;
  });
}

export default function ImagePicker({ image, testId, size = 64, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await cropToSquare(file);
      onChange(dataUrl);
    } catch { /* ignore */ }
    e.target.value = '';
  }

  const tid = testId ?? 'product-thumbnail';

  return (
    <div
      data-testid={tid}
      onClick={() => inputRef.current?.click()}
      style={{ position: 'relative', display: 'inline-block', cursor: 'pointer', flexShrink: 0 }}
      title="Click to change image"
    >
      {image ? (
        <img
          src={image}
          alt="Product"
          style={{ width: size, height: size, objectFit: 'cover', borderRadius: 8, display: 'block' }}
        />
      ) : (
        <div
          data-testid={`${tid}-placeholder`}
          style={{
            width: size, height: size, borderRadius: 8,
            background: '#f3f4f6',
            border: '2px dashed #d1d5db',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            color: '#9ca3af',
            gap: 2,
          }}
        >
          <span style={{ fontSize: size >= 80 ? '1.6rem' : '1.1rem', lineHeight: 1 }}>📷</span>
          {size >= 80 && (
            <span style={{ fontSize: '0.65rem', fontWeight: 500 }}>No image</span>
          )}
        </div>
      )}
      <div
        style={{
          position: 'absolute', bottom: 3, right: 3,
          background: 'rgba(0,0,0,0.55)',
          borderRadius: 4,
          width: 18, height: 18,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '0.6rem', color: 'white',
          pointerEvents: 'none',
        }}
      >
        ✎
      </div>
      <input
        ref={inputRef}
        data-testid={`image-input-${tid.replace('product-thumbnail-', '')}`}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleFile}
      />
    </div>
  );
}
