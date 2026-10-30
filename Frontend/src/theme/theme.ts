import { createTheme } from '@mantine/core'
import { ink, sand, terracotta } from './colors.ts'

export const theme = createTheme({
  primaryColor: 'terracotta',
  primaryShade: 7,
  colors: {
    terracotta,
    sand,
  },
  white: '#FFFFFF',
  black: ink,
  fontFamily: 'Manrope, "Segoe UI", sans-serif',
  headings: {
    fontFamily: 'Fraunces, Georgia, serif',
    fontWeight: '600',
  },
  defaultRadius: 'md',
  cursorType: 'pointer',
  components: {
    Button: {
      defaultProps: {
        radius: 'md',
      },
    },
    Card: {
      defaultProps: {
        radius: 'lg',
        withBorder: true,
        padding: 'lg',
      },
    },
    TextInput: {
      defaultProps: { size: 'md', radius: 'md' },
    },
    PasswordInput: {
      defaultProps: { size: 'md', radius: 'md' },
    },
    Select: {
      defaultProps: {
        size: 'md',
        radius: 'md',
        searchable: true,
        clearable: true,
        nothingFoundMessage: 'No matches',
        withScrollArea: false,
        comboboxProps: {
          withinPortal: true,
          floatingStrategy: 'fixed',
          position: 'bottom-start',
          offset: 4,
          zIndex: 500,
          middlewares: {
            flip: { padding: 8, fallbackPlacements: ['top-start', 'bottom-start'] },
            shift: { padding: 8 },
            inline: false,
          },
          transitionProps: { duration: 0 },
          shadow: 'md',
        },
      },
    },
    Popover: {
      defaultProps: {
        withinPortal: true,
        floatingStrategy: 'fixed',
        zIndex: 500,
        middlewares: { flip: true, shift: true, inline: false },
        transitionProps: { duration: 0 },
      },
    },
    NumberInput: {
      defaultProps: { size: 'md', radius: 'md', hideControls: true },
    },
    Textarea: {
      defaultProps: { size: 'md', radius: 'md' },
    },
    Modal: {
      defaultProps: { radius: 'lg', centered: true },
    },
    NavLink: {
      defaultProps: {
        variant: 'light',
        color: 'terracotta',
      },
    },
  },
  other: {
    pageBackground: sand[0],
  },
})
