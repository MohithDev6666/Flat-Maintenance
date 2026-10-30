import { Alert, Badge, Box, Button, Card, Group, Stack, Switch, Table, Text, Timeline } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import dayjs from 'dayjs'
import { useState, type ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { PageHeading } from '../../components/ui/PageHeading.tsx'
import { useAuth } from '../../hooks/useAuth.tsx'
import { useBuilding } from '../../hooks/useBuilding.tsx'
import { apartment } from '../../mocks/apartment.ts'
import { adminNav, paths } from '../../routes/nav.ts'
import type { ExpenseCategory, Flat, MockUser, RecurringRule } from '../../types/models.ts'
import { formatDate, formatDateTime, formatINR, formatMonth, formatPhone, formatRole } from '../../utils/format.ts'
import { flatStatus } from '../../utils/ledger.ts'
import { CategoryEditor, FlatEditor, RecurringEditor, TenantEditor, UserEditor } from './AdminEditors.tsx'

function loginFor(accounts: MockUser[], flatNumber: string, role: 'owner' | 'tenant') {
  const match = accounts.find((account) => account.flatNumber === flatNumber && account.role === role)
  return match ? match.email : 'No login yet'
}

function FieldCard({
  title,
  subtitle,
  fields,
  actions,
}: {
  title: string
  subtitle?: string
  fields: { label: string; value: string }[]
  actions?: ReactNode
}) {
  return (
    <Card withBorder padding="sm">
      <Group justify="space-between" align="flex-start" wrap="wrap" gap="xs">
        <div style={{ minWidth: 0, flex: '1 1 12rem' }}>
          <Text fw={700} style={{ overflowWrap: 'anywhere' }}>
            {title}
          </Text>
          {subtitle ? (
            <Text size="sm" c="dimmed" style={{ overflowWrap: 'anywhere' }}>
              {subtitle}
            </Text>
          ) : null}
        </div>
        {actions ? (
          <Group gap={6} wrap="wrap">
            {actions}
          </Group>
        ) : null}
      </Group>
      <Stack gap={2} mt="xs">
        {fields.map((field) => (
          <Text key={field.label} size="sm" style={{ overflowWrap: 'anywhere' }}>
            <Text span c="dimmed">
              {field.label}
            </Text>
            {' · '}
            {field.value}
          </Text>
        ))}
      </Stack>
    </Card>
  )
}

function FitTable({ headers, rows }: { headers: string[]; rows: { key: string; cells: ReactNode[] }[] }) {
  return (
    <Box visibleFrom="sm">
      <Table className="admin-fit-table" striped highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            {headers.map((header) => (
              <Table.Th key={header}>{header}</Table.Th>
            ))}
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {rows.map((row) => (
            <Table.Tr key={row.key}>
              {row.cells.map((cell, index) => (
                <Table.Td key={headers[index] ?? index}>{cell}</Table.Td>
              ))}
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Box>
  )
}

const descriptions: Record<string, string> = {
  [paths.adminUsers]: 'A login for an admin, owner, or tenant. Owners and tenants must be linked to a flat that already exists.',
  [paths.adminFlats]: 'The flat and its owner. Status becomes Rented when that flat has an active tenant.',
  [paths.adminTenants]: 'One tenant per flat. After saving, create their login on Users with the role Tenant and the same flat.',
  [paths.adminCategories]: 'Each category sets the default Owner or Tenant tag. The person adding an expense can still change it.',
  [paths.adminRecurring]: 'A fixed monthly expense. Run it to create this month’s copy. A locked month is skipped.',
  [paths.adminRecent]: 'Expenses, payments, flats, categories, recurring expenses, and the month lock from the last 30 days.',
  [paths.adminLock]: 'Freezing a month blocks new expenses, edits, deletes, and payments for that month until you unlock it.',
}

export function AdminPage() {
  const { pathname } = useLocation()
  const { user, accounts } = useAuth()
  const { audit, flats, categories, recurring, isLocked, toggleLock, removeCategory, removeRecurring, generateRecurring, saveFlat } =
    useBuilding()
  const [userOpen, setUserOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<MockUser | null>(null)
  const [flatOpen, setFlatOpen] = useState(false)
  const [editingFlat, setEditingFlat] = useState<Flat | null>(null)
  const [tenantOpen, setTenantOpen] = useState(false)
  const [editingTenantFlat, setEditingTenantFlat] = useState<Flat | null>(null)
  const [endingFlat, setEndingFlat] = useState<string | null>(null)
  const [categoryOpen, setCategoryOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<ExpenseCategory | null>(null)
  const [ruleOpen, setRuleOpen] = useState(false)
  const [editingRule, setEditingRule] = useState<RecurringRule | null>(null)

  const current = adminNav.find((item) => item.path === pathname)
  if (!current) return <Navigate to={paths.adminUsers} replace />
  if (!user) return null

  if (user.role !== 'admin') {
    return (
      <Stack gap="lg">
        <PageHeading title="Admin" />
        <Alert color="terracotta" variant="light" title="Admin only">
          Users, flats, tenants, categories, recurring expenses, recent changes, and the month lock are on the admin account.
        </Alert>
      </Stack>
    )
  }

  const locked = isLocked(apartment.currentMonth)
  const cutoff = dayjs(apartment.today).subtract(30, 'day')
  const recent = audit
    .filter((entry) => !dayjs(entry.at).isBefore(cutoff))
    .sort((left, right) => (left.at < right.at ? 1 : -1))
  const tenants = flats.filter((flat) => flat.tenant)
  const vacant = flats.filter((flat) => flat.tenant === null)

  const openUser = (account: MockUser | null) => {
    setEditingUser(account)
    setUserOpen(true)
  }
  const openFlat = (flat: Flat | null) => {
    setEditingFlat(flat)
    setFlatOpen(true)
  }
  const openTenant = (flat: Flat | null) => {
    setEditingTenantFlat(flat)
    setTenantOpen(true)
  }
  const openCategory = (category: ExpenseCategory | null) => {
    setEditingCategory(category)
    setCategoryOpen(true)
  }
  const openRule = (rule: RecurringRule | null) => {
    setEditingRule(rule)
    setRuleOpen(true)
  }

  const endTenancy = (flat: Flat) => {
    const error = saveFlat({ ...flat, tenant: null }, flat.number, user.name)
    if (error) {
      notifications.show({ color: 'red', title: 'Not removed', message: error })
      return
    }
    setEndingFlat(null)
    notifications.show({ color: 'terracotta', title: 'Tenancy ended', message: `Flat ${flat.number} no longer has a tenant.` })
  }

  const flatByNumber = (flatNumber: string | null) => flats.find((flat) => flat.number === flatNumber)

  return (
    <Stack gap="lg">
      <PageHeading title={current.label} description={descriptions[current.path]} />

      {current.path === paths.adminUsers ? (
        <Stack gap="sm">
          <Group justify="flex-end">
            <Button onClick={() => openUser(null)}>Add user</Button>
          </Group>
          <Stack gap="sm" hiddenFrom="sm">
            {accounts.map((account) => {
              const home = flatByNumber(account.flatNumber)
              const link =
                account.role === 'admin'
                  ? 'Not linked to a flat'
                  : home
                    ? `Flat ${home.number} · ${home.owner?.name ?? 'No owner'}${home.tenant ? ` · tenant ${home.tenant.name}` : ' · no tenant'}`
                    : 'Flat missing'
              return (
                <FieldCard
                  key={account.id}
                  title={account.name}
                  subtitle={account.email}
                  fields={[
                    { label: 'Phone', value: account.phone ? formatPhone(account.phone) : '—' },
                    { label: 'Role', value: formatRole(account.role) },
                    { label: 'Linked to', value: link },
                  ]}
                  actions={
                    <Button size="xs" variant="light" onClick={() => openUser(account)}>
                      Edit
                    </Button>
                  }
                />
              )
            })}
          </Stack>
          <FitTable
            headers={['Name', 'Phone', 'Role', 'Linked flat', '']}
            rows={accounts.map((account) => {
              const home = flatByNumber(account.flatNumber)
              return {
                key: account.id,
                cells: [
                  <div key="name">
                    <Text size="sm" fw={600}>{account.name}</Text>
                    <Text size="xs" c="dimmed">{account.email}</Text>
                  </div>,
                  account.phone ? formatPhone(account.phone) : '—',
                  formatRole(account.role),
                  account.role === 'admin' ? '—' : home ? `${home.number}${home.tenant ? ` · ${home.tenant.name}` : ''}` : '—',
                  <Button key="edit" size="xs" variant="light" onClick={() => openUser(account)}>Edit</Button>,
                ],
              }
            })}
          />
        </Stack>
      ) : null}

      {current.path === paths.adminFlats ? (
        <Stack gap="sm">
          <Group justify="flex-end">
            <Button onClick={() => openFlat(null)}>Add flat</Button>
          </Group>
          <Stack gap="sm" hiddenFrom="sm">
            {flats.map((flat) => (
              <FieldCard
                key={flat.number}
                title={`Flat ${flat.number}`}
                subtitle={`Floor ${flat.floor} · ${flatStatus(flat)}`}
                fields={[
                  { label: 'Owner', value: flat.owner ? `${flat.owner.name} · ${formatPhone(flat.owner.phone)}` : 'No owner' },
                  { label: 'Owner email', value: flat.owner?.email || '—' },
                  { label: 'Tenant', value: flat.tenant ? flat.tenant.name : 'None' },
                  { label: 'Owner login', value: loginFor(accounts, flat.number, 'owner') },
                ]}
                actions={
                  <Button size="xs" variant="light" onClick={() => openFlat(flat)}>
                    Edit
                  </Button>
                }
              />
            ))}
          </Stack>
          <FitTable
            headers={['Flat', 'Status', 'Owner', 'Tenant', 'Owner login', '']}
            rows={flats.map((flat) => ({
              key: flat.number,
              cells: [
                `${flat.number} · floor ${flat.floor}`,
                flatStatus(flat),
                flat.owner?.name ?? 'No owner',
                flat.tenant?.name ?? 'None',
                loginFor(accounts, flat.number, 'owner'),
                <Button key="edit" size="xs" variant="light" onClick={() => openFlat(flat)}>Edit</Button>,
              ],
            }))}
          />
        </Stack>
      ) : null}

      {current.path === paths.adminTenants ? (
        <Stack gap="sm">
          <Group justify="space-between" align="flex-start" wrap="wrap">
            <Text size="sm" c="dimmed">
              {vacant.length === 1 ? '1 flat can take a tenant.' : `${vacant.length} flats can take a tenant.`}
            </Text>
            <Button onClick={() => openTenant(null)} disabled={vacant.length === 0}>
              Add tenant
            </Button>
          </Group>
          {tenants.length === 0 ? <Text c="dimmed">No tenants yet.</Text> : null}
          <Stack gap="sm" hiddenFrom="sm">
            {tenants.map((flat) => (
              <FieldCard
                key={flat.number}
                title={flat.tenant?.name ?? 'Tenant'}
                subtitle={`Flat ${flat.number}`}
                fields={[
                  { label: 'Phone', value: flat.tenant ? formatPhone(flat.tenant.phone) : '—' },
                  { label: 'Email', value: flat.tenant?.email || '—' },
                  { label: 'Occupants', value: String(flat.tenant?.occupants ?? '—') },
                  { label: 'Move-in', value: flat.tenant ? formatDate(flat.tenant.moveIn) : '—' },
                  { label: 'Move-out', value: flat.tenant?.moveOut ? formatDate(flat.tenant.moveOut) : 'Still living here' },
                  { label: 'Agreement end', value: flat.tenant ? formatDate(flat.tenant.agreementEnd) : '—' },
                  { label: 'Vehicle', value: flat.tenant?.vehicle || '—' },
                  { label: 'Emergency', value: flat.tenant?.emergency || '—' },
                  { label: 'ID proof', value: flat.tenant?.idProofLabel || '—' },
                  { label: 'Login', value: loginFor(accounts, flat.number, 'tenant') },
                ]}
                actions={
                  <>
                    <Button size="xs" variant="light" onClick={() => openTenant(flat)}>
                      Edit
                    </Button>
                    {endingFlat === flat.number ? (
                      <Button size="xs" color="red" onClick={() => endTenancy(flat)}>
                        Confirm end
                      </Button>
                    ) : (
                      <Button size="xs" variant="default" onClick={() => setEndingFlat(flat.number)}>
                        End tenancy
                      </Button>
                    )}
                  </>
                }
              />
            ))}
          </Stack>
          {tenants.length > 0 ? (
            <FitTable
              headers={['Flat', 'Tenant', 'Stay', 'Login', '']}
              rows={tenants.map((flat) => ({
                key: flat.number,
                cells: [
                  flat.number,
                  <div key="who">
                    <Text size="sm" fw={600}>{flat.tenant?.name}</Text>
                    <Text size="xs" c="dimmed">{flat.tenant ? formatPhone(flat.tenant.phone) : ''}</Text>
                  </div>,
                  flat.tenant ? `${formatDate(flat.tenant.moveIn)} → ${formatDate(flat.tenant.agreementEnd)}` : '—',
                  loginFor(accounts, flat.number, 'tenant'),
                  <Group key="actions" gap={6} wrap="wrap">
                    <Button size="xs" variant="light" onClick={() => openTenant(flat)}>Edit</Button>
                    {endingFlat === flat.number ? (
                      <Button size="xs" color="red" onClick={() => endTenancy(flat)}>Confirm end</Button>
                    ) : (
                      <Button size="xs" variant="default" onClick={() => setEndingFlat(flat.number)}>End tenancy</Button>
                    )}
                  </Group>,
                ],
              }))}
            />
          ) : null}
        </Stack>
      ) : null}

      {current.path === paths.adminCategories ? (
        <Stack gap="sm">
          <Group justify="flex-end">
            <Button onClick={() => openCategory(null)}>Add category</Button>
          </Group>
          <Stack gap="sm" hiddenFrom="sm">
            {categories.map((category) => (
              <FieldCard
                key={category.id}
                title={category.name}
                fields={[{ label: 'Default responsibility', value: category.defaultTag }]}
                actions={
                  <>
                    <Button size="xs" variant="light" onClick={() => openCategory(category)}>Edit</Button>
                    <Button
                      size="xs"
                      variant="default"
                      onClick={() => {
                        const error = removeCategory(category.id, user.name)
                        if (error) notifications.show({ color: 'red', title: 'Not deleted', message: error })
                      }}
                    >
                      Delete
                    </Button>
                  </>
                }
              />
            ))}
          </Stack>
          <FitTable
            headers={['Name', 'Default responsibility', '']}
            rows={categories.map((category) => ({
              key: category.id,
              cells: [
                category.name,
                <Badge key="tag" variant="light" color="terracotta">{category.defaultTag}</Badge>,
                <Group key="actions" gap={6} wrap="wrap">
                  <Button size="xs" variant="light" onClick={() => openCategory(category)}>Edit</Button>
                  <Button
                    size="xs"
                    variant="default"
                    onClick={() => {
                      const error = removeCategory(category.id, user.name)
                      if (error) notifications.show({ color: 'red', title: 'Not deleted', message: error })
                    }}
                  >
                    Delete
                  </Button>
                </Group>,
              ],
            }))}
          />
        </Stack>
      ) : null}

      {current.path === paths.adminRecurring ? (
        <Stack gap="sm">
          <Group justify="flex-end" wrap="wrap">
            <Button
              variant="light"
              onClick={() => {
                const created = generateRecurring(apartment.currentMonth, user.name)
                notifications.show({
                  color: 'terracotta',
                  title: created > 0 ? 'Recurring expenses added' : 'Nothing new',
                  message:
                    created > 0
                      ? `${created} expense${created === 1 ? '' : 's'} created for ${formatMonth(apartment.currentMonth)}.`
                      : 'This month already has those rules.',
                })
              }}
            >
              Run for {formatMonth(apartment.currentMonth)}
            </Button>
            <Button onClick={() => openRule(null)}>Add recurring expense</Button>
          </Group>
          <Stack gap="sm" hiddenFrom="sm">
            {recurring.map((rule) => (
              <FieldCard
                key={rule.id}
                title={rule.name}
                fields={[
                  { label: 'Category', value: rule.category },
                  { label: 'Responsibility', value: rule.responsibility },
                  { label: 'Day', value: String(rule.dayOfMonth) },
                  { label: 'Amount', value: formatINR(rule.amount) },
                ]}
                actions={
                  <>
                    <Button size="xs" variant="light" onClick={() => openRule(rule)}>Edit</Button>
                    <Button size="xs" variant="default" onClick={() => removeRecurring(rule.id, user.name)}>Delete</Button>
                  </>
                }
              />
            ))}
          </Stack>
          <FitTable
            headers={['Name', 'Category', 'Tag', 'Day', 'Amount', '']}
            rows={recurring.map((rule) => ({
              key: rule.id,
              cells: [
                rule.name,
                rule.category,
                rule.responsibility,
                String(rule.dayOfMonth),
                formatINR(rule.amount),
                <Group key="actions" gap={6} wrap="wrap">
                  <Button size="xs" variant="light" onClick={() => openRule(rule)}>Edit</Button>
                  <Button size="xs" variant="default" onClick={() => removeRecurring(rule.id, user.name)}>Delete</Button>
                </Group>,
              ],
            }))}
          />
        </Stack>
      ) : null}

      {current.path === paths.adminRecent ? (
        recent.length === 0 ? (
          <Text c="dimmed">No changes in the last 30 days.</Text>
        ) : (
          <Timeline active={recent.length} bulletSize={16} lineWidth={2} color="terracotta">
            {recent.map((entry) => (
              <Timeline.Item key={entry.id} title={entry.action}>
                <Text size="sm" style={{ overflowWrap: 'anywhere' }}>{entry.detail}</Text>
                <Text size="xs" c="dimmed">
                  {entry.actor} · {formatDateTime(entry.at)}
                </Text>
              </Timeline.Item>
            ))}
          </Timeline>
        )
      ) : null}

      {current.path === paths.adminLock ? (
        <Card maw={560}>
          <Stack gap="sm">
            <Text fw={700}>{formatMonth(apartment.currentMonth)}</Text>
            <Text size="sm" c="dimmed">
              {locked
                ? 'This month is frozen. Expenses, edits, deletes, and new payments for it are blocked until you unlock it.'
                : 'This month is open. Residents can add expenses and payments, and creators can edit their own expenses.'}
            </Text>
            <Switch
              size="md"
              color="terracotta"
              checked={locked}
              label={locked ? 'Locked' : 'Open'}
              onChange={() => toggleLock(apartment.currentMonth, user.name)}
            />
          </Stack>
        </Card>
      ) : null}

      <UserEditor opened={userOpen} account={editingUser} onClose={() => setUserOpen(false)} />
      <FlatEditor opened={flatOpen} flat={editingFlat} onClose={() => setFlatOpen(false)} />
      <TenantEditor opened={tenantOpen} flat={editingTenantFlat} onClose={() => setTenantOpen(false)} />
      <CategoryEditor opened={categoryOpen} category={editingCategory} onClose={() => setCategoryOpen(false)} />
      <RecurringEditor opened={ruleOpen} rule={editingRule} onClose={() => setRuleOpen(false)} />
    </Stack>
  )
}
