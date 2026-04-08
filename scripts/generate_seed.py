#!/usr/bin/env python3
"""Generate seed data as a TypeScript module for the CIS4120 app."""
import base64, json

# Generate simple PDF content as data URLs using minimal valid PDF
# Each PDF contains realistic invoice/customs doc content

def make_pdf(title: str, content_lines: list[str]) -> str:
    """Create a minimal valid PDF and return as data URL."""
    content = f"BT /F1 12 Tf 50 780 Td ({title}) Tj ET\n"
    y = 760
    for line in content_lines:
        # Escape parentheses for PDF string
        safe = line.replace('(', r'\(').replace(')', r'\)')
        content += f"BT /F1 10 Tf 50 {y} Td ({safe}) Tj ET\n"
        y -= 16
        if y < 50:
            break

    stream = content.encode()
    stream_len = len(stream)

    pdf = f"""%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792]
   /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>
endobj
4 0 obj
<< /Length {stream_len} >>
stream
{content}endstream
endobj
5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
xref
0 6
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
0000000115 00000 n
0000000266 00000 n
0000000{400 + stream_len:06d} 00000 n
trailer
<< /Size 6 /Root 1 0 R >>
startxref
{500 + stream_len}
%%EOF"""

    b64 = base64.b64encode(pdf.encode()).decode()
    return f"data:application/pdf;base64,{b64}"

# Case 1 - DRAFTING — NAR Plastics Export (by user0, ghost user)
invoice_1 = make_pdf("COMMERCIAL INVOICE", [
    "Invoice No: INV-2024-0892",
    "Date: 10 March 2024",
    "Buyer: Meridian Trading Co. Ltd.",
    "14 Ataturk Blvd, Ankara, Turkey",
    "Seller: NAR Plastik Dis Ticaret A.S.",
    "Firuzkoy, Istanbul, Turkey",
    "---",
    "Description: Polypropylene Homopolymer Grade",
    "HS Code: 39021000",
    "Qty: 40,000 MT",
    "Unit Price: USD 1,100/MT",
    "Total Value: USD 44,000,000",
    "Net Weight: 40,000 kg",
    "Gross Weight: 44,400 kg",
    "Origin: Bulgaria",
    "Payment Terms: Cash",
    "Exit Customs: Istanbul Customs Gate 3",
    "IBAN: TR33 0006 1005 1978 6457 8413 26",
])

pkg_1 = make_pdf("PACKAGE LIST", [
    "Package List No: PL-2024-0892",
    "Case No: NAR-001",
    "Total Packages: 2,000 bags",
    "Each bag: 25 kg Polypropylene",
    "Total Net Weight: 40,000 kg",
    "Total Gross Weight: 44,400 kg",
    "Dimensions: 50x35x20 cm per bag",
    "Pallet Count: 80",
])

atr_1 = make_pdf("ATR MOVEMENT CERTIFICATE", [
    "ATR Certificate No: ATR-BG-2024-10291",
    "Country of Origin: Bulgaria",
    "Goods: Polypropylene Homopolymer",
    "HS Code: 39021000",
    "Net Weight: 40,000 kg",
    "Destination: Turkey",
    "Date: 10 March 2024",
    "Customs Authority: Sofia Customs Office",
])

insurance_1 = make_pdf("INSURANCE CERTIFICATE", [
    "Policy No: INS-2024-77821",
    "Insured: NAR Plastik Dis Ticaret A.S.",
    "Cargo: Polypropylene Homopolymer",
    "Coverage: USD 48,400,000 (110% of invoice)",
    "Route: Bulgaria to Istanbul",
    "Valid From: 10 March 2024",
    "Valid To: 30 April 2024",
    "Insurer: Anadolu Sigorta A.S.",
])

