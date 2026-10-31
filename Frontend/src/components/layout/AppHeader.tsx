import { Anchor, Avatar, Breadcrumbs, Burger, Group, Menu, Text, UnstyledButton } from '@mantine/core'
import { IconLogout } from '@tabler/icons-react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth.tsx'
import { crumbsFor, paths } from '../../routes/nav.ts'
import { initials } from '../../utils/format.ts'

export function AppHeader({ opened, onToggle }: { opened: boolean; onToggle: () => void }) {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const crumbs = crumbsFor(pathname)

  const signOut = () => {
    logout()
    navigate(paths.login, { replace: true })
  }

  return (
    <Group h="100%" px={{ base: 'sm', sm: 'lg' }} justify="space-between" wrap="nowrap" gap="sm">
      <Group gap="sm" wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
        <Burger opened={opened} onClick={onToggle} hiddenFrom="sm" size="sm" aria-label="Open menu" />
        <Breadcrumbs separator="/" style={{ flexWrap: 'wrap', rowGap: 2 }}>
          {crumbs.map((crumb, index) => {
            const current = index === crumbs.length - 1
            if (current || !crumb.to) {
              return (
                <Text key={crumb.label} size="sm" fw={700}>
                  {crumb.label}
                </Text>
              )
            }
            return (
              <Anchor key={crumb.label} component={Link} to={crumb.to} underline="never" c="sand.7" size="sm">
                {crumb.label}
              </Anchor>
            )
          })}
        </Breadcrumbs>
      </Group>
      {user ? (
        <Menu position="bottom-end" width={240} radius="md">
          <Menu.Target>
            <UnstyledButton aria-label="Account menu">
              <Group gap="xs" wrap="nowrap">
                <Avatar color="terracotta" radius="xl" variant="filled">
                  {initials(user.name)}
                </Avatar>
                <div>
                  <Text size="sm" fw={700} lh={1.2} visibleFrom="sm">
                    {user.name}
                  </Text>
                  <Text size="xs" c="dimmed" visibleFrom="sm">
                    {user.roleName}
                    {user.flatNumber ? ` · Flat ${user.flatNumber}` : ''}
                  </Text>
                </div>
              </Group>
            </UnstyledButton>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Label>
              {user.email}
              {user.flatNumber ? ` · Flat ${user.flatNumber}, floor ${user.floor}` : ' · Not linked to a flat'}
            </Menu.Label>
            <Menu.Item leftSection={<IconLogout size={16} />} onClick={signOut}>
              Logout
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
      ) : null}
    </Group>
  )
}
