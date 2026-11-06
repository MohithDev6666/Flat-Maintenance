import dayjs from 'dayjs'

/** Today's date and month, read fresh on every access so a long-open tab stays correct. */
export const calendar = {
  get today(): string {
    return dayjs().format('YYYY-MM-DD')
  },
  get currentMonth(): string {
    return dayjs().format('YYYY-MM')
  },
}
