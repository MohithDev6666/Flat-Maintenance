import { Button, Group, NumberInput, SimpleGrid, Stack, Textarea, TextInput } from '@mantine/core'
import { useForm } from '@mantine/form'
import type { Building } from '../../types/models.ts'

export function BuildingForm({
  initialValues,
  onSave,
  onCancel,
}: {
  initialValues: Building
  onSave: (values: Building) => void
  onCancel: () => void
}) {
  const form = useForm<Building>({
    initialValues,
    validate: {
      name: (value) => (value.trim() ? null : 'Enter the building name'),
      address: (value) => (value.trim() ? null : 'Enter the address'),
      totalFlats: (value) => (Number(value) >= 1 ? null : 'At least 1 flat'),
      floors: (value) => (Number(value) >= 1 ? null : 'At least 1 floor'),
      contactPhone: (value) => (/^[\d\s+-]{7,15}$/.test(value.trim()) ? null : 'Enter a valid phone number'),
    },
  })

  return (
    <form onSubmit={form.onSubmit((values) => onSave({ ...values, totalFlats: Number(values.totalFlats), floors: Number(values.floors) }))}>
      <Stack gap="sm">
        <TextInput label="Building name" required {...form.getInputProps('name')} />
        <Textarea label="Building address" required autosize minRows={2} {...form.getInputProps('address')} />
        <SimpleGrid cols={{ base: 1, sm: 3 }}>
          <NumberInput label="Total flats" required min={1} description="Default 8" {...form.getInputProps('totalFlats')} />
          <NumberInput label="Number of floors" required min={1} {...form.getInputProps('floors')} />
          <TextInput label="Contact phone number" required inputMode="tel" {...form.getInputProps('contactPhone')} />
        </SimpleGrid>
        <Group justify="flex-end">
          <Button variant="default" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit">Save</Button>
        </Group>
      </Stack>
    </form>
  )
}
