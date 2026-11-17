const readline = require("readline");
const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");

if (!process.env.DB_PATH) {
  process.env.DB_PATH = path.join(__dirname, "..", "data", "app.db");
}

const LECTURES_FILE = path.join(__dirname, "lectures.json");
const TIMETABLE_FILE = path.join(__dirname, "timetable.json");

const rl = readline.createInterface({ input: process.stdin });

function send(message) {
  process.stdout.write(JSON.stringify(message) + "\n");
}

function toolResult(id, text, isError) {
  send({
    jsonrpc: "2.0",
    id: id,
    result: {
      content: [{ type: "text", text: text }],
      isError: isError,
    },
  });
}

let initDb, resolveToken, getWorkstationSlots, getUpcomingBookingsForUser, createBooking, getLabUsage;
let BookingConflict;
let dbInitialized = false;

async function ensureServices() {
  if (!initDb) {
    const dbMod = await import(pathToFileURL(path.join(__dirname, "../src/db/database.js")).href);
    initDb = dbMod.initDb;

    const tokenMod = await import(pathToFileURL(path.join(__dirname, "../src/services/tokenService.js")).href);
    resolveToken = tokenMod.resolveToken;

    const bookingMod = await import(pathToFileURL(path.join(__dirname, "../src/services/bookingService.js")).href);
    getWorkstationSlots = bookingMod.getWorkstationSlots;
    getUpcomingBookingsForUser = bookingMod.getUpcomingBookingsForUser;
    createBooking = bookingMod.createBooking;

    const labMod = await import(pathToFileURL(path.join(__dirname, "../src/services/labService.js")).href);
    getLabUsage = labMod.getLabUsage;

    const errMod = await import(pathToFileURL(path.join(__dirname, "../src/services/errors.js")).href);
    BookingConflict = errMod.BookingConflict;
  }
  if (!dbInitialized) {
    await initDb();
    dbInitialized = true;
  }
}

const slotTimes = [
  "08:00 - 10:00",
  "10:00 - 12:00",
  "12:00 - 14:00",
  "14:00 - 16:00",
  "16:00 - 18:00",
  "18:00 - 20:00"
];

const TOOLS = [
  {
    name: "find_lecture",
    description:
      "Return the title and topics of one course lecture by its number, 1 to 10. Use it when asked what a lecture covers. Returns one line of text.",
    inputSchema: {
      type: "object",
      properties: {
        number: { type: "integer", description: "Lecture number, 1 to 10" },
      },
      required: ["number"],
    },
  },
  {
    name: "get_timetable",
    description:
      "Return the class timetable for one weekday. Use it when asked what classes there are on a given day. Returns one line per class with the time, subject and room, or a short message if there are no classes that day.",
    inputSchema: {
      type: "object",
      properties: {
        day: {
          type: "string",
          enum: ["mon", "tue", "wed", "thu", "fri"],
          description: "Weekday as a three-letter code",
        },
      },
      required: ["day"],
    },
  },
  {
    name: "free_workstations",
    description: "Lists the workstations in one lab that are free in each 2-hour slot on a given weekday",
    inputSchema: {
      type: "object",
      properties: {
        lab_id: { type: "integer", description: "Lab ID" },
        date: { type: "string", description: "Date in YYYY-MM-DD format" }
      },
      required: ["lab_id", "date"]
    }
  },
  {
    name: "my_bookings",
    description: "Lists the upcoming bookings of the signed-in student, with lab, workstation and time",
    inputSchema: {
      type: "object",
      properties: {}
    }
  },
  {
    name: "book_slot",
    description: "Books a free 2-hour slot on a workstation for the signed-in student, and refuses a slot that is already booked",
    inputSchema: {
      type: "object",
      properties: {
        workstation_id: { type: "integer", description: "Workstation ID" },
        date: { type: "string", description: "Date in YYYY-MM-DD format" },
        slot: { type: "integer", description: "Slot index 0 to 5" }
      },
      required: ["workstation_id", "date", "slot"]
    }
  },
  {
    name: "lab_usage",
    description: "Returns the number of bookings in each lab for a given week, the same numbers as the usage table",
    inputSchema: {
      type: "object",
      properties: {
        week: { type: "string", description: "Week date in YYYY-MM-DD format" }
      },
      required: ["week"]
    }
  }
];

