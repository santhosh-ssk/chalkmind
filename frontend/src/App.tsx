import { Routes, Route } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import BoardPage from './pages/BoardPage';
import TermsPage from './pages/TermsPage';
import { usePageTracking } from './hooks/usePageTracking';

function App() {
  usePageTracking();
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/board/:topic" element={<BoardPage />} />
      <Route path="/terms" element={<TermsPage />} />
    </Routes>
  );
}

export default App;
