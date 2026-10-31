import { Card, Stack } from '@mantine/core'
import dayjs from 'dayjs'
import { useNavigate } from 'react-router-dom'
import { ExpenseForm, type ExpenseFormValues } from '../../components/expenses/ExpenseForm.tsx'
import { PageHeading } from '../../components/ui/PageHeading.tsx'
import { useAuth } from '../../hooks/useAuth.tsx'
import { useBuilding } from '../../hooks/useBuilding.tsx'
import { calendar } from '../../mocks/calendar.ts'
import { paths } from '../../routes/nav.ts'
import { notifyResult } from '../../utils/notify.ts'

export function AddExpensePage() {
  const { user } = useAuth()
  const { addExpense, flats } = useBuilding()
  const navigate = useNavigate()
  if (!user) return null

  const submit = (values: ExpenseFormValues) => {
    if (!values.date) return
    const error = addExpense({
      date: dayjs(values.date).format('YYYY-MM-DD'),
      category: values.category,
      responsibility: values.responsibility,
      description: values.description,
      amount: Number(values.amount),
      vendorName: values.vendorName,
      vendorPhone: values.vendorPhone,
      paymentMode: values.paymentMode,
      bill: values.bill,
      paidByName: user.name,
      paidByUserId: user.id,
    })
    const saved = notifyResult(error, {
      title: 'Expense saved',
      message: 'Expenses, dashboard, contribution, and month summary now include this amount.',
    })
    if (saved) navigate(paths.expenses)
  }

  return (
    <Stack gap="lg">
      <PageHeading
        title="Add Expense"
        description={`Paid by is you. The share is recalculated for all ${flats.length} flats as soon as this is saved.`}
      />
      <Card maw={720}>
        <ExpenseForm
          paidByName={user.name}
          submitLabel="Save expense"
          onSubmit={submit}
          initialValues={{
            date: calendar.today,
            category: 'Water',
            responsibility: 'Tenant',
            description: '',
            amount: '',
            vendorName: '',
            vendorPhone: '',
            paymentMode: 'UPI',
            bill: null,
          }}
        />
      </Card>
    </Stack>
  )
}
