import { useState } from 'react'
import Icon from './Icon.jsx'

/**
 * Remote image with a graceful blue-gradient fallback.
 * Every landing-page photo is served live from Unsplash; if a request is blocked
 * (offline demo, corporate proxy) the tile stays on-brand instead of breaking.
 */
export default function SmartImage({ src, alt, className = '', ratio, loading = 'lazy', style }) {
  const [state, setState] = useState('loading')

  return (
    <div
      className={`smart-img ${state === 'loaded' ? 'is-loaded' : ''} ${
        state === 'failed' ? 'is-failed' : ''
      } ${className}`}
      style={{ aspectRatio: ratio, ...style }}
    >
      {state !== 'failed' && (
        <img
          src={src}
          alt={alt}
          loading={loading}
          decoding="async"
          referrerPolicy="no-referrer"
          onLoad={() => setState('loaded')}
          onError={() => setState('failed')}
        />
      )}
      {state === 'failed' && (
        <span className="smart-img__fallback" role="img" aria-label={alt}>
          <Icon name="image" />
        </span>
      )}
    </div>
  )
}
