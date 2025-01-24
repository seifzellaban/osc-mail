import { NextResponse } from "next/server";

export async function POST(request) {
  try {
    const { code } = await request.json();

    // Validate code format
    const codeRegex = /^OSCWW\d{3}$/;
    if (!codeRegex.test(code)) {
      return NextResponse.json(
        { error: "Invalid attendance code format" },
        { status: 400 }
      );
    }

    // Here you would typically verify against your database
    // For now, we'll just validate the format and return success
    return NextResponse.json({
      valid: true,
      message: "Attendance code verified successfully",
      code,
    });
  } catch (error) {
    console.error("Error verifying attendance:", error);
    return NextResponse.json(
      { error: "Failed to verify attendance code" },
      { status: 500 }
    );
  }
}
