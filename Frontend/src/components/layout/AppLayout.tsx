import { AppShell, Box } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { AppHeader } from './AppHeader.tsx'
import { SidebarNav } from './SidebarNav.tsx'

export function AppLayout() {
  const [opened, { toggle, close }] = useDisclosure()
  const location = useLocation()

  useEffect(() => {
    close()
  }, [location.pathname, close])

  return (
    <AppShell
      header={{ height: 64 }}
      layout="alt"
      navbar={{
        width: 280,
        breakpoint: 'sm',
        collapsed: { mobile: !opened },
      }}
      padding={{ base: 'sm', sm: 'lg' }}
    >
      <AppShell.Header bg="white">
        <AppHeader opened={opened} onToggle={toggle} />
      </AppShell.Header>
      {opened ? (
        <Box
          hiddenFrom="sm"
          onClick={close}
          style={{ position: 'fixed', inset: 0, background: 'rgba(38, 24, 16, 0.28)', zIndex: 100 }}
        />
      ) : null}
      <AppShell.Navbar p="md" bg="sand.1">
        <SidebarNav onClose={close} />
      </AppShell.Navbar>
      <AppShell.Main bg="sand.0">
        <Outlet />
      </AppShell.Main>
    </AppShell>
  )
}
