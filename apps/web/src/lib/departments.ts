/**
 * Department & Course Utility Helpers
 * Pure utility functions safe for both Client and Server execution.
 */

export function isICSCourse(course: string): boolean {
  const c = (course || '').toUpperCase();
  return (
    c.includes('BSIT') ||
    c.includes('BS-CPE') ||
    c.includes('BSCPE') ||
    c.includes('INFORMATION TECHNOLOGY') ||
    c.includes('COMPUTER ENGINEERING')
  );
}

export function isIBECourse(course: string): boolean {
  const c = (course || '').toUpperCase();
  return (
    c.includes('BSBA-HRM') ||
    c.includes('BSBA-HR') ||
    c.includes('BSENTREP') ||
    c.includes('ENTREPRENEURSHIP') ||
    c.includes('HUMAN RESOURCE') ||
    c.includes('BSBA') ||
    c.includes('BSA')
  );
}