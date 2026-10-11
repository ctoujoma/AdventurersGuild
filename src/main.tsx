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
