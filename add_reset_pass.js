const fs = require('fs');

let content = fs.readFileSync('app.js', 'utf8');

// 1. Update renderSimpleUsersList to include Reset Password button
const oldListPattern = /<button onclick="deleteMember\('\$\{u\.user\}'\)" style="background: rgba\(239,68,68,0\.05\); color: #ef4444; border: none; padding: 8px; border-radius: 10px; cursor: pointer; transition: all 0\.2s;">\s*<i class="fa-solid fa-trash-can"><\/i>\s*<\/button>/s;

const newListReplacement = `
                    <div style="display: flex; gap: 8px;">
                        <button onclick="resetUserPassword('\${u.user}')" style="background: rgba(99,102,241,0.05); color: #6366f1; border: none; padding: 8px; border-radius: 10px; cursor: pointer; transition: all 0.2s;" title="Parolni yangilash">
                            <i class="fa-solid fa-key"></i>
                        </button>
                        <button onclick="deleteMember('\${u.user}')" style="background: rgba(239,68,68,0.05); color: #ef4444; border: none; padding: 8px; border-radius: 10px; cursor: pointer; transition: all 0.2s;" title="O'chirish">
                            <i class="fa-solid fa-trash-can"></i>
                        </button>
                    </div>`;

content = content.replace(oldListPattern, newListReplacement);

// 2. Add resetUserPassword function after deleteMember function
const deleteMemberFuncEnd = /window\.deleteMember = async \(username\) => \{[\s\S]*?showCustomAlert\("O'chirishda xatolik yuz berdi"\);\s*\}\s*\};/s;

const resetPasswordFunc = `
window.resetUserPassword = async (username) => {
    const newPass = prompt(\`\${username} uchun yangi parolni kiriting:\`, "123456");
    if (!newPass) return;

    try {
        const response = await fetch(\`\${API_BASE}/update-password\`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, newPassword: newPass })
        });
        const result = await response.json();
        if (result.success) {
            showCustomAlert(\`\${username} paroli muvaffaqiyatli o'zgartirildi: \${newPass}\`);
        } else {
            showCustomAlert(result.message || "Xatolik yuz berdi");
        }
    } catch (err) {
        console.error("Failed to reset password", err);
        showCustomAlert("Server bilan bog'lanishda xato");
    }
};`;

content = content.replace(deleteMemberFuncEnd, match => match + '\n' + resetPasswordFunc);

fs.writeFileSync('app.js', content);
console.log('Password reset functionality added to app.js');
