import { createTheme, type CSSVariablesResolver, type MantineColorsTuple } from '@mantine/core';

// Cobalt accent: shade 6 is the light theme accent (#0D52A8), shade 5 the dark theme one (#2F6FC9).
const cobalt: MantineColorsTuple = [
  '#eaf1fb',
  '#d0e0f5',
  '#a3c2eb',
  '#73a2e0',
  '#4b87d6',
  '#2f6fc9',
  '#0d52a8',
  '#0b4689',
  '#093a70',
  '#072d57',
];

// Dark grays in the spirit of the IntelliJ Darcula theme; shade 7 is the page background.
const dark: MantineColorsTuple = [
  '#e6e6e6',
  '#c9c9c9',
  '#ababab',
  '#959595',
  '#5a5d60',
  '#45484a',
  '#3c3f41',
  '#2b2b2b',
  '#252526',
  '#1e1e1f',
];

export const theme = createTheme({
  primaryColor: 'cobalt',
  primaryShade: { light: 6, dark: 5 },
  colors: { cobalt, dark },
  fontFamily: "'Fixel Text', system-ui, sans-serif",
  fontFamilyMonospace: "'IBM Plex Mono', ui-monospace, monospace",
  headings: { fontFamily: "'Fixel Display', 'Fixel Text', system-ui, sans-serif", fontWeight: '600' },
  defaultRadius: 'sm',
  radius: { xs: '4px', sm: '6px', md: '8px', lg: '10px', xl: '12px' },
  fontSizes: { xs: '12px', sm: '13px', md: '14px', lg: '16px', xl: '20px' },
  cursorType: 'pointer',
});

export const cssVariablesResolver: CSSVariablesResolver = () => ({
  variables: {},
  light: {
    '--mantine-color-body': '#fafafa',
    '--mantine-color-default-border': '#d4d4d8',
  },
  dark: {
    '--mantine-color-body': '#2b2b2b',
    '--mantine-color-text': '#e6e6e6',
    '--mantine-color-default': '#313335',
    '--mantine-color-default-border': '#5a5d60',
  },
});
