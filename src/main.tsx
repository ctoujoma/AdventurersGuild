import { render } from 'preact';
import '@fontsource/pixelify-sans/latin-400.css';
import '@fontsource/pixelify-sans/latin-700.css';
import '@fontsource/alegreya-sans/latin-400.css';
import '@fontsource/alegreya-sans/latin-700.css';
import './styles.css';
import { App } from './ui/App';
import { installPixelUi } from './ui/pixelui';

installPixelUi();
render(<App />, document.getElementById('app')!);

// PWA: en la web publicada se guarda para abrirse sin conexión e instalarse como app.
if (
  import.meta.env.PROD &&
  'serviceWorker' in navigator &&
  (location.protocol === 'https:' || location.hostname === 'localhost')
) {
  navigator.serviceWorker.register('./sw.js').catch(() => {
    /* sin service worker (p. ej. dentro de un iframe): el juego funciona igual */
  });
}
