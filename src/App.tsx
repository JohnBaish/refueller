import { Component, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { JourneyForm, JourneyResults } from './components/Journey.tsx';
import { getPlaces, PlaceBox } from './components/PlaceBox.tsx';
import { REPORT_URL, Results, type Target } from './components/Results.tsx';
import { ThemeSwitch } from './components/ThemeSwitch.tsx';
import { loadIndex } from './lib/load.ts';
import { ROAD_CREDIT } from './lib/calc.ts';
import { fullHash } from './lib/postcodes.ts';
import { readRouteHash, routeHash, type RouteTarget } from './lib/route.ts';
import { POSTCODE_PROBLEMS, readPostcode } from './lib/search.ts';
import { findPlace, looksLikePostcode, namesakes, placeAt, placeLabel, type NamedPlace } from './lib/places.ts';

// The page has two states: the postcode screen, and the results for a postcode or district. It is kept in the address after "#"
// (#RG4 or #RG4-7HN: browsers never send that part, and the visit statistics drop it) and on this device as the last choice.
const CHOICE = 'refueller.choice';

// The address after "#": a postcode district (#RG4), a place (#@Caversham, or #@Newport, Isle of Wight; John, 1 November) or a
// station (#station/RG/d20f21e97871, "Find stations near this one").
// Or a journey (#route/RG1/BS1, src/lib/route.ts), which isn't remembered as the last choice.
type AppTarget = Target | RouteTarget;
function fromHash(): AppTarget | null {
  const h = decodeURIComponent(location.hash.slice(1));
  const route = readRouteHash(h);
  if (route) return route;
  const st = /^station\/([A-Za-z]{1,2})\/([0-9a-f]{12})$/.exec(h);
  if (st) return { kind: 'station', area: st[1].toUpperCase(), id: st[2] };
  return choiceTarget(h);
}
// "RG4", "RG4-7HN" or "@Caversham" (also as kept on the device) into a target.
function choiceTarget(h: string): Target | null {
  if (h.startsWith('@') && h.length > 1) {
    const [place, at] = h.slice(1).split('~');
    return { kind: 'place', place, ...(at ? { at } : {}) };
  }
  const m = /^([A-Z]{1,2}\d[A-Z\d]?)(?:-(\d[A-Z]{2}))?$/.exec(h.toUpperCase());
  return m ? { kind: 'postcode', outcode: m[1], ...(m[2] ? { inward: m[2] } : {}) } : null;
}
function remembered(): string | null {
  try {
    return localStorage.getItem(CHOICE) || null;
  } catch {
    return null;
  }
}
// The full postcode when one was typed (John, 31 October), otherwise the district; on this device only.
function remember(choice: string) {
  try {
    localStorage.setItem(CHOICE, choice);
  } catch {
    // Not kept; the page still works.
  }
}


const placeHash = (p: NamedPlace) => {
  const at = placeAt(p);
  return `@${placeLabel(p)}${at ? `~${at}` : ''}`;
};

function SearchBox({ start, initial, initialAt }: { start: boolean; initial: string; initialAt?: string }) {
  const [typed, setTyped] = useState(initial);
  const [problem, setProblem] = useState('');
  // The place picked from the list, to tell apart the few places that share a whole label.
  const [picked, setPicked] = useState<NamedPlace | null>(null);
  useEffect(() => setTyped(initial), [initial]);

  async function go(e: FormEvent) {
    e.preventDefault();
    setProblem('');
    const t = typed.trim();
    if (t && !looksLikePostcode(t)) {
      let ix;
      try {
        ix = await getPlaces();
      } catch {
        setProblem('Sorry, the places couldn’t be loaded. Check your connection and try again.');
        return;
      }
      const at = picked && placeLabel(picked) === t ? placeAt(picked) : t === initial ? initialAt : undefined;
      const f = ix ? findPlace(ix, t, at) : ({ ok: false, problem: 'none' } as const);
      if (!f.ok) {
        setProblem(
          f.problem === 'several'
            ? `There’s more than one ${f.places[0].name}. Choose one from the list as you type, such as ${namesakes(f.places)}.`
            : `We can’t find “${t}” among Great Britain’s postcodes, towns, villages and suburbs. Check the spelling, or try a postcode.`,
        );
        return;
      }
      const choice = placeHash(f.place);
      remember(choice);
      location.hash = choice;
      return;
    }
    let outcodes;
    try {
      outcodes = (await loadIndex()).outcodes;
    } catch {
      setProblem('Sorry, the postcodes couldn’t be loaded. Check your connection and try again.');
      return;
    }
    const r = readPostcode(typed, outcodes);
    if (!r.ok) {
      setProblem(POSTCODE_PROBLEMS[r.problem](typed));
      return;
    }
    const choice = r.inward ? fullHash(r.outcode, r.inward) : r.outcode;
    remember(choice);
    location.hash = choice;
  }

  return (
    <form className="search-form" onSubmit={go} noValidate>
      <div className="search">
        <PlaceBox
          id="where"
          ariaLabel="Postcode or place"
          placeholder="Reading, RG1 or RG1 8FR"
          postcodes
          enterKeyHint="go"
          value={typed}
          onChange={setTyped}
          onPick={setPicked}
        />
        <button type="submit" className="btn btn-primary">
          Go
        </button>
      </div>
      {problem && (
        <p className="problem" role="alert">
          {problem}
        </p>
      )}
      {start && !problem && (
        <p className="hint">Type your full postcode for the most accurate list, just the first half (RG1), or a town, village or suburb. Nothing you type leaves this page.</p>
      )}
    </form>
  );
}

function About() {
  // Draft wording (Claude, 30 October), for John to edit.
  return (
    <section className="about">
      <h3>About these figures</h3>
      <p>
        Prices and opening times come from the Government’s Fuel Finder service. Refueller collects them twice a day, at about 10.15am and 4.15pm. Underneath each price we show the period of
        time it’s been in effect. Petrol stations only make a report when it changes, so a long period normally indicates stable
        prices rather than an error.
      </p>
      <p>
        Only unleaded (E10) and standard diesel are shown. A price below 100p or above 300p a litre is assumed to be a mistake and
        left out.
      </p>
      <ul>
        <li>
          “Cheapest” marks the lowest unleaded and the lowest diesel price among the eight stations on the list.
        </li>
        <li>
          Costco only sells fuel to its members. Its filling stations are always shown if they’re in the nearest eight but with a
          “Members only” flag. If Costco’s fuel is the cheapest, two “Cheapest” flags are shown, one for Costco members and the
          standard one for everyone else.
        </li>
        <li>“Same price for …” is shown in blue when the price has been the same for more than 45 days, in case it’s wrong.</li>
        <li>The small chart under each price shows where it sits among the eight stations, from lowest to highest.</li>
        <li>
          A blue “Unusual price” note means the price is more than 30p away from the middle price across Great Britain,
          and may be a mistake, unless the station is in the Highlands and Islands of Scotland or on the Isles of Scilly,
          where higher prices are usual: there, a higher price isn’t marked. An unusual price is never marked as the
          cheapest.
        </li>
        <li>A grey “Closed until …” means the station is closed now; its row is shown more faintly.</li>
        <li>
          “Opening hours look wrong” means the hours given by the station are unlikely to be right (often 6pm given for
          6am).
        </li>
      </ul>
      <p>
        The choice of the “nearest” eight stations which appear in the list is calculated using the distances in a straight
        line from your postcode, or from the middle of its district if you only type the first half, or from the middle of the place if you
        type a place name, so they’re approximate. Stations that Fuel
        Finder lists as temporarily closed are left out, and so are a few whose position on the map is far from their own
        postcode. Opening times are each station’s usual hours, including bank holidays, and may differ on the day.
      </p>
      <p>
        <strong>Worth driving here?</strong> compares a station with the nearest open station in the list selling the same
        fuel. It works out how much fuel your money buys at the nearer station, how much less it would cost at this one, and
        how much fuel the extra miles there and back would use, from your car’s miles per gallon (the defaults are typical
        figures: 36 for petrol and 43 for diesel; change them to your car’s). The extra miles are by road from the middle of the
        postcode district, even when you type a full postcode (for a place name, the nearest district’s middle), using Ordnance Survey’s map of every road; they don’t allow for one-way streets or turns, so a sat
        nav may give a little more. Where there’s no road figure, type your own. The calculation can’t factor in your time, or wear and tear on the car.
      </p>
      <p>
        <strong>Price history</strong> shows a station’s price over the last 14 days, against the average of the stations
        shown. The official data only gives each station’s current price and the date that price came into effect, so the history is
        Refueller’s own record, taken at each collection. A price that changed twice between 10.15am and 4.15pm,
        or between 4.15pm and 10.15am, shows only its later change.
      </p>
      <p>
        {/* Draft for John (November 1st): the averages at every level. */}
        <strong>The wider picture</strong> gives the average price at the stations shown, then in the council area, county, region
        and country they’re in, and in Great Britain, each with a fact picked from the figures. Averages leave out unusual prices,
        and a council area, county or region is only shown when at least five of its stations sell the fuel. The council area is
        worked out from the postcode, using Ordnance Survey’s records of which council area each postcode is in.
      </p>
      <p>
        <strong>Find cheaper fuel near the route</strong> works out the quickest route between the places you type, on your
        device, from Ordnance Survey’s map of motorways, A roads and B roads, using rough speeds for each kind of road. It lists
        the eight cheapest stations within about two miles of that route that add no more than three miles and about six minutes to
        the journey, there and back (a short detour through a busy town can take much longer than its miles suggest), in the order
        you’d reach them. A “via” place is handled as one the route passes near, within about three miles, rather than a stop: so
        Reading to Exeter via Andover keeps to the A303, and via Royal Wootton Bassett it keeps to the M4. Place names come from
        Ordnance Survey’s list of cities, towns, villages and suburbs. For comparison we also show the cheapest stations nearest the
        start and end of the journey. One-way streets and turns aren’t known and minor roads are left out, so the distances are a guide.
      </p>
    </section>
  );
}

class SafetyNet extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="message" role="alert">
        <p>Sorry, this page couldn’t be shown. Try another postcode, or try again later.</p>
        <a className="btn btn-secondary" href="#">
          Start again
        </a>
      </div>
    );
  }
}

