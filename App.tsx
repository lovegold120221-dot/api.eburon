/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { LiveAPIProvider } from './contexts/LiveAPIContext';
import EburonApp from './EburonApp';
import { GooglePicker } from './components/GooglePicker';

/**
 * Main application component that provides a streaming interface for Live API.
 */
function App() {
  return (
    <LiveAPIProvider apiKey="PROXY">
      <EburonApp />
      <GooglePicker />
    </LiveAPIProvider>
  );
}

export default App;
