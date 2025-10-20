const { google } = require("googleapis");
const credentials = require("./credentials.json");
const crypto = require("crypto");

const fs = require("fs");
const path = require("path");
const handlebars = require("handlebars");
const { SESClient, SendEmailCommand } = require("@aws-sdk/client-ses");

const ALLOWED_ORIGINS = ["http://localhost:4000", "https://littlelens.com.au"];
const REQUIRED_FIELDS = [
  "centre-name",
  "photo-day",
  "room",
  "child-firstname",
  "child-lastname",
  "parent-firstname",
  "parent-lastname",
  "parent-email",
  "parent-phone",
];

exports.handler = async (event) => {
  const origin = event.headers?.origin || "";

  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: getCorsHeaders(origin),
      body: "",
    };
  }

  try {
    if (!event.body) {
      console.warn("No body in request");
      return {
        statusCode: 400,
        headers: getCorsHeaders(origin),
        body: JSON.stringify({ message: "Missing request body" }),
      };
    }

    const data = JSON.parse(event.body);

    // Generate or use provided idempotency key
    const idempotencyKey =
      event.headers["x-idempotency-key"] || crypto.randomUUID();
    console.log("Processing request with idempotency key:", idempotencyKey);

    // Check if this idempotency key has already been processed
    const isDuplicate = await checkDuplicateSubmission(idempotencyKey);
    if (isDuplicate) {
      console.log("Duplicate submission detected for key:", idempotencyKey);
      return {
        statusCode: 200,
        headers: getCorsHeaders(origin),
        body: JSON.stringify({
          message: "Form already submitted successfully!",
        }),
      };
    }

    const missingFields = REQUIRED_FIELDS.filter((field) => !data[field]);
    if (missingFields.length > 0) {
      console.warn("Missing required fields:", missingFields);
      return {
        statusCode: 400,
        headers: getCorsHeaders(origin),
        body: JSON.stringify({
          message: `Missing required fields: ${missingFields.join(", ")}`,
        }),
      };
    }

    // Write to Google Sheets and send email
    console.log("Writing to Google Sheets and sending email...");
    await Promise.all([
      writeToGoogleSheet(data, idempotencyKey),
      sendEmail(data),
    ]);

    console.log("Form submission and Google Sheet successful");
    return {
      statusCode: 200,
      headers: getCorsHeaders(origin),
      body: JSON.stringify({ message: "Form submitted successfully!" }),
    };
  } catch (error) {
    console.error("Unexpected error in Lambda:", error);
    return {
      statusCode: 500,
      headers: getCorsHeaders(origin),
      body: JSON.stringify({ message: "Error processing form." }),
    };
  }
};

function getCorsHeaders(origin) {
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : "";
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

async function checkDuplicateSubmission(idempotencyKey) {
  try {
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: "https://www.googleapis.com/auth/spreadsheets",
    });

    const sheets = google.sheets({
      version: "v4",
      auth: await auth.getClient(),
    });

    const spreadsheetId = "1ehUmTJyxkOS9F2fLIkgrdpuMbM0VIsNxvfmCB_kX-B4";
    const range = "Registrations!Q:Q"; // Check column Q for idempotency keys

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    });

    const values = response.data.values || [];

    // Check if any row in column Q matches our idempotency key
    return values.some((row) => row[0] === idempotencyKey);
  } catch (error) {
    console.error("Error checking for duplicate submission:", error);
    // If we can't check, assume it's not a duplicate to avoid blocking legitimate submissions
    return false;
  }
}