const fromRemembered = (): Target | null => {
  const o = remembered();
  return o ? choiceTarget(o) : null;
};
const hashOf = (t: AppTarget) => (t.kind === 'route' ? routeHash(t) : t.kind === 'postcode' ? (t.inward ? fullHash(t.outcode, t.inward) : t.outcode) : t.kind === 'place' ? `@${t.place}${t.at ? `~${t.at}` : ''}` : `station/${t.area}/${t.id}`);

// The journey planner as an open section at the bottom of the main page, just above About (John, 1 November: to try).
const JourneySection = () => (
  <section className="journey-front" data-noprint>
    <h3>Find cheaper fuel near the route</h3>
    <p className="lead">
      Type where you’re starting and where you’re going. Refueller finds the cheapest stations that add no more than three miles and about six minutes
      to your journey.
    </p>
    <JourneyForm target={{ kind: 'route' }} />
  </section>
);

export default function App() {
  const [target, setTarget] = useState<AppTarget | null>(() => fromHash() ?? fromRemembered());
  useEffect(() => {
    const onHash = () => {
      setTarget(fromHash());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  // A remembered district opens with its address, so Back and sharing behave as if it had been typed.
  useEffect(() => {
    if (target && !fromHash()) history.replaceState(null, '', `#${hashOf(target)}`);
  }, [target]);

  const start = target === null;
  const route = target?.kind === 'route' ? target : null;
  return (
    <>
      <nav className="nav" data-noprint>
        <a className="nav-brand" href="#" onClick={() => remember('')}>
          Refueller
        </a>
        <div className="nav-right">
          <ThemeSwitch />
        </div>
      </nav>
      <main className="col">
        {route ? (
          <div className="page-head">
            <div className="card-kicker">Fuel prices</div>
            <h2>Find cheaper fuel near the route</h2>
            <p className="lead">
              Type where you’re starting and where you’re going. Refueller finds the cheapest stations that add no more than three miles and about six
              minutes to your journey.
            </p>
            <JourneyForm target={route} />
          </div>
        ) : (
          <div className="page-head">
            <div className="card-kicker">Fuel prices</div>
            <h2>{start ? 'Check fuel prices near you' : 'Refueller'}</h2>
            {start && <p className="lead">Enter a postcode or a place to see the eight nearest petrol stations, with their unleaded and diesel prices and opening times.</p>}
            <SearchBox
              start={start}
              initial={target?.kind === 'postcode' ? `${target.outcode}${target.inward ? ` ${target.inward}` : ''}` : target?.kind === 'place' ? target.place : ''}
              initialAt={target?.kind === 'place' ? target.at : undefined}
            />
          </div>
        )}
        <SafetyNet key={target ? hashOf(target) : ''}>
          {route ? <JourneyResults target={route} /> : target && target.kind !== 'route' && <Results target={target} />}
        </SafetyNet>
        {!route && <JourneySection />}
        {!start && <About />}
        <footer className="footer-notice">
          {/* The source lines only where prices are shown; the postcode screen keeps just the project and privacy lines
              (John, 30 October). */}
          {!start && (
            <>
              <p>
                Prices from the Government’s Fuel Finder service. Contains public sector information licensed under the Open
                Government Licence v3.0.{' '}
                <a href={REPORT_URL} target="_blank" rel="noopener noreferrer">
                  Report a wrong price to Fuel Finder
                </a>
                .
              </p>
              <p>
                Postcode and place positions, and council areas: Contains OS data © Crown Copyright and database rights 2026. Contains Royal Mail data © Royal
                Mail copyright and database right 2026. Contains National Statistics data © Crown copyright and database right 2026.
              </p>
              <p>Road distances: {ROAD_CREDIT}.</p>
            </>
          )}
          {/* Printed: the source and credit lines above; not these two (fresh look 2.4, November 1st 2026). */}
          <p data-noprint>
            Refueller is a free-to-use personal project by John Baish, not connected with the Fuel Finder service. We don’t
            record anything you do here, apart from anonymous visit statistics (no cookies, no personal data), showing us how
            the site is used. Your device, rather than the website, stores your last choices (postcode or place, light or
            dark mode, how you sorted the list, the fuel you chose, and the calculator’s amount and miles per gallon), so the page opens the same way next time.
          </p>
          <p data-noprint>
            More free tools at{' '}
            <a href="https://www.baish.net/" target="_blank" rel="noopener noreferrer">
              www.baish.net
            </a>
            . Contact: workshop@baish.net.
          </p>
        </footer>
      </main>
    </>
  );
}
