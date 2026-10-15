const readline = require("readline");
const fs = require("fs");
const path = require("path");

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

const TOOLS = [
  {
    name: "find_lecture",
    description:
      "Return the title and topics of one course lecture by its number, 1 to 10. Use it when asked what a lecture covers. Returns one line of text.",    inputSchema: {
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
    } else {
      send({
        jsonrpc: "2.0",
        id: msg.id,
        error: { code: -32602, message: `Unknown tool: ${name}` },
      });
    }
  } else if (msg.id !== undefined) {
    send({
      jsonrpc: "2.0",
      id: msg.id,
      error: { code: -32601, message: `Unknown method: ${msg.method}` },
    });
  }
});