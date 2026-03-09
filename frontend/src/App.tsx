import { Routes, Route } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

function BoardPlaceholder() {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        color: 'text.primary',
      }}
    >
      <Typography variant="h4">Board — coming soon</Typography>
    </Box>
  );
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/board/:topic" element={<BoardPlaceholder />} />
    </Routes>
  );
}

export default App;
