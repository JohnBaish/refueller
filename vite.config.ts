import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';
import { SOURCES, writePageData } from './scripts/lib/pageData.ts';

// The page's data files (scripts/lib/pageData.ts), made from data/ before every build and dev start, into public/data,
// which Vite then copies into the site. Each collector commit to main makes Vercel rebuild with the new prices.
function refuellerData(): Plugin {
  return {
    name: 'refueller-data',
    buildStart() {
      for (const f of SOURCES) this.addWatchFile(f);
      const index = writePageData(process.cwd());
      console.log(`page data: ${index.points.length} stations in ${index.areas.length} postcode areas, prices collected ${index.collected}`);
    },
  };
}

export default defineConfig({
  plugins: [react(), refuellerData()],
  build: { outDir: 'dist' },
});
