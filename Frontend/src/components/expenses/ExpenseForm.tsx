import { Alert, Button, Group, Input, NumberInput, SegmentedControl, Select, SimpleGrid, Stack, Textarea, TextInput } from '@mantine/core'
import { DatePickerInput } from '@mantine/dates'
import { useForm } from '@mantine/form'
import { useBuilding } from '../../hooks/useBuilding.tsx'
import type { Attachment, PaymentMode, Responsibility } from '../../types/models.ts'
import { monthOf } from '../../utils/calculations.ts'
import { formatMonth } from '../../utils/format.ts'
import { FileUploadField } from '../common/FileUploadField.tsx'

export interface ExpenseFormValues {
  date: string | null
  category: string
  responsibility: Responsibility
  description: string
  amount: number | string
  vendorName: string
  vendorPhone: string
  paymentMode: PaymentMode
  bill: Attachment | null
}

/** One form for adding and editing. Picking a category fills the responsibility, which stays editable. */
export function ExpenseForm({
  initialValues,
  paidByName,
  submitLabel,
  onSubmit,
  onCancel,
  compact = false,
}: {
  initialValues: ExpenseFormValues
  paidByName: string
  submitLabel: string
  onSubmit: (values: ExpenseFormValues) => void
  onCancel?: () => void
  compact?: boolean
}) {
  const { categories, isLocked, flats } = useBuilding()
  const form = useForm<ExpenseFormValues>({
    initialValues,
    validate: {
      date: (value) => (value ? null : 'Choose a date'),
      category: (value) => (value ? null : 'Choose a category'),
      description: (value) => (value.trim().length >= 3 ? null : 'Add a short description'),
      amount: (value) => (Number(value) > 0 ? null : 'Enter an amount in rupees'),
      vendorPhone: (value) => (!value.trim() || /^[\d\s+-]{7,15}$/.test(value.trim()) ? null : 'Enter a valid phone number'),
    },
  })

  const month = form.values.date ? monthOf(form.values.date) : null
  const locked = month ? isLocked(month) : false
  const choices = categories
    .filter((item) => item.status === 'Active' || item.name === initialValues.category)
    .map((item) => item.name)

  return (
    <form onSubmit={form.onSubmit(onSubmit)}>
      <Stack gap="md">
        {locked && month ? (
          <Alert color="red" title="This month is locked">
            {formatMonth(month)} cannot take expenses or edits until the admin unlocks it.
          </Alert>
        ) : null}
        <DatePickerInput label="Expense date" valueFormat="DD-MM-YYYY" required {...form.getInputProps('date')} />
        <Select
          label="Category"
          required
          data={choices}
          allowDeselect={false}
          searchable
          value={form.values.category}
          error={form.errors.category}
          onChange={(value) => {
            const next = value ?? ''
            form.setFieldValue('category', next)
            const match = categories.find((item) => item.name === next)
            if (match && match.defaultTag !== 'Other') form.setFieldValue('responsibility', match.defaultTag)
          }}
        />
        <Input.Wrapper label="Responsibility" required description="Filled from the category. You can change it.">
          <SegmentedControl
            mt={6}
            fullWidth
            data={['Owner', 'Tenant']}
            value={form.values.responsibility}
            onChange={(value) => form.setFieldValue('responsibility', value as Responsibility)}
          />
        </Input.Wrapper>
        <Textarea label="Description" required minRows={2} autosize {...form.getInputProps('description')} />
        <NumberInput
          label="Amount"
          required
          description={`Rupees. Split equally across all ${flats.length} flats.`}
          prefix="₹ "
          min={0}
          thousandSeparator=","
          {...form.getInputProps('amount')}
        />
        <SimpleGrid cols={{ base: 1, sm: 2 }}>
          <TextInput label="Vendor name" placeholder="Optional" {...form.getInputProps('vendorName')} />
          <TextInput label="Vendor phone" placeholder="Optional" inputMode="tel" {...form.getInputProps('vendorPhone')} />
        </SimpleGrid>
        <Input.Wrapper label="Payment mode" required>
          <SegmentedControl
            mt={6}
            fullWidth
            data={['Cash', 'UPI', 'Bank']}
            value={form.values.paymentMode}
            onChange={(value) => form.setFieldValue('paymentMode', value as PaymentMode)}
          />
        </Input.Wrapper>
        <TextInput label="Paid by" value={paidByName} readOnly description="The person who paid this expense out of pocket." />
        <FileUploadField
          label="Bill photo or PDF"
          description="Optional."
          value={form.values.bill}
          onChange={(file) => form.setFieldValue('bill', file)}
        />
        <Group grow={!compact}>
          <Button type="submit" size={compact ? 'sm' : 'lg'} fullWidth={!compact} disabled={locked}>
            {submitLabel}
          </Button>
          {onCancel ? (
            <Button variant="default" size={compact ? 'sm' : 'lg'} onClick={onCancel}>
              Cancel
            </Button>
          ) : null}
        </Group>
      </Stack>
    </form>
  )
}
