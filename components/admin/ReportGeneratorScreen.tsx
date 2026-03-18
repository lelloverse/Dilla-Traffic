import React, { useState } from 'react';
import { useToast } from '../../context/ToastContext';
import { FaFileCsv, FaFilePdf } from 'react-icons/fa';
import { getPayments, getVehicles, getDrivers } from '../../database';
import { User, UserRole } from '../../types';
import { useTranslation } from 'react-i18next';

interface ReportGeneratorScreenProps {
  onBack: () => void;
  currentUser: User | null;
}

type ReportType = 'none' | 'revenue' | 'registrations' | 'licenses';

const ReportGeneratorScreen: React.FC<ReportGeneratorScreenProps> = ({ onBack, currentUser }) => {
    const { t } = useTranslation();
    const { addToast } = useToast();
    const [reportType, setReportType] = useState<ReportType>('none');
    const [dateRange, setDateRange] = useState({ start: '', end: '' });
    const [generatedReport, setGeneratedReport] = useState<any[] | null>(null);

    const handleGenerate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (reportType === 'none') {
            addToast(t('allFieldsRequired'), "error");
            setGeneratedReport(null);
            return;
        };

        let data: any[] = [];
        const { start, end } = dateRange;

        switch (reportType) {
            case 'revenue':
                const payments = await getPayments();
                data = payments.map(p => ({
                    date: p.date,
                    amount: `ETB ${p.amount.toLocaleString()}`,
                    type: p.serviceType.replace('_', ' ').toUpperCase(),
                    payer: p.payerName,
                    method: p.paymentMethod
                }));
                break;
            case 'registrations':
                const vehicles = await getVehicles();
                data = vehicles.map(v => ({
                    date: (v as any).createdAt || v.expiryDate, // Use createdAt if available
                    plate: v.plateNumber,
                    vehicle: `${v.make} ${v.model}`,
                    owner: v.ownerName,
                    type: v.type,
                    status: v.status
                }));
                break;
            case 'licenses':
                const drivers = await getDrivers();
                data = drivers.map(d => ({
                    date: (d as any).createdAt || d.expiryDate, // Use createdAt if available
                    licenseNo: d.licenseNumber,
                    name: d.fullName,
                    status: d.status,
                    phone: d.phone
                }));
                break;
        }

        // Filter by date if provided
        if (start || end) {
            data = data.filter(item => {
                if (!item.date) return false;
                
                // Handle various date formats (Supabase TIMESTAMPTZ, ISO strings, etc.)
                const itemDate = new Date(item.date);
                if (isNaN(itemDate.getTime())) return false; // Invalid date

                // Reset time for comparison to ensure full days are included
                const comparisonDate = new Date(itemDate.getFullYear(), itemDate.getMonth(), itemDate.getDate());
                
                if (start) {
                    const startDate = new Date(start);
                    if (comparisonDate < startDate) return false;
                }
                
                if (end) {
                    const endDate = new Date(end);
                    if (comparisonDate > endDate) return false;
                }
                
                return true;
            });
        }

        if (data.length === 0) {
            addToast(t('noDataFound'), "info");
            setGeneratedReport([]);
        } else {
            setGeneratedReport(data);
            addToast(t('reportGeneratedRecords', { count: data.length }), "success");
        }
    }

    const handleExportCSV = () => {
        if (!generatedReport || generatedReport.length === 0) return;
        
        const headers = Object.keys(generatedReport[0]);
        const csvContent = [
            headers.join(','),
            ...generatedReport.map(row => headers.map(h => `"${row[h]}"`).join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `${reportType}_report_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        addToast(t('reportExportedCsv'), "success");
    };

    const handleExportPDF = () => {
        window.print();
        addToast("Print dialog opened for PDF export", "info");
    };
    
    const renderReportTable = () => {
        if (!generatedReport) return <p className="text-gray-500">{t('noReportGenerated')}</p>;
        
        const headers = Object.keys(generatedReport[0] || {});

        return (
             <div className="overflow-x-auto">
                <table className="w-full text-sm text-left text-gray-500">
                    <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                        <tr>
                           {headers.map(h => <th scope="col" className="px-6 py-3 capitalize" key={h}>{h}</th>)}
                        </tr>
                    </thead>
                    <tbody>
                        {generatedReport.map((row, index) => (
                             <tr key={index} className="bg-white border-b">
                                {headers.map(h => <td className="px-6 py-4" key={h}>{row[h]}</td>)}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        )
    }

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-6xl mx-auto bg-white rounded-lg shadow-xl p-8 border border-gray-100">
        <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold text-gray-800">{t('reportGenerator')}</h1>
            <button
                onClick={onBack}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition"
            >
                {t('backToDashboard')}
            </button>
        </div>

        {/* Report Builder Form */}
        <form onSubmit={handleGenerate} className="p-6 bg-gray-50 rounded-lg md:flex items-end gap-4 space-y-4 md:space-y-0">
            <div className="flex-grow">
                <label htmlFor="reportType" className="block text-sm font-medium">{t('reportType')}</label>
                <select id="reportType" value={reportType} onChange={e => setReportType(e.target.value as ReportType)} className="w-full p-2 mt-1 border rounded bg-white border-gray-300">
                    <option value="none">{t('selectReport')}</option>
                    <option value="revenue">{t('revenue')}</option>
                    <option value="registrations">{t('vehicleRegistrations')}</option>
                    <option value="licenses">{t('licensesIssued')}</option>
                </select>
            </div>
             <div className="flex-grow">
                <label htmlFor="startDate" className="block text-sm font-medium">{t('startDate')}</label>
                <input type="date" id="startDate" value={dateRange.start} onChange={e => setDateRange({...dateRange, start: e.target.value})} className="w-full p-2 mt-1 border rounded bg-white border-gray-300" />
            </div>
             <div className="flex-grow">
                <label htmlFor="endDate" className="block text-sm font-medium">{t('endDate')}</label>
                <input type="date" id="endDate" value={dateRange.end} onChange={e => setDateRange({...dateRange, end: e.target.value})} className="w-full p-2 mt-1 border rounded bg-white border-gray-300" />
            </div>
            <button type="submit" className="w-full md:w-auto px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700">{t('generateReport')}</button>
        </form>

        {/* Generated Report */}
        <div className="mt-8">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">{t('generatedReport')}</h2>
                {generatedReport && (
                    <div className="flex gap-2">
                        <button onClick={() => window.print()} className="px-3 py-1 text-sm bg-gray-200 rounded hover:bg-gray-300 transition">{t('print')}</button>
                        <button onClick={handleExportCSV} className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700 transition flex items-center gap-1">
                            <FaFileCsv size={16} />
                            {t('csv')}
                        </button>
                        <button onClick={handleExportPDF} className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700 transition flex items-center gap-1">
                             <FaFilePdf size={16} />
                            {t('pdf')}
                        </button>
                    </div>
                )}
            </div>
            <div className="p-6 bg-gray-50 rounded-lg min-h-[200px]">
                {renderReportTable()}
            </div>
        </div>
      </div>
    </div>
  );
};

export default ReportGeneratorScreen;