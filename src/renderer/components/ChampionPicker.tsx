import { ArrowLeftRight, Plus, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { classifyChampionOrbType } from '../../engine/kaynMechanics';
import type { CatalogSnapshot } from '../../shared/types';
import { ChampionPortrait } from './GameIcon';

function normalizeSearch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/['.\s-]/g, '');
}

export function ChampionPicker({
  value,
  catalog,
  placeholder,
  disabled = false,
  ariaLabel,
  onChange,
}: {
  value: string | null;
  catalog: CatalogSnapshot;
  placeholder?: string;
  disabled?: boolean;
  ariaLabel: string;
  onChange: (championId: string | null) => void;
}) {
  const championsList = useMemo(
    () =>
      Object.values(catalog.champions).sort((a, b) =>
        a.name.localeCompare(b.name, 'pt-BR'),
      ),
    [catalog],
  );

  const selectedChamp = value ? catalog.champions[value] : null;
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    if (!query.trim()) {
      return championsList.slice(0, 12);
    }
    const q = normalizeSearch(query);
    return championsList
      .filter(
        (c) =>
          normalizeSearch(c.name).includes(q) || normalizeSearch(c.id).includes(q),
      )
      .slice(0, 14);
  }, [championsList, query]);

  useEffect(() => {
    const onOutsideClick = (ev: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(ev.target as Node)) {
        setIsOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', onOutsideClick);
    return () => document.removeEventListener('mousedown', onOutsideClick);
  }, []);

  const displayText = isOpen ? query : selectedChamp?.name ?? '';

  const selectChampion = (id: string | null) => {
    onChange(id);
    setQuery('');
    setIsOpen(false);
    setHighlightIndex(0);
  };

  return (
    <div className="picker-wrap" ref={wrapRef}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <input
          type="text"
          className="input"
          aria-label={ariaLabel}
          disabled={disabled}
          value={displayText}
          placeholder={placeholder ?? 'Vazio — digite para buscar...'}
          onFocus={() => {
            if (!disabled) {
              setIsOpen(true);
              setQuery('');
              setHighlightIndex(0);
            }
          }}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
            setHighlightIndex(0);
          }}
          onKeyDown={(e) => {
            if (!isOpen) {
              if (e.key === 'ArrowDown' || e.key === 'Enter') {
                setIsOpen(true);
                e.preventDefault();
              }
              return;
            }
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setHighlightIndex((i) => Math.min(filtered.length - 1, i + 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setHighlightIndex((i) => Math.max(0, i - 1));
            } else if (e.key === 'Enter') {
              e.preventDefault();
              const picked = filtered[highlightIndex];
              if (picked) selectChampion(picked.id);
            } else if (e.key === 'Escape') {
              e.preventDefault();
              setIsOpen(false);
              setQuery('');
            }
          }}
        />
        {value && !disabled ? (
          <button
            type="button"
            className="btn btn-xs btn-ghost"
            title="Limpar posição"
            aria-label={`Limpar ${ariaLabel}`}
            onClick={() => selectChampion(null)}
          >
            <X size={13} />
          </button>
        ) : null}
      </div>

      {isOpen && !disabled ? (
        <div className="picker-dropdown" role="listbox" aria-label={`Opções para ${ariaLabel}`}>
          {filtered.length === 0 ? (
            <div className="small-text muted-text" style={{ padding: 8 }}>
              Nenhum campeão encontrado para &ldquo;{query}&rdquo;.
            </div>
          ) : (
            filtered.map((champ, idx) => {
              const orb = classifyChampionOrbType(champ.id, champ.attackrange);
              const orbText =
                orb === 'melee' ? 'Melee' : orb === 'ranged' ? 'Ranged' : 'Híbrido';
              return (
                <button
                  key={champ.id}
                  type="button"
                  role="option"
                  aria-selected={idx === highlightIndex}
                  className={`picker-option ${idx === highlightIndex ? 'highlighted' : ''}`}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    selectChampion(champ.id);
                  }}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                    <ChampionPortrait
                      patch={catalog.patch}
                      imageFull={champ.imageFull}
                      name={champ.name}
                      size={22}
                    />
                    <span style={{ fontWeight: 600 }}>{champ.name}</span>
                  </span>
                  <span
                    className={`small-text ${
                      orb === 'ranged'
                        ? 'badge-blue'
                        : orb === 'melee'
                          ? 'badge-red'
                          : 'badge-amber'
                    }`}
                    style={{ padding: '1px 6px', borderRadius: 6, fontSize: 10.5 }}
                  >
                    {orbText}
                  </span>
                </button>
              );
            })
          )}
        </div>
      ) : null}
    </div>
  );
}

