import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { AuthProvider } from './lib/auth.jsx';
import '@fontsource/plus-jakarta-sans/400';
import '@fontsource/plus-jakarta-sans/500';
import '@fontsource/plus-jakarta-sans/600';
import '@fontsource/plus-jakarta-sans/700';
import '@fontsource/plus-jakarta-sans/800';
import './styles.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
);
