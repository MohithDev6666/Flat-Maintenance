import { createContext, useContext, useState, type ReactNode } from 'react'
import { mockAudit } from '../mocks/audit.ts'
import { categories as seedCategories } from '../mocks/categories.ts'
import { mockExpenses } from '../mocks/expenses.ts'
import { flats as seedFlats } from '../mocks/flats.ts'
import { recurringRules as seedRecurring } from '../mocks/recurring.ts'
import type {
  AuditEntry,
  Expense,
  ExpenseCategory,
  Flat,
  NewExpenseInput,
  Payment,
  RecurringRule,
} from '../types/models.ts'
import { formatDate, formatINR, formatMonth } from '../utils/format.ts'

interface BuildingContextValue {
  expenses: Expense[]
  flats: Flat[]
  categories: ExpenseCategory[]
  recurring: RecurringRule[]
  payments: Payment[]
  audit: AuditEntry[]
  lockedMonths: string[]
  addExpense: (input: NewExpenseInput) => void
  updateExpense: (next: Expense, actor: string) => string | null
  deleteExpense: (id: string, actor: string) => string | null
  isLocked: (month: string) => boolean
  toggleLock: (month: string, actor: string) => void
  saveFlat: (flat: Flat, previousNumber: string | null, actor: string) => string | null
  saveCategory: (category: ExpenseCategory, previousName: string | null, actor: string) => string | null
  removeCategory: (id: string, actor: string) => string | null
  saveRecurring: (rule: RecurringRule, isNew: boolean, actor: string) => void
  removeRecurring: (id: string, actor: string) => void
  generateRecurring: (month: string, actor: string) => number
  addPayment: (payment: Payment) => void
  flagPayment: (id: string, note: string, actor: string) => void
}

const BuildingContext = createContext<BuildingContextValue | null>(null)

function expenseLine(expense: Expense): string {
  return `${formatDate(expense.date)} · ${expense.category} · ${expense.responsibility} · ${formatINR(expense.amount)} · ${expense.description}`
}

