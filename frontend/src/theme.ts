import { createTheme } from '@mui/material/styles';

// Extend MUI's palette to include custom tokens
declare module '@mui/material/styles' {
  interface Palette {
    surfaceDark: string;
    borderDark: string;
    textMuted: string;
    chalkWhite: string;
    accentGreen: string;
    accentGold: string;
  }
  interface PaletteOptions {
    surfaceDark?: string;
    borderDark?: string;
    textMuted?: string;
    chalkWhite?: string;
    accentGreen?: string;
    accentGold?: string;
  }
}

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#2d5a3d',
    },
    background: {
      default: '#111613',
      paper: '#1a211c',
    },
    text: {
      primary: '#e8e4d9',
      secondary: '#706b60',
    },
    surfaceDark: '#1a211c',
    borderDark: '#2d3730',
    textMuted: '#706b60',
    chalkWhite: '#e8e4d9',
    accentGreen: '#5cb85c',
    accentGold: '#f5c842',
  },
  typography: {
    fontFamily: '"Lexend", sans-serif',
    h1: {
      fontFamily: '"Playfair Display", serif',
      fontWeight: 900,
    },
    h2: {
      fontFamily: '"Playfair Display", serif',
      fontWeight: 700,
    },
  },
  shape: {
    borderRadius: 16,
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: '#111613',
          minHeight: '100vh',
        },
      },
    },
  },
});

export default theme;
