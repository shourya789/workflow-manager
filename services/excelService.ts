
import * as XLSX from 'xlsx';
import { TimeData, User } from '../types';
import { timeToSeconds, secondsToTime } from '../utils';

export const exportToExcel = (entries: TimeData[], user: User, targetLoginSeconds: number, targetBreakSeconds: number) => {
  const data = entries.map(entry => {
    const pauseSec = timeToSeconds(entry.pause);
    const dispoSec = timeToSeconds(entry.dispo);
    const deadSec = timeToSeconds(entry.dead);
    const currentLoginSec = timeToSeconds(entry.currentLogin);
    
    const totalBreakSec = pauseSec + dispoSec + deadSec;
    const breakExceeded = totalBreakSec > targetBreakSeconds;

    return {
      "Date": entry.date,
      "Employee Name": user.name,
      "Employee ID": user.empId,
      "Total Login Time": entry.currentLogin,
      "Total Break (Pause+Dispo+Dead)": secondsToTime(totalBreakSec),
      "Break Status": breakExceeded ? "⚠️ EXCEEDED (RED)" : "✅ OK",
      "Pause Time": entry.pause,
      "Dispo Time": entry.dispo,
      "Dead Time": entry.dead,
      "Wait Time": entry.wait,
      "Talk Time": entry.talk,
      "Hold Time": entry.hold,
      "Customer Talk Time": entry.customerTalk,
      "Inbound": entry.inbound,
      "Outbound": entry.outbound
    };
  });

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Daily Performance Report");

  const wscols = [
    { wch: 20 }, { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 25 }, 
    { wch: 20 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, 
    { wch: 12 }, { wch: 12 }, { wch: 18 }, { wch: 10 }, { wch: 10 }
  ];
  worksheet['!cols'] = wscols;

  XLSX.writeFile(workbook, `${user.empId}_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
};