export function ChampionPortraitSlot({
  value,
  roleLabel,
  side,
  catalog,
  disabled = false,
  ariaLabel,
  onChange,
  onSwapNext,
}: {
  value: string | null;
  roleLabel: string;
  side: 'ally' | 'enemy';
  catalog: CatalogSnapshot;
  disabled?: boolean;
  ariaLabel: string;
  onChange: (championId: string | null) => void;
  onSwapNext?: () => void;
}) {
  const championsList = useMemo(
    () =>
      Object.values(catalog.champions).sort((a, b) =>
        a.name.localeCompare(b.name, 'pt-BR'),
      ),
    [catalog],
  );

  const selectedChamp = value ? catalog.champions[value] : null;
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlightIndex, setHighlightIndex] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    if (!query.trim()) return championsList.slice(0, 12);
    const q = normalizeSearch(query);
    return championsList
      .filter(
        (c) =>
          normalizeSearch(c.name).includes(q) || normalizeSearch(c.id).includes(q),
      )
      .slice(0, 14);
  }, [championsList, query]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [isOpen]);

  useEffect(() => {
    const onOutsideClick = (ev: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(ev.target as Node)) {
        setIsOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', onOutsideClick);
    return () => document.removeEventListener('mousedown', onOutsideClick);
  }, []);

  const pickChampion = (id: string | null) => {
    onChange(id);
    setIsOpen(false);
    setQuery('');
    setHighlightIndex(0);
  };

  return (
    <div className="champ-slot-wrap" ref={wrapRef}>
      <button
        type="button"
        className={`champ-slot-tile champ-slot-${side} ${selectedChamp ? 'has-champ' : 'is-empty'} ${disabled ? 'is-locked' : ''}`}
        aria-label={ariaLabel}
        title={
          selectedChamp
            ? `${roleLabel}: ${selectedChamp.name}${disabled ? ' (fixo)' : ' — clique para trocar'}`
            : `${roleLabel}: vazio — clique para escolher`
        }
        disabled={disabled}
        onClick={() => {
          if (!disabled) {
            setIsOpen((o) => !o);
            setQuery('');
            setHighlightIndex(0);
          }
        }}
      >
        {selectedChamp ? (
          <ChampionPortrait
            patch={catalog.patch}
            imageFull={selectedChamp.imageFull}
            name={selectedChamp.name}
            size={64}
            className="champ-slot-img"
          />
        ) : (
          <div className="champ-slot-placeholder">
            <Plus size={18} />
          </div>
        )}
        <span className="champ-slot-role">{roleLabel}</span>
        <span className="champ-slot-name">
          {selectedChamp ? selectedChamp.name : '—'}
        </span>
      </button>

      {isOpen && !disabled ? (
        <div className="champ-slot-popover" role="dialog" aria-label={`Escolher ${ariaLabel}`}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: 6, borderBottom: '1px solid var(--border)' }}>
            <input
              ref={inputRef}
              type="text"
              className="input"
              style={{ padding: '4px 7px', fontSize: 12 }}
              placeholder={`Buscar ${roleLabel}...`}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setHighlightIndex(0);
              }}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  setHighlightIndex((i) => Math.min(filtered.length - 1, i + 1));
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  setHighlightIndex((i) => Math.max(0, i - 1));
                } else if (e.key === 'Enter') {
                  e.preventDefault();
                  const picked = filtered[highlightIndex];
                  if (picked) pickChampion(picked.id);
                } else if (e.key === 'Escape') {
                  e.preventDefault();
                  setIsOpen(false);
                }
              }}
            />
            {onSwapNext ? (
              <button
                type="button"
                className="btn btn-xs btn-ghost"
                title="Trocar posição (flex pick)"
                onClick={() => {
                  onSwapNext();
                  setIsOpen(false);
                }}
              >
                <ArrowLeftRight size={12} />
              </button>
            ) : null}
            {value ? (
              <button
                type="button"
                className="btn btn-xs btn-ghost"
                title="Limpar vaga"
                onClick={() => pickChampion(null)}
              >
                <X size={12} />
              </button>
            ) : null}
          </div>
          <div className="champ-slot-list" role="listbox">
            {filtered.length === 0 ? (
              <div className="small-text muted-text" style={{ padding: 8 }}>
                Nenhum campeão para &ldquo;{query}&rdquo;.
              </div>
            ) : (
              filtered.map((champ, idx) => {
                const orb = classifyChampionOrbType(champ.id, champ.attackrange);
                return (
                  <button
                    key={champ.id}
                    type="button"
                    role="option"
                    aria-selected={idx === highlightIndex}
                    className={`picker-option ${idx === highlightIndex ? 'highlighted' : ''}`}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      pickChampion(champ.id);
                    }}
                  >
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                      <ChampionPortrait
                        patch={catalog.patch}
                        imageFull={champ.imageFull}
                        name={champ.name}
                        size={22}
                      />
                      <span style={{ fontWeight: 600 }}>{champ.name}</span>
                    </span>
                    <span
                      className={
                        orb === 'ranged'
                          ? 'badge-blue'
                          : orb === 'melee'
                            ? 'badge-red'
                            : 'badge-amber'
                      }
                      style={{ padding: '1px 5px', borderRadius: 5, fontSize: 10 }}
                    >
                      {orb === 'melee' ? 'Melee' : orb === 'ranged' ? 'Ranged' : 'Híbrido'}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
