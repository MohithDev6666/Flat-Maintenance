import { Alert, Button, Group, Modal, Select, SimpleGrid, Stack, Switch, Text, Textarea, TextInput } from '@mantine/core'
import { useForm } from '@mantine/form'
import { useEffect } from 'react'
import { useAuth } from '../../hooks/useAuth.tsx'
import { useBuilding } from '../../hooks/useBuilding.tsx'
import type { Owner } from '../../types/models.ts'
import { ownerOf, sortByFlatNumber } from '../../utils/calculations.ts'
import { notifyResult } from '../../utils/notify.ts'

const NONE = 'none'

interface OwnerFormValues {
  name: string
  phone: string
  email: string
  flatId: string
  livesInFlat: boolean
  address: string
  emergency: string
}

const empty: OwnerFormValues = { name: '', phone: '', email: '', flatId: NONE, livesInFlat: false, address: '', emergency: '' }

export function OwnerForm({ opened, owner, onClose }: { opened: boolean; owner: Owner | null; onClose: () => void }) {
  const { user } = useAuth()
  const { flats, owners, building, saveOwner } = useBuilding()

  const flatAddress = (flatId: string) => {
    const flat = flats.find((item) => item.id === flatId)
    return flat ? `Flat ${flat.number}, ${building.name}, ${building.address}` : ''
  }

  const form = useForm<OwnerFormValues>({
    initialValues: empty,
    validate: {
      name: (value) => (value.trim() ? null : 'Enter the owner’s name'),
      phone: (value) => (/^[\d\s+-]{7,15}$/.test(value.trim()) ? null : 'Enter a valid phone number'),
      email: (value) => (/^\S+@\S+\.\S+$/.test(value.trim()) ? null : 'Enter a valid email'),
      address: (value) => (value.trim() ? null : 'Enter an address'),
      emergency: (value) => (value.trim() ? null : 'Enter an emergency contact'),
    },
  })

  useEffect(() => {
    if (!opened) return
    form.setValues(
      owner
        ? {
            ...owner,
            flatId: owner.flatId ?? NONE,
            livesInFlat: owner.flatId !== null && owner.address === flatAddress(owner.flatId),
          }
        : empty,
    )
    form.resetDirty()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened, owner])

  if (!user) return null

  // The flat is assigned here. Once linked it stays fixed, because a flat must never be left without its owner;
  // ownership moves by giving the flat to the new owner, which releases the previous one.
  const linked = owner?.flatId != null
  const flatChoices = sortByFlatNumber(flats).map((flat) => {
    const current = ownerOf(owners, flat.id)
    const ownedByOther = current && current.id !== owner?.id
    return {
      value: flat.id,
      label: `Flat ${flat.number} · Floor ${flat.floor} · ${ownedByOther ? `owned by ${current.name}` : 'no owner'}`,
    }
  })
  const seller = form.values.flatId !== NONE ? ownerOf(owners, form.values.flatId) : null
  const transferFrom = seller && seller.id !== owner?.id ? seller : null

  const setFlat = (flatId: string) => {
    form.setFieldValue('flatId', flatId)
    if (flatId === NONE) form.setFieldValue('livesInFlat', false)
    else if (form.values.livesInFlat || !form.values.address.trim()) {
      form.setFieldValue('livesInFlat', true)
      form.setFieldValue('address', flatAddress(flatId))
    }
  }

  const setLivesInFlat = (checked: boolean) => {
    form.setFieldValue('livesInFlat', checked)
    if (checked && form.values.flatId !== NONE) form.setFieldValue('address', flatAddress(form.values.flatId))
  }

  const save = (values: OwnerFormValues) => {
    const flatId = values.flatId === NONE ? null : values.flatId
    const done = notifyResult(
      saveOwner(
        {
          id: owner?.id ?? `owner-${crypto.randomUUID()}`,
          name: values.name,
          phone: values.phone,
          email: values.email,
          flatId,
          address: values.livesInFlat && flatId ? flatAddress(flatId) : values.address,
          emergency: values.emergency,
        },
        user.name,
      ),
      {
        title: transferFrom ? 'Ownership transferred' : owner ? 'Owner updated' : 'Owner added',
        message: transferFrom ? `${transferFrom.name} → ${values.name.trim()}` : values.name.trim(),
      },
    )
    if (done) onClose()
  }

  return (
    <Modal opened={opened} onClose={onClose} title={owner ? 'Edit owner' : 'Add owner'} size="lg">
      <form onSubmit={form.onSubmit(save)}>
        <Stack gap="sm">
          <TextInput label="Owner name" required {...form.getInputProps('name')} />
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <TextInput label="Phone number" required inputMode="tel" {...form.getInputProps('phone')} />
            <TextInput label="Email" required {...form.getInputProps('email')} />
          </SimpleGrid>
          <Select
            label="Flat"
            searchable
            allowDeselect={false}
            disabled={linked}
            description={
              linked
                ? 'Permanent owner of this flat. If it is sold, add or edit the new owner and choose this flat for them.'
                : 'Choose the flat this owner owns. Choosing a flat that already has an owner transfers it to this owner.'
            }
            data={[...(linked ? [] : [{ value: NONE, label: 'No flat yet' }]), ...flatChoices]}
            value={form.values.flatId}
            onChange={(value) => setFlat(value ?? NONE)}
          />
          {transferFrom ? (
            <Alert color="red" variant="light" p="xs">
              <Text size="sm">
                Saving transfers flat {flats.find((flat) => flat.id === form.values.flatId)?.number} from {transferFrom.name} to
                this owner. {transferFrom.name} stays on the list with no flat.
              </Text>
            </Alert>
          ) : null}
          <Switch
            label="Lives in this flat"
            description="On: the flat is their address. Off: enter where they live."
            disabled={form.values.flatId === NONE}
            checked={form.values.livesInFlat}
            onChange={(event) => setLivesInFlat(event.currentTarget.checked)}
          />
          <Textarea
            label="Address"
            required
            autosize
            minRows={2}
            readOnly={form.values.livesInFlat && form.values.flatId !== NONE}
            {...form.getInputProps('address')}
          />
          <TextInput label="Emergency contact" required placeholder="Name · phone" {...form.getInputProps('emergency')} />
          <Group justify="flex-end">
            <Button variant="default" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">{owner ? 'Save owner' : 'Add owner'}</Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  )
}
