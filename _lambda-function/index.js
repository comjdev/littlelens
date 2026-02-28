const { google } = require("googleapis");
const credentials = require("./credentials.json");
const crypto = require("crypto");

const fs = require("fs");
const path = require("path");
const handlebars = require("handlebars");
const { SESClient, SendEmailCommand } = require("@aws-sdk/client-ses");
const Stripe = require("stripe");

const ALLOWED_ORIGINS = ["http://localhost:4000", "https://littlelens.com.au"];
const BASE_URL = "https://littlelens.com.au";
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
  console.log("Received request:", {
    httpMethod: event.httpMethod,
    headers: event.headers,
    origin: event.headers?.origin || event.headers?.Origin || "",
  });

  const origin = event.headers?.origin || event.headers?.Origin || "";

  if (event.httpMethod === "OPTIONS") {
    console.log("Handling OPTIONS preflight request");
    return {
      statusCode: 200,
      headers: getCorsHeaders(origin),
      body: JSON.stringify({ message: "CORS preflight" }),
    };
  }

  return {
    statusCode: 410,
    headers: getCorsHeaders(origin),
    body: JSON.stringify({
      message: "Registration now requires payment. Please use checkout flow.",
    }),
  };
};

/**
 * Lambda handler for creating Stripe Checkout sessions
 * Configure Lambda to use: index.createCheckoutSession
 */
exports.createCheckoutSession = async (event) => {
  const origin = event.headers?.origin || event.headers?.Origin || "";
  const httpMethod = event.requestContext?.http?.method || event.httpMethod;

  if (httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: getCorsHeaders(origin),
      body: JSON.stringify({ message: "CORS preflight" }),
    };
  }

  if (httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: getCorsHeaders(origin),
      body: JSON.stringify({ message: "Method not allowed" }),
    };
  }

  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

  if (!stripeSecretKey) {
    console.error("Missing STRIPE_SECRET_KEY env var");
    return {
      statusCode: 500,
      headers: getCorsHeaders(origin),
      body: JSON.stringify({ message: "Server configuration error" }),
    };
  }
  console.log("Stripe key prefix:", stripeSecretKey.substring(0, 7));

  let data;
  try {
    if (!event.body) {
      return {
        statusCode: 400,
        headers: getCorsHeaders(origin),
        body: JSON.stringify({ message: "Missing request body" }),
      };
    }
    data = JSON.parse(event.body);
  } catch (parseError) {
    return {
      statusCode: 400,
      headers: getCorsHeaders(origin),
      body: JSON.stringify({ message: "Invalid JSON body" }),
    };
  }

  const requiredFields = ["childName", "parentName", "parentEmail", "centreName"];
  const missingFields = requiredFields.filter(
    (field) => !data[field] || (typeof data[field] === "string" && !data[field].trim())
  );

  if (missingFields.length > 0) {
    return {
      statusCode: 400,
      headers: getCorsHeaders(origin),
      body: JSON.stringify({
        message: `Missing required fields: ${missingFields.join(", ")}`,
      }),
    };
  }

  const siblings = Array.isArray(data.siblings) ? data.siblings : [];
  const childrenCount = 1 + siblings.length;

  const metadata = {
    childName: String(data.childName).trim(),
    parentName: String(data.parentName).trim(),
    parentEmail: String(data.parentEmail).trim(),
    centreName: String(data.centreName).trim(),
    siblings: JSON.stringify(siblings),
    childrenCount: String(childrenCount),
  };
  if (data.photoDay) metadata.photoDay = String(data.photoDay).trim();
  if (data.room) metadata.room = String(data.room).trim();
  if (data.parentPhone) metadata.parentPhone = String(data.parentPhone).trim();
  if (data.childFirstname) metadata.childFirstname = String(data.childFirstname).trim();
  if (data.childLastname) metadata.childLastname = String(data.childLastname).trim();
  if (data.parentFirstname) metadata.parentFirstname = String(data.parentFirstname).trim();
  if (data.parentLastname) metadata.parentLastname = String(data.parentLastname).trim();

  try {
    const stripe = new Stripe(stripeSecretKey);

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "aud",
            product_data: {
              name: "Childcare Photography Registration Deposit",
            },
            unit_amount: 2500,
          },
          quantity: childrenCount,
        },
      ],
      success_url: `${BASE_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${BASE_URL}/cancel`,
      metadata,
    });

    return {
      statusCode: 200,
      headers: getCorsHeaders(origin),
      body: JSON.stringify({ url: session.url }),
    };
  } catch (stripeError) {
    console.error("Stripe error:", stripeError);

    const statusCode = stripeError.statusCode || 500;
    const message =
      stripeError.message || "Failed to create checkout session";

    return {
      statusCode,
      headers: getCorsHeaders(origin),
      body: JSON.stringify({ message }),
    };
  }
};