async function writeToGoogleSheet(data, idempotencyKey) {
  try {
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: "https://www.googleapis.com/auth/spreadsheets",
    });

    const sheets = google.sheets({
      version: "v4",
      auth: await auth.getClient(),
    });
    const spreadsheetId = "1ehUmTJyxkOS9F2fLIkgrdpuMbM0VIsNxvfmCB_kX-B4";
    const range = "Registrations";

    // Prepare base data that will be reused
    const baseData = [
      data["centre-name"],
      data["photo-day"],
      data["parent-firstname"],
      data["parent-lastname"],
      data["parent-email"],
      data["parent-phone"],
      data["message"] || "",
      data["permission-to-share"] || "",
      data["family-photos"] || "no",
      new Date().toLocaleString("en-AU", { timeZone: "Australia/Melbourne" }),
      idempotencyKey, // Column Q: idempotency key
    ];

    const values = [];

    // 1. Main child row
    const mainChildRow = [
      ...baseData.slice(0, 2), // centre-name, photo-day
      data["child-firstname"], // child-firstname
      data["child-lastname"], // child-lastname
      data["room"], // room
      ...baseData.slice(2, 4), // parent-firstname, parent-lastname
      ...baseData.slice(4, 6), // parent-email, parent-phone
      ...baseData.slice(6, 7), // message
      data["siblings"] && data["siblings"].length > 0
        ? data["siblings"][0].firstname
        : "", // sibling-firstname (first sibling if exists)
      data["siblings"] && data["siblings"].length > 0
        ? data["siblings"][0].lastname
        : "", // sibling-lastname (first sibling if exists)
      ...baseData.slice(7), // permission-to-share, family-photos, timestamp, idempotency-key
    ];
    values.push(mainChildRow);

    // 2. Individual sibling rows (if any)
    if (data["siblings"] && data["siblings"].length > 0) {
      data["siblings"].forEach((sibling) => {
        const siblingRow = [
          ...baseData.slice(0, 2), // centre-name, photo-day
          sibling.firstname, // child-firstname (sibling's name)
          sibling.lastname, // child-lastname (sibling's name)
          sibling.room, // room (sibling's room)
          ...baseData.slice(2, 4), // parent-firstname, parent-lastname
          ...baseData.slice(4, 6), // parent-email, parent-phone
          ...baseData.slice(6, 7), // message
          data["child-firstname"], // sibling-firstname (main child's name)
          data["child-lastname"], // sibling-lastname (main child's name)
          ...baseData.slice(7), // permission-to-share, family-photos, timestamp, idempotency-key
        ];
        values.push(siblingRow);
      });

      // 3. Family row (if there are siblings)
      const familyRow = [
        ...baseData.slice(0, 2), // centre-name, photo-day
        "Family", // child-firstname
        data["child-lastname"], // child-lastname (main child's lastname)
        data["room"], // room (main child's room)
        ...baseData.slice(2, 4), // parent-firstname, parent-lastname
        ...baseData.slice(4, 6), // parent-email, parent-phone
        ...baseData.slice(6, 7), // message
        data["child-firstname"], // sibling-firstname (main child's name)
        data["child-lastname"], // sibling-lastname (main child's name)
        ...baseData.slice(7), // permission-to-share, family-photos, timestamp, idempotency-key
      ];
      values.push(familyRow);
    }

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range,
      valueInputOption: "USER_ENTERED",
      resource: { values },
    });

    console.log(`Data appended to Google Sheet: ${values.length} rows created`);
  } catch (error) {
    console.error("Error writing to Google Sheets:", error);
    throw new Error("Failed to write to Google Sheets");
  }
}

async function sendEmail(data) {
  try {
    const ses = new SESClient({ region: "ap-southeast-2" });

    // Build children list for email
    let childrenList = data["child-firstname"];
    if (data["siblings"] && data["siblings"].length > 0) {
      const siblingNames = data["siblings"]
        .map((sibling) => sibling.firstname)
        .join(", ");
      childrenList += ` and ${siblingNames}`;
    }

    // Load and compile template
    const templatePath = path.join(__dirname, "confirmation-email.hbs");
    const source = fs.readFileSync(templatePath, "utf8");
    const template = handlebars.compile(source);

    // Prepare data
    const htmlBody = template({
      parentFirstName: data["parent-firstname"],
      parentLastName: data["parent-lastname"],
      parentEmail: data["parent-email"],
      parentPhone: data["parent-phone"],
      childFirstName: data["child-firstname"],
      childLastName: data["child-lastname"],
      room: data["room"],
      siblingFirstName: data["sibling-firstname"],
      siblingLastName: data["sibling-lastname"],
      centreName: data["centre-name"],
      photoDay: data["photo-day"],
      message: data["message"],
      permissionToShare: data["permission-to-share"],
      familyPhotos: data["family-photos"],
      siblings: data["siblings"] || [],
      childrenList: childrenList, // Use the same childrenList we built for textBody
    });

    const textBody = `Hi ${data["parent-firstname"]},

You've registered ${childrenList} for photo day at ${data["centre-name"]} on ${data["photo-day"]}.

Thank you!
The Little Lens Team`;

    const params = {
      Source: `"Little Lens" <hello@littlelens.com.au>`,
      Destination: {
        ToAddresses: [data["parent-email"]],
        BccAddresses: ["gill@littlelens.com.au"],
      },
      Message: {
        Subject: {
          Data: "Registration Confirmed – We’re Excited for Photo Day!",
          Charset: "UTF-8",
        },
        Body: {
          Text: {
            Data: textBody,
            Charset: "UTF-8",
          },
          Html: {
            Data: htmlBody,
            Charset: "UTF-8",
          },
        },
      },
    };

    const command = new SendEmailCommand(params);
    await ses.send(command);

    console.log("Confirmation email sent to", data["parent-email"]);
  } catch (error) {
    console.error("Error sending email:", error);
    throw new Error("Failed to send confirmation email");
  }
}

// Register equality helper once (ideally at the top of your file)
handlebars.registerHelper("eq", function (a, b) {
  return a === b;
});

// Register add helper for child numbering
handlebars.registerHelper("add", function (a, b) {
  return a + b;
});
