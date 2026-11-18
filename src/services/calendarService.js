export function calendarLink({ labName, workstationName, date, slot }) {
  const startHour = String(8 + slot * 2).padStart(2, '0');
  const endHour = String(8 + (slot + 1) * 2).padStart(2, '0');
  const dateStr = date.replace(/-/g, '');
  const dates = `${dateStr}T${startHour}0000/${dateStr}T${endHour}0000`;

  const url = new URL('https://calendar.google.com/calendar/render');
  url.searchParams.set('action', 'TEMPLATE');
  url.searchParams.set('text', `Lab ${labName}, workstation ${workstationName}`);
  url.searchParams.set('dates', dates);
  url.searchParams.set('ctz', 'Europe/Sofia');
  return url.toString();
}
