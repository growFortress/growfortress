import { render } from 'preact';
import './styles/theme.css';
import './i18n/index.js'; // Initialize i18n before rendering
import { App } from './components/App.js';
import { audioManager } from './game/AudioManager.js';

// Initialize services
console.log('Services initialized', { audioManager });

render(<App />, document.getElementById('root')!);