/**
 * Stripe webhook Lambda handler
 * Only registers child AFTER payment is confirmed via checkout.session.completed
 * Configure Lambda to use: index.stripeWebhook
 *
 * API Gateway: Enable raw body passthrough, disable automatic JSON parsing
 */
exports.stripeWebhook = async (event) => {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripeSecretKey || !webhookSecret) {
    console.error("Missing STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET");
    return { statusCode: 500, body: "Server configuration error" };
  }
  console.log("Stripe key prefix:", stripeSecretKey.substring(0, 7));

  let rawBody = event.body;
  if (!rawBody) {
    return { statusCode: 400, body: "Missing body" };
  }

  if (event.isBase64Encoded) {
    rawBody = Buffer.from(rawBody, "base64").toString("utf8");
  }

  const signature =
    event.headers?.["stripe-signature"] ||
    event.headers?.["Stripe-Signature"];
  if (!signature) {
    return { statusCode: 400, body: "Missing Stripe-Signature header" };
  }

  let stripeEvent;
  try {
    stripeEvent = Stripe.webhooks.constructEvent(
      rawBody,
      signature,
      webhookSecret
    );
  } catch (err) {
    console.error("Stripe signature verification failed:", err.message);
    return { statusCode: 400, body: "Invalid signature" };
  }

  if (stripeEvent.type !== "checkout.session.completed") {
    return { statusCode: 200, body: "OK" };
  }

  const session = stripeEvent.data.object;
  const metadata = session.metadata || {};

  let siblings = [];
  try {
    const parsed = metadata.siblings ? JSON.parse(metadata.siblings) : [];
    siblings = Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    siblings = [];
  }

  const childName = metadata.childName || "";
  const parentName = metadata.parentName || "";
  const parentEmail = metadata.parentEmail || "";
  const centreName = metadata.centreName || "";
  const paymentIntent = session.payment_intent || "";

  if (!childName || !parentEmail || !centreName) {
    console.error("Missing required metadata in checkout session");
    return { statusCode: 200, body: "OK" };
  }

  const childFirst =
    metadata.childFirstname ||
    childName.trim().split(/\s+/)[0] ||
    "";
  const childLastName =
    metadata.childLastname ||
    childName.trim().split(/\s+/).slice(1).join(" ") ||
    "";
  const parentFirst =
    metadata.parentFirstname ||
    parentName.trim().split(/\s+/)[0] ||
    "";
  const parentLastName =
    metadata.parentLastname ||
    parentName.trim().split(/\s+/).slice(1).join(" ") ||
    "";

  const idempotencyKey = session.id || paymentIntent || crypto.randomUUID();

  const isDuplicate = await checkDuplicateSubmission(idempotencyKey);
  if (isDuplicate) {
    console.log("Duplicate webhook for session:", idempotencyKey);
    return { statusCode: 200, body: "OK" };
  }

  const data = {
    "centre-name": centreName,
    "photo-day": metadata.photoDay || "",
    "room": metadata.room || "",
    "child-firstname": childFirst,
    "child-lastname": childLastName,
    "parent-firstname": parentFirst,
    "parent-lastname": parentLastName,
    "parent-email": parentEmail,
    "parent-phone": metadata.parentPhone || "",
    "message": "",
    "siblings": siblings,
  };

  try {
    await Promise.all([
      writeToGoogleSheet(data, idempotencyKey),
      sendEmail(data),
    ]);
    console.log("Registration completed after payment:", parentEmail);
    return { statusCode: 200, body: "OK" };
  } catch (error) {
    console.error("Failed to register after payment:", error);
    throw error;
  }
};

