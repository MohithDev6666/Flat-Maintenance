import { Badge, Button, Group, Modal, Select, Stack, Text, TextInput, Textarea } from '@mantine/core'
import { DatePickerInput } from '@mantine/dates'
import { notifications } from '@mantine/notifications'
import dayjs from 'dayjs'
import { useEffect, useState } from 'react'
import { useAuth } from '../../hooks/useAuth.tsx'
import { useBuilding } from '../../hooks/useBuilding.tsx'
import type { Expense, Responsibility } from '../../types/models.ts'
import { formatDate, formatINR, formatPhone } from '../../utils/format.ts'

export function ExpensePreview({
  expense,
  opened,
  onClose,
}: {
  expense: Expense | null
  opened: boolean
  onClose: () => void
}) {
  const { user } = useAuth()
  const { categories, isLocked, updateExpense, deleteExpense } = useBuilding()
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [date, setDate] = useState<string | null>(null)
  const [category, setCategory] = useState('')
  const [responsibility, setResponsibility] = useState<Responsibility | ''>('Tenant')
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')

  useEffect(() => {
    setEditing(false)
    setConfirmDelete(false)
    if (!expense) return
    setDate(expense.date)
    setCategory(expense.category)
    setResponsibility(expense.responsibility)
    setDescription(expense.description)
    setAmount(String(expense.amount))
  }, [expense])

  if (!user) return null

  const month = expense ? expense.date.slice(0, 7) : ''
  const locked = month ? isLocked(month) : false
  const canEdit = Boolean(expense) && !locked && (user.role === 'admin' || user.id === expense?.paidByUserId)
  const canDelete = Boolean(expense) && !locked && user.role === 'admin'

  const save = () => {
    if (!expense || !date) return
    const parsed = Number(amount)
    if (!category || !responsibility || !description.trim() || !(parsed > 0)) {
      notifications.show({ color: 'red', title: 'Check the expense', message: 'Category, responsibility, description, and amount are required.' })
      return
    }
    const next: Expense = {
      ...expense,
      date: dayjs(date).format('YYYY-MM-DD'),
      category,
      responsibility,
      description,
      amount: parsed,
    }
    const error = updateExpense(next, user.name)
    if (error) {
      notifications.show({ color: 'red', title: 'Not saved', message: error })
      return
    }
    notifications.show({ color: 'terracotta', title: 'Expense updated', message: 'Totals have been recalculated.' })
    setEditing(false)
    onClose()
  }

  const remove = () => {
    if (!expense) return
    const error = deleteExpense(expense.id, user.name)
    if (error) {
      notifications.show({ color: 'red', title: 'Not deleted', message: error })
      return
    }
    notifications.show({ color: 'terracotta', title: 'Expense deleted', message: 'Totals have been recalculated.' })
    onClose()
  }

  return (
    <Modal opened={opened} onClose={onClose} title={expense?.category ?? 'Expense'} size="md">
      {expense && editing ? (
        <Stack gap="sm">
          <DatePickerInput label="Date" valueFormat="DD-MM-YYYY" value={date} onChange={setDate} />
          <Select
            label="Category"
            data={categories.map((item) => item.name)}
            value={category}
            allowDeselect={false}
            onChange={(value) => {
              const next = value ?? ''
              setCategory(next)
              const match = categories.find((item) => item.name === next)
              if (match && match.defaultTag !== 'Other') setResponsibility(match.defaultTag)
            }}
          />
          <Select
            label="Responsibility"
            data={['Owner', 'Tenant']}
            value={responsibility}
            allowDeselect={false}
            onChange={(value) => setResponsibility(value === 'Owner' || value === 'Tenant' ? value : '')}
          />
          <Textarea label="Description" value={description} onChange={(event) => setDescription(event.currentTarget.value)} minRows={2} />
          <TextInput label="Amount" value={amount} onChange={(event) => setAmount(event.currentTarget.value)} />
          <Group>
            <Button onClick={save}>Save changes</Button>
            <Button variant="default" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </Group>
        </Stack>
      ) : expense ? (
        <Stack gap="sm">
          <Group justify="space-between">
            <Text fw={700} fz={28} c="terracotta.8">
              {formatINR(expense.amount)}
            </Text>
            <Badge variant="light" color="terracotta" size="lg">
              {expense.responsibility}
            </Badge>
          </Group>
          <Text>{expense.description}</Text>
          <Detail label="Date" value={formatDate(expense.date)} />
          <Detail label="Paid by" value={expense.paidBy} />
          <Detail label="Mode" value={expense.paymentMode} />
          {expense.vendorName ? (
            <Detail
              label="Vendor"
              value={expense.vendorPhone ? `${expense.vendorName} · ${formatPhone(expense.vendorPhone)}` : expense.vendorName}
            />
          ) : null}
          <Stack gap={4} p="md" bg="sand.0" style={{ borderRadius: 12 }}>
            <Text size="sm" fw={600}>
              Bill preview
            </Text>
            {expense.hasBill ? (
              <>
                <Text size="sm">{expense.billLabel}</Text>
                <Text size="xs" c="dimmed">
                  Every signed-in resident can open a bill. This sample keeps the file name only.
                </Text>
              </>
            ) : (
              <Text size="sm" c="dimmed">
                No bill was attached.
              </Text>
            )}
          </Stack>
          {locked ? (
            <Text size="sm" c="dimmed">
              This month is locked, so the expense cannot be changed.
            </Text>
          ) : null}
          <Group>
            {canEdit ? (
              <Button variant="light" onClick={() => setEditing(true)}>
                {user.role === 'admin' ? 'Edit or re-tag' : 'Edit'}
              </Button>
            ) : null}
            {canDelete && !confirmDelete ? (
              <Button variant="default" color="red" onClick={() => setConfirmDelete(true)}>
                Delete
              </Button>
            ) : null}
            {canDelete && confirmDelete ? (
              <Button color="red" onClick={remove}>
                Confirm delete
              </Button>
            ) : null}
          </Group>
        </Stack>
      ) : null}
    </Modal>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <Group justify="space-between" align="flex-start" wrap="nowrap" gap="md">
      <Text size="sm" c="dimmed">
        {label}
      </Text>
      <Text size="sm" fw={600} ta="right">
        {value}
      </Text>
    </Group>
  )
}
