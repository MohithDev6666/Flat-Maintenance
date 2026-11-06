import { Alert, Button, Card, Input, NumberInput, SegmentedControl, Select, SimpleGrid, Stack, TextInput } from '@mantine/core'
import { DatePickerInput } from '@mantine/dates'
import { useForm } from '@mantine/form'
import dayjs from 'dayjs'
import { useState } from 'react'
import { FileUploadField } from '../../components/common/FileUploadField.tsx'
import { createPayment } from '../../services/paymentService.ts'
import type { MonthOption } from '../../services/reportService.ts'
import type { Attachment, Flat, Owner, Payment, PaymentMode, ResidentKind, SessionUser, Tenant, UserAccount } from '../../types/models.ts'
import { calendar } from '../../utils/calendar.ts'
import { activeTenantOf, ownerOf, sortByFlatNumber, type Party } from '../../utils/calculations.ts'
import { formatMonth } from '../../utils/format.ts'
import { notifyApiError, notifyError, notifySuccess } from '../../utils/notify.ts'

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
 * Records money paid to the building. Owners and tenants pay for themselves (the API fills in
 * their flat and record); the admin picks the flat and whether the owner or tenant paid.
 */
export function PaymentForm({
  user,
  month,
  onMonthChange,
  flats,
  owners,
  tenants,
  accounts,
  months: monthList,
  payments,
  isLocked,
  onSaved,
}: {
  user: SessionUser
  month: string
  onMonthChange: (month: string) => void
  flats: Flat[]
  owners: Owner[]
  tenants: Tenant[]
  accounts: UserAccount[]
  /** From the pay-status API: months with expenses plus the current month, newest first. */
  months: MonthOption[]
  payments: Payment[]
  isLocked: (month: string) => boolean
  onSaved: () => void
}) {
  const forAdmin = user.role === 'admin'
  const [saving, setSaving] = useState(false)
  const form = useForm<PaymentFormValues>({
    initialValues: {
      flatId: sortByFlatNumber(flats)[0]?.id ?? '',
      payAs: 'owner',
      month,
      amount: '',
      date: calendar.today,
      mode: 'UPI',
      reference: '',
      screenshot: null,
    },
    validate: {
      flatId: (value) => (!forAdmin || value ? null : 'Choose a flat'),
      month: (value) => (value ? null : 'Choose a month'),
      amount: (value) => (Number(value) > 0 ? null : 'Enter an amount above zero'),
      date: (value) => (value ? null : 'Choose the payment date'),
      reference: (value, values) => (values.mode === 'Cash' || value.trim() ? null : 'Enter the UPI or bank reference'),
      screenshot: (value) => (value ? null : 'A payment screenshot is required'),
    },
  })

  const locked = isLocked(form.values.month)
  const months = new Set([...monthList.map((option) => option.month), month])
  const monthOptions = [...months]
    .sort()
    .reverse()
    .map((value) => ({ value, label: `${formatMonth(value)}${isLocked(value) ? ' · Locked' : ''}` }))

  /** Who the payment is for. Residents pay as themselves. */
  const payerFor = (values: PaymentFormValues): Party | null => {
    if (!forAdmin) {
      const residentId = user.role === 'owner' ? user.ownerId : user.tenantId
      if (!residentId || user.role === 'admin') return null
      return { kind: user.role, residentId, flatId: user.flatId, name: user.name }
    }
    if (values.payAs === 'owner') {
      const owner = ownerOf(owners, values.flatId)
      return owner ? { kind: 'owner', residentId: owner.id, flatId: values.flatId, name: owner.name } : null
    }
    const tenant = activeTenantOf(tenants, values.flatId, `${values.month}-01`) ?? activeTenantOf(tenants, values.flatId)
    return tenant ? { kind: 'tenant', residentId: tenant.id, flatId: values.flatId, name: tenant.name } : null
  }

  const save = async (values: PaymentFormValues) => {
    const party = payerFor(values)
    if (!party || !values.screenshot || !values.date) {
      notifyError(
        'Not saved',
        forAdmin ? `That flat has no ${values.payAs} for ${formatMonth(values.month)}.` : 'Your account is not linked to an owner or tenant record.',
      )
      return
    }
    const login = accounts.find((account) => (party.kind === 'owner' ? account.ownerId : account.tenantId) === party.residentId)
    setSaving(true)
    try {
      await createPayment({
        userId: forAdmin ? (login?.id ?? user.id) : user.id,
        payerName: forAdmin ? (login?.name ?? party.name) : user.name,
        flatId: party.flatId ?? '',
        role: party.kind,
        residentId: party.residentId,
        month: values.month,
        amount: Number(values.amount),
        date: dayjs(values.date).format('YYYY-MM-DD'),
        mode: values.mode,
        reference: values.reference,
        screenshot: values.screenshot,
      })
      notifySuccess(
        'Payment saved',
        forAdmin
          ? 'Recorded as verified. My Contribution and Month Summary now include this amount.'
          : 'Sent for verification. It counts as paid once the admin verifies it.',
      )
      form.setValues({ amount: '', reference: '', screenshot: null })
      form.resetDirty()
      onSaved()
    } catch (failure) {
      notifyApiError(failure)
    } finally {
      setSaving(false)
    }
  }

  const duplicateReference =
    form.values.reference.trim() !== '' && payments.some((payment) => payment.reference === form.values.reference.trim())

  return (
    <Card maw={720}>
      <form onSubmit={form.onSubmit((values) => void save(values))}>
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
                nothingFoundMessage="No flats. Add them on Admin → Flats."
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
            <NumberInput label="Amount" required prefix="₹ " min={0} decimalScale={2} thousandSeparator="," {...form.getInputProps('amount')} />
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
          <Button type="submit" size="lg" fullWidth disabled={!form.values.screenshot || locked} loading={saving}>
            Save payment
          </Button>
        </Stack>
      </form>
    </Card>
  )
}
