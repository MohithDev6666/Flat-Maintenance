import { Alert, Button, Card, Input, NumberInput, SegmentedControl, Select, SimpleGrid, Stack, TextInput } from '@mantine/core'
import { DatePickerInput } from '@mantine/dates'
import { useForm } from '@mantine/form'
import dayjs from 'dayjs'
import { FileUploadField } from '../../components/common/FileUploadField.tsx'
import { useBuilding } from '../../hooks/useBuilding.tsx'
import { calendar } from '../../mocks/calendar.ts'
import type { Attachment, Payment, PaymentMode, ResidentKind, SessionUser } from '../../types/models.ts'
import { activeTenantOf, listMonths, ownerOf, partyForUser, sortByFlatNumber, type Party } from '../../utils/calculations.ts'
import { formatMonth } from '../../utils/format.ts'
import { notifyError, notifyResult } from '../../utils/notify.ts'

interface PaymentFormValues {
  flatId: string
  payAs: ResidentKind
  month: string
  amount: number | string
  date: string | null
  mode: PaymentMode
  reference: string
  screenshot: Attachment | null
}

/**
 * Records money paid to the building. Owners and tenants pay for themselves;
 * the admin picks the flat and whether the owner or tenant paid.
 */
export function PaymentForm({ user, month, onMonthChange }: { user: SessionUser; month: string; onMonthChange: (month: string) => void }) {
  const { flats, owners, tenants, accounts, expenses, addPayment, isLocked, payments } = useBuilding()
  const data = { flats, owners, tenants, accounts }
  const forAdmin = user.role === 'admin'
  const form = useForm<PaymentFormValues>({
    initialValues: {
      flatId: flats[0]?.id ?? '',
      payAs: 'owner',
      month,
      amount: '',
      date: calendar.today,
      mode: 'UPI',
      reference: '',
      screenshot: null,
    },
    validate: {
      month: (value) => (value ? null : 'Choose a month'),
      amount: (value) => (Number(value) > 0 ? null : 'Enter an amount above zero'),
      date: (value) => (value ? null : 'Choose the payment date'),
      reference: (value, values) => (values.mode === 'Cash' || value.trim() ? null : 'Enter the UPI or bank reference'),
      screenshot: (value) => (value ? null : 'A payment screenshot is required'),
    },
  })

  const locked = isLocked(form.values.month)
  const monthOptions = listMonths(expenses)
    .slice()
    .reverse()
    .map((value) => ({ value, label: `${formatMonth(value)}${isLocked(value) ? ' · Locked' : ''}` }))

  const payerFor = (values: PaymentFormValues): Party | null => {
    if (!forAdmin) return partyForUser(user, data)
    if (values.payAs === 'owner') {
      const owner = ownerOf(owners, values.flatId)
      return owner ? { kind: 'owner', residentId: owner.id, flatId: values.flatId, name: owner.name } : null
    }
    const tenant = activeTenantOf(tenants, values.flatId, `${values.month}-01`) ?? activeTenantOf(tenants, values.flatId)
    return tenant ? { kind: 'tenant', residentId: tenant.id, flatId: values.flatId, name: tenant.name } : null
  }

  const save = (values: PaymentFormValues) => {
    const party = payerFor(values)
    if (!party || !party.flatId || !values.screenshot || !values.date) {
      notifyError('Not saved', forAdmin ? `That flat has no ${values.payAs} for ${formatMonth(values.month)}.` : 'Your account is not linked to a flat.')
      return
    }
    const login = accounts.find((account) => (party.kind === 'owner' ? account.ownerId : account.tenantId) === party.residentId)
    const payment: Payment = {
      id: `pay-${crypto.randomUUID()}`,
      userId: forAdmin ? (login?.id ?? user.id) : user.id,
      payerName: forAdmin ? (login?.name ?? party.name) : user.name,
      flatId: party.flatId,
      role: party.kind,
      residentId: party.residentId,
      month: values.month,
      amount: Number(values.amount),
      date: dayjs(values.date).format('YYYY-MM-DD'),
      mode: values.mode,
      reference: values.reference.trim(),
      screenshot: values.screenshot,
      needsCheck: false,
      checkNote: '',
    }
    const saved = notifyResult(addPayment(payment), {
      title: 'Payment saved',
      message: 'My Contribution and Month Summary now include this amount.',
    })
    if (saved) {
      form.setValues({ amount: '', reference: '', screenshot: null })
      form.resetDirty()
    }
  }

  const duplicateReference =
    form.values.reference.trim() !== '' && payments.some((payment) => payment.reference === form.values.reference.trim())

  return (
    <Card maw={720}>
      <form onSubmit={form.onSubmit(save)}>
        <Stack gap="md">
          {locked ? (
            <Alert color="red" title="This month is locked">
              {formatMonth(form.values.month)} cannot take a new payment.
            </Alert>
          ) : null}
          {forAdmin ? (
            <SimpleGrid cols={{ base: 1, sm: 2 }}>
              <Select
                label="Flat"
                required
                searchable
                data={sortByFlatNumber(flats).map((flat) => ({ value: flat.id, label: `Flat ${flat.number}` }))}
                allowDeselect={false}
                {...form.getInputProps('flatId')}
              />
              <Select
                label="Paid by"
                required
                data={[
                  { value: 'owner', label: 'Owner' },
                  { value: 'tenant', label: 'Tenant' },
                ]}
                allowDeselect={false}
                {...form.getInputProps('payAs')}
              />
            </SimpleGrid>
          ) : null}
          <Select
            label="Month"
            required
            searchable
            data={monthOptions}
            allowDeselect={false}
            value={form.values.month}
            error={form.errors.month}
            onChange={(value) => {
              if (!value) return
              form.setFieldValue('month', value)
              onMonthChange(value)
            }}
          />
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <NumberInput label="Amount" required prefix="₹ " min={0} thousandSeparator="," {...form.getInputProps('amount')} />
            <DatePickerInput label="Payment date" required valueFormat="DD-MM-YYYY" {...form.getInputProps('date')} />
          </SimpleGrid>
          <Input.Wrapper label="Payment mode" required>
            <SegmentedControl
              mt={6}
              fullWidth
              data={['Cash', 'UPI', 'Bank']}
              value={form.values.mode}
              onChange={(value) => form.setFieldValue('mode', value as PaymentMode)}
            />
          </Input.Wrapper>
          <TextInput
            label="Reference number"
            required={form.values.mode !== 'Cash'}
            placeholder="UPI or bank reference"
            description={duplicateReference ? 'This reference is already on another payment. Check before saving.' : undefined}
            {...form.getInputProps('reference')}
          />
          <FileUploadField
            label="Payment screenshot"
            description="Required before saving."
            required
            disabled={locked}
            value={form.values.screenshot}
            error={typeof form.errors.screenshot === 'string' ? form.errors.screenshot : null}
            onChange={(file) => form.setFieldValue('screenshot', file)}
          />
          <Button type="submit" size="lg" fullWidth disabled={!form.values.screenshot || locked}>
            Save payment
          </Button>
        </Stack>
      </form>
    </Card>
  )
}
