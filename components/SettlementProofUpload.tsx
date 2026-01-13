'use client'

/**
 * Settlement Proof Upload Component
 *
 * Allows users to upload proof of payment (check photo, bank transfer screenshot)
 * Triggers automatic 15% commission calculation
 */

import { useState } from 'react'
import { Upload, CheckCircle, AlertCircle, DollarSign, Camera } from 'lucide-react'
import { uploadSettlementProof } from '@/lib/commissionService'
import { handleSettlementProofUploaded } from '@/lib/collectionWorkflow'

interface SettlementProofUploadProps {
  claimId: string
  userId: string
  estimatedAmount?: number
  onUploadSuccess?: () => void
}

export default function SettlementProofUpload({
  claimId,
  userId,
  estimatedAmount,
  onUploadSuccess,
}: SettlementProofUploadProps) {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [claimedAmount, setClaimedAmount] = useState<number>(estimatedAmount || 0)
  const [proofType, setProofType] = useState<'check_photo' | 'bank_transfer' | 'cash_receipt' | 'other'>('bank_transfer')
  const [userNotes, setUserNotes] = useState('')
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return

    // Validate file type
    if (!selectedFile.type.startsWith('image/')) {
      setError('אנא העלה קובץ תמונה בלבד')
      return
    }

    // Validate file size (max 10MB)
    if (selectedFile.size > 10 * 1024 * 1024) {
      setError('גודל הקובץ חורג מ-10MB')
      return
    }

    setFile(selectedFile)
    setError(null)

    // Create preview
    const reader = new FileReader()
    reader.onloadend = () => {
      setPreview(reader.result as string)
    }
    reader.readAsDataURL(selectedFile)
  }

  async function handleUpload() {
    if (!file) {
      setError('אנא בחר קובץ להעלאה')
      return
    }

    if (!claimedAmount || claimedAmount <= 0) {
      setError('אנא הזן סכום תקין')
      return
    }

    setUploading(true)
    setError(null)

    try {
      // Upload settlement proof
      const proof = await uploadSettlementProof(
        claimId,
        userId,
        file,
        claimedAmount,
        proofType,
        userNotes
      )

      if (!proof) {
        throw new Error('העלאה נכשלה')
      }

      // Trigger workflow (sends notifications)
      await handleSettlementProofUploaded(claimId, proof.id)

      setSuccess(true)
      if (onUploadSuccess) {
        onUploadSuccess()
      }
    } catch (err) {
      console.error('Upload error:', err)
      setError(err instanceof Error ? err.message : 'שגיאה בהעלאת הקובץ')
    } finally {
      setUploading(false)
    }
  }

  const estimatedCommission = claimedAmount * 0.15

  if (success) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-6" dir="rtl">
        <div className="flex items-center gap-3 mb-4">
          <CheckCircle className="w-8 h-8 text-green-600" />
          <h3 className="text-xl font-bold text-green-900">האסמכתא נקלטה בהצלחה!</h3>
        </div>

        <div className="space-y-3 text-green-800">
          <p>✅ הקובץ הועלה למערכת</p>
          <p>✅ נשלחה הודעה לצוות האדמינים לאימות</p>
          <p>✅ תקבל אימייל עם חשבונית לאחר האימות</p>

          <div className="mt-6 p-4 bg-white rounded-lg">
            <div className="text-sm text-gray-600 mb-2">עמלה משוערת (15%):</div>
            <div className="text-2xl font-bold text-orange-600">
              ₪{estimatedCommission.toLocaleString('he-IL', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              15% מ-₪{claimedAmount.toLocaleString('he-IL')}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6" dir="rtl">
      <div className="flex items-center gap-3 mb-6">
        <div className="bg-orange-100 p-3 rounded-full">
          <Upload className="w-6 h-6 text-orange-600" />
        </div>
        <div>
          <h3 className="text-xl font-bold">העלאת אסמכתא לתשלום</h3>
          <p className="text-sm text-gray-600">צלם/י או העלה/י תמונה של התשלום שקיבלת</p>
        </div>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 text-red-800 p-4 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Proof Type Selection */}
      <div className="mb-6">
        <label className="block text-sm font-semibold mb-2">סוג האסמכתא</label>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setProofType('bank_transfer')}
            className={`p-3 border-2 rounded-lg text-right transition-colors ${
              proofType === 'bank_transfer'
                ? 'border-orange-500 bg-orange-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="font-semibold">העברה בנקאית</div>
            <div className="text-xs text-gray-600">צילום מסך מהבנק</div>
          </button>

          <button
            onClick={() => setProofType('check_photo')}
            className={`p-3 border-2 rounded-lg text-right transition-colors ${
              proofType === 'check_photo'
                ? 'border-orange-500 bg-orange-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="font-semibold">המחאה</div>
            <div className="text-xs text-gray-600">תמונה של המחאה</div>
          </button>

          <button
            onClick={() => setProofType('cash_receipt')}
            className={`p-3 border-2 rounded-lg text-right transition-colors ${
              proofType === 'cash_receipt'
                ? 'border-orange-500 bg-orange-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="font-semibold">קבלה במזומן</div>
            <div className="text-xs text-gray-600">קבלה על תשלום</div>
          </button>

          <button
            onClick={() => setProofType('other')}
            className={`p-3 border-2 rounded-lg text-right transition-colors ${
              proofType === 'other'
                ? 'border-orange-500 bg-orange-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="font-semibold">אחר</div>
            <div className="text-xs text-gray-600">סוג אחר</div>
          </button>
        </div>
      </div>

      {/* Amount Input */}
      <div className="mb-6">
        <label className="block text-sm font-semibold mb-2">
          סכום שקיבלת <span className="text-red-500">*</span>
        </label>
        <div className="relative">
          <DollarSign className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="number"
            value={claimedAmount || ''}
            onChange={(e) => setClaimedAmount(parseFloat(e.target.value) || 0)}
            className="w-full pr-10 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-lg font-semibold"
            placeholder="0.00"
            min="0"
            step="0.01"
          />
        </div>
        <div className="mt-2 text-sm text-gray-600">
          עמלה משוערת (15%): <strong className="text-orange-600">₪{estimatedCommission.toLocaleString('he-IL', { minimumFractionDigits: 2 })}</strong>
        </div>
      </div>

      {/* File Upload */}
      <div className="mb-6">
        <label className="block text-sm font-semibold mb-2">
          קובץ תמונה <span className="text-red-500">*</span>
        </label>

        {!preview ? (
          <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-orange-500 transition-colors bg-gray-50">
            <Camera className="w-12 h-12 text-gray-400 mb-3" />
            <span className="text-sm text-gray-600 mb-1">לחץ להעלאת תמונה</span>
            <span className="text-xs text-gray-500">או גרור קובץ לכאן</span>
            <input
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
            />
          </label>
        ) : (
          <div className="relative">
            <img
              src={preview}
              alt="Preview"
              className="w-full h-64 object-contain border border-gray-300 rounded-lg"
            />
            <button
              onClick={() => {
                setFile(null)
                setPreview(null)
              }}
              className="absolute top-2 left-2 bg-red-500 text-white px-3 py-1 rounded-lg text-sm hover:bg-red-600"
            >
              הסר
            </button>
          </div>
        )}
      </div>

      {/* Notes */}
      <div className="mb-6">
        <label className="block text-sm font-semibold mb-2">הערות (אופציונלי)</label>
        <textarea
          value={userNotes}
          onChange={(e) => setUserNotes(e.target.value)}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
          rows={3}
          placeholder="הוסף הערות או הסבר נוסף..."
        />
      </div>

      {/* Info Box */}
      <div className="mb-6 bg-blue-50 border border-blue-200 p-4 rounded-lg">
        <h4 className="font-semibold text-blue-900 mb-2">📌 חשוב לדעת</h4>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>✅ האסמכתא תאומת על ידי צוות האדמינים</li>
          <li>✅ תקבל חשבונית לתשלום לאחר האימות</li>
          <li>✅ עמלת ההצלחה היא 15% בלבד מהסכום שקיבלת</li>
          <li>✅ התשלום דרך Stripe (אבטחה מקסימלית)</li>
        </ul>
      </div>

      {/* Upload Button */}
      <button
        onClick={handleUpload}
        disabled={uploading || !file || !claimedAmount}
        className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-gray-400 text-white font-bold py-4 px-6 rounded-lg transition-colors shadow-lg flex items-center justify-center gap-2"
      >
        {uploading ? (
          <>
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
            <span>מעלה...</span>
          </>
        ) : (
          <>
            <Upload className="w-5 h-5" />
            <span>העלה אסמכתא</span>
          </>
        )}
      </button>
    </div>
  )
}
