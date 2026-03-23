interface Props {
  image?: string | null;
  name?: string;
  size?: number;
}

export default function ProductThumb({ image, name, size = 40 }: Props) {
  if (image) {
    return (
      <img
        src={image}
        alt={name ?? ''}
        style={{ width: size, height: size, objectFit: 'cover', borderRadius: 6, flexShrink: 0, display: 'block' }}
      />
    );
  }
  return (
    <div
      style={{
        width: size, height: size, borderRadius: 6, flexShrink: 0,
        background: '#f3f4f6', border: '1px solid #e5e7eb',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#9ca3af', fontSize: size >= 48 ? '1.1rem' : '0.8rem',
      }}
    >
      📷
    </div>
  );
}
