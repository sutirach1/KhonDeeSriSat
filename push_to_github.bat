@echo off
chcp 65001 >nul
echo ========================================================
echo   ระบบนำแดชบอร์ดขึ้น GitHub ^& เปิดแชร์ออนไลน์ (GitHub Pages)
echo ========================================================
echo.
echo ขั้นตอน:
echo 1. เข้าเว็บ https://github.com/new แล้วสร้าง Repository ใหม่
echo 2. คัดลอก URL ของ Repository มาวางด้านล่าง
echo    (เช่น https://github.com/YOUR_USERNAME/YOUR_REPO.git)
echo.
set /p REPO_URL="วาง URL ของ Repository ที่นี่: "

if "%REPO_URL%"=="" (
    echo [!] ไม่ได้ระบุ URL ยกเลิกการทำงาน
    pause
    exit /b
)

echo.
echo กำลังเชื่อมต่อ Repository...
git remote remove origin 2>nul
git remote add origin %REPO_URL%
git branch -M main

echo กำลัง Push โค้ดขึ้น GitHub...
git push -u origin main

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================================
    echo   [SUCCESS] นำโค้ดขึ้น GitHub สำเร็จแล้ว!
    echo ========================================================
    echo.
    echo ขั้นตอนเปิดให้เพื่อนดูผ่านลิงก์ฟรี (GitHub Pages):
    echo 1. เข้าไปที่หน้า Repository ของคุณบน GitHub
    echo 2. กดที่เมนู [Settings] ด้านบน
    echo 3. เมนูด้านซ้ายเลือก [Pages]
    echo 4. ใต้หัวข้อ "Build and deployment":
    echo    - Source: เลือก "Deploy from a branch"
    echo    - Branch: เลือก "main" และโฟลเดอร์ "/(root)"
    echo    - กดปุ่ม [Save]
    echo 5. รอประมาณ 1-2 นาที คุณจะได้ลิงก์เว็บไซต์ เช่น:
    echo    https://YOUR_USERNAME.github.io/YOUR_REPO/
    echo    ส่งลิงก์นี้ให้เพื่อนเปิดดูแดชบอร์ดได้ทันที!
    echo ========================================================
) else (
    echo.
    echo [!] เกิดข้อผิดพลาดในการ Push โปรดตรวจสอบสิทธิ์การเข้าสู่ระบบ GitHub
)

echo.
pause
