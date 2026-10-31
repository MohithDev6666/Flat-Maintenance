import {
  Alert,
  Box,
  Button,
  Divider,
  Flex,
  Group,
  PasswordInput,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core'
import { useForm } from '@mantine/form'
import { IconMapPin } from '@tabler/icons-react'
import { Navigate, useNavigate } from 'react-router-dom'
import loginBuilding from '../../assets/login-building.jpg'
import { BrandMark } from '../../components/brand/BrandMark.tsx'
import { useAuth } from '../../hooks/useAuth.tsx'
import { useBuilding } from '../../hooks/useBuilding.tsx'
import { mockRoles } from '../../mocks/roles.ts'
import { mockUsers } from '../../mocks/users.ts'
import { paths } from '../../routes/nav.ts'
import { useState } from 'react'

function seededRoleName(roleId: string): string {
  return mockRoles.find((role) => role.id === roleId)?.name ?? 'User'
}

export function LoginPage() {
  const { user, login } = useAuth()
  const { building } = useBuilding()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)

  const form = useForm({
    initialValues: { email: '', password: '' },
    validate: {
      email: (value) => (/^\S+@\S+\.\S+$/.test(value) ? null : 'Enter a valid email'),
      password: (value) => (value.trim() ? null : 'Enter the password'),
    },
  })

  if (user) return <Navigate to={paths.dashboard} replace />

  const signIn = (email: string, password: string) => {
    const failure = login(email, password)
    if (failure) {
      setError(failure)
      return
    }
    setError(null)
    navigate(paths.dashboard, { replace: true })
  }

  return (
    <SimpleGrid cols={{ base: 1, md: 2 }} spacing={0} mih="100dvh">
      <Box
        pos="relative"
        mih={{ base: 340, md: '100dvh' }}
        style={{
          backgroundImage: `url(${loginBuilding})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center 18%',
        }}
      >
        <Box
          pos="absolute"
          inset={0}
          style={{
            background:
              'linear-gradient(180deg, rgba(94, 56, 44, 0.2) 0%, rgba(94, 56, 44, 0.45) 38%, rgba(63, 38, 30, 0.9) 100%)',
          }}
        />
        <Flex pos="relative" align="flex-end" mih={{ base: 340, md: '100dvh' }} p={{ base: 28, md: 56 }}>
          <Stack gap="lg" maw={480}>
            <BrandMark light size={64} />
            <div>
              <Title order={1} c="sand.0" fz={{ base: 34, md: 52 }} lh={1.05}>
                {building.name}
              </Title>
              <Group gap={8} mt="sm" wrap="nowrap">
                <IconMapPin size={22} color="#F4EFE8" />
                <Text c="sand.1" size="lg">
                  {building.address}
                </Text>
              </Group>
            </div>
            <Stack gap={6} visibleFrom="md">
              <Text c="sand.1">{building.totalFlats} flats. One shared maintenance book.</Text>
              <Text c="sand.2" size="sm">
                Expenses are split equally. Bills stay inside the building.
              </Text>
            </Stack>
          </Stack>
        </Flex>
      </Box>

      <Flex bg="sand.0" align="center" justify="center" p={{ base: 20, md: 40 }}>
        <Box w="100%" maw={440}>
          <Title order={2}>Sign in</Title>
          <Text c="dimmed" mt={4} mb="lg">
            Static demo. Pick an account or type the email and password.
          </Text>
          <form
            onSubmit={form.onSubmit((values) => {
              signIn(values.email, values.password)
            })}
          >
            <Stack gap="md">
              {error ? (
                <Alert color="red" title="Could not sign in">
                  {error}
                </Alert>
              ) : null}
              <TextInput
                label="Email"
                placeholder="name@flat.com"
                autoComplete="username"
                {...form.getInputProps('email')}
              />
              <PasswordInput
                label="Password"
                placeholder="Password"
                autoComplete="current-password"
                {...form.getInputProps('password')}
              />
              <Button type="submit" size="lg" fullWidth>
                Login
              </Button>
            </Stack>
          </form>

          <Divider my="xl" label="Demo accounts · development only" labelPosition="center" />
          <Stack gap="sm">
            {mockUsers.map((account) => (
              <Button
                key={account.id}
                variant="default"
                size="lg"
                fullWidth
                onClick={() => signIn(account.email, account.password)}
              >
                <Group justify="space-between" wrap="nowrap" w="100%">
                  <Text size="sm" fw={600}>
                    {seededRoleName(account.roleId)} · {account.name}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {account.email} · {account.password}
                  </Text>
                </Group>
              </Button>
            ))}
          </Stack>
        </Box>
      </Flex>
    </SimpleGrid>
  )
}
