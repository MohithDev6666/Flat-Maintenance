import {
  Alert,
  Button,
  Card,
  Input,
  NumberInput,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  TextInput,
} from '@mantine/core'
import { DatePickerInput } from '@mantine/dates'
import { Dropzone } from '@mantine/dropzone'
import { useForm } from '@mantine/form'
import { notifications } from '@mantine/notifications'
import dayjs from 'dayjs'
import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageHeading } from '../../components/ui/PageHeading.tsx'
import { UploadPreview } from '../../components/ui/UploadPreview.tsx'
import { useAuth } from '../../hooks/useAuth.tsx'
import { useBuilding } from '../../hooks/useBuilding.tsx'
import { paths } from '../../routes/nav.ts'
import type { PaymentMode, Responsibility } from '../../types/models.ts'
import { formatMonth } from '../../utils/format.ts'
import { chosenFileKind, photoOrPdf, uploadRejectMessage } from '../../utils/upload.ts'

interface ExpenseFormValues {
  date: Date | null
  category: string
  responsibility: Responsibility
  description: string
  amount: number | string
  vendorName: string
  vendorPhone: string
  paymentMode: PaymentMode
}

export function AddExpensePage() {
  const { user } = useAuth()
  const { addExpense, isLocked, categories } = useBuilding()
  const navigate = useNavigate()
  const [billName, setBillName] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewKind, setPreviewKind] = useState<'image' | 'pdf'>('image')
  const previewUrlRef = useRef<string | null>(null)

  const form = useForm<ExpenseFormValues>({
    initialValues: {
      date: new Date(2026, 9, 30),
      category: 'Water',
      responsibility: 'Tenant',
      description: '',
      amount: '',
      vendorName: '',
      vendorPhone: '',
      paymentMode: 'UPI',
    },
    validate: {
      date: (value) => (value ? null : 'Choose a date'),
      category: (value) => (value ? null : 'Choose a category'),
      description: (value) => (value.trim().length >= 3 ? null : 'Add a short description'),
      amount: (value) => (Number(value) > 0 ? null : 'Enter an amount in rupees'),
    },
  })

  if (!user) return null

  const clearBill = () => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current)
    previewUrlRef.current = null
    setBillName(null)
    setPreviewUrl(null)
  }

  const showBill = (file: File) => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current)
    const url = URL.createObjectURL(file)
    previewUrlRef.current = url
    setBillName(file.name)
    setPreviewKind(chosenFileKind(file))
    setPreviewUrl(url)
  }

  const month = form.values.date ? dayjs(form.values.date).format('YYYY-MM') : null
  const locked = month ? isLocked(month) : false

  const submit = (values: ExpenseFormValues) => {
    if (!values.date || !month) return
    if (isLocked(month)) {
      notifications.show({
        color: 'red',
        title: 'Month locked',
        message: `${formatMonth(month)} is frozen. Ask the admin to unlock it.`,
      })
      return
    }
    addExpense({
      date: dayjs(values.date).format('YYYY-MM-DD'),
      category: values.category,
      responsibility: values.responsibility,
      description: values.description,
      amount: Number(values.amount),
      vendorName: values.vendorName,
      vendorPhone: values.vendorPhone,
      paymentMode: values.paymentMode,
      hasBill: Boolean(billName),
      billLabel: billName ?? undefined,
      paidByName: user.name,
      paidByUserId: user.id,
    })
    notifications.show({
      title: 'Expense saved',
      message: 'The month totals now include this amount.',
      color: 'terracotta',
    })
    navigate(paths.dashboard)
  }

  return (
    <Stack gap="lg">
      <PageHeading
        title="Add expense"
        description="Paid by is you. The share is recalculated for all 8 flats as soon as this is saved."
      />
      <Card maw={720}>
        <form onSubmit={form.onSubmit(submit)}>
          <Stack gap="md">
            {locked && month ? (
              <Alert color="red" title="This month is locked">
                {formatMonth(month)} cannot take new expenses until the admin unlocks it.
              </Alert>
            ) : null}
            <DatePickerInput label="Date" valueFormat="DD-MM-YYYY" {...form.getInputProps('date')} />
            <Select
              label="Category"
              data={categories.map((item) => item.name)}
              allowDeselect={false}
              searchable
              value={form.values.category}
              error={form.errors.category}
              onChange={(value) => {
                const next = value ?? ''
                form.setFieldValue('category', next)
                const match = categories.find((item) => item.name === next)
                if (match && match.defaultTag !== 'Other') {
                  form.setFieldValue('responsibility', match.defaultTag)
                }
              }}
            />
            <Input.Wrapper label="Responsibility" description="Filled from the category. You can change it.">
              <SegmentedControl
                mt={6}
                fullWidth
                data={[
                  { label: 'Owner', value: 'Owner' },
                  { label: 'Tenant', value: 'Tenant' },
                ]}
                value={form.values.responsibility}
                onChange={(value) => form.setFieldValue('responsibility', value as Responsibility)}
              />
            </Input.Wrapper>
            <Textarea label="Description" minRows={2} autosize {...form.getInputProps('description')} />
            <NumberInput
              label="Amount"
              description="Rupees. Split equally across all 8 flats."
              prefix="₹ "
              min={0}
              thousandSeparator=","
              {...form.getInputProps('amount')}
            />
            <SimpleGrid cols={{ base: 1, sm: 2 }}>
              <TextInput label="Vendor name" placeholder="Optional" {...form.getInputProps('vendorName')} />
              <TextInput label="Vendor phone" placeholder="Optional" {...form.getInputProps('vendorPhone')} />
            </SimpleGrid>
            <Input.Wrapper label="Payment mode">
              <SegmentedControl
                mt={6}
                fullWidth
                data={['Cash', 'UPI', 'Bank']}
                value={form.values.paymentMode}
                onChange={(value) => form.setFieldValue('paymentMode', value as PaymentMode)}
              />
            </Input.Wrapper>
            <TextInput label="Paid by" value={user.name} readOnly />
            <Stack gap={6}>
              <Text size="sm" fw={600}>
                Bill photo or PDF
              </Text>
              <Text size="xs" c="dimmed">
                Optional. JPG, PNG, other photos, or PDF.
              </Text>
              <Dropzone
                multiple={false}
                maxSize={8 * 1024 ** 2}
                accept={photoOrPdf}
                onDrop={(files) => {
                  const file = files[0]
                  if (file) showBill(file)
                }}
                onReject={() =>
                  notifications.show({
                    color: 'red',
                    title: 'File not added',
                    message: uploadRejectMessage,
                  })
                }
              >
                {previewUrl && billName ? (
                  <UploadPreview url={previewUrl} name={billName} kind={previewKind} onRemove={clearBill} />
                ) : (
                  <Stack align="center" gap={4} mih={84} justify="center" style={{ pointerEvents: 'none' }}>
                    <Text size="sm" ta="center">
                      Tap to add a bill
                    </Text>
                    <Text size="xs" c="dimmed" ta="center">
                      JPG, PNG, other photos, or PDF
                    </Text>
                  </Stack>
                )}
              </Dropzone>
              {billName ? (
                <Button variant="subtle" color="terracotta" onClick={clearBill} w="fit-content">
                  Remove bill
                </Button>
              ) : null}
            </Stack>
            <Button type="submit" size="lg" fullWidth disabled={locked}>
              Save expense
            </Button>
          </Stack>
        </form>
      </Card>
    </Stack>
  )
}
