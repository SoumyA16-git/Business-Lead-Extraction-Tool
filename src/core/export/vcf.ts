import { BusinessRecord } from "../schema/business-record";

/**
 * Converts a list of BusinessRecords to a standard vCard (.vcf) string.
 */
export function toVcf(records: BusinessRecord[]): string {
  if (!records || records.length === 0) return "";

  let vcfContent = "";

  for (const record of records) {
    if (!record.phone_normalized && !record.phone) continue;

    // Filter: Only include businesses that do NOT have a website
    if (record.website_status === "website" || (record.website && record.website.trim() !== "")) {
      continue;
    }

    const fn = record.business_name || "Unknown Business";
    const tel = record.phone_normalized || record.phone || "";
    
    // Create vCard block
    vcfContent += "BEGIN:VCARD\r\n";
    vcfContent += "VERSION:3.0\r\n";
    vcfContent += `FN:${fn}\r\n`;
    vcfContent += `ORG:${fn}\r\n`;
    
    if (tel) {
      vcfContent += `TEL;TYPE=WORK,VOICE:${tel}\r\n`;
    }
    
    if (record.address) {
      vcfContent += `ADR;TYPE=WORK:;;${record.address.replace(/,/g, "\\,")}\r\n`;
    }

    if (record.primary_category) {
      vcfContent += `NOTE:Category: ${record.primary_category}\r\n`;
    }

    vcfContent += "END:VCARD\r\n";
  }

  return vcfContent;
}
