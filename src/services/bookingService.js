import {
  getLabById,
  getWorkstationsForLab,
  getWorkstationById,
  getBookingsForLab,
  insertBooking,
  getBooking,
  deleteBooking,
  getUpcomingBookingsForUser as getUpcomingBookingsForUserDb
} from '../db/bookings.js';
import {
  InvalidBooking,
  BookingConflict,
  NotOwner,
  BookingNotFound,
  LabNotFound,
  WorkstationNotFound
} from './errors.js';
import { calendarLink } from './calendarService.js';

function validateDate(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') {
    throw new InvalidBooking('Invalid date');
  }
  const parts = dateStr.split('-');
  if (parts.length !== 3) {
    throw new InvalidBooking('Invalid date format');
  }
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  const d = new Date(year, month, day);
  if (
    d.getFullYear() !== year ||
    d.getMonth() !== month ||
    d.getDate() !== day
  ) {
    throw new InvalidBooking('Invalid date');
  }
  const dayOfWeek = d.getDay(); // 0 = Sun, 6 = Sat
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    throw new InvalidBooking('Weekends are not bookable');
  }
  return true;
}

function validateSlot(slot) {
  if (typeof slot !== 'number' || !Number.isInteger(slot) || slot < 0 || slot > 5) {
    throw new InvalidBooking('Invalid slot');
  }
}

export async function getLab(labId) {
  const lab = await getLabById(labId);
  if (!lab) {
    throw new LabNotFound('Lab not found');
  }
  return lab;
}

export async function getWorkstationSlots(labId, date, userId) {
  validateDate(date);
  const lab = await getLabById(labId);
  if (!lab) {
    throw new LabNotFound('Lab not found');
  }

  const workstations = await getWorkstationsForLab(labId);
  const bookings = await getBookingsForLab(labId, date);

  // Map bookings by workstation_id and slot
  const bookingMap = new Map();
  for (const b of bookings) {
    bookingMap.set(`${b.workstation_id}-${b.slot}`, b);
  }

  return workstations.map((ws) => {
    const slots = [];
    for (let slot = 0; slot < 6; slot++) {
      const b = bookingMap.get(`${ws.id}-${slot}`);
      let status = 'free';
      let bookingId = null;
      let calendarUrl = undefined;
      if (b) {
        bookingId = b.id;
        if (b.user_id === userId) {
          status = 'mine';
          calendarUrl = calendarLink({
            labName: lab.name,
            workstationName: ws.name,
            date,
            slot
          });
        } else {
          status = 'other';
        }
      }
      const slotObj = { slot, status, bookingId };
      if (calendarUrl) {
        slotObj.calendarUrl = calendarUrl;
      }
      slots.push(slotObj);
    }
    return {
      id: ws.id,
      name: ws.name,
      slots
    };
  });
}

export async function createBooking(userId, workstationId, date, slot) {
  validateDate(date);
  validateSlot(slot);

  const ws = await getWorkstationById(workstationId);
  if (!ws) {
    throw new WorkstationNotFound('Workstation not found');
  }

  try {
    const result = await insertBooking(userId, workstationId, date, slot);
    return { id: result.id, userId, workstationId, date, slot };
  } catch (err) {
    if (err.code === '23505') {
      throw new BookingConflict('This slot is already booked');
    }
    throw err;
  }
}

export async function cancelBooking(userId, bookingId) {
  const booking = await getBooking(bookingId);
  if (!booking) {
    throw new BookingNotFound('Booking not found');
  }
  if (booking.user_id !== userId) {
    throw new NotOwner('Not authorized to cancel this booking');
  }
  await deleteBooking(bookingId);
}

function getLocalDateString(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export async function getUpcomingBookingsForUser(userId, today = getLocalDateString()) {
  return getUpcomingBookingsForUserDb(userId, today);
}
