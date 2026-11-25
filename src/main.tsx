import { render } from 'preact';
import '@fontsource/pixelify-sans/latin-400.css';
import '@fontsource/pixelify-sans/latin-700.css';
import '@fontsource/alegreya-sans/latin-400.css';
import '@fontsource/alegreya-sans/latin-700.css';
import './styles.css';
import { App } from './ui/App';
import { installPixelUi } from './ui/pixelui';
import { currentLang, t } from './textos';
import { registerSw } from './platform/update';
import { VERSION } from './version';

document.documentElement.lang = currentLang();
document.title = t('pantallas.title.app');
installPixelUi();
render(<App />, document.getElementById('app')!);

// PWA: en la web publicada se guarda para abrirse sin conexión e instalarse como app.
if (
  import.meta.env.PROD &&
  'serviceWorker' in navigator &&
  (location.protocol === 'https:' || location.hostname === 'localhost')
) {
  registerSw(VERSION).catch(() => {
    /* sin service worker (p. ej. dentro de un iframe): el juego funciona igual */
  });
}
