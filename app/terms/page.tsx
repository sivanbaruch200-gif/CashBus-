'use client'

import Link from 'next/link'

export default function TermsPage() {
  const lastUpdated = '22 בפברואר 2026'

  return (
    <div className="min-h-screen bg-surface-overlay py-8 px-4" dir="rtl">
      <div className="max-w-4xl mx-auto bg-surface-raised rounded-lg shadow-lg p-8">
        <h1 className="text-3xl font-bold text-content-primary mb-2">תנאי שימוש</h1>
        <p className="text-content-tertiary mb-8">עדכון אחרון: {lastUpdated}</p>

        {/* הקדמה */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-accent mb-4">1. הגדרות והקדמה</h2>
          <div className="text-content-secondary space-y-3">
            <p>
              <strong>&quot;CashBus&quot;</strong> או <strong>&quot;המערכת&quot;</strong> - פלטפורמה דיגיטלית לתיעוד אירועי
              תחבורה ציבורית ויצירת מכתבי דרישה לפיצוי.
            </p>
            <p>
              <strong>&quot;המשתמש&quot;</strong> או <strong>&quot;הלקוח&quot;</strong> - כל אדם הנרשם לשירות ומשתמש בו.
            </p>
            <p>
              <strong>&quot;מכתב דרישה&quot;</strong> - מסמך הנוצר על ידי המערכת על בסיס מידע שהמשתמש מזין,
              הנשלח לחברת התחבורה הציבורית בדרישה לפיצוי.
            </p>
            <p>
              <strong>&quot;פיצוי&quot;</strong> - כל תשלום כספי שהמשתמש מקבל מחברת תחבורה ציבורית
              בעקבות פנייה שנעשתה באמצעות המערכת.
            </p>
          </div>
        </section>

        {/* מהות השירות */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-accent mb-4">2. מהות השירות</h2>
          <div className="text-content-secondary space-y-3">
            <p>
              2.1 CashBus מספקת <strong>פלטפורמה טכנולוגית</strong> המאפשרת למשתמשים לתעד אירועי
              תחבורה ציבורית וליצור מכתבי דרישה על בסיס המידע שהם מזינים.
            </p>
            <p>
              2.2 המערכת <strong>אינה משרד עורכי דין</strong> ואינה מספקת ייעוץ משפטי.
              המסמכים נוצרים על ידי תבניות אוטומטיות בשילוב בינה מלאכותית,
              על בסיס המידע שהמשתמש מזין.
            </p>
            <p>
              2.3 <strong>המשתמש הוא זה שמאשר ושולח</strong> את מכתב הדרישה.
              המערכת משמשת ככלי עזר טכנולוגי בלבד.
            </p>
            <p>
              2.4 השירות אינו מהווה ייצוג משפטי, ואינו מהווה תחליף לייעוץ מעורך דין מוסמך.
            </p>
          </div>
        </section>

        {/* מודל התשלום - 80/20 */}
        <section className="mb-8 bg-accent-surface p-6 rounded-lg border border-accent-border">
          <h2 className="text-xl font-semibold text-accent mb-4">3. מודל התשלום - עמלת הצלחה</h2>
          <div className="text-content-secondary space-y-3">
            <p className="font-semibold text-lg">
              3.1 <strong>אין תשלום מראש.</strong> המשתמש לא משלם דבר עבור השימוש בשירות עד לקבלת פיצוי.
            </p>
            <p>
              3.2 <strong>חלוקת הפיצוי:</strong> במידה והמשתמש מקבל פיצוי כספי בעקבות פנייה שנעשתה
              באמצעות המערכת, הפיצוי יחולק באופן הבא:
            </p>
            <ul className="list-disc list-inside mr-4 space-y-2 bg-surface-raised p-4 rounded">
              <li><strong>80% - למשתמש</strong></li>
              <li><strong>20% - ל-CashBus</strong> (עמלת הצלחה)</li>
            </ul>
            <p>
              3.3 <strong>מנגנון התשלום:</strong> הפיצוי מחברת התחבורה יועבר לחשבון CashBus.
              לאחר קבלת הכספים, CashBus תעביר למשתמש את חלקו (80%) תוך 14 ימי עסקים
              לחשבון הבנק שמסר בעת ההרשמה.
            </p>
            <p>
              3.4 <strong>שקיפות מלאה:</strong> המשתמש יקבל הודעה על כל תשלום שהתקבל,
              כולל פירוט מלא של החישוב.
            </p>
          </div>
        </section>

        {/* התחייבות לדיווח */}
        <section className="mb-8 bg-status-rejected-surface p-6 rounded-lg border border-status-rejected/20">
          <h2 className="text-xl font-semibold text-status-rejected mb-4">4. חובת דיווח על פיצוי</h2>
          <div className="text-content-secondary space-y-3">
            <p>
              4.1 המשתמש <strong>מתחייב לדווח ל-CashBus באופן מיידי</strong> על כל פיצוי שקיבל
              מחברת תחבורה ציבורית בקשר לאירוע שתועד במערכת, בין אם הפיצוי התקבל ישירות
              ובין אם דרך צד שלישי.
            </p>
            <p>
              4.2 <strong>אזהרה:</strong> כל האירועים, הפניות והתכתובות מתועדים במערכת.
              אי-דיווח על פיצוי שהתקבל עלול להוות <strong>הפרת חוזה</strong> ולחייב את המשתמש
              בתשלום עמלת ההצלחה בתוספת פיצוי מוסכם.
            </p>
            <p>
              4.3 <strong>פיצוי מוסכם:</strong> במקרה של אי-דיווח מכוון על פיצוי שהתקבל,
              המשתמש מתחייב לשלם ל-CashBus את עמלת ההצלחה (20%) בתוספת
              <strong> 500 ש&quot;ח פיצוי מוסכם</strong> עבור הפרת חובת הדיווח.
            </p>
          </div>
        </section>

        {/* אחריות המשתמש */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-accent mb-4">5. אחריות המשתמש</h2>
          <div className="text-content-secondary space-y-3">
            <p>
              5.1 המשתמש מתחייב <strong>למסור מידע מדויק ואמיתי</strong> בלבד.
              מסירת מידע כוזב עלולה להוות עבירה פלילית.
            </p>
            <p>
              5.2 המשתמש <strong>אחראי באופן בלעדי</strong> לתוכן מכתבי הדרישה שנשלחים בשמו,
              לרבות הפרטים האישיים ותיאור האירועים שמסר. הסכום הנתבע, ככל שיכלל, ייקבע על ידי המשתמש בעת הגשת תביעה בפועל.
            </p>
            <p>
              5.3 המשתמש מאשר כי <strong>בדק ואישר</strong> את תוכן מכתב הדרישה
              לפני שליחתו לחברת התחבורה.
            </p>
            <p>
              5.4 המשתמש מבין שמכתב הדרישה נשלח <strong>מטעמו ובשמו</strong>,
              לא מטעם CashBus.
            </p>
          </div>
        </section>

        {/* הגבלת אחריות */}
        <section className="mb-8 bg-surface-overlay p-6 rounded-lg">
          <h2 className="text-xl font-semibold text-content-secondary mb-4">6. הגבלת אחריות</h2>
          <div className="text-content-secondary space-y-3">
            <p>
              6.1 CashBus <strong>אינה מתחייבת להצלחת הפנייה</strong> או לקבלת פיצוי כלשהו.
              ההחלטה על מתן פיצוי נתונה לחברת התחבורה או לבית המשפט.
            </p>
            <p>
              6.2 CashBus <strong>אינה אחראית לנזקים ישירים או עקיפים</strong> שעלולים להיגרם
              למשתמש כתוצאה משימוש בשירות, לרבות אובדן הכנסה, פגיעה במוניטין, או כל נזק אחר.
            </p>
            <p>
              6.3 <strong>אחריות מקסימלית:</strong> בכל מקרה, אחריות CashBus לא תעלה על סכום
              עמלת ההצלחה ששולמה על ידי המשתמש בגין אותה תביעה.
            </p>
            <p>
              6.4 CashBus אינה אחראית לשיבושים טכניים, זמני השבתה, או אובדן מידע.
            </p>
          </div>
        </section>

        {/* נתונים וראיות */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-accent mb-4">7. נתוני GPS וראיות דיגיטליות</h2>
          <div className="text-content-secondary space-y-3">
            <p>
              7.1 המערכת אוספת נתוני GPS מהמכשיר הנייד של המשתמש לצורך תיעוד מיקום האירוע.
            </p>
            <p>
              7.2 נתונים אלה <strong>משמשים כראיה תומכת</strong> בלבד, ואינם מהווים בהכרח
              ראיה קבילה בבית המשפט ללא אימות נוסף.
            </p>
            <p>
              7.3 המשתמש מסכים לשמירת נתוני המיקום במערכת לצורך תיעוד האירועים.
            </p>
            <p>
              7.4 <strong>חתימה דיגיטלית:</strong> המשתמש מאשר את הדיווחים שלו באמצעות
              לחיצה על כפתור האישור, המהווה חתימה אלקטרונית בהתאם ל<strong>חוק חתימה
              אלקטרונית, תשס&quot;א-2001</strong>.
            </p>
            <p>
              7.5 <strong>הגנת הפרטיות:</strong> איסוף ושמירת נתוני GPS ומידע אישי נעשים
              בהתאם ל<strong>חוק הגנת הפרטיות, תשמ&quot;א-1981</strong>
              ותקנות הגנת הפרטיות (אבטחת מידע), תשע&quot;ז-2017. המשתמש רשאי לבקש
              עיון, תיקון, או מחיקת מידע אישי בכל עת.
            </p>
          </div>
        </section>

        {/* קטינים */}
        <section className="mb-8 bg-status-pending-surface p-6 rounded-lg border border-status-pending/20">
          <h2 className="text-xl font-semibold text-status-pending mb-4">8. קטינים (מתחת לגיל 18)</h2>
          <div className="text-content-secondary space-y-3">
            <p>
              8.1 <strong>ילדים מתחת לגיל 13 אינם רשאים להשתמש בשירות.</strong> הגבלה זו נובעת
              מהנחיות הרשות להגנת הפרטיות (ILITA) בנוגע לאיסוף נתוני מיקום GPS ומידע אישי של ילדים.
            </p>
            <p>
              8.2 משתמשים בגילאי <strong>13–17</strong> חייבים לקבל הסכמה מפורשת בכתב של הורה
              או אפוטרופוס לפני השימוש בשירות, בהתאם ל<strong>חוק הכשרות המשפטית והאפוטרופסות,
              תשכ&quot;ב-1962</strong>, לפיו קטין אינו בעל כשרות משפטית מלאה לכריתת חוזים.
            </p>
            <p>
              8.3 הסכמת ההורה תכלול: שם ההורה, מספר ת.ז., אישור על קריאת תנאי השימוש,
              והסכמה מפורשת למודל עמלת ההצלחה (80/20) שיחול גם על פעולות הקטין.
              הסכמה זו תישמר במערכת ותהווה תיעוד חוזי מחייב.
            </p>
            <p>
              8.4 הורה או אפוטרופוס של קטין המאשר את ההרשמה <strong>נושא באחריות מלאה ובלעדית</strong>
              לכל פעולות הקטין במערכת: דיווח על אירועים, קבלת פיצויים, וחובת העברת עמלת ההצלחה ל-CashBus.
              פעולות הקטין מחייבות את ההורה/אפוטרופוס כמייצגו החוקי.
            </p>
            <p>
              8.5 CashBus שומרת לעצמה את הזכות לבקש אימות גיל, ת.ז. ההורה, ואישור בכתב בכל שלב.
              חשבון שלא עמד בדרישות אימות הגיל יושעה עד להשלמת האימות.
            </p>
          </div>
        </section>

        {/* יישוב מחלוקות */}
        <section className="mb-8 bg-surface-overlay p-6 rounded-lg">
          <h2 className="text-xl font-semibold text-content-secondary mb-4">9. יישוב מחלוקות בנוגע לפיצוי</h2>
          <div className="text-content-secondary space-y-3">
            <p>
              9.1 <strong>תיעוד כספי:</strong> CashBus תשמור תיעוד מלא של כל תקבול שיועבר לחשבונה.
              המשתמש יקבל הודעה מיידית עם קבלת כל תשלום מחברת התחבורה.
            </p>
            <p>
              9.2 <strong>מחלוקת על סכום:</strong> במידה והמשתמש חולק על הסכום שדווח כפיצוי,
              עליו להודיע ל-CashBus תוך 14 ימים מיום קבלת ההודעה. CashBus תספק תיעוד מלא של הסכום שהתקבל.
            </p>
            <p>
              9.3 <strong>פיצוי ישיר ללא ידיעת CashBus:</strong> אם חברת התחבורה העבירה פיצוי
              ישירות למשתמש, על המשתמש לדווח על כך <strong>תוך 7 ימים</strong> ולהעביר ל-CashBus
              את חלקה (20%). אי-עמידה בתנאי זה תיחשב הפרת חוזה (ראה סעיף 4).
            </p>
          </div>
        </section>

        {/* איחוד תביעות */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-accent mb-4">10. טיפול בדיווחים</h2>
          <div className="text-content-secondary space-y-3">
            <p>
              10.1 <strong>כל דיווח = מכתב דרישה נפרד.</strong> כל אירוע שמדווח במערכת
              מטופל בנפרד ונשלח כמכתב דרישה עצמאי לחברת התחבורה.
            </p>
            <p>
              10.2 <strong>עמלת הצלחה לכל פיצוי:</strong> עמלת ההצלחה (20%) תחושב מכל
              פיצוי שהתקבל בנפרד.
            </p>
            <p>
              10.3 המערכת שומרת על פשטות - <strong>אירוע אחד = תביעה אחת</strong>.
            </p>
          </div>
        </section>

        {/* ביטול והפסקת שימוש */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-accent mb-4">11. ביטול והפסקת שימוש</h2>
          <div className="text-content-secondary space-y-3">
            <p>
              11.1 המשתמש רשאי להפסיק את השימוש בשירות בכל עת.
            </p>
            <p>
              11.2 <strong>חשוב:</strong> הפסקת השימוש אינה פוטרת מחובת תשלום עמלת הצלחה
              על פיצויים שהתקבלו בעקבות פניות שנעשו באמצעות המערכת, גם לאחר הביטול.
            </p>
            <p>
              11.3 CashBus שומרת לעצמה את הזכות לחסום או להשעות משתמש שמפר את תנאי השימוש.
            </p>
          </div>
        </section>

        {/* זכות ביטול - מינוי */}
        <section className="mb-8 bg-accent-surface p-6 rounded-lg border border-accent-border">
          <h2 className="text-xl font-semibold text-accent mb-4">11א. זכות ביטול מינוי</h2>
          <div className="text-content-secondary space-y-3">
            <p>
              11א.1 <strong>מינוי בתשלום:</strong> בהתאם ל<strong>חוק הגנת הצרכן, תשמ&quot;א-1981</strong>
              ותקנות הגנת הצרכן (ביטול עסקה), תשע&quot;א-2010, המשתמש רשאי לבטל עסקת מינוי
              תוך <strong>14 ימים</strong> ממועד הרכישה או מיום קבלת מסמכי העסקה, לפי המאוחר.
            </p>
            <p>
              11א.2 <strong>ביטול שלא בתוך 14 יום</strong> — ניתן לבטל מינוי בכל עת; לא יינתן
              החזר יחסי על החלק שנוצל, אלא אם נקבע אחרת בתנאי המינוי הספציפי.
            </p>
            <p>
              11א.3 <strong>עמלת הצלחה — אינה ניתנת לביטול</strong> לאחר קבלת הפיצוי מחברת
              התחבורה. עמלת ההצלחה (20%) חלה על כל פיצוי שהתקבל, ללא קשר לסטטוס המינוי.
            </p>
            <p>
              11א.4 לביטול מינוי יש לפנות לכתובת: <strong>cash.bus200@gmail.com</strong> עם
              פרטי המשתמש ומספר הזמנה.
            </p>
          </div>
        </section>

        {/* שינויים בתנאים */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-accent mb-4">12. שינויים בתנאי השימוש</h2>
          <div className="text-content-secondary space-y-3">
            <p>
              12.1 CashBus שומרת לעצמה את הזכות לעדכן תנאים אלה מעת לעת.
            </p>
            <p>
              12.2 שינויים מהותיים יפורסמו באתר ו/או יישלחו למשתמשים בדוא&quot;ל.
            </p>
            <p>
              12.3 המשך השימוש בשירות לאחר פרסום שינויים מהווה הסכמה לתנאים המעודכנים.
            </p>
          </div>
        </section>

        {/* דין וסמכות שיפוט */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-accent mb-4">13. דין וסמכות שיפוט</h2>
          <div className="text-content-secondary space-y-3">
            <p>
              13.1 תנאי שימוש אלה כפופים <strong>לחוקי מדינת ישראל</strong> בלבד.
            </p>
            <p>
              13.2 סמכות השיפוט הבלעדית בכל סכסוך הנובע מתנאים אלה נתונה
              <strong> לבתי המשפט המוסמכים בישראל</strong>.
            </p>
          </div>
        </section>

        {/* יצירת קשר */}
        <section className="mb-8 bg-accent-surface p-6 rounded-lg border border-accent-border">
          <h2 className="text-xl font-semibold text-accent mb-4">14. יצירת קשר</h2>
          <div className="text-content-secondary space-y-3">
            <p>
              לשאלות בנוגע לתנאי שימוש אלה, ניתן לפנות אלינו:
            </p>
            <ul className="list-disc list-inside mr-4 space-y-2">
              <li>דוא&quot;ל: cash.bus200@gmail.com</li>
              <li>טלפון: *2992</li>
            </ul>
            <p className="text-xs text-content-tertiary mt-4">
              CashBus מנהלת מאגר מידע הכולל נתוני משתמשים, אירועים ותיעוד GPS.
              בהתאם ל<strong>חוק הגנת הפרטיות, תשמ&quot;א-1981</strong>, המשתמש רשאי
              לעיין במידע הנוגע לו ולדרוש תיקונו. פניות בנושא פרטיות יופנו לכתובת הדוא&quot;ל לעיל.
            </p>
          </div>
        </section>

        {/* הצהרת הסכמה */}
        <section className="mb-8 bg-status-approved-surface p-6 rounded-lg border border-status-approved/20">
          <h2 className="text-xl font-semibold text-status-approved mb-4">הצהרת הסכמה</h2>
          <div className="text-content-secondary space-y-3">
            <p className="font-semibold">
              בשימוש בשירותי CashBus, אני מאשר/ת כי:
            </p>
            <ul className="list-disc list-inside mr-4 space-y-2">
              <li>קראתי והבנתי את תנאי השימוש</li>
              <li>אני מסכים/ה למודל עמלת ההצלחה (80/20)</li>
              <li>אני מתחייב/ת לדווח על כל פיצוי שאקבל</li>
              <li>אני מבין/ה שהשירות אינו ייעוץ משפטי</li>
              <li>אני מאשר/ת כי אני מעל גיל 18 או קיבלתי הסכמת הורה</li>
              <li>המידע שאמסור יהיה מדויק ואמיתי</li>
            </ul>
          </div>
        </section>

        {/* לינקים */}
        <div className="flex gap-4 mt-8 pt-4 border-t border-surface-border">
          <Link href="/" className="text-accent hover:underline">
            חזרה לדף הבית
          </Link>
          <Link href="/privacy" className="text-accent hover:underline">
            מדיניות פרטיות
          </Link>
        </div>
      </div>
    </div>
  )
}