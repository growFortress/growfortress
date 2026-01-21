import { render } from 'preact';
import './styles/theme.css';
import './i18n/index.js'; // Initialize i18n before rendering
import { App } from './components/App.js';
import { audioManager } from './game/AudioManager.js';

const suppressedWarnings = new Set([
  '[DEPRECATED] Default export is deprecated. Instead use `import { create } from \'zustand\'`.',
]);

const originalWarn = console.warn.bind(console);
console.warn = (...args: unknown[]) => {
  if (typeof args[0] === 'string' && suppressedWarnings.has(args[0])) {
    return;
  }
  originalWarn(...args);
};

// Initialize services
console.log('Services initialized', { audioManager });

render(<App />, document.getElementById('root')!);
