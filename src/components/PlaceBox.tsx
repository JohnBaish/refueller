import { useEffect, useState } from 'react';
import { loadIndex, loadPlaces } from '../lib/load.ts';
import { looksLikePostcode, makePlaceIndex, norm, placeLabel, suggest, type NamedPlace, type PlaceIndex } from '../lib/places.ts';

// The place names, loaded the first time a name is typed, and kept for the visit.
let placeIndex: { file: string; ix: Promise<PlaceIndex> } | null = null;
export async function getPlaces(): Promise<PlaceIndex | null> {
  const index = await loadIndex();
  if (!index.places) return null;
  if (placeIndex?.file !== index.places.file) placeIndex = { file: index.places.file, ix: loadPlaces(index.places.file).then(makePlaceIndex) };
  return placeIndex.ix.catch((e) => {
    placeIndex = null;
    throw e;
  });
}

// One box for a place name (or a postcode too, where `postcodes`), with place suggestions as you type: the journey planner's
// From, Via and To, and the main search (John, 1 November).
export function PlaceBox({ id, label, ariaLabel, placeholder, postcodes, enterKeyHint, value, onChange, onPick }: {
  id: string;
  label?: string;
  ariaLabel?: string;
  placeholder: string;
  postcodes: boolean; // a postcode can be typed here too (no suggestions for one)
  enterKeyHint: 'go' | 'next';
  value: string;
  onChange: (v: string) => void;
  onPick: (p: NamedPlace) => void;
}) {
  const [list, setList] = useState<NamedPlace[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  useEffect(() => {
    let live = true;
    const typed = value.trim();
    if (typed.length < 2 || (postcodes && looksLikePostcode(typed))) {
      setList([]);
      return;
    }
    getPlaces().then(
      (ix) => live && setList(ix ? suggest(ix, typed) : []),
      () => live && setList([]),
    );
    return () => {
      live = false;
    };
  }, [value, postcodes]);
  // Closed once what's typed is exactly one of the places (so it never covers the Find button needlessly).
  const shown = open && list.length > 0 && !list.some((p) => norm(placeLabel(p)) === norm(value));
  const pick = (p: NamedPlace) => {
    onChange(placeLabel(p));
    onPick(p);
    setOpen(false);
    setActive(-1);
  };
  return (
    <div className="jf">
      {label && (
        <label className="jl" htmlFor={id}>
          {label}
        </label>
      )}
      <input
        id={id}
        className="input"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setActive(-1);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={(e) => {
          if (!shown) return;
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            setActive((a) => (e.key === 'ArrowDown' ? Math.min(list.length - 1, a + 1) : Math.max(-1, a - 1)));
          } else if (e.key === 'Enter' && active >= 0) {
            e.preventDefault();
            pick(list[active]);
          } else if (e.key === 'Escape') setOpen(false);
        }}
        placeholder={placeholder}
        aria-label={label ? undefined : ariaLabel}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={shown}
        aria-controls={`${id}-list`}
        aria-activedescendant={shown && active >= 0 ? `${id}-${active}` : undefined}
        autoCorrect="off"
        autoComplete="off"
        spellCheck={false}
        enterKeyHint={enterKeyHint}
        maxLength={60}
      />
      {shown && (
        <ul className="suggest" id={`${id}-list`} role="listbox">
          {list.map((p, i) => (
            <li
              key={`${p.name}|${p.area}|${p.lat}`}
              id={`${id}-${i}`}
              role="option"
              aria-selected={i === active}
              className={i === active ? 'on' : undefined}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(p)}
            >
              <span className="sg-name">{p.name}</span>
              {p.area && norm(p.area) !== norm(p.name) && <span className="sg-area">{p.clash ? `${p.area} (${p.district})` : p.area}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
