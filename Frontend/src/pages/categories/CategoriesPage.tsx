import { Badge, Button, SegmentedControl, Stack } from '@mantine/core'
import { IconPlus } from '@tabler/icons-react'
import { useCallback, useEffect, useState } from 'react'
import { ConfirmDialog } from '../../components/common/ConfirmDialog.tsx'
import { EmptyState } from '../../components/common/EmptyState.tsx'
import { LoadState } from '../../components/common/LoadState.tsx'
import { ResponsiveList } from '../../components/common/ResponsiveList.tsx'
import { StatusBadge } from '../../components/common/StatusBadge.tsx'
import { PageHeading } from '../../components/ui/PageHeading.tsx'
import { usePermissions } from '../../hooks/usePermissions.ts'
import { getErrorMessage } from '../../services/apiClient.ts'
import { deleteCategory, getCategories } from '../../services/categoryService.ts'
import { getExpenses } from '../../services/expenseService.ts'
import type { CategoryTag, Expense, ExpenseCategory } from '../../types/models.ts'
import { notifyApiError, notifySuccess } from '../../utils/notify.ts'
import { CategoryForm } from './CategoryForm.tsx'

export function CategoriesPage() {
  const { can } = usePermissions()
  const [categories, setCategories] = useState<ExpenseCategory[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tag, setTag] = useState<'all' | CategoryTag>('all')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<ExpenseCategory | null>(null)
  const [deleting, setDeleting] = useState<ExpenseCategory | null>(null)
  const [busy, setBusy] = useState(false)
  const canCountUsage = can('expenses', 'view')

  const load = useCallback(async () => {
    try {
      const [categoryList, expenseList] = await Promise.all([getCategories(), canCountUsage ? getExpenses() : Promise.resolve([])])
      setCategories(categoryList)
      setExpenses(expenseList)
      setError(null)
    } catch (failure) {
      setError(getErrorMessage(failure))
    } finally {
      setLoading(false)
    }
  }, [canCountUsage])

  useEffect(() => {
    void load()
  }, [load])

  const open = (category: ExpenseCategory | null) => {
    setEditing(category)
    setFormOpen(true)
  }
  const remove = async () => {
    if (!deleting) return
    setBusy(true)
    try {
      await deleteCategory(deleting.id)
      notifySuccess('Category deleted', deleting.name)
      setDeleting(null)
      await load()
    } catch (failure) {
      notifyApiError(failure, 'Not deleted')
    } finally {
      setBusy(false)
    }
  }

  const rows = categories
    .filter((category) => tag === 'all' || category.defaultTag === tag)
    .map((category) => {
      const used = expenses.filter((expense) => expense.category === category.name).length
      const tagBadge = (
        <Badge variant="light" color="terracotta">
          {category.defaultTag}
        </Badge>
      )
      return {
        key: category.id,
        cells: [category.name, category.description || '—', tagBadge, String(used), <StatusBadge key="status" status={category.status} />],
        card: {
          title: category.name,
          subtitle: category.description,
          badge: <StatusBadge status={category.status} />,
          fields: [
            { label: 'Default responsibility', value: category.defaultTag },
            { label: 'Used on', value: `${used} expense${used === 1 ? '' : 's'}` },
          ],
        },
        actions: (
          <>
            {can('categories', 'edit') ? (
              <Button size="xs" variant="light" onClick={() => open(category)}>
                Edit
              </Button>
            ) : null}
            {can('categories', 'delete') && used === 0 ? (
              <Button size="xs" variant="subtle" color="red" onClick={() => setDeleting(category)}>
                Delete
              </Button>
            ) : null}
          </>
        ),
      }
    })

  return (
    <Stack gap="lg">
      <PageHeading
        title="Categories"
        description="Each category sets the default Owner or Tenant responsibility. The person adding an expense can still change it."
        action={
          can('categories', 'add') ? (
            <Button leftSection={<IconPlus size={16} />} onClick={() => open(null)}>
              Add category
            </Button>
          ) : null
        }
      />
      <SegmentedControl
        w="fit-content"
        value={tag}
        onChange={(value) => setTag(value as 'all' | CategoryTag)}
        data={[
          { label: 'All', value: 'all' },
          { label: 'Tenant', value: 'Tenant' },
          { label: 'Owner', value: 'Owner' },
          { label: 'Other', value: 'Other' },
        ]}
      />
      <LoadState loading={loading} error={error} onRetry={load}>
        {rows.length === 0 ? (
          <EmptyState title={categories.length === 0 ? 'No categories yet' : 'No categories here'} message="Add a category to use it on expenses." />
        ) : (
          <ResponsiveList headers={['Category', 'Description', 'Default responsibility', 'Expenses', 'Status']} rows={rows} />
        )}
      </LoadState>
      <CategoryForm
        opened={formOpen}
        category={editing}
        categories={categories}
        onClose={() => setFormOpen(false)}
        onSaved={() => void load()}
      />
      <ConfirmDialog
        opened={deleting !== null}
        title="Delete category"
        message={deleting ? `Delete ${deleting.name}? Only categories that no expense uses can be deleted.` : ''}
        confirmLabel="Delete category"
        loading={busy}
        onConfirm={() => void remove()}
        onClose={() => setDeleting(null)}
      />
    </Stack>
  )
}
