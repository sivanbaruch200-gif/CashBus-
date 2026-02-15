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

    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/heic', 'application/pdf']
    if (!validTypes.includes(file.type)) {
      alert('אנא העלה קובץ תמונה (JPG, PNG, HEIC) או PDF')
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      alert('גודל הקובץ חייב להיות עד 10MB')
      return
    }

    setReceiptFile(file)
    onReceiptUploaded?.(file)

    if (file.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onloadend = () => {
        setReceiptPreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    } else {
      setReceiptPreview(null)
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
      <div className="flex items-center gap-3 pb-4 border-b border-surface-border">
        <div className="bg-accent-surface p-2 rounded-xl border border-accent-border">
          <Calculator className="w-5 h-5 text-accent" />
        </div>
        <div>
          <h3 className="font-bold text-content-primary">מחשבון פיצויים</h3>
          <p className="text-sm text-content-secondary">חישוב סכום הפיצוי לפי חוק</p>
        </div>
      </div>

      {/* Delay Duration */}
      {incidentType === 'delay' && (
        <div>
          <label className="block text-sm font-medium text-content-secondary mb-2">
            משך העיכוב (בדקות)
          </label>
          <input
            type="number"
            min="0"
            max="180"
            value={delayMinutes}
            onChange={(e) => setDelayMinutes(parseInt(e.target.value) || 0)}
            className="input-field"
          />
          <p className="text-xs text-content-tertiary mt-1">עיכוב מעל 20 דקות מזכה בפיצוי</p>
        </div>
      )}

      {/* Damage Type */}
      <div>
        <label className="block text-sm font-medium text-content-secondary mb-2">
          סוג הנזק הנוסף (אופציונלי)
        </label>
        <select
          value={damageType || ''}
          onChange={(e) => setDamageType(e.target.value as any || undefined)}
          className="input-field"
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
          <label className="block text-sm font-medium text-content-secondary mb-2">
            סכום הנזק (₪)
          </label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={damageAmount}
            onChange={(e) => setDamageAmount(parseFloat(e.target.value) || 0)}
            className="input-field"
            placeholder="הזן סכום"
          />
        </div>
      )}

      {/* Receipt Upload */}
      {damageType === 'taxi_cost' && (
        <div className="border-2 border-dashed border-surface-border rounded-xl p-6">
          {!receiptFile ? (
            <label className="cursor-pointer block text-center">
              <input
                type="file"
                accept="image/*,application/pdf"
                onChange={handleReceiptUpload}
                className="hidden"
              />
              <div className="flex flex-col items-center gap-2" onClick={() => (document.querySelector('input[type="file"]') as HTMLInputElement)?.click()}>
                <div className="bg-accent-surface p-3 rounded-full border border-accent-border">
                  <Upload className="w-6 h-6 text-accent" />
                </div>
                <div>
                  <p className="font-medium text-content-primary">העלה צילום קבלה</p>
                  <p className="text-sm text-content-secondary">PNG, JPG, HEIC או PDF (עד 10MB)</p>
                </div>
                <button
                  type="button"
                  className="btn-primary mt-2"
                >
                  בחר קובץ
                </button>
              </div>
            </label>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Receipt className="w-5 h-5 text-status-approved" />
                  <span className="text-sm font-medium text-content-primary">{receiptFile.name}</span>
                </div>
                <button
                  type="button"
                  onClick={removeReceipt}
                  className="p-1 hover:bg-surface-overlay rounded"
                >
                  <X className="w-5 h-5 text-content-tertiary" />
                </button>
              </div>
              {receiptPreview && (
                <img
                  src={receiptPreview}
                  alt="Receipt preview"
                  className="w-full h-48 object-cover rounded-lg"
                />
              )}
              <div className="flex items-center gap-2 text-status-approved text-sm">
                <CheckCircle className="w-4 h-4" />
                <span>הקבלה הועלתה בהצלחה</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Compensation Result */}
      {compensation && compensation.totalCompensation > 0 && (
        <div className="bg-surface-overlay border border-accent-border rounded-xl p-6">
          <div className="flex items-start gap-3 mb-4">
            <CheckCircle className="w-6 h-6 text-status-approved flex-shrink-0 mt-1" />
            <div className="flex-1">
              <h4 className="font-bold text-content-primary mb-1">חישוב פיצוי</h4>
              <p className="text-sm text-content-secondary">{compensation.description}</p>
            </div>
          </div>

          <div className="space-y-2 mb-4">
            {compensation.baseCompensation > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-content-secondary">פיצוי בסיס:</span>
                <span className="font-medium text-content-primary">₪{compensation.baseCompensation}</span>
              </div>
            )}
            {compensation.damageCompensation > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-content-secondary">פיצוי נזק:</span>
                <span className="font-medium text-content-primary">₪{compensation.damageCompensation}</span>
              </div>
            )}
            <div className="border-t border-surface-border pt-2 flex justify-between">
              <span className="font-bold text-content-primary">סה"כ פיצוי:</span>
              <span className="font-bold text-gold text-xl">
                ₪{compensation.totalCompensation.toLocaleString()}
              </span>
            </div>
          </div>

          <div className="bg-surface-base/60 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" />
              <div className="text-xs text-content-secondary">
                <span className="font-medium">בסיס משפטי:</span>
                <br />
                {compensation.legalBasis}
              </div>
            </div>
          </div>
        </div>
      )}

      {compensation && compensation.totalCompensation === 0 && (
        <div className="bg-status-pending-surface border border-status-pending/20 rounded-xl p-4">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-status-pending flex-shrink-0 mt-0.5" />
            <p className="text-sm text-status-pending">
              {compensation.description || 'לא ניתן לחשב פיצוי עבור אירוע זה'}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
