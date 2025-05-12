const { google } = require("googleapis");
const credentials = require("./credentials.json");

const fs = require("fs");
const path = require("path");
const handlebars = require("handlebars");
const { SESClient, SendEmailCommand } = require("@aws-sdk/client-ses");

const ALLOWED_ORIGINS = ["http://localhost:4000", "https://littlelens.com.au"];
const REQUIRED_FIELDS = [
  "centre-name",
  "photo-day",
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
    await Promise.all([writeToGoogleSheet(data), sendEmail(data)]);

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

async function writeToGoogleSheet(data) {
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

    const values = [
      [
        data["centre-name"],
        data["photo-day"],
        data["child-firstname"],
        data["child-lastname"],
        data["parent-firstname"],
        data["parent-lastname"],
        data["parent-email"],
        data["parent-phone"],
        data["message"] || "",
        data["sibling-firstname"] || "",
        data["sibling-lastname"] || "",
        data["permission-to-share"] || "",
        data["family-photos"] || "no",
        new Date().toLocaleString("en-AU", { timeZone: "Australia/Melbourne" }),
      ],
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range,
      valueInputOption: "USER_ENTERED",
      resource: { values },
    });

    console.log("Data appended to Google Sheet");
  } catch (error) {
    console.error("Error writing to Google Sheets:", error);
    throw new Error("Failed to write to Google Sheets");
  }
}

async function sendEmail(data) {
  try {
    const ses = new SESClient({ region: "us-east-1" });

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
      siblingFirstName: data["sibling-firstname"],
      siblingLastName: data["sibling-lastname"],
      centreName: data["centre-name"],
      photoDay: data["photo-day"],
      message: data["message"],
      permissionToShare: data["permission-to-share"],
      familyPhotos: data["family-photos"],
    });

    const textBody = `Hi ${data["parent-firstname"]},

You've registered ${data["child-firstname"]} for photo day at ${data["centre-name"]} on ${data["photo-day"]}.

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
          Data: "Photo Day Registration Confirmation",
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
