import { Alert, Box, Button, Flex, PasswordInput, SimpleGrid, Stack, Text, TextInput, Title } from '@mantine/core'
import { useForm } from '@mantine/form'
import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import loginBuilding from '../../assets/login-building.jpg'
import { BrandMark } from '../../components/brand/BrandMark.tsx'
import { useAuth } from '../../hooks/useAuth.tsx'
import { paths } from '../../routes/nav.ts'
import { getErrorMessage } from '../../services/apiClient.ts'
import { notifySuccess } from '../../utils/notify.ts'

export function LoginPage() {
  const { user, login } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const form = useForm({
    initialValues: { email: '', password: '' },
    validate: {
      email: (value) => (/^\S+@\S+\.\S+$/.test(value.trim()) ? null : 'Enter a valid email'),
      password: (value) => (value ? null : 'Enter the password'),
    },
  })

  if (user) return <Navigate to={paths.dashboard} replace />

  const signIn = async (email: string, password: string) => {
    setSubmitting(true)
    setError(null)
    try {
      await login(email, password)
      notifySuccess('Signed in', 'Welcome back.')
      navigate(paths.dashboard, { replace: true })
    } catch (failure) {
      const message = getErrorMessage(failure)
      // The API answers a wrong email or password with a generic "login failed".
      setError(/login failed/i.test(message) ? 'The email or password is incorrect.' : message)
    } finally {
      setSubmitting(false)
    }
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
                Flat Maintenance
              </Title>
              <Text c="sand.1" size="lg" mt="sm">
                One shared maintenance book for the building.
              </Text>
            </div>
            <Stack gap={6} visibleFrom="md">
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
            Use the email and password your building admin gave you.
          </Text>
          <form onSubmit={form.onSubmit((values) => void signIn(values.email, values.password))}>
            <Stack gap="md">
              {error ? (
                <Alert color="red" title="Could not sign in">
                  {error}
                </Alert>
              ) : null}
              <TextInput label="Email" placeholder="name@example.com" autoComplete="username" {...form.getInputProps('email')} />
              <PasswordInput label="Password" placeholder="Password" autoComplete="current-password" {...form.getInputProps('password')} />
              <Button type="submit" size="lg" fullWidth loading={submitting}>
                Login
              </Button>
            </Stack>
          </form>
        </Box>
      </Flex>
    </SimpleGrid>
  )
}
