import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import InputBase from '@mui/material/InputBase';
import Link from '@mui/material/Link';

const TOPIC_PILLS = [
  'Photosynthesis',
  'How DNS Works',
  'Quantum Computing',
  'Machine Learning',
  'Black Holes',
];

const HOW_IT_WORKS = [
  {
    icon: 'hub',
    title: 'Ask anything',
    description:
      'Simply type any topic you want to learn about, from basic science to advanced algorithms.',
    gradient: 'linear-gradient(135deg, rgba(147,51,234,0.2), rgba(147,51,234,0.1))',
    color: '#a855f7',
    shadow: 'rgba(168,85,247,0.2)',
    border: 'rgba(147,51,234,0.2)',
  },
  {
    icon: 'animation',
    title: 'Watch it unfold',
    description:
      'Our AI creates a real-time visual explanation on a virtual chalkboard, narrated step-by-step.',
    gradient: 'linear-gradient(135deg, rgba(20,184,166,0.2), rgba(20,184,166,0.1))',
    color: '#2dd4bf',
    shadow: 'rgba(20,184,166,0.2)',
    border: 'rgba(20,184,166,0.2)',
  },
  {
    icon: 'interactive_space',
    title: 'Jump in anytime',
    description:
      'Pause, ask follow-up questions, or explore related concepts instantly as you learn.',
    gradient: 'linear-gradient(135deg, rgba(16,185,129,0.2), rgba(16,185,129,0.1))',
    color: '#34d399',
    shadow: 'rgba(16,185,129,0.2)',
    border: 'rgba(16,185,129,0.2)',
  },
];

