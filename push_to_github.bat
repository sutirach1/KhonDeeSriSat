@echo off
chcp 65001 >nul
echo ========================================================
echo   นำแดชบอร์ดขึ้น GitHub: https://github.com/sutirach1/KhonDeeSriSat
echo ========================================================
echo.
echo กำลังเชื่อมต่อ Repository และ Push โค้ด...
git remote remove origin 2>nul
git remote add origin https://github.com/sutirach1/KhonDeeSriSat.git
git branch -M main

echo.
echo กำลังส่งข้อมูลขึ้น GitHub...
echo (หากมีหน้าต่าง GitHub Login ขึ้นมา ให้กด Sign in with your browser ได้เลยครับ)
echo.

git push -u origin main

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================================
    echo   [SUCCESS] นำโค้ดขึ้น GitHub สำเร็จเรียบร้อยแล้ว!
    echo ========================================================
    echo.
    echo ขั้นตอนเปิดให้เพื่อนดูผ่านลิงก์ฟรี (GitHub Pages):
    echo 1. เข้าไปที่: https://github.com/sutirach1/KhonDeeSriSat/settings/pages
    echo 2. ใต้หัวข้อ "Build and deployment":
    echo    - Source: เลือก "Deploy from a branch"
    echo    - Branch: เลือก "main" และโฟลเดอร์ "/(root)"
    echo    - กดปุ่ม [Save]
    echo.
    echo 3. รอประมาณ 1-2 นาที คุณจะได้ลิงก์แดชบอร์ด:
    echo    https://sutirach1.github.io/KhonDeeSriSat/
    echo.
    echo    ส่งลิงก์นี้ให้เพื่อนเปิดดูแดชบอร์ดได้ทันที!
    echo ========================================================
) else (
    echo.
    echo [!] หาก Push ไม่สำเร็จ โปรดตรวจสอบการล็อกอิน GitHub ในหน้าต่างที่ปรากฏ
)

echo.
pause
