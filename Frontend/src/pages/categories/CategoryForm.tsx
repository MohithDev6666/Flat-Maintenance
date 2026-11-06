import { Button, Group, Modal, Select, SimpleGrid, Stack, Textarea, TextInput } from '@mantine/core'
import { useForm } from '@mantine/form'
import { useEffect, useState } from 'react'
import { createCategory, updateCategory } from '../../services/categoryService.ts'
import type { CategoryTag, ExpenseCategory, RecordStatus } from '../../types/models.ts'
import { notifyApiError, notifySuccess } from '../../utils/notify.ts'

interface CategoryFormValues {
  name: string
  description: string
  defaultTag: CategoryTag
  status: RecordStatus
}

const empty: CategoryFormValues = { name: '', description: '', defaultTag: 'Tenant', status: 'Active' }

export function CategoryForm({
  opened,
  category,
  categories,
  onClose,
  onSaved,
}: {
  opened: boolean
  category: ExpenseCategory | null
  /** Existing categories, to catch a duplicate name before calling the API. */
  categories: ExpenseCategory[]
  onClose: () => void
  onSaved: () => void
}) {
  const [saving, setSaving] = useState(false)
  const form = useForm<CategoryFormValues>({
    initialValues: empty,
    validate: {
      name: (value) => {
        const name = value.trim()
        if (!name) return 'Enter a category name'
        const taken = categories.some((item) => item.name.toLowerCase() === name.toLowerCase() && item.id !== category?.id)
        return taken ? 'That category already exists' : null
      },
    },
  })

  useEffect(() => {
    if (!opened) return
    form.setValues(
      category
        ? { name: category.name, description: category.description, defaultTag: category.defaultTag, status: category.status }
        : empty,
    )
    form.resetDirty()
    form.clearErrors()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened, category])

  const save = async (values: CategoryFormValues) => {
    setSaving(true)
    try {
      if (category) await updateCategory(category.id, values)
      else await createCategory(values)
      notifySuccess(category ? 'Category updated' : 'Category added', values.name.trim())
      onSaved()
      onClose()
    } catch (failure) {
      notifyApiError(failure)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal opened={opened} onClose={onClose} title={category ? 'Edit category' : 'Add category'}>
      <form onSubmit={form.onSubmit((values) => void save(values))}>
        <Stack gap="sm">
          <TextInput label="Category name" required {...form.getInputProps('name')} />
          <Textarea label="Description" autosize minRows={2} {...form.getInputProps('description')} />
          <SimpleGrid cols={2}>
            <Select
              label="Default responsibility"
              required
              description="Other means the person chooses"
              data={['Owner', 'Tenant', 'Other']}
              allowDeselect={false}
              {...form.getInputProps('defaultTag')}
            />
            <Select
              label="Status"
              required
              description="Inactive is hidden from Add Expense"
              data={['Active', 'Inactive']}
              allowDeselect={false}
              {...form.getInputProps('status')}
            />
          </SimpleGrid>
          <Group justify="flex-end">
            <Button variant="default" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              Save category
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  )
}
