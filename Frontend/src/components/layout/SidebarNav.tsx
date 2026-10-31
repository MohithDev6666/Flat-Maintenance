import { ActionIcon, AppShell, Divider, Group, NavLink, Stack, Text } from '@mantine/core'
import { IconChevronLeft } from '@tabler/icons-react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth.tsx'
import { useBuilding } from '../../hooks/useBuilding.tsx'
import { adminNavFor, navFor, type NavItem } from '../../routes/nav.ts'
import { splitBuildingName } from '../../utils/format.ts'
import { BrandMark } from '../brand/BrandMark.tsx'

export function SidebarNav({ onClose }: { onClose: () => void }) {
  const { user } = useAuth()
  const { building } = useBuilding()
  const { pathname } = useLocation()
  if (!user) return null

  const items = navFor(user)
  const adminItems = adminNavFor(user)
  const brand = splitBuildingName(building.name)

  const renderItem = (item: NavItem) => {
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
  }

  return (
    <>
      <AppShell.Section>
        <Group gap="sm" wrap="nowrap" justify="space-between" align="center">
          <Group gap="sm" wrap="nowrap" style={{ minWidth: 0 }}>
            <BrandMark size={40} />
            <div style={{ minWidth: 0 }}>
              <Text fw={700} lh={1.15} truncate>
                {brand.title}
              </Text>
              {brand.subtitle ? (
                <Text size="xs" c="dimmed">
                  {brand.subtitle}
                </Text>
              ) : null}
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
          {items.map(renderItem)}
          {adminItems.length > 0 ? (
            <>
              <Divider color="sand.3" my="sm" />
              <Text size="xs" fw={700} tt="uppercase" c="sand.7" px="sm">
                Admin
              </Text>
              {adminItems.map(renderItem)}
            </>
          ) : null}
        </Stack>
      </AppShell.Section>
    </>
  )
}
