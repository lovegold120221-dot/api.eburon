/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { LiveAPIProvider } from './contexts/LiveAPIContext';
import EburonApp from './EburonApp';
import { GooglePicker } from './components/GooglePicker';
import { useEffect, useState } from 'react';
import { initFirebase } from './lib/firebase';

/**
 * Main application component that provides a streaming interface for Live API.
 */
function App() {
  const [initialized, setInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    initFirebase()
      .then(() => setInitialized(true))
      .catch((err) => {
        console.error("Critical Initialization Error:", err);
        setError("Eburon AI server is redeploying the server. Reference: INIT_FAIL");
      });
  }, []);

  if (error) {
    return (
      <div style={{ 
        display: 'flex', 
        height: '100vh', 
        width: '100vw', 
        alignItems: 'center', 
        justifyContent: 'center', 
        backgroundColor: '#000', 
        color: '#fff',
        fontFamily: 'sans-serif',
        padding: '20px',
        textAlign: 'center'
      }}>
        <div>
          <h2 style={{ color: 'var(--gold, #D4A017)' }}>⚠️ Configuration Error</h2>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  if (!initialized) {
    return (
      <div style={{ 
        display: 'flex', 
        height: '100vh', 
        width: '100vw', 
        alignItems: 'center', 
        justifyContent: 'center', 
        backgroundColor: '#000', 
        color: 'var(--gold, #D4A017)',
        fontSize: '18px',
        fontWeight: 600,
        flexDirection: 'column',
        gap: '12px'
      }}>
        <div className="loading-spinner" />
        <div>Initializing Beatrice...</div>
      </div>
    );
  }

  return (
    <LiveAPIProvider apiKey="PROXY">
      <EburonApp />
      <GooglePicker />
    </LiveAPIProvider>
  );
}

export default App;
