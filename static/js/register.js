(function(){ if(localStorage.getItem('est-theme') === 'light') document.documentElement.classList.add('light'); })();
function toggleTheme(){ const isLight = document.documentElement.classList.toggle('light'); localStorage.setItem('est-theme', isLight ? 'light' : 'dark'); }
const questions = {
  en: ['What was the name of your first school?','What is your mother\'s maiden name?','What city were you born in?','What is the name of your favorite teacher?','What was your first phone number?'],
  ar: ['ما اسم أول مدرسة التحقت بها؟','ما اسم عائلة والدتك قبل الزواج؟','في أي مدينة ولدت؟','ما اسم معلمك المفضل؟','ما هو أول رقم هاتف استخدمته؟']
};
const jobTitles = {
  en: ['QC Inspector','QC Supervisor','Lab Technician','Lab Supervisor','Lab Manager','Quality Assurance Specialist','Sample Coordinator','Lab Assistant','Data Entry','Technical Analyst','Warehouse Supervisor','Production Supervisor','Other'],
  ar: ['مفتش مراقبة الجودة','مشرف مراقبة الجودة','فني مختبر','مشرف مختبر','مدير مختبر','أخصائي ضمان الجودة','منسق العينات','مساعد مختبر','إدخال بيانات','محلل فني','مشرف مستودعات','مشرف إنتاج','أخرى']
};
const AUTH_LANG = {
  en:{lang:'عربي',back:'Back',topbar:'Registration',badge:'EST-iMs Access',heroTitle:'REGISTER',heroSub:'Send a new employee account request for admin approval.',c1t:'Account Details',c1:'Use a unique username and accurate contact information.',c2t:'Security Question',c2:'Choose a question you can answer later for password recovery.',formTitle:'Registration Details',fullName:'Full name',username:'Username',email:'Email',phone:'Phone',jobTitle:'Job title',gender:'Gender',birthDate:'Birth date',genderSelect:'Select',male:'Male',female:'Female',privacyText:'I agree to the <a href="/privacy" target="_blank">Privacy Policy</a> and <a href="/terms" target="_blank">Terms of Use</a>',successTitle:'Registration sent',successText:'Your request was sent successfully and is waiting for admin approval. You will be redirected to login.',password:'Password',confirmPassword:'Confirm password',securityQuestion:'Security question',securityAnswer:'Security answer',captcha:'Captcha',refresh:'Refresh',captchaHelp:'Solve the captcha to confirm the request is human.',submit:'Send request',loginBack:'Back to login',sending:'Sending...',captchaLoadError:'Could not load captcha',submitError:'Could not submit request',
    hintRequired:'This field is required',hintUsernameMin:'At least 5 characters',hintUsernameReserved:'This username is reserved',hintEmailInvalid:'Enter a valid email address',hintPasswordWeak:'Must contain letters and numbers',hintPasswordMismatch:'Passwords do not match'},
  ar:{lang:'English',back:'رجوع',topbar:'التسجيل',badge:'دخول EST-iMs',heroTitle:'التسجيل',heroSub:'إرسال طلب حساب موظف جديد بانتظار موافقة الأدمن.',c1t:'بيانات الحساب',c1:'استخدم اسم مستخدم فريد وبيانات اتصال دقيقة.',c2t:'السؤال الأمني',c2:'اختر سؤالاً تستطيع الإجابة عنه لاحقاً لاسترجاع كلمة المرور.',formTitle:'بيانات التسجيل',fullName:'الاسم الكامل',username:'اسم المستخدم',email:'الإيميل',phone:'الهاتف',jobTitle:'الوظيفة',gender:'الجنس',birthDate:'تاريخ الميلاد',genderSelect:'اختر',male:'ذكر',female:'أنثى',privacyText:'أوافق على <a href="/privacy" target="_blank">سياسة الخصوصية</a> و <a href="/terms" target="_blank">شروط الاستخدام</a>',successTitle:'تم إرسال التسجيل',successText:'تم إرسال طلبك بنجاح وهو بانتظار موافقة الأدمن. سيتم تحويلك إلى صفحة الدخول.',password:'كلمة المرور',confirmPassword:'تأكيد كلمة المرور',securityQuestion:'السؤال الأمني',securityAnswer:'إجابة السؤال الأمني',captcha:'كابتشا',refresh:'تحديث',captchaHelp:'حل الكابتشا للتأكد أن الطلب من شخص حقيقي.',submit:'إرسال الطلب',loginBack:'العودة للدخول',sending:'جاري الإرسال...',captchaLoadError:'تعذر تحميل الكابتشا',submitError:'تعذر إرسال الطلب',
    hintRequired:'هذا الحقل مطلوب',hintUsernameMin:'5 أحرف على الأقل',hintUsernameReserved:'اسم المستخدم محجوز',hintEmailInvalid:'أدخل بريداً إلكترونياً صحيحاً',hintPasswordWeak:'يجب أن تحتوي على أحرف وأرقام',hintPasswordMismatch:'كلمتا المرور غير متطابقتين'}
};
let authLang = localStorage.getItem('est-lang') || 'en';
function setText(id, value){ const el = document.getElementById(id); if (el) el.textContent = value; }
function applyAuthLang(lang){
  authLang = lang; localStorage.setItem('est-lang', lang);
  const t = AUTH_LANG[lang]; const isAr = lang === 'ar';
  document.documentElement.lang = lang; document.documentElement.dir = isAr ? 'rtl' : 'ltr';
  const dockLang = document.getElementById('langDockText'); if (dockLang) dockLang.textContent = isAr ? 'EN' : 'AR';
  const dockLabel = document.getElementById('langDockLabel'); if (dockLabel) dockLabel.textContent = lang === 'en' ? 'عربي' : 'English';
  setText('badgeText', t.badge); setText('heroTitle', t.heroTitle); setText('heroSub', t.heroSub);
  setText('card1Title', t.c1t); setText('card1Text', t.c1); setText('card2Title', t.c2t); setText('card2Text', t.c2); setText('formTitle', t.formTitle);
  setText('fullNameLabel', t.fullName); setText('usernameLabel', t.username); setText('emailLabel', t.email); setText('phoneLabel', t.phone); setText('jobTitleLabel', t.jobTitle); setText('genderLabel', t.gender); setText('birthDateLabel', t.birthDate); document.getElementById('privacyText').innerHTML = t.privacyText; setText('successTitle', t.successTitle); setText('successText', t.successText); setText('passwordLabel', t.password); setText('confirmPasswordLabel', t.confirmPassword); setText('securityQuestionLabel', t.securityQuestion); setText('securityAnswerLabel', t.securityAnswer); setText('captchaLabel', t.captcha); setText('captchaHelp', t.captchaHelp); setText('submitBtn', t.submit); setText('loginBackBtn', t.loginBack);
  const sel = document.getElementById('securityQuestion'); const current = sel.value; sel.innerHTML = ''; questions[lang].forEach(q => { const opt = document.createElement('option'); opt.value = q; opt.textContent = q; sel.appendChild(opt); }); if (questions[lang].includes(current)) sel.value = current;
  const genderEl = document.getElementById('gender'); if (genderEl) { genderEl.options[0].textContent = t.genderSelect; genderEl.options[1].textContent = t.male; genderEl.options[2].textContent = t.female; }
  const jobSel = document.getElementById('jobTitle'); if (jobSel) { const curJob = jobSel.value; jobSel.innerHTML = `<option value="">${t.genderSelect}</option>`; jobTitles[lang].forEach(j => { const o = document.createElement('option'); o.value = j; o.textContent = j; jobSel.appendChild(o); }); if (jobTitles[lang].includes(curJob)) jobSel.value = curJob; }
}
function toggleAuthLang(){ applyAuthLang(authLang === 'en' ? 'ar' : 'en'); }
function setStatus(msg, ok){ const box = document.getElementById('statusBox'); box.className = 'status ' + (ok ? 'ok' : 'err'); box.textContent = msg; }
function markInvalid(el){ if (el) el.classList.add('invalid'); }
function clearInvalid(){ document.querySelectorAll('.invalid').forEach(el => el.classList.remove('invalid')); }
function setHint(id, msg){ const el = document.getElementById(id); if (el) { el.textContent = msg; el.classList.toggle('err', !!msg); } }
function clearHints(){ document.querySelectorAll('.field-hint').forEach(el => { el.textContent = ''; el.classList.remove('err'); }); }
function validateRegisterForm(){
  clearHints(); clearInvalid();
  let ok = true;
  const t = AUTH_LANG[authLang];
  // Full name
  if (!fullName.value.trim()) { markInvalid(fullName); setHint('hintFullName', t.hintRequired); ok = false; }
  // Username
  const uname = username.value.trim();
  if (!uname) { markInvalid(username); setHint('hintUsername', t.hintRequired); ok = false; }
  else if (uname.length < 5) { markInvalid(username); setHint('hintUsername', t.hintUsernameMin); ok = false; }
  else if (['admin','administrator','dev','developer','root','superadmin'].includes(uname.toLowerCase())) { markInvalid(username); setHint('hintUsername', t.hintUsernameReserved); ok = false; }
  // Email
  const _emailDomains = new Set(['gmail.com','yahoo.com','hotmail.com','outlook.com','live.com','live.co.uk','icloud.com','me.com','mac.com','proton.me','protonmail.com','msn.com','aol.com','mail.com','yandex.com','yandex.ru','ymail.com','zoho.com','alestesharia.com.jo','alestesharia.com']);
  const _emailDomainOk2 = (e) => { const d = (e.split('@')[1] || '').toLowerCase(); return _emailDomains.has(d) || /\.(jo|edu|gov|org|net)$/.test(d); };
  if (!email.value.trim()) { markInvalid(email); setHint('hintEmail', t.hintRequired); ok = false; }
  else if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.value.trim()) || !_emailDomainOk2(email.value.trim())) { markInvalid(email); setHint('hintEmail', t.hintEmailInvalid); ok = false; }
  // Phone
  if (!phone.value.trim()) { markInvalid(phone); setHint('hintPhone', t.hintRequired); ok = false; }
  // Job title
  if (!jobTitle.value) { markInvalid(jobTitle); setHint('hintJobTitle', t.hintRequired); ok = false; }
  // Gender
  if (!gender.value) { markInvalid(gender); setHint('hintGender', t.hintRequired); ok = false; }
  // Birth date
  if (!birthDate.value) { markInvalid(birthDate); setHint('hintBirthDate', t.hintRequired); ok = false; }
  // Password
  const passOk = /[A-Za-z]/.test(password.value) && /\d/.test(password.value);
  if (!password.value) { markInvalid(password); setHint('hintPassword', t.hintRequired); ok = false; }
  else if (!passOk) { markInvalid(password); setHint('hintPassword', t.hintPasswordWeak); ok = false; }
  // Confirm password
  if (!confirmPassword.value) { markInvalid(confirmPassword); setHint('hintConfirmPassword', t.hintRequired); ok = false; }
  else if (password.value !== confirmPassword.value) { markInvalid(confirmPassword); setHint('hintConfirmPassword', t.hintPasswordMismatch); ok = false; }
  // Security answer
  if (!securityAnswer.value.trim()) { markInvalid(securityAnswer); setHint('hintSecurityAnswer', t.hintRequired); ok = false; }
  // Privacy
  if (!privacyAccepted.checked) { markInvalid(privacyAccepted); ok = false; }
  // reCAPTCHA
  const rcToken = typeof grecaptcha !== 'undefined' ? grecaptcha.getResponse() : '';
  if (!rcToken) { const wrap = document.getElementById('recaptchaWidget'); if (wrap) wrap.style.outline = '2px solid var(--danger, #ef4444)'; ok = false; }
  if (!ok) setStatus(t.submitError, false);
  return ok;
}
function showSuccessModal(){ const m = document.getElementById('successModal'); if(m) m.style.display = 'flex'; }
document.getElementById('registerForm').addEventListener('submit', async e => {
  e.preventDefault();
  clearInvalid();
  const wrap = document.getElementById('recaptchaWidget'); if (wrap) wrap.style.outline = '';
  if (!validateRegisterForm()) return;
  const recaptchaToken = typeof grecaptcha !== 'undefined' ? grecaptcha.getResponse() : '';
  const payload = { full_name: fullName.value.trim(), username: username.value.trim(), email: email.value.trim(), phone: phone.value.trim(), job_title: jobTitle.value.trim(), gender: gender.value, birth_date: birthDate.value, privacy_accepted: privacyAccepted.checked, password: password.value, confirm_password: confirmPassword.value, security_question: securityQuestion.value, security_answer: securityAnswer.value.trim(), recaptcha_token: recaptchaToken };
  const btn = document.getElementById('submitBtn'); btn.disabled = true; btn.textContent = AUTH_LANG[authLang].sending;
  const avatarFile = document.getElementById('avatarFile')?.files[0];
  try {
    let res, data;
    if (avatarFile) {
      const fd = new FormData();
      Object.entries(payload).forEach(([k, v]) => fd.append(k, v));
      fd.append('avatar', avatarFile);
      res = await fetch('/api/register', { method:'POST', body: fd });
    } else {
      res = await fetch('/api/register', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
    }
    data = await res.json();
    if(!res.ok || !data.success) throw new Error(data.message || AUTH_LANG[authLang].submitError);
    showSuccessModal(); e.target.reset();
    document.getElementById('avatarPreview').style.display = 'none';
    const ph = document.getElementById('avatarPlaceholderIcon'); if (ph) ph.style.display = '';
    document.getElementById('avatarFileName').textContent = 'No photo selected';
    applyAuthLang(authLang); setTimeout(() => window.location.href = '/login', 1800);
  }
  catch(err){
    setStatus(err.message || AUTH_LANG[authLang].submitError, false);
    if (typeof grecaptcha !== 'undefined') grecaptcha.reset();
  }
  finally { btn.disabled = false; btn.textContent = AUTH_LANG[authLang].submit; }
});
// ── Birth date bounds (18–80 years old) ──
(function setBirthDateBounds(){
  const el = document.getElementById('birthDate');
  if (!el) return;
  const today = new Date();
  const maxDate = new Date(today.getFullYear() - 18, today.getMonth(), today.getDate());
  const minDate = new Date(today.getFullYear() - 80, today.getMonth(), today.getDate());
  el.max = maxDate.toISOString().split('T')[0];
  el.min = minDate.toISOString().split('T')[0];
})();

// ── Avatar preview ──
document.getElementById('avatarFile').addEventListener('change', function(){
  const file = this.files[0];
  const preview = document.getElementById('avatarPreview');
  const placeholder = document.getElementById('avatarPlaceholderIcon');
  const label = document.getElementById('avatarFileName');
  if (file) {
    label.textContent = file.name;
    const reader = new FileReader();
    reader.onload = e => {
      preview.src = e.target.result;
      preview.style.display = 'block';
      if (placeholder) placeholder.style.display = 'none';
    };
    reader.readAsDataURL(file);
  }
});

applyAuthLang(authLang);
