import { ThemeIcon } from '@mantine/core'
import { IconBuildingCommunity } from '@tabler/icons-react'

export function BrandMark({ light = false, size = 56 }: { light?: boolean; size?: number }) {
  return (
    <ThemeIcon
      size={size}
      radius="xl"
      variant={light ? 'white' : 'filled'}
      color="terracotta"
      c={light ? 'terracotta.8' : 'white'}
    >
      <IconBuildingCommunity size={Math.round(size * 0.48)} stroke={1.6} />
    </ThemeIcon>
  )
}
