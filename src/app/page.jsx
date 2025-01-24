"use client";

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

export default function OSCAutoMailingService() {
  const [link, setLink] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [passcode, setPasscode] = useState("");
  const [recipientCount, setRecipientCount] = useState(0);
  const [emailQueue, setEmailQueue] = useState([]);
  const [uniqueIdColumnIndex, setUniqueIdColumnIndex] = useState(null);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return null;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    // Validate spreadsheet ID format
    const spreadsheetIdRegex = /^[a-zA-Z0-9-_]+$/;
    if (!spreadsheetIdRegex.test(link)) {
      setError("Please provide a valid spreadsheet ID");
      setIsLoading(false);
      return;
    }

    try {
      console.log("Fetching spreadsheet data...");
      const response = await fetch("/api/process-spreadsheet", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ spreadsheetUrl: link.trim() }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error("API Error:", errorData);
        throw new Error(errorData.error || "Failed to fetch spreadsheet data");
      }

      const data = await response.json();
      console.log("Spreadsheet data received:", data);

      if (!data.rows || !Array.isArray(data.rows)) {
        throw new Error("Invalid spreadsheet data format");
      }

      // Filter FCIS students and create email queue
      const fcisStudents = data.rows
        .filter(
          (row) =>
            row["Are you a student at FCIS?"]?.toLowerCase().trim() === "yes"
        )
        .map((row) => ({
          name: row["Name"]?.trim() || "",
          email: row["Email"]?.trim() || "",
        }))
        .filter((student) => student.name && student.email); // Filter out empty entries

      if (fcisStudents.length === 0) {
        throw new Error("No valid FCIS students found in the spreadsheet");
      }

      setEmailQueue(fcisStudents);
      setRecipientCount(fcisStudents.length);
      setUniqueIdColumnIndex(data.uniqueIdColumn);
      setIsDialogOpen(true);
    } catch (err) {
      console.error("Submission error:", err);
      setError(
        err.message || "Failed to fetch recipient count. Please try again."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmSend = async () => {
    if (passcode !== "OSC2025") {
      setError("Invalid passcode. Please try again.");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      console.log("Sending emails...", {
        recipients: emailQueue,
        spreadsheetId: link.trim(),
        uniqueIdColumn: uniqueIdColumnIndex,
      });

      const response = await fetch("/api/send-emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          recipients: emailQueue,
          spreadsheetId: link.trim(),
          uniqueIdColumn: uniqueIdColumnIndex,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error("Email API Error:", errorData);
        throw new Error(errorData.error || "Failed to send emails");
      }

      const result = await response.json();
      console.log("Email send result:", result);

      // Create results file
      const blob = new Blob([JSON.stringify(result, null, 2)], {
        type: "application/json",
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `email-results-${new Date().toISOString()}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      alert(
        `Emails sent successfully!\nSuccessful: ${result.successful}\nFailed: ${result.failed}`
      );
      setIsDialogOpen(false);
      setPasscode("");
      setEmailQueue([]);
    } catch (err) {
      console.error("Send error:", err);
      setError(err.message || "Failed to send emails. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-center">
            OSC Auto Mailing Service
          </CardTitle>
          <CardDescription className="text-center">
            Enter your spreadsheet ID below
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Input
                type="text"
                placeholder="Enter spreadsheet ID"
                value={link}
                onChange={(e) => setLink(e.target.value)}
                required
                className="w-full"
              />
              <p className="text-sm text-gray-500">
                Example ID: 1pYL9K2Uor-e9IisjxX2SnQepEztVVWjwah2Z_oTD53s
              </p>
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Processing..." : "Send Emails"}
            </Button>
            {error && (
              <p className="text-red-500 text-sm text-center">{error}</p>
            )}
          </form>
        </CardContent>
      </Card>

      {isDialogOpen && (
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirm Email Send</DialogTitle>
              <DialogDescription>
                You are about to send emails to {recipientCount} recipients.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="passcode" className="text-right">
                  Passcode
                </Label>
                <Input
                  id="passcode"
                  type="password"
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value)}
                  className="col-span-3"
                  placeholder="Passcode ex: OSCx"
                />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleConfirmSend} disabled={isLoading}>
                {isLoading ? "Sending..." : "Confirm Send"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
