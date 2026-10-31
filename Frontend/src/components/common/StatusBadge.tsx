import { Badge } from '@mantine/core'

const colors: Record<string, string> = {
  Paid: 'teal',
  Partial: 'yellow',
  Unpaid: 'terracotta',
  Active: 'teal',
  Inactive: 'gray',
  Upcoming: 'yellow',
  Past: 'gray',
  Locked: 'red',
  Open: 'teal',
  Rented: 'terracotta',
  'Owner-occupied': 'teal',
  Vacant: 'gray',
  Occupied: 'terracotta',
  Available: 'teal',
  'Needs check': 'red',
  Recorded: 'teal',
}

export function StatusBadge({ status, size = 'sm' }: { status: string; size?: 'xs' | 'sm' | 'md' | 'lg' }) {
  return (
    <Badge variant="light" color={colors[status] ?? 'terracotta'} size={size}>
      {status}
    </Badge>
  )
}
