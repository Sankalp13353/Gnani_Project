import React, { useState, useRef } from 'react';
import {
  X,
  Upload,
  FileSpreadsheet,
  Download,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Loader2,
  ArrowRight,
  RefreshCw,
  FileText,
} from 'lucide-react';
import {
  previewProductImport,
  confirmProductImport,
  downloadImportTemplate,
} from '../../services/api.js';

export const BulkImportModal = ({ isOpen, onClose, onSuccess }) => {
  const fileInputRef = useRef(null);

  const [step, setStep] = useState('upload'); // 'upload' | 'preview' | 'success'
  const [file, setFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [error, setError] = useState(null);

  const [previewData, setPreviewData] = useState(null);
  const [duplicatePolicy, setDuplicatePolicy] = useState('skip'); // 'skip' | 'update'
  const [activeTab, setActiveTab] = useState('valid'); // 'valid' | 'invalid'
  const [resultData, setResultData] = useState(null);

  if (!isOpen) return null;

  const handleReset = () => {
    setStep('upload');
    setFile(null);
    setError(null);
    setPreviewData(null);
    setDuplicatePolicy('skip');
    setActiveTab('valid');
    setResultData(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleFileChange = (e) => {
    const selected = e.target.files?.[0];
    if (selected) {
      const ext = selected.name.slice(selected.name.lastIndexOf('.')).toLowerCase();
      if (ext !== '.csv' && ext !== '.xlsx') {
        setError('Please select a valid CSV (.csv) or Excel (.xlsx) spreadsheet.');
        setFile(null);
        return;
      }
      setFile(selected);
      setError(null);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) {
      const ext = dropped.name.slice(dropped.name.lastIndexOf('.')).toLowerCase();
      if (ext !== '.csv' && ext !== '.xlsx') {
        setError('Please drop a valid CSV (.csv) or Excel (.xlsx) spreadsheet.');
        setFile(null);
        return;
      }
      setFile(dropped);
      setError(null);
    }
  };

  const handleUploadAndPreview = async () => {
    if (!file) {
      setError('Please select a file to import.');
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      const response = await previewProductImport(file);
      if (response?.success && response?.data) {
        setPreviewData(response.data);
        setActiveTab(response.data.summary.validCount > 0 ? 'valid' : 'invalid');
        setStep('preview');
      } else {
        throw new Error(response?.message || 'Failed to process file preview');
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Error processing preview');
    } finally {
      setIsUploading(false);
    }
  };

  const handleConfirmImport = async () => {
    if (!previewData?.importToken) {
      setError('Import session missing. Please re-upload your file.');
      return;
    }

    setIsConfirming(true);
    setError(null);

    try {
      const response = await confirmProductImport({
        importToken: previewData.importToken,
        duplicatePolicy,
      });

      if (response?.success && response?.data) {
        setResultData(response.data);
        setStep('success');
        onSuccess(
          `Bulk import complete: ${response.data.createdCount} added, ${response.data.skippedCount} skipped, ${response.data.updatedCount} updated`
        );
      } else {
        throw new Error(response?.message || 'Failed to commit import');
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Error confirming import');
    } finally {
      setIsConfirming(false);
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      await downloadImportTemplate();
    } catch (err) {
      setError('Failed to download template: ' + (err.message || 'Network error'));
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-2xl w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">Bulk Product Catalogue Import</h3>
              <p className="text-xs text-slate-500">
                Upload grocery inventory in bulk using CSV or Excel (.xlsx)
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              handleReset();
              onClose();
            }}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6">
          {error && (
            <div className="mb-4 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-red-500" />
              <div className="font-medium flex-1">{error}</div>
            </div>
          )}

          {/* STEP 1: Upload File */}
          {step === 'upload' && (
            <div className="space-y-5">
              {/* Dropzone */}
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
                  file
                    ? 'border-blue-500 bg-blue-50/40'
                    : 'border-slate-300 hover:border-blue-400 hover:bg-slate-50'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv, .xlsx, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, text/csv"
                  onChange={handleFileChange}
                  className="hidden"
                />

                <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-200 text-blue-600 mx-auto flex items-center justify-center mb-3">
                  <Upload className="w-6 h-6" />
                </div>

                {file ? (
                  <div className="space-y-1">
                    <p className="font-semibold text-slate-900 text-sm">{file.name}</p>
                    <p className="text-xs text-slate-500">
                      {(file.size / 1024).toFixed(1)} KB • Click to choose a different file
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <p className="font-semibold text-slate-800 text-sm">
                      Choose a spreadsheet or drag & drop here
                    </p>
                    <p className="text-xs text-slate-500">
                      Supports CSV (.csv) and Microsoft Excel (.xlsx) up to 500 rows (max 5MB)
                    </p>
                  </div>
                )}
              </div>

              {/* Sample Template & Help */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                <div className="flex items-center gap-2 text-slate-600">
                  <FileText className="w-4 h-4 text-blue-600" />
                  <span>Required columns: <strong>name</strong>, <strong>unit</strong>, <strong>price</strong></span>
                </div>

                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  className="inline-flex items-center gap-1.5 font-semibold text-blue-600 hover:text-blue-800 hover:underline"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Sample CSV Template</span>
                </button>
              </div>

              {/* Action Button */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    handleReset();
                    onClose();
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!file || isUploading}
                  onClick={handleUploadAndPreview}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm transition-colors flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Parsing Spreadsheet...</span>
                    </>
                  ) : (
                    <>
                      <span>Preview Catalogue Items</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: Preview & Validation */}
          {step === 'preview' && previewData && (
            <div className="space-y-4">
              {/* Summary Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-center">
                  <p className="text-[11px] text-slate-500 font-medium">Total Rows</p>
                  <p className="text-lg font-bold text-slate-900">{previewData.summary.totalRows}</p>
                </div>
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-center">
                  <p className="text-[11px] text-emerald-700 font-medium">Valid Items</p>
                  <p className="text-lg font-bold text-emerald-700">{previewData.summary.validCount}</p>
                </div>
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-center">
                  <p className="text-[11px] text-red-700 font-medium">Invalid Rows</p>
                  <p className="text-lg font-bold text-red-700">{previewData.summary.invalidCount}</p>
                </div>
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-center">
                  <p className="text-[11px] text-amber-700 font-medium">Store Duplicates</p>
                  <p className="text-lg font-bold text-amber-700">{previewData.summary.duplicateCount}</p>
                </div>
              </div>

              {/* Tab navigation */}
              <div className="flex border-b border-slate-200 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setActiveTab('valid')}
                  className={`pb-2 px-3 border-b-2 transition-colors ${
                    activeTab === 'valid'
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Valid Products ({previewData.validRows.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('invalid')}
                  className={`pb-2 px-3 border-b-2 transition-colors flex items-center gap-1.5 ${
                    activeTab === 'invalid'
                      ? 'border-red-600 text-red-600'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <span>Invalid Rows ({previewData.invalidRows.length})</span>
                  {previewData.invalidRows.length > 0 && (
                    <span className="w-2 h-2 rounded-full bg-red-500" />
                  )}
                </button>
              </div>

              {/* Table View of Rows */}
              <div className="max-h-56 overflow-y-auto border border-slate-200 rounded-xl">
                {activeTab === 'valid' ? (
                  previewData.validRows.length === 0 ? (
                    <div className="p-6 text-center text-xs text-slate-500">
                      No valid rows found in file. Please correct the invalid rows and re-upload.
                    </div>
                  ) : (
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 sticky top-0">
                        <tr>
                          <th className="p-2.5 pl-3">Row</th>
                          <th className="p-2.5">Product Name</th>
                          <th className="p-2.5">Category</th>
                          <th className="p-2.5">Unit</th>
                          <th className="p-2.5">Price</th>
                          <th className="p-2.5 pr-3 text-right">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {previewData.validRows.map((row) => (
                          <tr key={row.rowNumber} className="hover:bg-slate-50">
                            <td className="p-2.5 pl-3 text-slate-400 font-mono">#{row.rowNumber}</td>
                            <td className="p-2.5 font-medium text-slate-900">
                              {row.name}
                              {row.brand && <span className="text-slate-400 font-normal"> ({row.brand})</span>}
                            </td>
                            <td className="p-2.5 text-slate-600">{row.category || '—'}</td>
                            <td className="p-2.5 font-mono text-slate-700">{row.unit}</td>
                            <td className="p-2.5 font-semibold text-slate-900">₹{row.price}</td>
                            <td className="p-2.5 pr-3 text-right">
                              {row.isDuplicate ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-semibold">
                                  Duplicate
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-semibold">
                                  New
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )
                ) : (
                  previewData.invalidRows.length === 0 ? (
                    <div className="p-6 text-center text-xs text-emerald-600 flex items-center justify-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>All rows in spreadsheet passed validation!</span>
                    </div>
                  ) : (
                    <table className="w-full text-left text-xs">
                      <thead className="bg-red-50 text-red-800 border-b border-red-100 sticky top-0">
                        <tr>
                          <th className="p-2.5 pl-3">Row</th>
                          <th className="p-2.5">Uploaded Data</th>
                          <th className="p-2.5 pr-3">Validation Errors</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-red-100/50">
                        {previewData.invalidRows.map((row) => (
                          <tr key={row.rowNumber} className="bg-red-50/20">
                            <td className="p-2.5 pl-3 text-red-600 font-mono font-bold">#{row.rowNumber}</td>
                            <td className="p-2.5 text-slate-700">
                              <span className="font-semibold text-slate-900">
                                {row.raw.name || row.raw.productname || '<missing name>'}
                              </span>
                              <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                                Unit: {row.raw.unit || '—'} | Price: {row.raw.price || '—'}
                              </div>
                            </td>
                            <td className="p-2.5 pr-3">
                              <ul className="list-disc list-inside text-red-600 text-[11px] space-y-0.5">
                                {row.errors.map((err, i) => (
                                  <li key={i}>{err}</li>
                                ))}
                              </ul>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )
                )}
              </div>

              {/* Duplicate Policy Configuration */}
              {previewData.summary.duplicateCount > 0 && (
                <div className="p-3.5 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 space-y-2">
                  <div className="flex items-center gap-1.5 font-semibold text-amber-800">
                    <AlertTriangle className="w-4 h-4" />
                    <span>{previewData.summary.duplicateCount} product(s) already exist in your store</span>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-4 pt-1">
                    <label className="inline-flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="duplicatePolicy"
                        value="skip"
                        checked={duplicatePolicy === 'skip'}
                        onChange={(e) => setDuplicatePolicy(e.target.value)}
                        className="text-amber-600 focus:ring-amber-500"
                      />
                      <span><strong>Skip existing</strong> (Preserve current prices & details)</span>
                    </label>

                    <label className="inline-flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="duplicatePolicy"
                        value="update"
                        checked={duplicatePolicy === 'update'}
                        onChange={(e) => setDuplicatePolicy(e.target.value)}
                        className="text-amber-600 focus:ring-amber-500"
                      />
                      <span><strong>Update existing</strong> (Overwrite with spreadsheet prices)</span>
                    </label>
                  </div>
                </div>
              )}

              {/* Footer Actions */}
              <div className="flex items-center justify-between gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setStep('upload')}
                  disabled={isConfirming}
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  ← Back to File Upload
                </button>

                <button
                  type="button"
                  disabled={previewData.summary.validCount === 0 || isConfirming}
                  onClick={handleConfirmImport}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm transition-colors flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isConfirming ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving to Catalogue...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Confirm & Import ({previewData.summary.validCount} items)</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: Success Screen */}
          {step === 'success' && resultData && (
            <div className="text-center py-6 space-y-4">
              <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8" />
              </div>

              <div>
                <h4 className="text-lg font-bold text-slate-900">Bulk Import Complete!</h4>
                <p className="text-xs text-slate-500 mt-1">
                  Your store catalogue has been updated successfully.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-3 max-w-sm mx-auto pt-2">
                <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200">
                  <p className="text-[11px] text-emerald-700 font-semibold">Added New</p>
                  <p className="text-xl font-bold text-emerald-800 mt-0.5">{resultData.createdCount}</p>
                </div>
                <div className="p-3 bg-blue-50 rounded-xl border border-blue-200">
                  <p className="text-[11px] text-blue-700 font-semibold">Updated</p>
                  <p className="text-xl font-bold text-blue-800 mt-0.5">{resultData.updatedCount}</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <p className="text-[11px] text-slate-600 font-semibold">Skipped</p>
                  <p className="text-xl font-bold text-slate-700 mt-0.5">{resultData.skippedCount}</p>
                </div>
              </div>

              <div className="pt-4">
                <button
                  type="button"
                  onClick={() => {
                    handleReset();
                    onClose();
                  }}
                  className="px-6 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-sm transition-colors"
                >
                  Done & View Catalogue
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BulkImportModal;

