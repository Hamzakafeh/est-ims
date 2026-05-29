(function(){
  if(localStorage.getItem('est-theme') === 'light') document.documentElement.classList.add('light');
  const lbl = document.getElementById('dockThemeLabel');
  if(lbl) lbl.textContent = document.documentElement.classList.contains('light') ? 'Dark Mode' : 'Light Mode';
})();
function toggleTheme(){
  const isLight = document.documentElement.classList.toggle('light');
  localStorage.setItem('est-theme', isLight ? 'light' : 'dark');
  const lbl = document.getElementById('dockThemeLabel');
  if(lbl) lbl.textContent = isLight ? 'Dark Mode' : 'Light Mode';
}
const questions = { en:['What was the name of your first school?','What is your mother\'s maiden name?','What city were you born in?','What is the name of your favorite teacher?','What was your first phone number?'], ar:['ما اسم أول مدرسة التحقت بها؟','ما اسم عائلة والدتك قبل الزواج؟','في أي مدينة ولدت؟','ما اسم معلمك المفضل؟','ما هو أول رقم هاتف استخدمته؟'] };
const AUTH_LANG = {
  en:{lang:'AR',back:'Back',topbar:'Password Recovery',badge:'EST-iMs Access',heroTitle:'RECOVERY',heroSub:'Verify your security answer, then set a new password.',c1t:'Verify Account',c1:'Use your username and the security question saved during registration.',c2t:'Reset Password',c2:'After verification, enter a new password and return to login.',verifyTitle:'Verify Account',username:'Username',oldPassword:'Old password',securityQuestion:'Security question',securityAnswer:'Security answer',verify:'Verify',loginBack:'Back to login',changeTitle:'Change Password',newPassword:'New password',confirmPassword:'Confirm new password',save:'Save password',verifyOk:'Verified successfully. Continue to the second step.',verifyError:'Could not verify account',saveOk:'Password changed successfully. You can login now.',saveError:'Could not save password'},
  ar:{lang:'EN',back:'رجوع',topbar:'استرجاع كلمة المرور',badge:'دخول EST-iMs',heroTitle:'استرجاع',heroSub:'تحقق من جوابك الأمني ثم أدخل كلمة مرور جديدة.',c1t:'التحقق من الحساب',c1:'استخدم اسم المستخدم والسؤال الأمني المحفوظ عند التسجيل.',c2t:'إعادة تعيين كلمة المرور',c2:'بعد التحقق أدخل كلمة مرور جديدة ثم ارجع لتسجيل الدخول.',verifyTitle:'التحقق من الحساب',username:'اسم المستخدم',oldPassword:'كلمة السر القديمة',securityQuestion:'السؤال الأمني',securityAnswer:'الجواب الأمني',verify:'تحقق',loginBack:'العودة للدخول',changeTitle:'تغيير كلمة المرور',newPassword:'كلمة المرور الجديدة',confirmPassword:'تأكيد كلمة المرور الجديدة',save:'حفظ كلمة المرور',verifyOk:'تم التحقق بنجاح. انتقل للمرحلة الثانية.',verifyError:'تعذر التحقق',saveOk:'تم تغيير كلمة المرور بنجاح. يمكنك تسجيل الدخول الآن.',saveError:'تعذر حفظ كلمة المرور'}
};
let authLang = localStorage.getItem('est-lang') || 'en';
function setText(id, value){ const el = document.getElementById(id); if (el) el.textContent = value; }
function applyAuthLang(lang){
  authLang = lang; localStorage.setItem('est-lang', lang);
  const t = AUTH_LANG[lang]; const isAr = lang === 'ar';
  document.documentElement.lang = lang; document.documentElement.dir = isAr ? 'rtl' : 'ltr';
  setText('langBtn', t.lang); const _dfl = document.getElementById('langDockLabel'); if(_dfl) _dfl.textContent = lang === 'en' ? 'عربي' : 'English'; setText('backText', t.back); setText('topbarTitle', t.topbar); setText('badgeText', t.badge); setText('heroTitle', t.heroTitle); setText('heroSub', t.heroSub); setText('card1Title', t.c1t); setText('card1Text', t.c1); setText('card2Title', t.c2t); setText('card2Text', t.c2); setText('verifyTitle', t.verifyTitle); setText('usernameLabel', t.username); setText('oldPasswordLabel', t.oldPassword); setText('securityQuestionLabel', t.securityQuestion); setText('securityAnswerLabel', t.securityAnswer); setText('verifyBtn', t.verify); setText('loginBackBtn', t.loginBack); setText('changeTitle', t.changeTitle); setText('newPasswordLabel', t.newPassword); setText('confirmPasswordLabel', t.confirmPassword); setText('saveBtn', t.save);
  const sel = document.getElementById('securityQuestion'); const current = sel.value; sel.innerHTML = ''; questions[lang].forEach(q => { const opt = document.createElement('option'); opt.value = q; opt.textContent = q; sel.appendChild(opt); }); if (questions[lang].includes(current)) sel.value = current;
}
function toggleAuthLang(){ applyAuthLang(authLang === 'en' ? 'ar' : 'en'); }
function setStatus(id, msg, ok){ const box = document.getElementById(id); box.className = 'status ' + (ok ? 'ok' : 'err'); box.textContent = msg; }
document.getElementById('verifyBtn').addEventListener('click', async () => {
  const rcToken = (typeof grecaptcha !== 'undefined' && document.getElementById('recaptchaWidgetFp'))
    ? grecaptcha.getResponse(grecaptcha.render ? undefined : 0)
    : '';
  const payload = { username: username.value.trim(), old_password: oldPassword.value, security_question: securityQuestion.value, security_answer: securityAnswer.value.trim(), recaptcha_token: rcToken };
  try {
    const res = await fetch('/api/password_reset/verify', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
    const data = await res.json();
    if(!res.ok || !data.success) throw new Error(data.message || AUTH_LANG[authLang].verifyError);
    setStatus('statusBox', AUTH_LANG[authLang].verifyOk, true);
    step2Box.classList.remove('hidden');
    step2Box.scrollIntoView({behavior:'smooth', block:'start'});
    if(typeof grecaptcha !== 'undefined') grecaptcha.reset();
  }
  catch(err){
    setStatus('statusBox', err.message || AUTH_LANG[authLang].verifyError, false);
    if(typeof grecaptcha !== 'undefined') grecaptcha.reset();
  }
});
document.getElementById('saveBtn').addEventListener('click', async () => {
  const payload = { new_password: newPassword.value, confirm_password: confirmPassword.value };
  try { const res = await fetch('/api/password_reset/complete', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) }); const data = await res.json(); if(!res.ok || !data.success) throw new Error(data.message || AUTH_LANG[authLang].saveError); setStatus('statusBox2', AUTH_LANG[authLang].saveOk, true); setTimeout(() => window.location.href = '/login', 1400); }
  catch(err){ setStatus('statusBox2', err.message || AUTH_LANG[authLang].saveError, false); }
});
applyAuthLang(authLang);
