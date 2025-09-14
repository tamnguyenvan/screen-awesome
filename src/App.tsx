// src/App.tsx
import { useState, useEffect } from 'react';
import { EditorPage } from './pages/EditorPage';
import { RecorderPage } from './pages/RecorderPage';
import { RendererPage } from './pages/RendererPage';

function App() {
  const [route, setRoute] = useState(window.location.hash);

  useEffect(() => {
    const handleHashChange = () => {
      setRoute(window.location.hash);
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => {
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, []);
  
  if (route.startsWith('#renderer')) { // Route mới cho worker
    return <RendererPage />;
  }

  if (route.startsWith('#editor')) {
    return <EditorPage />;
  }

  return <RecorderPage />;
}

export default App;