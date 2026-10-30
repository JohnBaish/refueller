import { Component, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { REPORT_URL, Results } from './components/Results.tsx';
import { ThemeSwitch } from './components/ThemeSwitch.tsx';
import { loadIndex } from './lib/load.ts';
import { readPostcode, type PostcodeResult } from './lib/search.ts';

// The page has two states: the postcode screen, and a postcode district's results. The district is kept in the address
// after "#" (#RG4: browsers never send that part, and the visit statistics drop it) and on this device as the last choice.
const CHOICE = 'refueller.choice';

function fromHash(): string | null {
  const h = decodeURIComponent(location.hash.slice(1)).toUpperCase();
  return /^[A-Z]{1,2}\d[A-Z\d]?$/.test(h) ? h : null;
}
function remembered(): string | null {
  try {
    return localStorage.getItem(CHOICE) || null;
  } catch {
    return null;
  }
}
function remember(outcode: string) {
  try {
    localStorage.setItem(CHOICE, outcode);
  } catch {
    // Not kept; the page still works.
  }
}

const PROBLEMS: Record<Exclude<PostcodeResult, { ok: true }>['problem'], (typed: string) => string> = {
  empty: () => 'Please type a postcode, such as RG4 7HN.',
  'not-a-postcode': () => 'That doesn’t look like a postcode. Try one like RG4 or RG4 7HN.',
  'northern-ireland': () => 'Refueller covers Great Britain only for now, so Northern Ireland postcodes aren’t included yet.',
  'not-found': (typed) => `We can’t find ${typed.trim().toUpperCase().split(/\s+/)[0]} among Great Britain’s postcodes. Check it, or try a nearby postcode.`,
};

function SearchBox({ start, initial }: { start: boolean; initial: string }) {
  const [typed, setTyped] = useState(initial);
  const [problem, setProblem] = useState('');
  useEffect(() => setTyped(initial), [initial]);

  async function go(e: FormEvent) {
    e.preventDefault();
    setProblem('');
    let outcodes;
    try {
      outcodes = (await loadIndex()).outcodes;
    } catch {
      setProblem('Sorry, the postcodes couldn’t be loaded. Check your connection and try again.');
      return;
    }
    const r = readPostcode(typed, outcodes);
    if (!r.ok) {
      setProblem(PROBLEMS[r.problem](typed));
      return;
    }
    remember(r.outcode);
    location.hash = r.outcode;
  }

  return (
    <form className="search-form" onSubmit={go} noValidate>
      <div className="search">
        <input
          className="input"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          placeholder="RG4 or RG4 7HN"
          aria-label="Postcode"
          autoCapitalize="characters"
          autoCorrect="off"
          autoComplete="off"
          spellCheck={false}
          enterKeyHint="go"
          maxLength={10}
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
      {start && !problem && <p className="hint">Only the first half (RG4) is used. Nothing you type leaves this page.</p>}
    </form>
  );
}

function About() {
  // Draft wording (Claude, 30 October), for John to edit.
  return (
    <section className="about">
      <h3>About these figures</h3>
      <p>
        Prices and opening times come from the Government’s Fuel Finder service, which petrol stations are required to keep
        up to date. Refueller collects them twice a day, at about 10.15am and 4.15pm. Under each price is how long ago the
        station set it. Stations report a price when it changes, so an older price may well still be right.
      </p>
      <p>
        Only unleaded (E10) and standard diesel are shown. A price below 100p or above 300p a litre is taken as a mistake and
        left out.
      </p>
      <p>How to read the list:</p>
      <ul>
        <li>
          <strong>Cheapest</strong> marks the lowest unleaded and the lowest diesel price among the stations shown.
        </li>
        <li>“Price set …” is shown in blue when the price was set more than 45 days ago.</li>
        <li>
          A blue “Unusual price” note means the price is more than 30p away from the middle price across Great Britain,
          and may be a mistake. It is never marked as the cheapest.
        </li>
        <li>A grey “Closed until …” means the station is closed now; its row is shown fainter.</li>
        <li>
          “Opening hours look wrong” means the hours given by the station are unlikely to be right (often 6pm given for
          6am).
        </li>
      </ul>
      <p>
        Distances are in a straight line from the middle of the postcode district, so they’re approximate. Stations that Fuel
        Finder lists as temporarily closed are left out, and so are a few whose position on the map is far from their own
        postcode. Opening times are each station’s usual hours, including bank holidays, and may differ on the day.
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

export default function App() {
  const [outcode, setOutcode] = useState<string | null>(() => fromHash() ?? remembered());
  useEffect(() => {
    const onHash = () => {
      setOutcode(fromHash());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  // A remembered district opens with its address, so Back and sharing behave as if it had been typed.
  useEffect(() => {
    if (outcode && !fromHash()) history.replaceState(null, '', `#${outcode}`);
  }, [outcode]);

  const start = outcode === null;
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
        <div className="page-head">
          <div className="card-kicker">Fuel prices</div>
          <h2>{start ? 'Check fuel prices near you' : 'Refueller'}</h2>
          {start && <p className="lead">Enter a postcode to see the eight nearest petrol stations, with their unleaded and diesel prices and opening times.</p>}
          <SearchBox start={start} initial={outcode ?? ''} />
        </div>
        <SafetyNet key={outcode ?? ''}>{outcode && <Results outcode={outcode} />}</SafetyNet>
        {!start && <About />}
        <footer className="footer-notice" data-noprint>
          <p>
            Prices from the Government’s Fuel Finder service. Contains public sector information licensed under the Open
            Government Licence v3.0.{' '}
            <a href={REPORT_URL} target="_blank" rel="noopener noreferrer">
              Report a wrong price to Fuel Finder
            </a>
            .
          </p>
          <p>
            Postcode positions: Contains OS data © Crown Copyright and database rights 2026. Contains Royal Mail data © Royal
            Mail copyright and database right 2026. Contains National Statistics data © Crown copyright and database right 2026.
          </p>
          <p>
            Refueller is a free-to-use personal project by John Baish, not connected with the Fuel Finder service. We don’t
            record anything you do here, apart from anonymous visit statistics (no cookies, no personal data), showing us how
            the site is used. Your device, rather than the website, stores your last choices (postcode district and light or
            dark mode), so the page opens the same way next time.
          </p>
          <p>
            More free tools at <a href="https://www.baish.net/">www.baish.net</a>.
          </p>
        </footer>
      </main>
    </>
  );
}
