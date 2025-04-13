import * as React from 'react';
import * as ReactDOM from 'react-dom/client';
import { Excalidraw } from '@excalidraw/excalidraw';
import type { ExcalidrawImperativeAPI, AppState } from '@excalidraw/excalidraw/dist/types/excalidraw/types';
import type { ExcalidrawElement as OrderedExcalidrawElement } from '@excalidraw/element/types';
import type { BinaryFiles } from '@excalidraw/excalidraw/dist/types/excalidraw/types';
import Sidebar from './Sidebar';

// Import CSS directly
import './styles/excalidraw-overrides.css';
import '@excalidraw/excalidraw/dist/excalidraw.css';

console.log('Script loaded - looking for root element');

const rootElement = document.getElementById('app');
if (!rootElement) {
  console.error('Failed to find root element');
  throw new Error('Failed to find the root element');
}

console.log('Root element found, creating React root');
const root = ReactDOM.createRoot(rootElement);

const App = () => {
  console.log('Rendering App component');
  const [excalidrawAPI, setExcalidrawAPI] = React.useState<ExcalidrawImperativeAPI | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<Error | null>(null);

  React.useEffect(() => {
    try {
      // Initialize any required Excalidraw dependencies
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
      setLoading(false);
    }
  }, []);

  if (loading) {
    return <div>Loading Excalidraw...</div>;
  }

  if (error) {
    return <div>Error loading Excalidraw: {error.message}</div>;
  }

  const onChange = (
    elements: readonly OrderedExcalidrawElement[], 
    appState: AppState, 
    files: BinaryFiles
  ) => {
    console.log('Excalidraw state changed:', elements, appState, files);
  };

  const onPointerUpdate = (payload: { pointer: { x: number; y: number } }) => {
    console.log('Excalidraw pointer update:', payload);
  };

  return (
    <div style={{ display: 'flex' }}>
      <Sidebar excalidrawAPI={excalidrawAPI} />
      <div style={{ height: '500px', width: '800px' }}>
        <Excalidraw
          excalidrawAPI={(api: ExcalidrawImperativeAPI) => {
            setExcalidrawAPI(api);
          }}
          onChange={onChange}
          onPointerUpdate={onPointerUpdate}
          initialData={{
            appState: {
              viewBackgroundColor: '#ffffff',
              width: 800,
              height: 500,
            },
          }}
        />
      </div>
    </div>
  );
};

console.log('Starting React render');
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
console.log('Render completed');