import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

const DIFFICULTIES = [
  { value: 'beginner', label: 'Beginner', icon: 'school' },
  { value: 'intermediate', label: 'Intermediate', icon: 'psychology' },
  { value: 'advanced', label: 'Advanced', icon: 'rocket_launch' },
] as const;

interface DifficultyChipsProps {
  value: string;
  onChange: (value: string) => void;
  error?: string | null;
}

export default function DifficultyChips({ value, onChange, error }: DifficultyChipsProps) {
  return (
    <Box sx={{ width: '100%', maxWidth: 640, px: 2 }}>
      <Typography
        sx={{
          fontSize: '0.75rem',
          color: '#9ca3af',
          mb: 1,
          pl: 1,
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
        }}
      >
        Difficulty
      </Typography>
      <Box sx={{ display: 'flex', gap: 1.5 }}>
        {DIFFICULTIES.map((diff) => {
          const selected = value === diff.value;
          return (
            <Box
              key={diff.value}
              onClick={() => onChange(diff.value)}
              sx={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 0.5,
                py: 1.5,
                px: 1,
                borderRadius: '1rem',
                border: `1px solid ${selected ? 'rgba(20,184,166,0.5)' : 'rgba(255,255,255,0.1)'}`,
                bgcolor: selected ? 'rgba(20,184,166,0.3)' : 'rgba(255,255,255,0.05)',
                cursor: 'pointer',
                transition: 'all 0.2s',
                '&:hover': {
                  bgcolor: selected ? 'rgba(20,184,166,0.35)' : 'rgba(255,255,255,0.1)',
                  borderColor: selected ? 'rgba(20,184,166,0.6)' : 'rgba(255,255,255,0.2)',
                },
              }}
            >
              <span
                className="material-symbols-outlined"
                style={{ fontSize: 22, color: selected ? '#5eead4' : '#9ca3af' }}
              >
                {diff.icon}
              </span>
              <Typography
                sx={{
                  fontSize: '0.8rem',
                  fontWeight: selected ? 700 : 500,
                  color: selected ? '#5eead4' : '#d1d5db',
                }}
              >
                {diff.label}
              </Typography>
            </Box>
          );
        })}
      </Box>
      {error && (
        <Typography sx={{ color: '#e07050', fontSize: '0.75rem', mt: 0.5, pl: 1 }}>
          {error}
        </Typography>
      )}
    </Box>
  );
}
