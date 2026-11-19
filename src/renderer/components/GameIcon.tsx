import { AlertTriangle } from 'lucide-react';
import { useState } from 'react';
import {
  getChampionIconUrl,
  getItemIconUrl,
  getRuneIconUrl,
} from '../assetUrls';

function initialsFromName(name: string): string {
  const parts = name
    .replace(/['.]/g, '')
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 3).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export function ChampionPortrait({
  patch,
  imageFull,
  name,
  size = 54,
  className = '',
}: {
  patch: string;
  imageFull?: string | null;
  name: string;
  size?: number;
  className?: string;
}) {
  const url = getChampionIconUrl(patch, imageFull);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const showImg = Boolean(url && failedUrl !== url);

  return (
    <div
      className={`champ-portrait-box ${className}`}
      style={{ width: size, height: size }}
    >
      {showImg ? (
        <img
          src={url!}
          alt={name}
          width={size}
          height={size}
          onError={() => setFailedUrl(url)}
        />
      ) : (
        <div className="icon-fallback-neutral" title={name}>
          <span>{initialsFromName(name)}</span>
        </div>
      )}
    </div>
  );
}

export function RuneIconTile({
  patch,
  iconPath,
  name,
  subLabel,
  size = 40,
  variant = 'minor',
  invalid = false,
  accent = 'gold',
}: {
  patch: string;
  iconPath: string | null;
  name: string;
  subLabel?: string;
  size?: number;
  variant?: 'keystone' | 'minor' | 'secondary' | 'shard' | 'tree';
  invalid?: boolean;
  accent?: 'gold' | 'blue' | 'red' | 'neutral';
}) {
  const url = invalid ? null : getRuneIconUrl(patch, iconPath);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const showImg = Boolean(!invalid && url && failedUrl !== url);
  const tooltipText = subLabel ? `${name} — ${subLabel}` : name;

  return (
    <div
      className={`game-icon-wrap rune-tile rune-tile-${variant} rune-accent-${accent} ${invalid ? 'is-invalid' : ''}`}
      tabIndex={0}
      role="img"
      aria-label={tooltipText}
      data-tooltip={tooltipText}
      style={{ width: size, height: size }}
    >
      {invalid ? (
        <div className="icon-fallback-invalid" title={tooltipText}>
          <AlertTriangle size={Math.max(12, Math.round(size * 0.42))} />
        </div>
      ) : showImg ? (
        <img
          src={url!}
          alt={name}
          width={size}
          height={size}
          onError={() => setFailedUrl(url)}
        />
      ) : (
        <div className="icon-fallback-neutral" title={tooltipText}>
          <span style={{ fontSize: Math.max(9, Math.round(size * 0.28)) }}>
            {initialsFromName(name)}
          </span>
        </div>
      )}
      <span className="icon-tooltip" role="tooltip">
        {name}
        {subLabel ? <span className="icon-tooltip-sub">{subLabel}</span> : null}
      </span>
    </div>
  );
}

export function ItemIconTile({
  patch,
  iconFile,
  name,
  gold,
  reason,
  size = 50,
  invalid = false,
}: {
  patch: string;
  iconFile: string | null;
  name: string;
  gold?: number;
  reason?: string;
  size?: number;
  invalid?: boolean;
}) {
  const url = invalid ? null : getItemIconUrl(patch, iconFile);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const showImg = Boolean(!invalid && url && failedUrl !== url);
  const fullLabel = gold && gold > 0 ? `${name} (${gold}g)` : name;

  return (
    <div
      className={`game-icon-wrap item-tile ${invalid ? 'is-invalid' : ''}`}
      tabIndex={0}
      role="img"
      aria-label={reason ? `${fullLabel} — ${reason}` : fullLabel}
      style={{ width: size, height: size }}
    >
      {invalid ? (
        <div className="icon-fallback-invalid" title={fullLabel}>
          <AlertTriangle size={Math.max(14, Math.round(size * 0.36))} />
          <span style={{ fontSize: 8.5, lineHeight: 1 }}>Rev.</span>
        </div>
      ) : showImg ? (
        <img
          src={url!}
          alt={name}
          width={size}
          height={size}
          onError={() => setFailedUrl(url)}
        />
      ) : (
        <div className="icon-fallback-neutral" title={fullLabel}>
          <span style={{ fontSize: Math.max(9, Math.round(size * 0.22)), padding: '0 2px', textAlign: 'center' }}>
            {name.slice(0, 6)}
          </span>
        </div>
      )}
      <span className="icon-tooltip" role="tooltip">
        <strong>{fullLabel}</strong>
        {reason ? <span className="icon-tooltip-sub">{reason}</span> : null}
      </span>
    </div>
  );
}
