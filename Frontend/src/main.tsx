import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import dayjs from 'dayjs'
import customParseFormat from 'dayjs/plugin/customParseFormat'
import '@mantine/core/styles.css'
import '@mantine/dates/styles.css'
import '@mantine/charts/styles.css'
import '@mantine/dropzone/styles.css'
import '@mantine/notifications/styles.css'
import './index.css'
import App from './App.tsx'

dayjs.extend(customParseFormat)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
