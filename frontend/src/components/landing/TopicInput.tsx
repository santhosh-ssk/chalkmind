import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import InputBase from '@mui/material/InputBase';
import Typography from '@mui/material/Typography';

interface TopicInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  error?: string | null;
}

export default function TopicInput({ value, onChange, onSubmit, onKeyDown, error }: TopicInputProps) {
  return (
    <Box sx={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      {/* Search input — full width */}
      <Box sx={{ position: 'relative' }}>
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
            border: `1px solid ${error ? 'rgba(224,112,80,0.5)' : 'rgba(255,255,255,0.1)'}`,
            bgcolor: 'rgba(26,33,28,0.9)',
            backdropFilter: 'blur(20px)',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
            position: 'relative',
            zIndex: 10,
            transition: 'border-color 0.3s',
            '&:focus-within': {
              borderColor: error ? 'rgba(224,112,80,0.6)' : 'rgba(20,184,166,0.4)',
            },
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', pl: 3, pr: 1, color: '#9ca3af' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>
              search
            </span>
          </Box>
          <InputBase
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="What would you like to learn today?"
            inputProps={{ maxLength: 200 }}
            sx={{
              flex: 1,
              color: '#fff',
              px: 1,
              pr: 3,
              fontSize: { xs: '0.875rem', md: '1rem' },
              '& ::placeholder': { color: '#6b7280' },
            }}
          />
        </Box>
        {error && (
          <Typography sx={{ color: '#e07050', fontSize: '0.75rem', mt: 0.5, pl: 3 }}>
            {error}
          </Typography>
        )}
      </Box>

      {/* Submit button — full width below input */}
      <Button
        onClick={onSubmit}
        variant="contained"
        fullWidth
        sx={{
          borderRadius: '9999px',
          height: { xs: 48, md: 52 },
          background: 'linear-gradient(to right, #059669, #14b8a6)',
          fontWeight: 700,
          textTransform: 'none',
          fontSize: { xs: '0.9375rem', md: '1.0625rem' },
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
  );
}
