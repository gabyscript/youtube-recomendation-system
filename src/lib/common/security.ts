import { timingSafeEqual } from "node:crypto";

/** Constant-time string comparison (avoids leaking secrets through timing). */
export function safeEqualStrings(receivedValue: string, expectedValue: string): boolean {
  const receivedBuffer: Buffer = Buffer.from(receivedValue, "utf8");
  const expectedBuffer: Buffer = Buffer.from(expectedValue, "utf8");
  if (receivedBuffer.length !== expectedBuffer.length) {
    return false;
  }
  return timingSafeEqual(receivedBuffer, expectedBuffer);
}
