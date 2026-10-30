import { Button, Group } from '@mantine/core'
import { IconBrandWhatsapp, IconDownload, IconFileSpreadsheet } from '@tabler/icons-react'

export function DownloadBar({
  onPdf,
  onCsv,
  onWhatsApp,
}: {
  onPdf: () => void
  onCsv?: () => void
  onWhatsApp?: () => void
}) {
  return (
    <Group gap="sm">
      <Button variant="light" leftSection={<IconDownload size={16} />} onClick={onPdf}>
        Download PDF
      </Button>
      {onCsv ? (
        <Button variant="default" leftSection={<IconFileSpreadsheet size={16} />} onClick={onCsv}>
          Download CSV
        </Button>
      ) : null}
      {onWhatsApp ? (
        <Button variant="default" leftSection={<IconBrandWhatsapp size={16} />} onClick={onWhatsApp}>
          WhatsApp
        </Button>
      ) : null}
    </Group>
  )
}
