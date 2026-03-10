import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Typography from '@mui/material/Typography';

const AGE_GROUPS = ['1-5', '6-10', '10-18', '18-40', '40-60', '60+'] as const;

interface AgeGroupChipsProps {
  value: string;
  onChange: (value: string) => void;
  error?: string | null;
}

export default function AgeGroupChips({ value, onChange, error }: AgeGroupChipsProps) {
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
        Age Group
      </Typography>
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
        {AGE_GROUPS.map((group) => {
          const selected = value === group;
          return (
            <Chip
              key={group}
              label={group}
              onClick={() => onChange(group)}
              sx={{
                height: 36,
                borderRadius: '9999px',
                border: `1px solid ${selected ? 'rgba(20,184,166,0.5)' : 'rgba(255,255,255,0.1)'}`,
                bgcolor: selected ? 'rgba(20,184,166,0.3)' : 'rgba(255,255,255,0.05)',
                color: selected ? '#5eead4' : '#d1d5db',
                fontWeight: selected ? 700 : 500,
                fontSize: '0.875rem',
                cursor: 'pointer',
                transition: 'all 0.2s',
                '&:hover': {
                  bgcolor: selected ? 'rgba(20,184,166,0.35)' : 'rgba(255,255,255,0.1)',
                  borderColor: selected ? 'rgba(20,184,166,0.6)' : 'rgba(255,255,255,0.2)',
                },
              }}
            />
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
