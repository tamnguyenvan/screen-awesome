// src/App.tsx
import { useState, useEffect } from 'react';
import { EditorPage } from './pages/EditorPage';
import { RecorderPage } from './pages/RecorderPage';

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
  
  if (route.startsWith('#editor')) {
    return <EditorPage />;
  }

  return <RecorderPage />;
}

export default App;