'use client'

import { useState, useEffect } from 'react'
import { Upload, X, Calculator, Receipt, AlertCircle, CheckCircle } from 'lucide-react'
import { calculateCompensation, type CompensationParams, type CompensationResult } from '@/lib/compensation'

interface CompensationCalculatorProps {
  incidentType: 'delay' | 'no_stop' | 'no_arrival'
  busCompany: string
  onCompensationCalculated?: (result: CompensationResult) => void
  onReceiptUploaded?: (file: File) => void
  initialDamageType?: string
  initialDamageAmount?: number
}

export default function CompensationCalculator({
  incidentType,
  busCompany,
  onCompensationCalculated,
  onReceiptUploaded,
  initialDamageType,
  initialDamageAmount,
}: CompensationCalculatorProps) {
  const [delayMinutes, setDelayMinutes] = useState<number>(20)
  const [damageType, setDamageType] = useState<CompensationParams['damageType']>(
    initialDamageType as any || undefined
  )
  const [damageAmount, setDamageAmount] = useState<number>(initialDamageAmount || 0)
  const [receiptFile, setReceiptFile] = useState<File | null>(null)
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null)
  const [compensation, setCompensation] = useState<CompensationResult | null>(null)

  // Calculate compensation whenever inputs change
  useEffect(() => {
    const params: CompensationParams = {
      incidentType,
      busCompany,
      delayMinutes: incidentType === 'delay' ? delayMinutes : undefined,
      damageType,
      damageAmount: damageAmount > 0 ? damageAmount : undefined,
    }

    const result = calculateCompensation(params)
    setCompensation(result)
    onCompensationCalculated?.(result)
  }, [incidentType, busCompany, delayMinutes, damageType, damageAmount, onCompensationCalculated])

  const handleReceiptUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/heic', 'application/pdf']
    if (!validTypes.includes(file.type)) {
      alert('אנא העלה קובץ תמונה (JPG, PNG, HEIC) או PDF')
      return
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      alert('גודל הקובץ חייב להיות עד 10MB')
      return
    }

    setReceiptFile(file)
    onReceiptUploaded?.(file)

    // Create preview for images
    if (file.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onloadend = () => {
        setReceiptPreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    } else {
      setReceiptPreview(null) // PDF - no preview
    }
  }

  const removeReceipt = () => {
    setReceiptFile(null)
    setReceiptPreview(null)
    onReceiptUploaded?.(null as any)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 pb-4 border-b border-gray-200">
        <div className="bg-orange-100 p-2 rounded-lg">
          <Calculator className="w-5 h-5 text-primary-orange" />
        </div>
        <div>
          <h3 className="font-bold text-gray-900">מחשבון פיצויים</h3>
          <p className="text-sm text-gray-600">חישוב סכום הפיצוי לפי חוק</p>
        </div>
      </div>

      {/* Delay Duration (only for delay type) */}
      {incidentType === 'delay' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            משך העיכוב (בדקות)
          </label>
          <input
            type="number"
            min="0"
            max="180"
            value={delayMinutes}
            onChange={(e) => setDelayMinutes(parseInt(e.target.value) || 0)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-orange focus:border-transparent"
          />
          <p className="text-xs text-gray-500 mt-1">עיכוב מעל 20 דקות מזכה בפיצוי</p>
        </div>
      )}

      {/* Damage Type */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          סוג הנזק הנוסף (אופציונלי)
        </label>
        <select
          value={damageType || ''}
          onChange={(e) => setDamageType(e.target.value as any || undefined)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-orange focus:border-transparent"
        >
          <option value="">ללא נזק נוסף</option>
          <option value="taxi_cost">הוצאות מונית (עם קבלה)</option>
          <option value="lost_workday">אובדן יום עבודה</option>
          <option value="missed_exam">החמצת בחינה</option>
          <option value="medical_appointment">החמצת תור לרופא</option>
          <option value="other">נזק אחר</option>
        </select>
      </div>

      {/* Damage Amount */}
      {damageType && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            סכום הנזק (₪)
          </label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={damageAmount}
            onChange={(e) => setDamageAmount(parseFloat(e.target.value) || 0)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-orange focus:border-transparent"
            placeholder="הזן סכום"
          />
        </div>
      )}

      {/* Receipt Upload (for taxi_cost) */}
      {damageType === 'taxi_cost' && (
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
          {!receiptFile ? (
            <label className="cursor-pointer block text-center">
              <input
                type="file"
                accept="image/*,application/pdf"
                onChange={handleReceiptUpload}
                className="hidden"
              />
              <div className="flex flex-col items-center gap-2">
                <div className="bg-blue-100 p-3 rounded-full">
                  <Upload className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">העלה צילום קבלה</p>
                  <p className="text-sm text-gray-600">PNG, JPG, HEIC או PDF (עד 10MB)</p>
                </div>
                <button
                  type="button"
                  className="mt-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                >
                  בחר קובץ
                </button>
              </div>
            </label>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Receipt className="w-5 h-5 text-green-600" />
                  <span className="text-sm font-medium text-gray-900">{receiptFile.name}</span>
                </div>
                <button
                  type="button"
                  onClick={removeReceipt}
                  className="p-1 hover:bg-gray-100 rounded"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
              {receiptPreview && (
                <img
                  src={receiptPreview}
                  alt="Receipt preview"
                  className="w-full h-48 object-cover rounded-lg"
                />
              )}
              <div className="flex items-center gap-2 text-green-600 text-sm">
                <CheckCircle className="w-4 h-4" />
                <span>הקבלה הועלתה בהצלחה</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Compensation Result */}
      {compensation && compensation.totalCompensation > 0 && (
        <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-lg p-6">
          <div className="flex items-start gap-3 mb-4">
            <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0 mt-1" />
            <div className="flex-1">
              <h4 className="font-bold text-gray-900 mb-1">חישוב פיצוי</h4>
              <p className="text-sm text-gray-600">{compensation.description}</p>
            </div>
          </div>

          {/* Breakdown */}
          <div className="space-y-2 mb-4">
            {compensation.baseCompensation > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-700">פיצוי בסיס:</span>
                <span className="font-medium">₪{compensation.baseCompensation}</span>
              </div>
            )}
            {compensation.damageCompensation > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-700">פיצוי נזק:</span>
                <span className="font-medium">₪{compensation.damageCompensation}</span>
              </div>
            )}
            <div className="border-t border-green-200 pt-2 flex justify-between">
              <span className="font-bold text-gray-900">סה"כ פיצוי:</span>
              <span className="font-bold text-green-700 text-xl">
                ₪{compensation.totalCompensation.toLocaleString()}
              </span>
            </div>
          </div>

          {/* Legal Basis */}
          <div className="bg-white bg-opacity-60 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-gray-700">
                <span className="font-medium">בסיס משפטי:</span>
                <br />
                {compensation.legalBasis}
              </div>
            </div>
          </div>
        </div>
      )}

      {compensation && compensation.totalCompensation === 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-yellow-800">
              {compensation.description || 'לא ניתן לחשב פיצוי עבור אירוע זה'}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}