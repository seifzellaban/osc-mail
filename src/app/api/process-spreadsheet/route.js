import { NextResponse } from "next/server";
import { google } from "googleapis";

export async function POST(request) {
  try {
    const { spreadsheetUrl } = await request.json();

    if (!spreadsheetUrl || typeof spreadsheetUrl !== "string") {
      return NextResponse.json(
        { error: "Invalid spreadsheet ID" },
        { status: 400 }
      );
    }

    const spreadsheetId = spreadsheetUrl.trim();

    // Initialize Google Sheets API with write permissions
    const auth = new google.auth.GoogleAuth({
      credentials: {
        type: "service_account",
        project_id: process.env.GOOGLE_PROJECT_ID,
        private_key_id: process.env.GOOGLE_PRIVATE_KEY_ID,
        private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        client_id: process.env.GOOGLE_CLIENT_ID,
        auth_uri: "https://accounts.google.com/o/oauth2/auth",
        token_uri: "https://oauth2.googleapis.com/token",
        auth_provider_x509_cert_url:
          "https://www.googleapis.com/oauth2/v1/certs",
        client_x509_cert_url: process.env.GOOGLE_CLIENT_X509_CERT_URL,
        universe_domain: "googleapis.com",
      },
      scopes: ["https://www.googleapis.com/auth/spreadsheets"], // Updated scope for write access
    });

    const sheets = google.sheets({ version: "v4", auth });

    try {
      // First, get the spreadsheet data
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: "A:Z",
      });

      if (!response.data.values || response.data.values.length === 0) {
        return NextResponse.json(
          { error: "No data found in spreadsheet" },
          { status: 400 }
        );
      }

      const rows = response.data.values;
      const headers = rows[0];

      // Check if Unique ID column exists, if not, add it
      const uniqueIdColumnIndex = headers.indexOf("Unique ID");
      if (uniqueIdColumnIndex === -1) {
        // Add new column
        headers.push("Unique ID");
        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: `A1:${String.fromCharCode(65 + headers.length - 1)}1`,
          valueInputOption: "RAW",
          resource: {
            values: [headers],
          },
        });
      }

      // Validate required columns exist
      const requiredColumns = ["Name", "Email", "Are you a student at FCIS?"];
      const missingColumns = requiredColumns.filter(
        (col) => !headers.includes(col)
      );

      if (missingColumns.length > 0) {
        return NextResponse.json(
          { error: `Missing required columns: ${missingColumns.join(", ")}` },
          { status: 400 }
        );
      }

      // Convert to object array with headers as keys
      const data = rows.slice(1).map((row) => {
        const obj = {};
        headers.forEach((header, index) => {
          obj[header] = row[index] || "";
        });
        return obj;
      });

      return NextResponse.json({
        rows: data,
        uniqueIdColumn: headers.indexOf("Unique ID") + 1, // Adding 1 for 1-based column index
      });
    } catch (error) {
      console.error("Sheets API Error:", error);

      if (error.code === 404) {
        return NextResponse.json(
          { error: "Spreadsheet not found or not accessible" },
          { status: 404 }
        );
      }

      if (error.code === 403) {
        return NextResponse.json(
          {
            error:
              "Access denied. Please share the spreadsheet with the service account email: " +
              process.env.GOOGLE_CLIENT_EMAIL,
          },
          { status: 403 }
        );
      }

      throw error;
    }
  } catch (error) {
    console.error("Error processing spreadsheet:", error);
    return NextResponse.json(
      { error: error.message || "Failed to process spreadsheet" },
      { status: 500 }
    );
  }
}
