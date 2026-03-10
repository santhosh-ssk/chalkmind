import Box from '@mui/material/Box';
import InputBase from '@mui/material/InputBase';
import Typography from '@mui/material/Typography';

interface NameFieldProps {
  value: string;
  onChange: (value: string) => void;
  error?: string | null;
}

export default function NameField({ value, onChange, error }: NameFieldProps) {
  return (
    <Box sx={{ width: '100%', maxWidth: 640, px: 2 }}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          height: 52,
          borderRadius: '9999px',
          border: `1px solid ${error ? 'rgba(224,112,80,0.5)' : 'rgba(255,255,255,0.1)'}`,
          bgcolor: 'rgba(26,33,28,0.9)',
          backdropFilter: 'blur(20px)',
          transition: 'border-color 0.3s',
          '&:focus-within': {
            borderColor: error ? 'rgba(224,112,80,0.6)' : 'rgba(20,184,166,0.4)',
          },
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', pl: 3, pr: 1, color: '#9ca3af' }}>
          <span className="material-symbols-outlined" style={{ fontSize: 20 }}>
            person
          </span>
        </Box>
        <InputBase
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Your name"
          inputProps={{ maxLength: 50 }}
          sx={{
            flex: 1,
            color: '#fff',
            px: 1,
            fontSize: '0.95rem',
            '& ::placeholder': { color: '#6b7280' },
          }}
        />
      </Box>
      {error && (
        <Typography sx={{ color: '#e07050', fontSize: '0.75rem', mt: 0.5, pl: 2 }}>
          {error}
        </Typography>
      )}
    </Box>
  );
}
