import { MantineProvider } from '@mantine/core'
import { DatesProvider } from '@mantine/dates'
import { Notifications } from '@mantine/notifications'
import { BrowserRouter } from 'react-router-dom'
import { BuildingProvider } from './hooks/useBuilding.tsx'
import { AuthProvider } from './hooks/useAuth.tsx'
import { AppRoutes } from './routes/AppRoutes.tsx'
import { theme } from './theme/theme.ts'

export default function App() {
  return (
    <MantineProvider theme={theme} forceColorScheme="light">
      <DatesProvider settings={{ firstDayOfWeek: 1, consistentWeeks: true }}>
        <Notifications position="top-center" />
        <BrowserRouter>
          <BuildingProvider>
            <AuthProvider>
              <AppRoutes />
            </AuthProvider>
          </BuildingProvider>
        </BrowserRouter>
      </DatesProvider>
    </MantineProvider>
  )
}
