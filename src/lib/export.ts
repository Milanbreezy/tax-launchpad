import type { TaxPosition } from "./types"

// Export to CSV (Excel-compatible)
export function exportToExcel(position: TaxPosition): void {
  const headers = [
    "TIN",
    "Taxpayer Name",
    "Status",
    "Business Type",
    "Principal Amount",
    "Penalty Amount",
    "Interest Amount",
    "Total Arrears",
    "Registration Date",
    "Last Payment Date",
    "Notes",
  ]

  const rows = position.records.map((record) => [
    record.tin || "",
    record.taxpayerName || "",
    record.status || "Active",
    record.businessType || "",
    record.principalAmount?.toFixed(2) || "0.00",
    record.penaltyAmount?.toFixed(2) || "0.00",
    record.interestAmount?.toFixed(2) || "0.00",
    record.totalArrears?.toFixed(2) || "0.00",
    record.registrationDate || "",
    record.lastPaymentDate || "",
    record.notes || "",
  ])

  // Add summary row
  rows.push([])
  rows.push(["SUMMARY"])
  rows.push(["Total Records", position.summary.totalRecords.toString()])
  rows.push(["Total Principal", position.summary.totalPrincipal.toFixed(2)])
  rows.push(["Total Penalty", position.summary.totalPenalty.toFixed(2)])
  rows.push(["Total Interest", position.summary.totalInterest.toFixed(2)])
  rows.push(["Total Arrears", position.summary.totalArrears.toFixed(2)])
  rows.push(["Active Records", position.summary.activeCount.toString()])
  rows.push(["Inactive Records", position.summary.inactiveCount.toString()])
  rows.push(["Duplicate Records", position.summary.duplicateCount.toString()])

  // Create CSV content
  const csvContent = [headers, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(",")).join("\n")

  // Create blob and download
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
  const link = document.createElement("a")
  const url = URL.createObjectURL(blob)

  link.setAttribute("href", url)
  link.setAttribute("download", `${sanitizeFilename(position.name)}_${getDateString()}.csv`)
  link.style.visibility = "hidden"
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

// Export to PDF
export function exportToPDF(position: TaxPosition): void {
  const printWindow = window.open("", "_blank")
  if (!printWindow) {
    alert("Please allow popups to export PDF")
    return
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "decimal",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount)
  }

  const formatDate = (dateString?: string) => {
    if (!dateString) return "-"
    try {
      return new Date(dateString).toLocaleDateString()
    } catch {
      return dateString
    }
  }

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>${position.name} - Tax Position Report</title>
      <style>
        @page {
          size: A4 landscape;
          margin: 1cm;
        }
        
        body {
          font-family: Arial, sans-serif;
          font-size: 10pt;
          line-height: 1.4;
          color: #000;
          margin: 0;
          padding: 20px;
        }
        
        .header {
          text-align: center;
          margin-bottom: 30px;
          border-bottom: 2px solid #000;
          padding-bottom: 15px;
        }
        
        .header h1 {
          margin: 0 0 5px 0;
          font-size: 18pt;
          font-weight: bold;
        }
        
        .header p {
          margin: 5px 0;
          color: #666;
        }
        
        .summary {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 15px;
          margin-bottom: 30px;
          page-break-inside: avoid;
        }
        
        .summary-card {
          border: 1px solid #ddd;
          padding: 10px;
          background: #f9f9f9;
        }
        
        .summary-card h3 {
          margin: 0 0 5px 0;
          font-size: 9pt;
          color: #666;
          font-weight: normal;
        }
        
        .summary-card p {
          margin: 0;
          font-size: 14pt;
          font-weight: bold;
        }
        
        table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 20px;
          font-size: 9pt;
        }
        
        th {
          background: #333;
          color: white;
          padding: 8px 6px;
          text-align: left;
          font-weight: bold;
          border: 1px solid #000;
        }
        
        td {
          padding: 6px;
          border: 1px solid #ddd;
        }
        
        tr:nth-child(even) {
          background: #f9f9f9;
        }
        
        .duplicate {
          background: #fff3cd !important;
        }
        
        .text-right {
          text-align: right;
        }
        
        .status {
          display: inline-block;
          padding: 2px 6px;
          border-radius: 3px;
          font-size: 8pt;
          font-weight: bold;
        }
        
        .status-active {
          background: #d4edda;
          color: #155724;
        }
        
        .status-inactive {
          background: #e2e3e5;
          color: #383d41;
        }
        
        .status-suspended {
          background: #f8d7da;
          color: #721c24;
        }
        
        tfoot {
          font-weight: bold;
          background: #f0f0f0;
        }
        
        tfoot td {
          border-top: 2px solid #000;
        }
        
        .footer {
          margin-top: 30px;
          padding-top: 15px;
          border-top: 1px solid #ddd;
          text-align: center;
          font-size: 8pt;
          color: #666;
        }
        
        @media print {
          body {
            padding: 0;
          }
          
          .no-print {
            display: none;
          }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>Tax Position Report</h1>
        <p><strong>${position.name}</strong></p>
        ${position.description ? `<p>${position.description}</p>` : ""}
        <p>Generated: ${new Date().toLocaleString()}</p>
      </div>
      
      <div class="summary">
        <div class="summary-card">
          <h3>Total Records</h3>
          <p>${position.summary.totalRecords.toLocaleString()}</p>
        </div>
        <div class="summary-card">
          <h3>Total Arrears</h3>
          <p>${formatCurrency(position.summary.totalArrears)}</p>
        </div>
        <div class="summary-card">
          <h3>Active / Inactive</h3>
          <p>${position.summary.activeCount} / ${position.summary.inactiveCount}</p>
        </div>
        <div class="summary-card">
          <h3>Duplicates</h3>
          <p>${position.summary.duplicateCount}</p>
        </div>
      </div>
      
      <table>
        <thead>
          <tr>
            <th style="width: 40px;">#</th>
            <th style="width: 100px;">TIN</th>
            <th>Taxpayer Name</th>
            <th style="width: 80px;">Status</th>
            <th style="width: 100px;" class="text-right">Principal</th>
            <th style="width: 100px;" class="text-right">Penalty</th>
            <th style="width: 100px;" class="text-right">Interest</th>
            <th style="width: 100px;" class="text-right">Total Arrears</th>
          </tr>
        </thead>
        <tbody>
          ${position.records
            .map(
              (record, index) => `
            <tr class="${record.isDuplicate ? "duplicate" : ""}">
              <td>${index + 1}</td>
              <td>${record.tin || "-"}</td>
              <td>${record.taxpayerName || "-"}</td>
              <td>
                <span class="status status-${record.status?.toLowerCase() || "active"}">
                  ${record.status || "Active"}
                </span>
              </td>
              <td class="text-right">${formatCurrency(record.principalAmount || 0)}</td>
              <td class="text-right">${formatCurrency(record.penaltyAmount || 0)}</td>
              <td class="text-right">${formatCurrency(record.interestAmount || 0)}</td>
              <td class="text-right">${formatCurrency(record.totalArrears || 0)}</td>
            </tr>
          `,
            )
            .join("")}
        </tbody>
        <tfoot>
          <tr>
            <td colspan="4">TOTAL (${position.records.length} records)</td>
            <td class="text-right">${formatCurrency(position.summary.totalPrincipal)}</td>
            <td class="text-right">${formatCurrency(position.summary.totalPenalty)}</td>
            <td class="text-right">${formatCurrency(position.summary.totalInterest)}</td>
            <td class="text-right">${formatCurrency(position.summary.totalArrears)}</td>
          </tr>
        </tfoot>
      </table>
      
      <div class="footer">
        <p>Tax Position Automation System | Generated from TRA Internal Portal Data</p>
        <p>This is a computer-generated report. All amounts are in local currency.</p>
      </div>
      
      <script>
        window.onload = function() {
          window.print();
        }
      </script>
    </body>
    </html>
  `

  printWindow.document.write(html)
  printWindow.document.close()
}

// Helper functions
function sanitizeFilename(filename: string): string {
  return filename.replace(/[^a-z0-9]/gi, "_").toLowerCase()
}

function getDateString(): string {
  const now = new Date()
  return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`
}