rl.on("line", (line) => {
  console.error("got: " + line);

  let msg;
  try {
    msg = JSON.parse(line);
  } catch (err) {
    send({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } });
    return;
  }

  if (msg.method === "initialize") {
    send({
      jsonrpc: "2.0",
      id: msg.id,
      result: {
        protocolVersion: msg.params.protocolVersion,
        capabilities: { tools: {} },
        serverInfo: { name: "lectures", version: "0.1.0" },
      },
    });
  } else if (msg.method === "notifications/initialized") {
    // Notification: no id, so no reply.
  } else if (msg.method === "tools/list") {
    send({ jsonrpc: "2.0", id: msg.id, result: { tools: TOOLS } });
  } else if (msg.method === "tools/call") {
    (async () => {
      const params = msg.params || {};
      const name = params.name;
      const args = params.arguments || {};

      if (name === "find_lecture") {
        const lectures = JSON.parse(fs.readFileSync(LECTURES_FILE, "utf8"));
        const lecture = lectures.find((l) => l.number === args.number);
        if (lecture === undefined) {
          toolResult(
            msg.id,
            `There is no lecture ${args.number}. The course has lectures 1 to 10.`,
            true
          );
        } else {
          toolResult(
            msg.id,
            `Lecture ${lecture.number}: ${lecture.title}. Topics: ${lecture.topics}`,
            false
          );
        }
      } else if (name === "get_timetable") {
        const timetable = JSON.parse(fs.readFileSync(TIMETABLE_FILE, "utf8"));
        const classes = timetable[args.day];
        if (!Array.isArray(classes)) {
          toolResult(
            msg.id,
            `There is no day "${args.day}". Use mon, tue, wed, thu or fri.`,
            true
          );
        } else if (classes.length === 0) {
          toolResult(msg.id, `No classes on ${args.day}.`, false);
        } else {
          toolResult(msg.id, classes.join("\n"), false);
        }
      } else if (name === "free_workstations" || name === "my_bookings" || name === "book_slot" || name === "lab_usage") {
        try {
          await ensureServices();
          const user = await resolveToken(process.env.MCP_TOKEN);
          if (!user) {
            toolResult(msg.id, "Missing or unknown MCP token", true);
            return;
          }

          if (name === "free_workstations") {
            const workstationSlots = getWorkstationSlots(args.lab_id, args.date, user.id);
            const resultSlots = [];
            for (let slot = 0; slot < 6; slot++) {
              const free = workstationSlots
                .filter((w) => w.slots[slot].status === "free")
                .map((w) => w.name);
              resultSlots.push({
                slot,
                time: slotTimes[slot],
                free
              });
            }
            toolResult(msg.id, JSON.stringify(resultSlots), false);
          } else if (name === "my_bookings") {
            const bookings = getUpcomingBookingsForUser(user.id);
            toolResult(msg.id, JSON.stringify(bookings), false);
          } else if (name === "book_slot") {
            const booking = createBooking(user.id, args.workstation_id, args.date, args.slot);
            toolResult(msg.id, JSON.stringify(booking), false);
          } else if (name === "lab_usage") {
            const usage = getLabUsage(user, args.week);
            toolResult(msg.id, JSON.stringify(usage), false);
          }
        } catch (err) {
          if (BookingConflict && err instanceof BookingConflict) {
            toolResult(msg.id, "This slot is already booked", true);
          } else {
            toolResult(msg.id, err.message, true);
          }
        }
      } else {
        send({
          jsonrpc: "2.0",
          id: msg.id,
          error: { code: -32602, message: `Unknown tool: ${name}` },
        });
      }
    })();
  } else if (msg.id !== undefined) {
    send({
      jsonrpc: "2.0",
      id: msg.id,
      error: { code: -32601, message: `Unknown method: ${msg.method}` },
    });
  }
});
