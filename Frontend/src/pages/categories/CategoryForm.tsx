import { Button, Group, Modal, Select, SimpleGrid, Stack, Textarea, TextInput } from '@mantine/core'
import { useForm } from '@mantine/form'
import { useEffect } from 'react'
import { useAuth } from '../../hooks/useAuth.tsx'
import { useBuilding } from '../../hooks/useBuilding.tsx'
import type { CategoryTag, ExpenseCategory, RecordStatus } from '../../types/models.ts'
import { notifyResult } from '../../utils/notify.ts'

interface CategoryFormValues {
  name: string
  description: string
  defaultTag: CategoryTag
  status: RecordStatus
}

const empty: CategoryFormValues = { name: '', description: '', defaultTag: 'Tenant', status: 'Active' }

export function CategoryForm({ opened, category, onClose }: { opened: boolean; category: ExpenseCategory | null; onClose: () => void }) {
  const { user } = useAuth()
  const { saveCategory } = useBuilding()
  const form = useForm<CategoryFormValues>({
    initialValues: empty,
    validate: { name: (value) => (value.trim() ? null : 'Enter a category name') },
  })

  useEffect(() => {
    if (!opened) return
    form.setValues(category ? { ...category } : empty)
    form.resetDirty()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened, category])

  if (!user) return null

  const save = (values: CategoryFormValues) => {
    const done = notifyResult(saveCategory({ ...values, id: category?.id ?? `cat-${crypto.randomUUID()}` }, user.name), {
      title: category ? 'Category updated' : 'Category added',
      message: values.name.trim(),
    })
    if (done) onClose()
  }

  return (
    <Modal opened={opened} onClose={onClose} title={category ? 'Edit category' : 'Add category'}>
      <form onSubmit={form.onSubmit(save)}>
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
            <Button variant="default" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">Save category</Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  )
}
