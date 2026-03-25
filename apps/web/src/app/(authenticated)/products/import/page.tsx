'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api';
import { Upload, FileSpreadsheet } from 'lucide-react';

export default function ImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const router = useRouter();

  const handleImport = async () => {
    if (!file) return;
    setLoading(true);
    try {
      const res = await apiClient.upload('/api/products/import', file);
      setResult(res.data);
    } catch (err: any) {
      setResult({ error: err.response?.data?.error?.message || 'Import failed' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Import Products</h1>

      <div className="bg-white rounded-lg shadow p-8">
        <div className="max-w-lg mx-auto text-center">
          <FileSpreadsheet className="h-16 w-16 mx-auto text-gray-400 mb-4" />
          <h2 className="text-lg font-medium mb-2">Upload CSV or Excel File</h2>
          <p className="text-sm text-gray-500 mb-6">
            Required columns: sku, websiteId. Optional: title, description, brand, categoryId, priority
          </p>

          <div className="border-2 border-dashed rounded-lg p-8 mb-4">
            <input
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary file:text-primary-foreground hover:file:opacity-90"
            />
          </div>

          {file && (
            <p className="text-sm text-gray-600 mb-4">
              Selected: {file.name} ({(file.size / 1024).toFixed(1)} KB)
            </p>
          )}

          <button
            onClick={handleImport}
            disabled={!file || loading}
            className="inline-flex items-center gap-2 px-6 py-2 bg-primary text-primary-foreground rounded-md disabled:opacity-50"
          >
            <Upload className="h-4 w-4" />
            {loading ? 'Importing...' : 'Import'}
          </button>
        </div>

        {result && (
          <div className="mt-8 p-4 rounded-lg bg-gray-50">
            {result.error ? (
              <p className="text-red-600">{result.error}</p>
            ) : (
              <div className="space-y-2">
                <p className="text-green-600 font-medium">Import complete!</p>
                <p>Imported: {result.imported}</p>
                <p>Skipped: {result.skipped}</p>
                <p>Total rows: {result.totalRows}</p>
                {result.errors?.length > 0 && (
                  <div className="mt-2">
                    <p className="font-medium text-red-600">Errors:</p>
                    {result.errors.map((err: string, i: number) => (
                      <p key={i} className="text-sm text-red-500">{err}</p>
                    ))}
                  </div>
                )}
                <button
                  onClick={() => router.push('/products')}
                  className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm"
                >
                  View Products
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