# Case 2 - MISSING_EV — Textile Export (missing some links)
invoice_2 = make_pdf("COMMERCIAL INVOICE", [
    "Invoice No: INV-2024-1145",
    "Date: 15 March 2024",
    "Buyer: EuroFabrics GmbH, Berlin, Germany",
    "Seller: Istanbul Tekstil San. ve Tic. A.S.",
    "Description: Cotton Woven Fabric, Plain Weave",
    "HS Code: 52081100",
    "Qty: 120,000 meters",
    "Unit Price: USD 3.20/meter",
    "Total Value: USD 384,000",
    "Net Weight: 18,000 kg",
    "Gross Weight: 19,200 kg",
    "Origin: Turkey",
    "Payment: 60 days L/C",
    "Exit: Mersin Port",
])

# Case 3 - READY_FOR_REVIEW — Chemical Export (fully linked)
invoice_3 = make_pdf("COMMERCIAL INVOICE", [
    "Invoice No: INV-2024-2201",
    "Date: 01 April 2024",
    "Buyer: Chem Solutions Inc., Rotterdam, Netherlands",
    "Seller: Petkim Petrokimya Holding A.S., Izmir",
    "Description: Ethylene Glycol Industrial Grade",
    "HS Code: 29053100",
    "Qty: 500 MT",
    "Unit Price: USD 680/MT",
    "Total Value: USD 340,000",
    "Net Weight: 500,000 kg",
    "Gross Weight: 510,000 kg",
    "Origin: Turkey",
    "Payment: Cash in Advance",
    "Exit Customs: Izmir Port Customs",
    "IBAN: TR61 0001 5001 5800 7308 6300 01",
])

# Case 4 - RETURNED — Steel Export (needs fixing)
invoice_4 = make_pdf("COMMERCIAL INVOICE", [
    "Invoice No: INV-2024-0765",
    "Date: 20 February 2024",
    "Buyer: ArcelorMittal Poland S.A.",
    "Seller: Erdemir Demir Celik San. A.S., Eregli",
    "Description: Hot Rolled Steel Coils",
    "HS Code: 72081000",
    "Qty: 3,200 MT",
    "Unit Price: USD 520/MT",
    "Total Value: USD 1,664,000",
    "Net Weight: 3,200,000 kg",
    "Gross Weight: 3,280,000 kg",
    "Origin: Turkey",
    "Payment: Net 90 days",
    "CONFLICT: Invoice amount USD 1,664,000 does not match contract USD 1,640,000",
])

# Case 5 - COMPLETED — Electronics Export
invoice_5 = make_pdf("COMMERCIAL INVOICE", [
    "Invoice No: INV-2024-3301",
    "Date: 25 January 2024",
    "Buyer: Samsung Electronics, Seoul, Korea",
    "Seller: Arcelik A.S., Istanbul, Turkey",
    "Description: Home Appliances - Washing Machines",
    "HS Code: 84501100",
    "Qty: 5,000 units",
    "Unit Price: USD 280/unit",
    "Total Value: USD 1,400,000",
    "Net Weight: 250,000 kg",
    "Gross Weight: 275,000 kg",
    "Origin: Turkey",
    "Payment: L/C at sight",
    "Exit Customs: Istanbul Haydarpasa Port",
    "IBAN: TR32 0001 2001 5678 9012 3456 78",
    "Status: SUBMITTED TO CUSTOMS - 15 documents",
])

def ts_doc(var_name: str, doc_name: str, doc_type: str, data_url: str) -> str:
    return f'const {var_name}: UploadedDoc = {{ name: "{doc_name}", docType: "{doc_type}", dataUrl: "{data_url}" }};'

output = '''// AUTO-GENERATED SEED DATA — do not edit manually
// Generated by scripts/generate_seed.py

import type { Case, UploadedDoc } from './types';

'''

# Write out the data URLs
print("Generating seed TypeScript...")

