import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { google } from "googleapis";

export async function POST(request) {
  try {
    const { recipients, spreadsheetId, uniqueIdColumn } = await request.json();
    const emailResults = [];

    // Initialize Google Sheets API
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
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    const sheets = google.sheets({ version: "v4", auth });

    // Create email transporter
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: true,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
    });

    // Get all rows to maintain row mapping
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "A:Z",
    });

    const rows = response.data.values;
    const headers = rows[0];
    const emailColumnIndex = headers.indexOf("Email");

    // Prepare unique IDs for batch update with correct row mapping
    const uniqueIds = new Array(rows.length).fill([""]); // Initialize with empty values for all rows
    const updates = [];

    // Send emails to all recipients and track status
    for (let i = 0; i < recipients.length; i++) {
      try {
        const recipient = recipients[i];
        const uniqueCode = `OSC25WW${String(i + 1).padStart(3, "0")}`;

        // Find the correct row index for this recipient
        const rowIndex = rows.findIndex(
          (row, index) => index > 0 && row[emailColumnIndex] === recipient.email
        );

        if (rowIndex !== -1) {
          uniqueIds[rowIndex] = [uniqueCode];
          updates.push({
            rowIndex,
            uniqueCode,
          });
        }

        await transporter.sendMail({
          from: process.env.SMTP_FROM_EMAIL,
          to: recipient.email,
          subject: "OSC Event Registration Confirmation",
          html: `
          <!DOCTYPE html>
          <html lang="en">
          <head>
              <meta charset="UTF-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>Winter Blender Workshop Registration</title>
              <style>
                  body {
                      font-family: Arial, sans-serif;
                      line-height: 1.6;
                      color: #333;
                      background-color: #f4f4f4;
                      margin: 0;
                      padding: 20px;
                  }
                  .container {
                      max-width: 600px;
                      margin: 0 auto;
                      background-color: #ffffff;
                      padding: 30px;
                      border-radius: 5px;
                      box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
                  }
                  h1 {
                      color: #2c3e50;
                      border-bottom: 2px solid #ff7f00;
                      padding-bottom: 10px;
                  }
                  .attendance-code {
                      background-color: #fff5e6;
                      border: 1px solid #ff7f00;
                      border-radius: 4px;
                      padding: 10px;
                      margin: 20px 0;
                      font-size: 18px;
                  }
                  .event-details {
                      background-color: #f8f9fa;
                      border-left: 4px solid #ff7f00;
                      padding: 15px;
                      margin: 20px 0;
                  }
                  .event-details h2 {
                      color: #2c3e50;
                      margin-top: 0;
                      font-size: 1.2em;
                  }
                  .event-details p {
                      margin: 5px 0;
                  }
                  .signature {
                      margin-top: 30px;
                      border-top: 1px solid #eee;
                      padding-top: 20px;
                  }
                  .accent {
                      color: #ff7f00;
                  }
                  .important-note {
                      font-weight: bold;
                      color: #e74c3c;
                  }
              </style>
          </head>
          <body>
              <div class="container">
                  <header>
                      <h1>Hello <span class="accent">${recipient.name}</span>!</h1>
                  </header>
                  <main>
                      <p>Thank you for registering for the winter blender workshop. This email confirms that we've received your registration.</p>
                      
                      <div class="event-details">
                          <h2>Event Details</h2>
                          <p><strong>Date:</strong> Saturday, 26th of January, 2025</p>
                          <p><strong>Time:</strong> 10:00 AM - 2:00 PM</p>
                          <p><strong>Venue:</strong> Faculty of Computer and Information Sciences (FCIS)</p>
                          <p><strong>Location:</strong> Saied Auditorium</p>
                      </div>

                      <div class="attendance-code">
                          Your unique attendance code is: <strong class="accent">${uniqueCode}</strong>
                      </div>

                      <p class="important-note">Please note:</p>
                      <ul>
                          <li>Arrive 15 minutes before the start time</li>
                          <li>Bring your laptop with Blender installed</li>
                          <li>Keep your attendance code ready for check-in</li>
                      </ul>

                      <p>If you have any questions or need to make changes to your registration, please contact us at <span class="accent">oscopensourcecommunity@gmail.com</span></p>
                  </main>
                  <footer class="signature">
                      <p>Best regards,</p>
                      <p class="accent">The OSC HR Team</p>
                  </footer>
              </div>
          </body>
          </html>
          `,
        });

        emailResults.push({
          email: recipient.email,
          name: recipient.name,
          status: "success",
          uniqueCode,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        emailResults.push({
          email: recipient.email,
          name: recipient.name,
          status: "failed",
          error: error.message,
          timestamp: new Date().toISOString(),
        });
      }
    }

    // Write unique IDs back to spreadsheet
    try {
      const columnLetter = String.fromCharCode(64 + uniqueIdColumn);
      // Filter out empty rows and create the update range
      const nonEmptyIds = uniqueIds.filter((id) => id[0] !== "");
      const firstRow = rows.findIndex(
        (row, index) =>
          index > 0 && recipients.some((r) => r.email === row[emailColumnIndex])
      );

      if (firstRow !== -1) {
        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: `${columnLetter}${firstRow + 1}:${columnLetter}${
            firstRow + nonEmptyIds.length
          }`,
          valueInputOption: "RAW",
          resource: {
            values: nonEmptyIds,
          },
        });
      }
    } catch (error) {
      console.error("Error updating spreadsheet:", error);
    }

    // Generate results summary
    const summary = {
      total: emailResults.length,
      successful: emailResults.filter((r) => r.status === "success").length,
      failed: emailResults.filter((r) => r.status === "failed").length,
      results: emailResults,
    };

    return NextResponse.json(summary);
  } catch (error) {
    console.error("Error sending emails:", error);
    return NextResponse.json(
      { error: "Failed to send emails", details: error.message },
      { status: 500 }
    );
  }
}
