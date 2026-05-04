import React, { useState } from 'react';
import { Home } from 'lucide-react';
import { streetViewStaticImageUrl } from '../utils/streetViewStatic';

interface Props {
  address: string | null;
  jobName: string;
  mapsApiKey: string;
  width?: number;
  height?: number;
  className?: string;
  imageClassName?: string;
  fallbackClassName?: string;
  fallbackIconSize?: number;
}

export default function JobStreetViewImage({
  address,
  jobName,
  mapsApiKey,
  width = 640,
  height = 360,
  className = '',
  imageClassName = 'h-full w-full object-cover',
  fallbackClassName = '',
  fallbackIconSize = 28,
}: Props) {
  const [imgFailed, setImgFailed] = useState(false);
  const url =
    mapsApiKey && address?.trim()
      ? streetViewStaticImageUrl({ location: address.trim(), apiKey: mapsApiKey, width, height })
      : '';

  if (!url || imgFailed) {
    return (
      <div
        className={`flex items-center justify-center ${className} ${fallbackClassName}`}
        style={{ background: 'var(--color-surface)' }}
        aria-hidden="true"
      >
        <Home size={fallbackIconSize} style={{ color: 'var(--color-border)' }} />
      </div>
    );
  }

  return (
    <img
      src={url}
      alt={`Street View near ${jobName}`}
      className={`${imageClassName} ${className}`}
      onError={() => setImgFailed(true)}
      loading="lazy"
      decoding="async"
    />
  );
}
