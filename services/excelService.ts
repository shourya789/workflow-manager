
import * as XLSX from 'xlsx-js-style';
import { TimeData, User, EntryStatus } from '../types';
import { timeToSeconds, secondsToTime } from '../utils';

/**
 * Common data mapper for Excel export (Legacy Format)
 */
const mapEntryForExcel = (entry: TimeData, userName: string, empId: string) => {
  const loginSec = timeToSeconds(entry.currentLogin);
  const pauseSec = timeToSeconds(entry.pause);
  const dispoSec = timeToSeconds(entry.dispo);
  const deadSec = timeToSeconds(entry.dead);

  const totalBreakSec = pauseSec + dispoSec + deadSec;
  const shiftBase = entry.shiftType === 'Full Day' ? 9 * 3600 : 4.5 * 3600;
  const breakLimit = entry.shiftType === 'Full Day' ? 7200 : 2700;

  const excessSeconds = loginSec - shiftBase;
  const otSec = excessSeconds > 0 ? excessSeconds : 0;
  const isBreakExceeded = totalBreakSec > breakLimit;

  return {
    "Working Date": entry.date.split('T')[0],
    "Employee ID": empId.toUpperCase(),
    "Employee Name": userName,
    "Shift Category": entry.shiftType,
    "Status": entry.status || "N/A",
    "Session Duration": entry.currentLogin,
    "OT Calculated": secondsToTime(otSec),
    "Total Break Time": secondsToTime(totalBreakSec),
    "Inbound Calls": entry.inbound || 0,
    "Outbound Calls": entry.outbound || 0,
    "Login Start": entry.loginTimestamp || "—",
    "Login End": entry.logoutTimestamp || "—",
    "Pause Time": entry.pause,
    "Dispo Time": entry.dispo,
    "Dead Time": entry.dead,
    "Wait Time": entry.wait || "00:00:00",
    "Talk Time": entry.talk || "00:00:00",
    "Hold Time": entry.hold || "00:00:00",
    "Customer Talk Time": entry.customerTalk || "00:00:00",
    "Break Cap Status": isBreakExceeded ? "EXCEEDED" : "OK",
    "Notes/Reason": entry.reason || "N/A"
  };
};

export const exportToExcel = (entries: TimeData[], user: User) => {
  if (!entries.length) return alert("No data to export");
  const data = entries.map(entry => mapEntryForExcel(entry, user.name, user.empId));
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Performance_Audit");
  XLSX.writeFile(workbook, `WF_Audit_${user.empId}_${new Date().toISOString().split('T')[0]}.xlsx`);
};

export const exportConsolidatedExcel = (allEntries: any[]) => {
  if (!allEntries.length) return alert("No master data to export");
  const data = allEntries.map(entry =>
    mapEntryForExcel(entry, entry.userName || "N/A", entry.userId || "N/A")
  );
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Master_Property_Log");
  XLSX.writeFile(workbook, `MASTER_AUDIT_REPORT_4K_${new Date().toISOString().split('T')[0]}.xlsx`);
};

/**
 * Daily Performance Report with Conditional Formatting
 */
