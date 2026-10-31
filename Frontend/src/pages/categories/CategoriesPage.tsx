import { Badge, Button, SegmentedControl, Stack } from '@mantine/core'
import { IconPlus } from '@tabler/icons-react'
import { useState } from 'react'
import { ConfirmDialog } from '../../components/common/ConfirmDialog.tsx'
import { EmptyState } from '../../components/common/EmptyState.tsx'
import { ResponsiveList } from '../../components/common/ResponsiveList.tsx'
import { StatusBadge } from '../../components/common/StatusBadge.tsx'
import { PageHeading } from '../../components/ui/PageHeading.tsx'
import { useAuth } from '../../hooks/useAuth.tsx'
import { useBuilding } from '../../hooks/useBuilding.tsx'
import { usePermissions } from '../../hooks/usePermissions.ts'
import type { CategoryTag, ExpenseCategory } from '../../types/models.ts'
import { notifyResult } from '../../utils/notify.ts'
import { CategoryForm } from './CategoryForm.tsx'

export function CategoriesPage() {
  const { user } = useAuth()
  const { categories, expenses, removeCategory } = useBuilding()
  const { can } = usePermissions()
  const [tag, setTag] = useState<'all' | CategoryTag>('all')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<ExpenseCategory | null>(null)
  const [deleting, setDeleting] = useState<ExpenseCategory | null>(null)
  if (!user) return null

  const open = (category: ExpenseCategory | null) => {
    setEditing(category)
    setFormOpen(true)
  }
  const remove = () => {
    if (!deleting) return
    notifyResult(removeCategory(deleting.id, user.name), { title: 'Category deleted', message: deleting.name }, 'Not deleted')
    setDeleting(null)
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
      {rows.length === 0 ? (
        <EmptyState title="No categories here" />
      ) : (
        <ResponsiveList headers={['Category', 'Description', 'Default responsibility', 'Expenses', 'Status']} rows={rows} />
      )}
      <CategoryForm opened={formOpen} category={editing} onClose={() => setFormOpen(false)} />
      <ConfirmDialog
        opened={deleting !== null}
        title="Delete category"
        message={deleting ? `Delete ${deleting.name}? Only categories that no expense uses can be deleted.` : ''}
        confirmLabel="Delete category"
        onConfirm={remove}
        onClose={() => setDeleting(null)}
      />
    </Stack>
  )
}
