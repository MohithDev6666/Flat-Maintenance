import { Badge, Button, Group, Modal, Stack, Text } from '@mantine/core'
import dayjs from 'dayjs'
import { useEffect, useState } from 'react'
import { useAuth } from '../../hooks/useAuth.tsx'
import { useBuilding } from '../../hooks/useBuilding.tsx'
import type { Attachment, Expense } from '../../types/models.ts'
import { monthOf } from '../../utils/calculations.ts'
import { formatDate, formatINR, formatPhone } from '../../utils/format.ts'
import { notifyResult } from '../../utils/notify.ts'
import { canDeleteExpense, canEditExpense, can } from '../../utils/permissions.ts'
import { ConfirmDialog } from '../common/ConfirmDialog.tsx'
import { FilePreview } from '../common/FilePreview.tsx'
import { StatusBadge } from '../common/StatusBadge.tsx'
import { ExpenseForm, type ExpenseFormValues } from './ExpenseForm.tsx'

export function ExpenseDetails({
  expense,
  opened,
  onClose,
}: {
  expense: Expense | null
  opened: boolean
  onClose: () => void
}) {
  const { user } = useAuth()
  const { isLocked, updateExpense, deleteExpense } = useBuilding()
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [bill, setBill] = useState<Attachment | null>(null)

  useEffect(() => {
    setEditing(false)
    setConfirmDelete(false)
  }, [expense])

  if (!user) return null

  const locked = expense ? isLocked(monthOf(expense.date)) : false
  const canEdit = expense ? canEditExpense(user, expense, locked) : false
  const canDelete = expense ? canDeleteExpense(user, expense, locked) : false

  const save = (values: ExpenseFormValues) => {
    if (!expense || !values.date) return
    const next: Expense = {
      ...expense,
      date: dayjs(values.date).format('YYYY-MM-DD'),
      category: values.category,
      responsibility: values.responsibility,
      description: values.description,
      amount: Number(values.amount),
      vendorName: values.vendorName,
      vendorPhone: values.vendorPhone,
      paymentMode: values.paymentMode,
      bill: values.bill,
    }
    const saved = notifyResult(updateExpense(next, user.name), {
      title: 'Expense updated',
      message: 'Expenses, dashboard, contribution, and month summary are recalculated.',
    })
    if (saved) {
      setEditing(false)
      onClose()
    }
  }

  const remove = () => {
    if (!expense) return
    setConfirmDelete(false)
    const removed = notifyResult(
      deleteExpense(expense.id, user.name),
      { title: 'Expense deleted', message: 'Totals have been recalculated.' },
      'Not deleted',
    )
    if (removed) onClose()
  }

  return (
    <>
      <Modal opened={opened} onClose={onClose} title={editing ? 'Edit expense' : (expense?.category ?? 'Expense')} size={editing ? 'lg' : 'md'}>
        {expense && editing ? (
          <ExpenseForm
            compact
            paidByName={expense.paidBy}
            submitLabel={can(user, 'expenses', 'manage') ? 'Save or re-tag' : 'Save changes'}
            onCancel={() => setEditing(false)}
            onSubmit={save}
            initialValues={{
              date: expense.date,
              category: expense.category,
              responsibility: expense.responsibility,
              description: expense.description,
              amount: expense.amount,
              vendorName: expense.vendorName,
              vendorPhone: expense.vendorPhone,
              paymentMode: expense.paymentMode,
              bill: expense.bill,
            }}
          />
        ) : expense ? (
          <Stack gap="sm">
            <Group justify="space-between">
              <Text fw={700} fz={28} c="terracotta.8">
                {formatINR(expense.amount)}
              </Text>
              <Group gap={6}>
                {locked ? <StatusBadge status="Locked" size="lg" /> : null}
                <Badge variant="light" color="terracotta" size="lg">
                  {expense.responsibility}
                </Badge>
              </Group>
            </Group>
            <Text>{expense.description}</Text>
            <Detail label="Expense date" value={formatDate(expense.date)} />
            <Detail label="Category" value={expense.category} />
            <Detail label="Responsibility" value={expense.responsibility} />
            <Detail label="Paid by" value={expense.paidBy} />
            <Detail label="Payment mode" value={expense.paymentMode} />
            <Detail label="Vendor" value={expense.vendorName || '—'} />
            <Detail label="Vendor phone" value={expense.vendorPhone ? formatPhone(expense.vendorPhone) : '—'} />
            <Stack gap={4} p="md" bg="sand.0" style={{ borderRadius: 12 }}>
              <Text size="sm" fw={600}>
                Bill
              </Text>
              {expense.bill ? (
                <Group justify="space-between" wrap="nowrap">
                  <Text size="sm" style={{ overflowWrap: 'anywhere' }}>
                    {expense.bill.name}
                  </Text>
                  <Button size="xs" variant="light" onClick={() => setBill(expense.bill)}>
                    View bill
                  </Button>
                </Group>
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
            {canEdit || canDelete ? (
              <Group>
                {canEdit ? (
                  <Button variant="light" onClick={() => setEditing(true)}>
                    {can(user, 'expenses', 'manage') ? 'Edit or re-tag' : 'Edit'}
                  </Button>
                ) : null}
                {canDelete ? (
                  <Button variant="default" color="red" onClick={() => setConfirmDelete(true)}>
                    Delete
                  </Button>
                ) : null}
              </Group>
            ) : null}
          </Stack>
        ) : null}
      </Modal>
      <ConfirmDialog
        opened={confirmDelete}
        title="Delete expense"
        message={expense ? `Delete ${expense.category} for ${formatINR(expense.amount)} on ${formatDate(expense.date)}? Every flat's share is recalculated.` : ''}
        confirmLabel="Delete expense"
        onConfirm={remove}
        onClose={() => setConfirmDelete(false)}
      />
      <FilePreview file={bill} title="Bill" note="Every signed-in resident can open a bill." onClose={() => setBill(null)} />
    </>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <Group justify="space-between" align="flex-start" wrap="nowrap" gap="md">
      <Text size="sm" c="dimmed">
        {label}
      </Text>
      <Text size="sm" fw={600} ta="right" style={{ overflowWrap: 'anywhere' }}>
        {value}
      </Text>
    </Group>
  )
}
