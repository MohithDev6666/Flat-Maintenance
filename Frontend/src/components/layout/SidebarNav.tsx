import { ActionIcon, AppShell, Divider, Group, NavLink, Stack, Text } from '@mantine/core'
import { IconChevronLeft } from '@tabler/icons-react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth.tsx'
import { apartment } from '../../mocks/apartment.ts'
import { adminNav, navFor, paths } from '../../routes/nav.ts'
import { BrandMark } from '../brand/BrandMark.tsx'

export function SidebarNav({ onClose }: { onClose: () => void }) {
  const { user } = useAuth()
  const { pathname } = useLocation()
  if (!user) return null

  const items = navFor(user.role)

  return (
    <>
      <AppShell.Section>
        <Group gap="sm" wrap="nowrap" justify="space-between" align="center">
          <Group gap="sm" wrap="nowrap" style={{ minWidth: 0 }}>
            <BrandMark size={40} />
            <div style={{ minWidth: 0 }}>
              <Text fw={700} lh={1.15} truncate>
                {apartment.shortName}
              </Text>
              <Text size="xs" c="dimmed">
                Residency
              </Text>
            </div>
          </Group>
          <ActionIcon
            hiddenFrom="sm"
            variant="subtle"
            color="terracotta"
            size="lg"
            aria-label="Close menu"
            onClick={onClose}
          >
            <IconChevronLeft size={22} />
          </ActionIcon>
        </Group>
        <Divider color="sand.3" mt="md" />
      </AppShell.Section>

      <AppShell.Section grow mt="md" className="sidebar-scroll">
        <Stack gap={4}>
          {items.map((item) => {
            const Icon = item.icon
            const label = item.path === paths.residents && user.role === 'tenant' ? 'My flat' : item.label
            return (
              <NavLink
                key={item.path}
                component={Link}
                to={item.path}
                label={label}
                active={pathname === item.path}
                leftSection={<Icon size={18} />}
                style={{ borderRadius: 12 }}
              />
            )
          })}
          {user.role === 'admin' ? (
            <>
              <Divider color="sand.3" my="sm" />
              <Text size="xs" fw={700} tt="uppercase" c="sand.7" px="sm">
                Admin
              </Text>
              {adminNav.map((item) => {
                const Icon = item.icon
                return (
                  <NavLink
                    key={item.path}
                    component={Link}
                    to={item.path}
                    label={item.label}
                    active={pathname === item.path}
                    leftSection={<Icon size={18} />}
                    style={{ borderRadius: 12 }}
                  />
                )
              })}
            </>
          ) : null}
        </Stack>
      </AppShell.Section>
    </>
  )
}
