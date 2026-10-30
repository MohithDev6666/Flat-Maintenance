import {
  Alert,
  Badge,
  Button,
  Card,
  Group,
  Select,
  Stack,
  Text,
  TextInput,
} from '@mantine/core'
import { Dropzone } from '@mantine/dropzone'
import { notifications } from '@mantine/notifications'
import dayjs from 'dayjs'
import { useRef, useState } from 'react'
import { PageHeading } from '../../components/ui/PageHeading.tsx'
import { UploadPreview } from '../../components/ui/UploadPreview.tsx'
import { useAuth } from '../../hooks/useAuth.tsx'
import { useBuilding } from '../../hooks/useBuilding.tsx'
import { apartment } from '../../mocks/apartment.ts'
import type { Payment, PaymentMode, Role } from '../../types/models.ts'
import { formatDate, formatINR, formatMonth } from '../../utils/format.ts'
import { chosenFileKind, photoOrPdf, uploadRejectMessage } from '../../utils/upload.ts'

export function PayPage() {
  const { user, accounts } = useAuth()
  const { payments, addPayment, flagPayment, isLocked, flats } = useBuilding()
  const openScreenshot = useRef<() => void>(null)
  const previewUrlRef = useRef<string | null>(null)
  const [month, setMonth] = useState<string | null>(apartment.currentMonth)
  const [date, setDate] = useState('30-10-2026')
  const [amount, setAmount] = useState('')
  const [mode, setMode] = useState<PaymentMode | null>('UPI')
  const [reference, setReference] = useState('')
  const [screenshot, setScreenshot] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewKind, setPreviewKind] = useState<'image' | 'pdf'>('image')
  const [note, setNote] = useState('')
  const [flagId, setFlagId] = useState<string | null>(null)
  const [payFlat, setPayFlat] = useState<string | null>('101')
  const [payAs, setPayAs] = useState<'owner' | 'tenant' | null>('owner')

  if (!user) return null

  const clearScreenshot = () => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current)
    previewUrlRef.current = null
    setScreenshot(null)
    setPreviewUrl(null)
  }

  const showScreenshot = (file: File) => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current)
    const url = URL.createObjectURL(file)
    previewUrlRef.current = url
    setScreenshot(file.name)
    setPreviewKind(chosenFileKind(file))
    setPreviewUrl(url)
  }

  const mine = payments.filter((payment) => payment.userId === user.id)
  const visible = user.role === 'admin' ? payments : mine
  const locked = month ? isLocked(month) : false

  const save = () => {
    const parsed = dayjs(date, 'DD-MM-YYYY', true)
    const value = Number(amount)
    if (!parsed.isValid()) {
      notifications.show({ color: 'red', title: 'Check the date', message: 'Use DD-MM-YYYY.' })
      return
    }
    if (!(value > 0)) {
      notifications.show({ color: 'red', title: 'Enter an amount', message: 'The payment has to be more than zero.' })
      return
    }
    if (!screenshot) {
      notifications.show({ color: 'red', title: 'Screenshot required', message: 'Add a payment screenshot before saving.' })
      return
    }
    if (!month) {
      notifications.show({ color: 'red', title: 'Choose a month', message: 'Pick the month this payment is for.' })
      return
    }
    if (!mode) {
      notifications.show({ color: 'red', title: 'Choose a mode', message: 'Pick Cash, UPI, or Bank.' })
      return
    }
    if (locked) {
      notifications.show({ color: 'red', title: 'Month locked', message: `${formatMonth(month)} is frozen.` })
      return
    }
    const forAdmin = user.role === 'admin'
    if (forAdmin && !payAs) {
      notifications.show({ color: 'red', title: 'Choose who paid', message: 'Pick Owner or Tenant.' })
      return
    }
    const payerRole: Role = forAdmin && payAs ? payAs : user.role
    const flatNumber = forAdmin ? payFlat : user.flatNumber
    if (!flatNumber) {
      notifications.show({ color: 'red', title: 'Choose a flat', message: 'A payment has to belong to a flat.' })
      return
    }
    const linked = forAdmin
      ? accounts.find((account) => account.flatNumber === flatNumber && account.role === payerRole)
      : null
    const payment: Payment = {
      id: `pay-${crypto.randomUUID()}`,
      userId: linked?.id ?? user.id,
      payerName: linked?.name ?? user.name,
      flatNumber,
      role: payerRole,
      month,
      amount: value,
      date: parsed.format('YYYY-MM-DD'),
      mode,
      reference: reference.trim(),
      screenshotLabel: screenshot,
      needsCheck: false,
      checkNote: '',
    }
    addPayment(payment)
    setAmount('')
    setReference('')
    clearScreenshot()
    notifications.show({ color: 'terracotta', title: 'Payment saved', message: 'The status now includes this amount.' })
  }

  return (
    <Stack gap="lg">
      <PageHeading
        title="Pay"
        description="Record money paid to the building. A screenshot is required. Status becomes Unpaid, Partial, or Paid straight away."
      />

      {user.role === 'admin' ? (
        <Alert variant="light" color="terracotta" title="Admin review">
          Record a payment with a screenshot, or flag one already in the list as “Needs check”.
        </Alert>
      ) : null}
      <Card maw={720}>
        <Stack gap="md">
          {month && locked ? <Alert color="red" title="This month is locked">{formatMonth(month)} cannot take a new payment.</Alert> : null}
          {user.role === 'admin' ? (
            <>
              <Select
                label="Flat"
                data={[...flats]
                  .sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true }))
                  .map((flat) => ({ value: flat.number, label: `Flat ${flat.number}` }))}
                value={payFlat}
                onChange={setPayFlat}
                allowDeselect={false}
              />
              <Select
                label="Paid by"
                data={[
                  { value: 'owner', label: 'Owner' },
                  { value: 'tenant', label: 'Tenant' },
                ]}
                value={payAs}
                onChange={(value) => setPayAs(value === 'owner' || value === 'tenant' ? value : null)}
                allowDeselect={false}
              />
            </>
          ) : null}
          <Select
            label="Month"
            data={[{ value: apartment.currentMonth, label: formatMonth(apartment.currentMonth) }]}
            value={month}
            onChange={setMonth}
            allowDeselect={false}
          />
          <TextInput label="Date" placeholder="DD-MM-YYYY" value={date} onChange={(event) => setDate(event.currentTarget.value)} />
          <TextInput label="Amount" placeholder="₹" value={amount} onChange={(event) => setAmount(event.currentTarget.value)} />
          <Select
            label="Mode"
            data={['Cash', 'UPI', 'Bank']}
            value={mode}
            allowDeselect={false}
            onChange={(value) => setMode(value === 'Cash' || value === 'UPI' || value === 'Bank' ? value : null)}
          />
          <TextInput label="Reference number" placeholder="UPI or bank reference" value={reference} onChange={(event) => setReference(event.currentTarget.value)} />
          <Stack gap={6}>
            <Text size="sm" fw={600}>
              Payment screenshot
            </Text>
            <Dropzone
              openRef={openScreenshot}
              multiple={false}
              disabled={locked}
              maxSize={8 * 1024 ** 2}
              accept={photoOrPdf}
              onDrop={(files) => {
                const file = files[0]
                if (file) showScreenshot(file)
              }}
              onReject={() =>
                notifications.show({ color: 'red', title: 'File not added', message: uploadRejectMessage })
              }
            >
              {previewUrl && screenshot ? (
                <UploadPreview url={previewUrl} name={screenshot} kind={previewKind} onRemove={clearScreenshot} />
              ) : (
                <Stack align="center" gap={4} mih={84} justify="center" style={{ pointerEvents: 'none' }}>
                  <Text size="sm">No screenshot yet</Text>
                  <Text size="xs" c="dimmed">
                    JPG, PNG, other photos, or PDF. Up to 8 MB. Required before saving.
                  </Text>
                </Stack>
              )}
            </Dropzone>
            <Button variant="light" disabled={locked} onClick={() => openScreenshot.current?.()}>
              {screenshot ? 'Replace screenshot' : 'Upload screenshot'}
            </Button>
          </Stack>
          <Button size="lg" fullWidth onClick={save} disabled={!screenshot || locked}>
            Save payment
          </Button>
        </Stack>
      </Card>

      <Stack gap="sm">
        <Text fw={700}>{user.role === 'admin' ? 'All payments' : 'Your payments'}</Text>
        {visible.length === 0 ? <Text c="dimmed">No payments yet.</Text> : null}
        {visible.map((payment) => (
          <Card key={payment.id}>
            <Group justify="space-between" align="flex-start">
              <div>
                <Text fw={700}>{formatINR(payment.amount)}</Text>
                <Text size="sm" c="dimmed">
                  {payment.payerName} · {formatMonth(payment.month)} · {formatDate(payment.date)} · {payment.mode}
                </Text>
                <Text size="sm">Screenshot: {payment.screenshotLabel}</Text>
                {payment.reference ? <Text size="sm">Reference {payment.reference}</Text> : null}
              </div>
              {payment.needsCheck ? (
                <Badge color="red" variant="light">
                  Needs check
                </Badge>
              ) : (
                <Badge variant="light" color="terracotta">
                  Recorded
                </Badge>
              )}
            </Group>
            {payment.needsCheck && payment.checkNote ? (
              <Text size="sm" mt="sm">
                Note: {payment.checkNote}
              </Text>
            ) : null}
            {user.role === 'admin' && !payment.needsCheck ? (
              <Stack gap="xs" mt="sm">
                {flagId === payment.id ? (
                  <>
                    <TextInput
                      label="Note for the payer"
                      value={note}
                      onChange={(event) => setNote(event.currentTarget.value)}
                    />
                    <Group>
                      <Button
                        size="sm"
                        onClick={() => {
                          flagPayment(payment.id, note, user.name)
                          setFlagId(null)
                          setNote('')
                        }}
                      >
                        Save flag
                      </Button>
                      <Button size="sm" variant="default" onClick={() => setFlagId(null)}>
                        Cancel
                      </Button>
                    </Group>
                  </>
                ) : (
                  <Button size="sm" variant="light" onClick={() => setFlagId(payment.id)}>
                    Needs check
                  </Button>
                )}
              </Stack>
            ) : null}
          </Card>
        ))}
      </Stack>
    </Stack>
  )
}