export default function LandingPage() {
  const [topic, setTopic] = useState('');
  const navigate = useNavigate();

  const handleStart = () => {
    const t = topic.trim();
    if (t) navigate(`/board/${encodeURIComponent(t)}`);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleStart();
  };

  return (
    <Box
      sx={{
        position: 'relative',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Grid background */}
      <Box
        className="grid-bg"
        sx={{
          position: 'absolute',
          inset: 0,
          opacity: 0.08,
          pointerEvents: 'none',
          mixBlendMode: 'overlay',
        }}
      />

      {/* Mesh gradient background */}
      <Box
        className="mesh-bg"
        sx={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />

      {/* Main content */}
      <Container
        maxWidth="lg"
        sx={{
          position: 'relative',
          zIndex: 10,
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          py: 2,
        }}
      >
        {/* Header */}
        <Box
          component="header"
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            px: 3,
            py: 1.5,
            mb: 2,
            borderRadius: '9999px',
            border: '1px solid rgba(255,255,255,0.1)',
            backdropFilter: 'blur(12px)',
            backgroundColor: 'rgba(17,22,19,0.6)',
            mx: { xs: 1, md: 2 },
            mt: 1,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box sx={{ position: 'relative', color: 'primary.main' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 20 }}>
                draw
              </span>
              <Box
                sx={{
                  position: 'absolute',
                  top: -4,
                  right: -4,
                  width: 8,
                  height: 8,
                }}
              >
                <Box
                  className="animate-ping"
                  sx={{
                    position: 'absolute',
                    width: '100%',
                    height: '100%',
                    borderRadius: '50%',
                    bgcolor: '#34d399',
                    opacity: 0.75,
                  }}
                />
                <Box
                  sx={{
                    position: 'relative',
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    bgcolor: '#22c55e',
                  }}
                />
              </Box>
            </Box>
            <Typography variant="h6" sx={{ fontWeight: 700, letterSpacing: '-0.02em' }}>
              ChalkMind
            </Typography>
          </Box>
        </Box>

        {/* Hero section */}
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            py: { xs: 4, md: 6 },
          }}
        >
          {/* Heading group (badge + title + subtitle) */}
          <Box sx={{ textAlign: 'center', maxWidth: 800, px: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
            {/* Social proof badge */}
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                bgcolor: 'rgba(255,255,255,0.05)',
                backdropFilter: 'blur(12px)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '9999px',
                px: 2,
                py: 0.75,
                boxShadow: 3,
              }}
            >
              <Typography variant="caption" sx={{ fontWeight: 500, color: '#d1d5db' }}>
                AI-powered visual learning
              </Typography>
            </Box>
            <Typography
              variant="h1"
              sx={{
                fontSize: { xs: '2.25rem', md: '3rem', lg: '3.75rem' },
                lineHeight: { xs: 1.2, md: 1.15 },
                letterSpacing: '-0.02em',
                background: 'linear-gradient(to right, #fff, #f3f4f6, #9ca3af)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.3))',
              }}
            >
              Learn Anything.
              <br />
              Watch It Come to Life.
            </Typography>
            <Typography
              variant="body1"
              sx={{
                color: '#d1d5db',
                mt: 2,
                maxWidth: 560,
                mx: 'auto',
                fontSize: { xs: '1rem', md: '1.125rem' },
                lineHeight: 1.7,
              }}
            >
              ChalkMind turns complex topics into simple visual explanations — drawn step by step on
              a virtual chalkboard, narrated by AI in real-time.
            </Typography>
          </Box>

          {/* Search bar */}
          <Box sx={{ width: '100%', maxWidth: 640, px: 2, position: 'relative' }}>
            {/* Glow behind search */}
            <Box
              sx={{
                position: 'absolute',
                inset: 0,
                background:
                  'linear-gradient(to right, rgba(20,184,166,0.1), rgba(16,185,129,0.1), rgba(147,51,234,0.1))',
                filter: 'blur(20px)',
                borderRadius: '9999px',
                opacity: 0.5,
                pointerEvents: 'none',
              }}
            />
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                height: { xs: 56, md: 64 },
                borderRadius: '9999px',
                border: '1px solid rgba(255,255,255,0.1)',
                bgcolor: 'rgba(26,33,28,0.9)',
                backdropFilter: 'blur(20px)',
                boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
                position: 'relative',
                zIndex: 10,
                overflow: 'hidden',
                transition: 'border-color 0.3s',
                '&:focus-within': {
                  borderColor: 'rgba(20,184,166,0.4)',
                },
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', pl: 3, pr: 1, color: '#9ca3af' }}>
                <span className="material-symbols-outlined" style={{ fontSize: 20 }}>
                  search
                </span>
              </Box>
              <InputBase
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="What would you like to learn today?"
                sx={{
                  flex: 1,
                  color: '#fff',
                  px: 1,
                  fontSize: { xs: '0.875rem', md: '1rem' },
                  '& ::placeholder': { color: '#6b7280' },
                }}
              />
              <Box sx={{ pr: 1 }}>
                <Button
                  onClick={handleStart}
                  variant="contained"
                  sx={{
                    borderRadius: '9999px',
                    height: { xs: 40, md: 48 },
                    px: 3,
                    background: 'linear-gradient(to right, #059669, #14b8a6)',
                    fontWeight: 700,
                    textTransform: 'none',
                    fontSize: { xs: '0.875rem', md: '1rem' },
                    boxShadow: '0 0 15px rgba(20,184,166,0.3)',
                    '&:hover': {
                      background: 'linear-gradient(to right, #10b981, #2dd4bf)',
                      boxShadow: '0 0 25px rgba(20,184,166,0.5)',
                    },
                  }}
                >
                  Start Learning
                </Button>
              </Box>
            </Box>
          </Box>

          {/* Topic pills */}
          <Box
            sx={{
              display: 'flex',
              gap: 1.5,
              flexWrap: 'wrap',
              justifyContent: 'center',
              px: 2,
            }}
          >
            {TOPIC_PILLS.map((pill) => (
              <Chip
                key={pill}
                label={pill}
                onClick={() => navigate(`/board/${encodeURIComponent(pill)}`)}
                sx={{
                  height: 36,
                  borderRadius: '9999px',
                  border: '1px solid rgba(255,255,255,0.1)',
                  bgcolor: 'rgba(255,255,255,0.05)',
                  backdropFilter: 'blur(4px)',
                  color: '#d1d5db',
                  fontWeight: 500,
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  '&:hover': {
                    bgcolor: 'rgba(255,255,255,0.1)',
                    borderColor: 'rgba(255,255,255,0.2)',
                  },
                }}
              />
            ))}
          </Box>
        </Box>

        {/* How It Works */}
        <Box
          sx={{
            borderTop: '1px solid rgba(255,255,255,0.05)',
            mt: 6,
            py: { xs: 8, md: 12 },
          }}
        >
          <Typography
            variant="h2"
            sx={{
              textAlign: 'center',
              mb: 6,
              fontSize: { xs: '1.875rem', md: '2.25rem' },
              color: '#fff',
            }}
          >
            How It Works
          </Typography>

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' },
              gap: { xs: 3, lg: 4 },
            }}
          >
            {HOW_IT_WORKS.map((item) => (
              <Box
                key={item.title}
                className="glass-card glow-border"
                sx={{
                  borderRadius: '1.5rem',
                  p: 4,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 2,
                  transition: 'transform 0.2s',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                  },
                }}
              >
                <Box
                  sx={{
                    width: 64,
                    height: 64,
                    borderRadius: '1rem',
                    background: item.gradient,
                    color: item.color,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: `inset 0 0 20px ${item.shadow}`,
                    border: `1px solid ${item.border}`,
                    backdropFilter: 'blur(12px)',
                    transition: 'transform 0.2s',
                    '&:hover': { transform: 'scale(1.05)' },
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 32 }}>
                    {item.icon}
                  </span>
                </Box>
                <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <Typography variant="h6" sx={{ fontWeight: 700, color: '#fff' }}>
                    {item.title}
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{ color: '#9ca3af', lineHeight: 1.6 }}
                  >
                    {item.description}
                  </Typography>
                </Box>
              </Box>
            ))}
          </Box>
        </Box>

        {/* Footer */}
        <Box
          component="footer"
          sx={{
            borderTop: '1px solid rgba(255,255,255,0.05)',
            mt: 'auto',
            py: 6,
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            gap: 3,
          }}
        >
          <Box sx={{ display: 'flex', justifyContent: 'center', gap: 3 }}>
            {['About', 'Privacy', 'Terms'].map((label) => (
              <Link
                key={label}
                href="#"
                underline="none"
                sx={{
                  color: '#6b7280',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  transition: 'color 0.2s',
                  '&:hover': { color: '#2dd4bf' },
                }}
              >
                {label}
              </Link>
            ))}
          </Box>
          <Typography variant="caption" sx={{ color: '#4b5563' }}>
            Built with Gemini AI &middot; Google Cloud
          </Typography>
        </Box>
      </Container>
    </Box>
  );
}
