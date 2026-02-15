'use client'

import Link from 'next/link'

export default function PrivacyPage() {
  const lastUpdated = '1 בפברואר 2026'

  return (
    <div className="min-h-screen bg-surface-overlay py-8 px-4" dir="rtl">
      <div className="max-w-4xl mx-auto bg-surface-raised rounded-lg shadow-lg p-8">
        <h1 className="text-3xl font-bold text-content-primary mb-2">מדיניות פרטיות</h1>
        <p className="text-content-tertiary mb-8">עדכון אחרון: {lastUpdated}</p>

        {/* הקדמה */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-accent mb-4">1. כללי</h2>
          <div className="text-content-secondary space-y-3">
            <p>
              CashBus מכבדת את פרטיות המשתמשים ומחויבת להגן על המידע האישי שנאסף במסגרת השירות.
              מדיניות זו מפרטת את אופן האיסוף, השימוש והשמירה של מידע אישי.
            </p>
          </div>
        </section>

        {/* מידע נאסף */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-accent mb-4">2. מידע שאנו אוספים</h2>
          <div className="text-content-secondary space-y-3">
            <p><strong>מידע שנמסר על ידי המשתמש:</strong></p>
            <ul className="list-disc list-inside mr-4 space-y-2">
              <li>שם מלא ותעודת זהות</li>
              <li>כתובת מגורים</li>
              <li>מספר טלפון וכתובת דוא&quot;ל</li>
              <li>פרטי חשבון בנק (לצורך העברת פיצויים)</li>
              <li>תיאורי אירועים ותלונות</li>
            </ul>

            <p className="mt-4"><strong>מידע שנאסף אוטומטית:</strong></p>
            <ul className="list-disc list-inside mr-4 space-y-2">
              <li>נתוני GPS ומיקום בעת דיווח על אירוע</li>
              <li>חותמות זמן של פעולות במערכת</li>
              <li>מידע על המכשיר (דפדפן, מערכת הפעלה)</li>
              <li>כתובת IP</li>
            </ul>
          </div>
        </section>

        {/* שימוש במידע */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-accent mb-4">3. שימוש במידע</h2>
          <div className="text-content-secondary space-y-3">
            <p>אנו משתמשים במידע למטרות הבאות:</p>
            <ul className="list-disc list-inside mr-4 space-y-2">
              <li>אימות זהות המשתמש</li>
              <li>תיעוד אירועי תחבורה ציבורית</li>
              <li>יצירת מכתבי דרישה</li>
              <li>העברת פיצויים לחשבון המשתמש</li>
              <li>יצירת קשר עם המשתמש בנוגע לשירות</li>
              <li>שיפור השירות וחווית המשתמש</li>
            </ul>
          </div>
        </section>

        {/* שיתוף מידע */}
        <section className="mb-8 bg-status-pending-surface p-6 rounded-lg border border-status-pending/20">
          <h2 className="text-xl font-semibold text-status-pending mb-4">4. שיתוף מידע עם צדדים שלישיים</h2>
          <div className="text-content-secondary space-y-3">
            <p>מידע אישי עשוי להיות משותף עם:</p>
            <ul className="list-disc list-inside mr-4 space-y-2">
              <li><strong>חברות תחבורה ציבורית</strong> - לצורך משלוח מכתבי דרישה</li>
              <li><strong>משרד התחבורה</strong> - העתק של הפניות (במסגרת פיקוח)</li>
              <li><strong>ספקי שירות</strong> - לצורך תפעול המערכת (אחסון ענן, שליחת מיילים)</li>
              <li><strong>רשויות אכיפה</strong> - בהתאם לצו שיפוטי או דרישה חוקית</li>
            </ul>
            <p className="mt-4">
              <strong>אנו לא מוכרים מידע אישי לצדדים שלישיים.</strong>
            </p>
          </div>
        </section>

        {/* אבטחת מידע */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-accent mb-4">5. אבטחת מידע</h2>
          <div className="text-content-secondary space-y-3">
            <p>
              אנו נוקטים באמצעי אבטחה מקובלים להגנה על המידע, לרבות:
            </p>
            <ul className="list-disc list-inside mr-4 space-y-2">
              <li>הצפנת תעבורה (SSL/TLS)</li>
              <li>אחסון מאובטח בשרתים מוגנים</li>
              <li>בקרת גישה למורשים בלבד</li>
              <li>גיבויים תקופתיים</li>
            </ul>
            <p className="mt-4">
              יחד עם זאת, אין שיטת אבטחה מושלמת, ואנו לא יכולים להתחייב להגנה מוחלטת מפני גישה בלתי מורשית.
            </p>
          </div>
        </section>

        {/* שמירת מידע */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-accent mb-4">6. תקופת שמירת מידע</h2>
          <div className="text-content-secondary space-y-3">
            <p>
              מידע אישי נשמר כל עוד החשבון פעיל וכן לתקופה נוספת של <strong>7 שנים</strong>
              לאחר סגירת החשבון, בהתאם לדרישות חוק ולצורך תביעות אפשריות.
            </p>
          </div>
        </section>

        {/* זכויות המשתמש */}
        <section className="mb-8 bg-surface-overlay p-6 rounded-lg border border-surface-border">
          <h2 className="text-xl font-semibold text-status-legal mb-4">7. זכויות המשתמש</h2>
          <div className="text-content-secondary space-y-3">
            <p>המשתמש זכאי:</p>
            <ul className="list-disc list-inside mr-4 space-y-2">
              <li>לבקש גישה למידע האישי שנשמר עליו</li>
              <li>לבקש תיקון מידע שגוי</li>
              <li>לבקש מחיקת מידע (בכפוף להגבלות חוקיות)</li>
              <li>להתנגד לשימושים מסוימים במידע</li>
            </ul>
            <p className="mt-4">
              לבקשות בנושא פרטיות, ניתן לפנות: cash.bus200@gmail.com
            </p>
          </div>
        </section>

        {/* עוגיות */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-accent mb-4">8. עוגיות (Cookies)</h2>
          <div className="text-content-secondary space-y-3">
            <p>
              האתר משתמש בעוגיות לצורך:
            </p>
            <ul className="list-disc list-inside mr-4 space-y-2">
              <li>שמירת מצב התחברות</li>
              <li>שיפור חווית המשתמש</li>
              <li>ניתוח שימוש באתר</li>
            </ul>
            <p className="mt-4">
              ניתן לחסום עוגיות בהגדרות הדפדפן, אך הדבר עלול לפגוע פונקציונליות השירות.
            </p>
          </div>
        </section>

        {/* שינויים */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-accent mb-4">9. שינויים במדיניות</h2>
          <div className="text-content-secondary space-y-3">
            <p>
              אנו עשויים לעדכן מדיניות זו מעת לעת. שינויים מהותיים יפורסמו באתר
              ו/או יישלחו למשתמשים בדוא&quot;ל.
            </p>
          </div>
        </section>

        {/* יצירת קשר */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-accent mb-4">10. יצירת קשר</h2>
          <div className="text-content-secondary space-y-3">
            <p>לשאלות בנוגע למדיניות הפרטיות:</p>
            <ul className="list-disc list-inside mr-4 space-y-2">
              <li>דוא&quot;ל: cash.bus200@gmail.com</li>
              <li>טלפון: *2992</li>
            </ul>
          </div>
        </section>

        {/* לינקים */}
        <div className="flex gap-4 mt-8 pt-4 border-t border-surface-border">
          <Link href="/" className="text-accent hover:underline">
            חזרה לדף הבית
          </Link>
          <Link href="/terms" className="text-accent hover:underline">
            תנאי שימוש
          </Link>
        </div>
      </div>
    </div>
  )
}