export const exportDailyPerformanceReport = (entries: any[]) => {
  if (!entries.length) return alert("No data to generate report");

  // 1. Group by User + Date to aggregate if needed, but for "Daily Report" typically we list sessions.
  // However, the request implies a summary row per user? The image shows "USER NAME" as primary.
  // Let's assume one row per entry for granularity, OR aggregate if there are multiple entries per day.
  // The image shows one row per user. So we should AGGREGATE by User.

  const aggregated: Record<string, any> = {};

  entries.forEach(e => {
    const key = e.userId || e.userName; // grouping key
    if (!aggregated[key]) {
      aggregated[key] = {
        name: e.userName || 'Unknown',
        userId: e.userId,
        inbound: 0,
        outbound: 0,
        loginSec: 0,
        pauseSec: 0,
        waitSec: 0,
        talkSec: 0,
        dispoSec: 0,
        deadSec: 0,
        custTalkSec: 0,
        shiftType: e.shiftType, // Last shift type wins or we detect mixed
        date: e.date, // Keep track of date range
        reasons: [] as string[]
      };
    }
    aggregated[key].inbound += (e.inbound || 0);
    aggregated[key].outbound += (e.outbound || 0);
    aggregated[key].loginSec += timeToSeconds(e.currentLogin);
    aggregated[key].pauseSec += timeToSeconds(e.pause);
    aggregated[key].waitSec += timeToSeconds(e.wait);
    aggregated[key].talkSec += timeToSeconds(e.talk);
    aggregated[key].dispoSec += timeToSeconds(e.dispo);
    aggregated[key].deadSec += timeToSeconds(e.dead);
    aggregated[key].custTalkSec += timeToSeconds(e.customerTalk);
    if (e.reason && typeof e.reason === 'string') {
      const trimmed = e.reason.trim();
      if (trimmed) aggregated[key].reasons.push(trimmed);
    }
  });

  // 2. Prepare Data Rows with Styling
  // Columns: USER NAME | CALLS | TIME | PAUSE | WAIT | TALK | DISPO | DEAD | TOTAL PAUSE | CUSTOMER | TOTAL INBOUND | TOTAL OUTBOUND | REMARKS

  const rows: any[] = [];

  // Header Row
  const headers = [
    "USER NAME", "CALLS", "TIME", "PAUSE", "WAIT", "TALK", "DISPO", "DEAD", "TOTAL PAUSE", "CUSTOMER", "TOTAL INBOUND", "TOTAL OUTBOUND", "REMARKS"
  ];

  // Create Worksheet with Headers
  const ws_data = [headers];

  // Total counters for footer
  let grandInbound = 0;

  Object.values(aggregated).forEach(u => {
    grandInbound += u.inbound;

    const totalPauseSec = u.pauseSec + u.dispoSec + u.deadSec;
    const totalPauseStr = secondsToTime(totalPauseSec);

    const uniqueReasons = Array.from(new Set(u.reasons));
    const remarkParts = uniqueReasons.length ? uniqueReasons : [];
    if (u.shiftType === 'Half Day' && !remarkParts.includes('Half Day')) {
      remarkParts.push('Half Day');
    }
    const remark = remarkParts.join(' | ');

    rows.push({
      name: u.name,
      calls: u.inbound, // First "CALLS" column in image? It says "CALLS" then "TOTAL INBOUND"... let's map Calls to Inbound for now or maybe "Connected"? Image has "88" in CALLS and "88" in TOTAL INBOUND. Likely same.
      time: secondsToTime(u.loginSec),
      pause: secondsToTime(u.pauseSec),
      wait: secondsToTime(u.waitSec),
      talk: secondsToTime(u.talkSec),
      dispo: secondsToTime(u.dispoSec),
      dead: secondsToTime(u.deadSec),
      totalPause: totalPauseStr,
      customer: secondsToTime(u.custTalkSec),
      totalInbound: u.inbound,
      totalOutbound: u.outbound,
      remark: remark || "",

      // For styling logic
      isTotalPauseExceeded: totalPauseSec > (u.shiftType === 'Half Day' ? 2700 : 7200) // 45m or 2h
    });
  });

  // Sort by name or calls? Image looks sorted. Let's sort by Inbound desc.
  rows.sort((a, b) => b.totalInbound - a.totalInbound);

  // Add rows to ws_data
  rows.forEach(r => {
    ws_data.push([
      r.name,
      r.calls,
      r.time,
      r.pause,
      r.wait,
      r.talk,
      r.dispo,
      r.dead,
      r.totalPause,
      r.customer,
      r.totalInbound,
      r.totalOutbound,
      r.remark
    ]);
  });

  // Add Grand Total Row
  const grandRow = ["", "", "", "", "", "", "", "", "", "", grandInbound, "", ""];
  ws_data.push(grandRow);

  // Create Sheet
  const ws = XLSX.utils.aoa_to_sheet(ws_data);

  // 3. Apply Styling
  const range = XLSX.utils.decode_range(ws['!ref'] || "A1:M1");

  // Styles
  const headerStyle = {
    fill: { fgColor: { rgb: "FFFF00" } },
    font: { bold: true, name: "Calibri", sz: 11 },
    border: { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } },
    alignment: { horizontal: "center", vertical: "center" }
  };

  const footerStyle = {
    fill: { fgColor: { rgb: "4472C4" } },
    font: { bold: true, color: { rgb: "FFFFFF" }, name: "Calibri" },
    alignment: { horizontal: "center" }
  };

  // Apply styles cell by cell
  for (let R = range.s.r; R <= range.e.r; ++R) {
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const cell_address = XLSX.utils.encode_cell({ r: R, c: C });
      if (!ws[cell_address]) continue;

      // Header
      if (R === 0) {
        ws[cell_address].s = headerStyle;
        continue;
      }

      // Footer (Last Row)
      if (R === range.e.r) {
        // Specific cells for Grand Total Labels/Values
        // In image: "TOTAL INBOUND CALLS" and the Value are colored Blue
        // Let's color the Total Inbound column (Col J = 10)
        if (C === 10 || C === 9) { // 9 is Customer logic, 10 is Total Inbound
          ws[cell_address].s = footerStyle;
          if (C === 9) ws[cell_address].v = "TOTAL INBOUND CALLS"; // Inject label
        }
        continue;
      }

      // Data Rows
      const rowData = rows[R - 1]; // -1 because header is 0

      let cellStyle: any = {
        font: { name: "Calibri", sz: 11 },
        border: { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } },
        alignment: { horizontal: "center" }
      };

      // Column Indexes:
      // 0:Name, 1:Calls, 2:Time, 3:Pause, 4:Wait, 5:Talk, 6:Dispo, 7:Dead, 8:TotalPause, 9:Cust, 10:Inbound, 11:Outbound, 12:Remark

      // Inbound Coloring (Col 10)
      if (C === 10) {
        const val = rowData.totalInbound;
        if (val >= 80) cellStyle.fill = { fgColor: { rgb: "90EE90" } }; // Green
        else if (val >= 60) cellStyle.fill = { fgColor: { rgb: "FFA500" } }; // Orange
        else cellStyle.fill = { fgColor: { rgb: "FF6B6B" } }; // Red
      }

      // Total Pause Coloring (Col 8)
      if (C === 8) {
        if (rowData.isTotalPauseExceeded) {
          cellStyle.fill = { fgColor: { rgb: "FF0000" } };
          cellStyle.font = { color: { rgb: "FFFFFF" }, bold: true };
        }
      }

      // Remark Coloring (Col 12)
      if (C === 12) {
        if (rowData.remark === 'Half Day' || rowData.remark === 'Night Shift') {
          cellStyle.fill = { fgColor: { rgb: "FFFF00" } };
          cellStyle.font = { bold: true };
        }
      }

      // Apply
      ws[cell_address].s = cellStyle;
    }
  }

  // Set Column Widths to Auto Fit roughly
  ws['!cols'] = headers.map(() => ({ wch: 15 }));
  ws['!cols'][0] = { wch: 25 }; // User Name wider
  ws['!cols'][8] = { wch: 18 }; // Total Pause wider

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, ws, "Daily_Report");
  XLSX.writeFile(workbook, `Daily_Performance_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
};
