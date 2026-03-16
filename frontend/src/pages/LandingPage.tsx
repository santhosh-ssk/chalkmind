import { useState, useEffect } from 'react';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Link from '@mui/material/Link';

import NameField from '../components/landing/NameField';
import AgeGroupChips from '../components/landing/AgeGroupChips';
import DifficultyChips from '../components/landing/DifficultyChips';
import TopicInput from '../components/landing/TopicInput';
import { useRecaptcha } from '../hooks/useRecaptcha';
import { validateForm } from '../utils/validation';
import { trackEvent } from '../utils/analytics';

const TOPIC_PILLS = [
  'Why is the sky blue?',
  'How do volcanoes erupt?',
  'How does the internet work?',
  'How does AI work?',
  'How does the stock market work?',
  'How does the immune system work?',
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
  const [name, setName] = useState(() => localStorage.getItem('chalkmind_name') || '');
  const [ageGroup, setAgeGroup] = useState(() => localStorage.getItem('chalkmind_ageGroup') || '18-40');
  const [difficulty, setDifficulty] = useState(() => localStorage.getItem('chalkmind_difficulty') || 'beginner');
  const [topic, setTopic] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const navigate = useNavigate();
  const { executeRecaptcha } = useRecaptcha();

  // Persist preferences to localStorage
  useEffect(() => { localStorage.setItem('chalkmind_name', name); }, [name]);
  useEffect(() => { localStorage.setItem('chalkmind_ageGroup', ageGroup); }, [ageGroup]);
  useEffect(() => { localStorage.setItem('chalkmind_difficulty', difficulty); }, [difficulty]);

  const handleStart = async () => {
    const formErrors = validateForm({ name, topic });
    if (Object.keys(formErrors).length > 0) {
      setErrors(formErrors);
      return;
    }
    setErrors({});

    const recaptchaToken = await executeRecaptcha('generate_lesson');

    trackEvent('lesson_started', { topic: topic.trim(), age_group: ageGroup, difficulty });

    navigate(`/board/${encodeURIComponent(topic.trim())}`, {
      state: {
        name: name.trim(),
        ageGroup,
        difficulty,
        recaptchaToken,
      },
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleStart();
  };

  const handleTopicPillClick = (pill: string) => {
    trackEvent('topic_pill_clicked', { topic: pill });
    setTopic(pill);
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
        {/* Hero section — two-column on desktop, single-column on mobile */}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: '9fr 11fr' },
            gap: { xs: 4, md: 6 },
            alignItems: 'center',
            py: { xs: 4, md: 6 },
          }}
        >
          {/* Left column — branding + heading group */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, textAlign: { xs: 'center', md: 'left' }, alignItems: { xs: 'center', md: 'flex-start' } }}>
            {/* ChalkMind branding */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Box sx={{ position: 'relative', color: 'primary.main' }}>
                <span className="material-symbols-outlined" style={{ fontSize: 32 }}>
                  draw
                </span>
                <Box
                  sx={{
                    position: 'absolute',
                    top: -4,
                    right: -4,
                    width: 10,
                    height: 10,
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
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      bgcolor: '#22c55e',
                    }}
                  />
                </Box>
              </Box>
              <Typography variant="h4" sx={{ fontWeight: 800, letterSpacing: '-0.02em', color: '#fff' }}>
                ChalkMind
              </Typography>
            </Box>

            <Box
              sx={{
                display: 'inline-flex',
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
                fontSize: { xs: '2.25rem', md: '2.75rem', lg: '3.5rem' },
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
                maxWidth: 480,
                fontSize: { xs: '1rem', md: '1.125rem' },
                lineHeight: 1.7,
              }}
            >
              ChalkMind turns complex topics into simple visual explanations — drawn step by step on
              a virtual chalkboard, narrated by AI in real-time.
            </Typography>
            <Box
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 1,
                bgcolor: 'rgba(255,255,255,0.05)',
                backdropFilter: 'blur(12px)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '9999px',
                px: 2,
                py: 0.75,
              }}
            >
              <Typography variant="caption" sx={{ fontWeight: 500, color: '#d1d5db' }}>
                Built for Gemini Agent Hackathon 2026
              </Typography>
            </Box>
          </Box>

          {/* Right column — form */}
          <Box
            className="glass-card"
            sx={{
              display: 'flex',
              flexDirection: 'column',
              gap: 3,
              p: { xs: 3, md: 5 },
              borderRadius: '1.5rem',
              border: '1px solid rgba(255,255,255,0.08)',
              bgcolor: 'rgba(255,255,255,0.03)',
              backdropFilter: 'blur(16px)',
            }}
          >
            <NameField value={name} onChange={setName} error={errors.name} />
            <AgeGroupChips value={ageGroup} onChange={setAgeGroup} />
            <DifficultyChips value={difficulty} onChange={setDifficulty} />
            <TopicInput
              value={topic}
              onChange={setTopic}
              onSubmit={handleStart}
              onKeyDown={handleKeyDown}
              error={errors.topic}
            />

            {/* Topic suggestion pills — below the search/button */}
            <Box
              sx={{
                display: 'flex',
                gap: 1,
                flexWrap: 'wrap',
                justifyContent: 'center',
              }}
            >
              {TOPIC_PILLS.map((pill) => (
                <Chip
                  key={pill}
                  label={pill}
                  onClick={() => handleTopicPillClick(pill)}
                  sx={{
                    height: 32,
                    borderRadius: '9999px',
                    border: `1px solid ${topic === pill ? 'rgba(20,184,166,0.5)' : 'rgba(255,255,255,0.1)'}`,
                    bgcolor: topic === pill ? 'rgba(20,184,166,0.2)' : 'rgba(255,255,255,0.05)',
                    backdropFilter: 'blur(4px)',
                    color: topic === pill ? '#5eead4' : '#d1d5db',
                    fontWeight: topic === pill ? 700 : 500,
                    fontSize: '0.8125rem',
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
            <Link
              component={RouterLink}
              to="/terms"
              underline="none"
              sx={{
                color: '#6b7280',
                fontSize: '0.875rem',
                fontWeight: 500,
                transition: 'color 0.2s',
                '&:hover': { color: '#2dd4bf' },
              }}
            >
              Terms
            </Link>
            <Link
              component={RouterLink}
              to="/terms#privacy"
              underline="none"
              sx={{
                color: '#6b7280',
                fontSize: '0.875rem',
                fontWeight: 500,
                transition: 'color 0.2s',
                '&:hover': { color: '#2dd4bf' },
              }}
            >
              Privacy
            </Link>
            <Link
              href="https://github.com/santhosh-ssk/chalkmind"
              target="_blank"
              rel="noopener noreferrer"
              underline="none"
              sx={{
                color: '#6b7280',
                fontSize: '0.875rem',
                fontWeight: 500,
                transition: 'color 0.2s',
                '&:hover': { color: '#2dd4bf' },
              }}
            >
              About
            </Link>
          </Box>
          <Typography variant="caption" sx={{ color: '#4b5563' }}>
            Built with Gemini AI &middot; Google Cloud
          </Typography>
        </Box>
      </Container>
    </Box>
  );
}
