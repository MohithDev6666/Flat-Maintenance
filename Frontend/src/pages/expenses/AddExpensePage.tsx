import { Card, Stack } from '@mantine/core'
import dayjs from 'dayjs'
import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LoadState } from '../../components/common/LoadState.tsx'
import { ExpenseForm, type ExpenseFormValues } from '../../components/expenses/ExpenseForm.tsx'
import { PageHeading } from '../../components/ui/PageHeading.tsx'
import { useAuth } from '../../hooks/useAuth.tsx'
import { paths } from '../../routes/nav.ts'
import { getErrorMessage } from '../../services/apiClient.ts'
import { getCategories } from '../../services/categoryService.ts'
import { createExpense } from '../../services/expenseService.ts'
import { getFlats } from '../../services/flatService.ts'
import { getMonthLocks, lockChecker } from '../../services/monthLockService.ts'
import type { ExpenseCategory, MonthLock } from '../../types/models.ts'
import { calendar } from '../../utils/calendar.ts'
import { notifyApiError, notifySuccess } from '../../utils/notify.ts'

export function AddExpensePage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [categories, setCategories] = useState<ExpenseCategory[]>([])
  const [monthLocks, setMonthLocks] = useState<MonthLock[]>([])
  const [flatCount, setFlatCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    try {
      const [categoryList, lockList, flats] = await Promise.all([
        getCategories(),
        getMonthLocks(),
        // The flat count only explains the split; the form works without it.
        getFlats().catch(() => []),
      ])
      setCategories(categoryList)
      setMonthLocks(lockList)
      setFlatCount(flats.length)
      setError(null)
    } catch (failure) {
      setError(getErrorMessage(failure))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  if (!user) return null

  const submit = async (values: ExpenseFormValues) => {
    if (!values.date) return
    setSaving(true)
    try {
      await createExpense({
        date: dayjs(values.date).format('YYYY-MM-DD'),
        category: values.category,
        responsibility: values.responsibility,
        description: values.description,
        amount: Number(values.amount),
        vendorName: values.vendorName,
        vendorPhone: values.vendorPhone,
        paymentMode: values.paymentMode,
        bill: values.bill,
        paidBy: user.name,
        paidByUserId: user.id,
      })
      notifySuccess('Expense saved', 'Expenses, dashboard, contribution, and month summary now include this amount.')
      navigate(paths.expenses)
    } catch (failure) {
      notifyApiError(failure)
    } finally {
      setSaving(false)
    }
  }

  const firstCategory = categories.find((category) => category.status === 'Active')

  return (
    <Stack gap="lg">
      <PageHeading
        title="Add Expense"
        description={`Paid by is you. The share is recalculated for all ${flatCount > 0 ? `${flatCount} ` : ''}flats as soon as this is saved.`}
      />
      <LoadState loading={loading} error={error} onRetry={load}>
        <Card maw={720}>
          <ExpenseForm
            paidByName={user.name}
            submitLabel="Save expense"
            onSubmit={(values) => void submit(values)}
            saving={saving}
            categories={categories}
            isLocked={lockChecker(monthLocks)}
            flatCount={flatCount}
            initialValues={{
              date: calendar.today,
              category: firstCategory?.name ?? '',
              responsibility: firstCategory?.defaultTag === 'Owner' ? 'Owner' : 'Tenant',
              description: '',
              amount: '',
              vendorName: '',
              vendorPhone: '',
              paymentMode: 'UPI',
              bill: null,
            }}
          />
        </Card>
      </LoadState>
    </Stack>
  )
}
