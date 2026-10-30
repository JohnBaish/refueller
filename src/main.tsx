import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Analytics } from '@vercel/analytics/react';
import './styles/organic.css';
import './styles/global.css';
import App from './App.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    {/* The visit statistics get the page's address without the part after "#", which holds the postcode district:
        the page promises nothing typed is sent anywhere. */}
    <Analytics beforeSend={(event) => ({ ...event, url: event.url.split('#')[0] })} />
  </StrictMode>,
);