function getCorsHeaders(origin) {
  console.log("Getting CORS headers for origin:", origin);
  console.log("Allowed origins:", ALLOWED_ORIGINS);

  const allowedOrigin = ALLOWED_ORIGINS.includes(origin)
    ? origin
    : ALLOWED_ORIGINS[1]; // Default to production URL
  const headers = {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers":
      "Content-Type, x-idempotency-key, X-Requested-With",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400", // 24 hours
  };

  console.log("Returning CORS headers:", headers);
  return headers;
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
    const range = "Registrations!P:P"; // Check column P for idempotency keys

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

function getInitials(value) {
  if (!value || typeof value !== "string") {
    return "";
  }

  return value
    .split(/[^A-Za-z]+/)
    .filter(Boolean)
    .map((part) => part[0].toUpperCase())
    .join("");
}

function generateRandomString(length) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz123456789";
  const bytes = crypto.randomBytes(length);
  let result = "";

  for (let i = 0; i < length; i++) {
    const index = bytes[i] % alphabet.length;
    result += alphabet[index];
  }

  return result;
}

function generatePassword(centreName, childFirstName, childLastName) {
  const centreInitials = getInitials(centreName);
  const childInitials =
    getInitials(childFirstName) + getInitials(childLastName);
  const randomPart = generateRandomString(6);

  return `${centreInitials}${childInitials}${randomPart}`;
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

    const timestamp = new Date().toLocaleString("en-AU", {
      timeZone: "Australia/Melbourne",
    });

    const values = [];

    // 1. Main child row
    const primarySibling =
      Array.isArray(data["siblings"]) && data["siblings"].length > 0
        ? data["siblings"][0]
        : null;

    const mainChildRow = [
      data["centre-name"], // centre-name
      data["photo-day"], // photo-day
      data["child-firstname"], // child-firstname
      data["child-lastname"], // child-lastname
      data["room"], // room
      data["parent-firstname"], // parent-firstname
      data["parent-lastname"], // parent-lastname
      data["parent-email"], // parent-email
      data["parent-phone"], // parent-phone
      data["message"] || "", // message
      primarySibling ? primarySibling.firstname : "", // sibling-firstname
      primarySibling ? primarySibling.lastname : "", // sibling-lastname
      data["permission-to-share"] || "", // permission-to-share
      data["family-photos"] || "no", // family-photos
      timestamp, // timestamp
      idempotencyKey, // Column P: idempotency key
      generatePassword(
        data["centre-name"],
        data["child-firstname"],
        data["child-lastname"]
      ), // Column Q: password
    ];
    values.push(mainChildRow);

    // 2. Individual sibling rows (if any)
    if (data["siblings"] && data["siblings"].length > 0) {
      data["siblings"].forEach((sibling) => {
        const siblingRow = [
          data["centre-name"], // centre-name
          data["photo-day"], // photo-day
          sibling.firstname, // child-firstname (sibling's name)
          sibling.lastname, // child-lastname (sibling's name)
          sibling.room || "", // room (sibling's room)
          data["parent-firstname"], // parent-firstname
          data["parent-lastname"], // parent-lastname
          data["parent-email"], // parent-email
          data["parent-phone"], // parent-phone
          data["message"] || "", // message
          data["child-firstname"], // sibling-firstname (main child's name)
          data["child-lastname"], // sibling-lastname (main child's name)
          data["permission-to-share"] || "", // permission-to-share
          data["family-photos"] || "no", // family-photos
          timestamp, // timestamp
          idempotencyKey, // Column P: idempotency key
          generatePassword(
            data["centre-name"],
            sibling.firstname,
            sibling.lastname
          ), // Column Q: password
        ];
        values.push(siblingRow);
      });

      // 3. Family row (if there are siblings)
      const familyRow = [
        data["centre-name"], // centre-name
        data["photo-day"], // photo-day
        "Family", // child-firstname
        data["child-lastname"], // child-lastname (main child's lastname)
        data["room"], // room (main child's room)
        data["parent-firstname"], // parent-firstname
        data["parent-lastname"], // parent-lastname
        data["parent-email"], // parent-email
        data["parent-phone"], // parent-phone
        data["message"] || "", // message
        data["child-firstname"], // sibling-firstname (main child's name)
        data["child-lastname"], // sibling-lastname (main child's name)
        data["permission-to-share"] || "", // permission-to-share
        data["family-photos"] || "no", // family-photos
        timestamp, // timestamp
        idempotencyKey, // Column P: idempotency key
        generatePassword(data["centre-name"], "Family", data["child-lastname"]), // Column Q: password
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