seed_ts = f'''// SEED DATA — auto-generated
// Users: test1@test.com / test2@test.com / test3@test.com (all password: Test)
// Cases seeded across all 5 status lanes, created by "System (user0)"

const INVOICE_1_URL = "{invoice_1}";
const PKG_1_URL = "{pkg_1}";
const ATR_1_URL = "{atr_1}";
const INS_1_URL = "{insurance_1}";
const INVOICE_2_URL = "{invoice_2}";
const INVOICE_3_URL = "{invoice_3}";
const INVOICE_4_URL = "{invoice_4}";
const INVOICE_5_URL = "{invoice_5}";

export const SEED_USERS = [
  {{ email: "test1@test.com", password: "Test", role: "writer" as const, company: "NAR Plastik", name: "Test User 1" }},
  {{ email: "test2@test.com", password: "Test", role: "lead_reviewer" as const, company: "NAR Plastik", name: "Test User 2" }},
  {{ email: "test3@test.com", password: "Test", role: "ceo" as const, company: "NAR Plastik", name: "Test User 3" }},
];

export const SEED_CASES: Case[] = [
  {{
    id: "CASE-001",
    title: "NAR EXPORT #1 — Polypropylene",
    createdBy: "System",
    createdAt: new Date("2024-03-10"),
    status: "drafting",
    fields: {{
      hsCode: "39021000",
      originCountry: "Bulgaria",
      destCountry: "Turkey",
      invoiceAmount: "44000000",
      netWeight: "40000",
      grossWeight: "44400",
      exitCustoms: "Istanbul Gate 3",
      iban: "TR33 0006 1005 1978 6457 8413 26",
      others: "",
    }},
    docs: [
      {{ name: "Invoice_NAR_001.pdf", docType: "invoice", dataUrl: INVOICE_1_URL }},
      {{ name: "PackageList_NAR_001.pdf", docType: "packageList", dataUrl: PKG_1_URL }},
      {{ name: "ATR_BG_001.pdf", docType: "atr", dataUrl: ATR_1_URL }},
      {{ name: "Insurance_NAR_001.pdf", docType: "insurance", dataUrl: INS_1_URL }},
    ],
    links: [
      {{ field: "hsCode", docType: "invoice", region: "HS Code line", value: "39021000", status: "linked" }},
      {{ field: "invoiceAmount", docType: "invoice", region: "Total Value line", value: "44000000", status: "linked" }},
    ],
    regions: [],
    comments: [],
  }},
  {{
    id: "CASE-002",
    title: "IST TEKSTIL #2 — Cotton Fabric",
    createdBy: "System",
    createdAt: new Date("2024-03-15"),
    status: "missing_ev",
    fields: {{
      hsCode: "52081100",
      originCountry: "Turkey",
      destCountry: "Germany",
      invoiceAmount: "384000",
      netWeight: "18000",
      grossWeight: "",
      exitCustoms: "Mersin Port",
      iban: "",
      others: "",
    }},
    docs: [
      {{ name: "Invoice_IST_002.pdf", docType: "invoice", dataUrl: INVOICE_2_URL }},
    ],
    links: [
      {{ field: "invoiceAmount", docType: "invoice", region: "Total Value line", value: "384000", status: "linked" }},
    ],
    regions: [],
    comments: [
      {{ author: "System", text: "Missing ATR certificate and gross weight entry.", timestamp: new Date("2024-03-16") }},
    ],
  }},
  {{
    id: "CASE-003",
    title: "PETKIM #3 — Ethylene Glycol",
    createdBy: "System",
    createdAt: new Date("2024-04-01"),
    status: "ready_review",
    fields: {{
      hsCode: "29053100",
      originCountry: "Turkey",
      destCountry: "Netherlands",
      invoiceAmount: "340000",
      netWeight: "500000",
      grossWeight: "510000",
      exitCustoms: "Izmir Port Customs",
      iban: "TR61 0001 5001 5800 7308 6300 01",
      others: "Dangerous goods declaration attached",
    }},
    docs: [
      {{ name: "Invoice_PETKIM_003.pdf", docType: "invoice", dataUrl: INVOICE_3_URL }},
    ],
    links: [
      {{ field: "hsCode", docType: "invoice", region: "HS Code", value: "29053100", status: "linked" }},
      {{ field: "invoiceAmount", docType: "invoice", region: "Total Value", value: "340000", status: "linked" }},
      {{ field: "netWeight", docType: "invoice", region: "Net Weight", value: "500000", status: "linked" }},
      {{ field: "originCountry", docType: "invoice", region: "Origin", value: "Turkey", status: "linked" }},
    ],
    regions: [],
    comments: [
      {{ author: "Test User 1", text: "All fields verified. Ready for lead reviewer.", timestamp: new Date("2024-04-02") }},
    ],
  }},
  {{
    id: "CASE-004",
    title: "ERDEMIR #4 — Steel Coils",
    createdBy: "System",
    createdAt: new Date("2024-02-20"),
    status: "returned",
    fields: {{
      hsCode: "72081000",
      originCountry: "Turkey",
      destCountry: "Poland",
      invoiceAmount: "1664000",
      netWeight: "3200000",
      grossWeight: "3280000",
      exitCustoms: "Haydarpasa Port",
      iban: "",
      others: "",
    }},
    docs: [
      {{ name: "Invoice_ERD_004.pdf", docType: "invoice", dataUrl: INVOICE_4_URL }},
    ],
    links: [
      {{ field: "invoiceAmount", docType: "invoice", region: "Total Value", value: "1640000", status: "conflict" }},
    ],
    regions: [],
    comments: [
      {{ author: "Test User 2", text: "Invoice amount mismatch: document shows 1,640,000 but declared 1,664,000. Please correct and resubmit.", timestamp: new Date("2024-02-25") }},
    ],
  }},
  {{
    id: "CASE-005",
    title: "ARCELIK #5 — Washing Machines",
    createdBy: "System",
    createdAt: new Date("2024-01-25"),
    status: "completed",
    fields: {{
      hsCode: "84501100",
      originCountry: "Turkey",
      destCountry: "South Korea",
      invoiceAmount: "1400000",
      netWeight: "250000",
      grossWeight: "275000",
      exitCustoms: "Istanbul Haydarpasa Port",
      iban: "TR32 0001 2001 5678 9012 3456 78",
      others: "15 documents submitted to customs",
    }},
    docs: [
      {{ name: "Invoice_ARC_005.pdf", docType: "invoice", dataUrl: INVOICE_5_URL }},
    ],
    links: [
      {{ field: "hsCode", docType: "invoice", region: "HS Code", value: "84501100", status: "linked" }},
      {{ field: "invoiceAmount", docType: "invoice", region: "Total Value", value: "1400000", status: "linked" }},
      {{ field: "netWeight", docType: "invoice", region: "Net Weight", value: "250000", status: "linked" }},
      {{ field: "grossWeight", docType: "invoice", region: "Gross Weight", value: "275000", status: "linked" }},
      {{ field: "originCountry", docType: "invoice", region: "Origin", value: "Turkey", status: "linked" }},
      {{ field: "destCountry", docType: "invoice", region: "Buyer country", value: "South Korea", status: "linked" }},
      {{ field: "iban", docType: "invoice", region: "IBAN line", value: "TR32 0001 2001 5678 9012 3456 78", status: "linked" }},
    ],
    regions: [],
    comments: [
      {{ author: "Test User 3", text: "Approved. Submitted 15 documents to customs.", timestamp: new Date("2024-01-28") }},
    ],
  }},
];
'''

out_path = '/home/ubuntu/.openclaw/workspace/assignments/CIS4120/FinalProject/src/port5176/seedData.ts'
with open(out_path, 'w') as f:
    f.write(seed_ts)

print(f"Written to {out_path} ({len(seed_ts):,} chars)")