export function BuildingProvider({ children }: { children: ReactNode }) {
  const [expenses, setExpenses] = useState<Expense[]>(mockExpenses)
  const [flats, setFlats] = useState<Flat[]>(seedFlats)
  const [categories, setCategories] = useState<ExpenseCategory[]>(seedCategories)
  const [recurring, setRecurring] = useState<RecurringRule[]>(seedRecurring)
  const [payments, setPayments] = useState<Payment[]>([])
  const [audit, setAudit] = useState<AuditEntry[]>(mockAudit)
  const [lockedMonths, setLockedMonths] = useState<string[]>([])

  const pushAudit = (actor: string, action: string, detail: string) => {
    const entry: AuditEntry = {
      id: `audit-${crypto.randomUUID()}`,
      at: new Date().toISOString(),
      actor,
      action,
      detail,
    }
    setAudit((current) => [entry, ...current])
  }

  const isLocked = (month: string) => lockedMonths.includes(month)

  const addExpense = (input: NewExpenseInput) => {
    const expense: Expense = {
      id: `exp-${crypto.randomUUID()}`,
      date: input.date,
      category: input.category,
      responsibility: input.responsibility,
      description: input.description.trim(),
      amount: input.amount,
      vendorName: input.vendorName.trim(),
      vendorPhone: input.vendorPhone.trim(),
      paymentMode: input.paymentMode,
      paidBy: input.paidByName,
      paidByUserId: input.paidByUserId,
      hasBill: input.hasBill,
      billLabel: input.billLabel,
    }
    setExpenses((current) => [expense, ...current])
    pushAudit(input.paidByName, 'Added expense', expenseLine(expense))
  }

  const updateExpense = (next: Expense, actor: string) => {
    const previous = expenses.find((expense) => expense.id === next.id)
    if (!previous) return 'That expense is no longer here.'
    if (isLocked(previous.date.slice(0, 7)) || isLocked(next.date.slice(0, 7))) {
      return 'That month is locked.'
    }
    const saved: Expense = { ...next, description: next.description.trim() }
    setExpenses((current) => current.map((expense) => (expense.id === saved.id ? saved : expense)))
    pushAudit(actor, previous.responsibility === saved.responsibility ? 'Edited expense' : 'Re-tagged expense', `${expenseLine(previous)} → ${expenseLine(saved)}`)
    return null
  }

  const deleteExpense = (id: string, actor: string) => {
    const previous = expenses.find((expense) => expense.id === id)
    if (!previous) return 'That expense is no longer here.'
    if (isLocked(previous.date.slice(0, 7))) return 'That month is locked.'
    setExpenses((current) => current.filter((expense) => expense.id !== id))
    pushAudit(actor, 'Deleted expense', expenseLine(previous))
    return null
  }

  const toggleLock = (month: string, actor: string) => {
    const locking = !lockedMonths.includes(month)
    setLockedMonths((current) => (locking ? [...current, month] : current.filter((item) => item !== month)))
    pushAudit(actor, locking ? 'Locked month' : 'Unlocked month', formatMonth(month))
  }

  const saveFlat = (flat: Flat, previousNumber: string | null, actor: string) => {
    const numberTaken = flats.some((item) => item.number === flat.number && item.number !== previousNumber)
    if (numberTaken) return 'That flat number already exists.'
    if (!flat.number.trim()) return 'Enter a flat number.'
    setFlats((current) => {
      if (!previousNumber) return [...current, flat].sort((left, right) => left.number.localeCompare(right.number))
      return current.map((item) => (item.number === previousNumber ? flat : item))
    })
    if (previousNumber && previousNumber !== flat.number) {
      setPayments((current) =>
        current.map((payment) =>
          payment.flatNumber === previousNumber ? { ...payment, flatNumber: flat.number } : payment,
        ),
      )
    }
    pushAudit(actor, previousNumber ? 'Edited flat' : 'Added flat', `Flat ${flat.number}, floor ${flat.floor}`)
    return null
  }

  const saveCategory = (category: ExpenseCategory, previousName: string | null, actor: string) => {
    const nameTaken = categories.some((item) => item.name.toLowerCase() === category.name.toLowerCase() && item.id !== category.id)
    if (!category.name.trim()) return 'Enter a category name.'
    if (nameTaken) return 'That category already exists.'
    setCategories((current) => {
      const exists = current.some((item) => item.id === category.id)
      if (!exists) return [...current, category]
      return current.map((item) => (item.id === category.id ? category : item))
    })
    if (previousName && previousName !== category.name) {
      setExpenses((current) =>
        current.map((expense) => (expense.category === previousName ? { ...expense, category: category.name } : expense)),
      )
      setRecurring((current) =>
        current.map((rule) => (rule.category === previousName ? { ...rule, category: category.name } : rule)),
      )
    }
    pushAudit(
      actor,
      previousName ? 'Edited category' : 'Added category',
      previousName && previousName !== category.name
        ? `${previousName} → ${category.name} · ${category.defaultTag}`
        : `${category.name} · ${category.defaultTag}`,
    )
    return null
  }

  const removeCategory = (id: string, actor: string) => {
    const category = categories.find((item) => item.id === id)
    if (!category) return 'That category is no longer here.'
    const used = expenses.some((expense) => expense.category === category.name)
    if (used) return 'This category is used on an expense, so it stays.'
    setCategories((current) => current.filter((item) => item.id !== id))
    pushAudit(actor, 'Deleted category', category.name)
    return null
  }

  const saveRecurring = (rule: RecurringRule, isNew: boolean, actor: string) => {
    setRecurring((current) => (isNew ? [...current, rule] : current.map((item) => (item.id === rule.id ? rule : item))))
    pushAudit(actor, isNew ? 'Added recurring expense' : 'Edited recurring expense', `${rule.name} · ${formatINR(rule.amount)}`)
  }

  const removeRecurring = (id: string, actor: string) => {
    const rule = recurring.find((item) => item.id === id)
    if (!rule) return
    setRecurring((current) => current.filter((item) => item.id !== id))
    pushAudit(actor, 'Deleted recurring expense', rule.name)
  }

  const generateRecurring = (month: string, actor: string) => {
    if (isLocked(month)) return 0
    const created: Expense[] = []
    for (const rule of recurring) {
      const already = expenses.some((expense) => expense.recurringRuleId === rule.id && expense.date.startsWith(month))
      if (already) continue
      created.push({
        id: `exp-${crypto.randomUUID()}`,
        date: `${month}-${String(rule.dayOfMonth).padStart(2, '0')}`,
        category: rule.category,
        responsibility: rule.responsibility,
        description: `${rule.name}. Created from the recurring rule.`,
        amount: rule.amount,
        vendorName: '',
        vendorPhone: '',
        paymentMode: 'Bank',
        paidBy: 'Building',
        paidByUserId: null,
        hasBill: false,
        recurringRuleId: rule.id,
      })
    }
    if (created.length === 0) return 0
    setExpenses((current) => [...created, ...current])
    pushAudit(actor, 'Created recurring expenses', `${formatMonth(month)} · ${created.length} added`)
    return created.length
  }

  const addPayment = (payment: Payment) => {
    setPayments((current) => [payment, ...current])
    pushAudit(payment.payerName, 'Added payment', `${formatMonth(payment.month)} · ${formatINR(payment.amount)} · ${payment.screenshotLabel}`)
  }

  const flagPayment = (id: string, note: string, actor: string) => {
    const previous = payments.find((payment) => payment.id === id)
    if (!previous) return
    const next = { ...previous, needsCheck: true, checkNote: note.trim() }
    setPayments((current) => current.map((payment) => (payment.id === id ? next : payment)))
    pushAudit(actor, 'Flagged payment', `${previous.payerName} · ${formatINR(previous.amount)} · ${next.checkNote || 'Needs check'}`)
  }

  return (
    <BuildingContext.Provider
      value={{
        expenses,
        flats,
        categories,
        recurring,
        payments,
        audit,
        lockedMonths,
        addExpense,
        updateExpense,
        deleteExpense,
        isLocked,
        toggleLock,
        saveFlat,
        saveCategory,
        removeCategory,
        saveRecurring,
        removeRecurring,
        generateRecurring,
        addPayment,
        flagPayment,
      }}
    >
      {children}
    </BuildingContext.Provider>
  )
}

export function useBuilding(): BuildingContextValue {
  const value = useContext(BuildingContext)
  if (!value) throw new Error('useBuilding must be used within BuildingProvider')
  return value
}
