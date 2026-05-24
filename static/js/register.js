(function(){ if(localStorage.getItem('est-theme') === 'light') document.documentElement.classList.add('light'); })();
function toggleTheme(){ const isLight = document.documentElement.classList.toggle('light'); localStorage.setItem('est-theme', isLight ? 'light' : 'dark'); }
const questions = {
  en: ['What was the name of your first school?','What is your mother\'s maiden name?','What city were you born in?','What is the name of your favorite teacher?','What was your first phone number?'],
  ar: ['ما اسم أول مدرسة التحقت بها؟','ما اسم عائلة والدتك قبل الزواج؟','في أي مدينة ولدت؟','ما اسم معلمك المفضل؟','ما هو أول رقم هاتف استخدمته؟']
};
const AUTH_LANG = {
  en:{lang:'عربي',back:'Back',topbar:'Registration',badge:'EST-iMs Access',heroTitle:'REGISTER',heroSub:'Send a new employee account request for admin approval.',c1t:'Account Details',c1:'Use a unique username and accurate contact information.',c2t:'Security Question',c2:'Choose a question you can answer later for password recovery.',formTitle:'Registration Details',fullName:'Full name',username:'Username',email:'Email',phone:'Phone',jobTitle:'Job title',gender:'Gender',birthDate:'Birth date',genderSelect:'Select',male:'Male',female:'Female',privacyText:'I agree to the <a href="/privacy" target="_blank">Privacy Policy</a> and <a href="/terms" target="_blank">Terms of Use</a>',successTitle:'Registration sent',successText:'Your request was sent successfully and is waiting for admin approval. You will be redirected to login.',password:'Password',confirmPassword:'Confirm password',securityQuestion:'Security question',securityAnswer:'Security answer',captcha:'Captcha',refresh:'Refresh',captchaHelp:'Solve the captcha to confirm the request is human.',submit:'Send request',loginBack:'Back to login',sending:'Sending...',captchaLoadError:'Could not load captcha',submitError:'Could not submit request'},
  ar:{lang:'English',back:'رجوع',topbar:'التسجيل',badge:'دخول EST-iMs',heroTitle:'التسجيل',heroSub:'إرسال طلب حساب موظف جديد بانتظار موافقة الأدمن.',c1t:'بيانات الحساب',c1:'استخدم اسم مستخدم فريد وبيانات اتصال دقيقة.',c2t:'السؤال الأمني',c2:'اختر سؤالاً تستطيع الإجابة عنه لاحقاً لاسترجاع كلمة المرور.',formTitle:'بيانات التسجيل',fullName:'الاسم الكامل',username:'اسم المستخدم',email:'الإيميل',phone:'الهاتف',jobTitle:'الوظيفة',gender:'الجنس',birthDate:'تاريخ الميلاد',genderSelect:'اختر',male:'ذكر',female:'أنثى',privacyText:'أوافق على <a href="/privacy" target="_blank">سياسة الخصوصية</a> و <a href="/terms" target="_blank">شروط الاستخدام</a>',successTitle:'تم إرسال التسجيل',successText:'تم إرسال طلبك بنجاح وهو بانتظار موافقة الأدمن. سيتم تحويلك إلى صفحة الدخول.',password:'كلمة المرور',confirmPassword:'تأكيد كلمة المرور',securityQuestion:'السؤال الأمني',securityAnswer:'إجابة السؤال الأمني',captcha:'كابتشا',refresh:'تحديث',captchaHelp:'حل الكابتشا للتأكد أن الطلب من شخص حقيقي.',submit:'إرسال الطلب',loginBack:'العودة للدخول',sending:'جاري الإرسال...',captchaLoadError:'تعذر تحميل الكابتشا',submitError:'تعذر إرسال الطلب'}
};
let authLang = localStorage.getItem('est-lang') || 'en';
let captchaToken = '';
function setText(id, value){ const el = document.getElementById(id); if (el) el.textContent = value; }
function applyAuthLang(lang){
  authLang = lang; localStorage.setItem('est-lang', lang);
  const t = AUTH_LANG[lang]; const isAr = lang === 'ar';
  document.documentElement.lang = lang; document.documentElement.dir = isAr ? 'rtl' : 'ltr';
  setText('langBtn', t.lang); setText('backText', t.back); setText('topbarTitle', t.topbar); setText('badgeText', t.badge); setText('heroTitle', t.heroTitle); setText('heroSub', t.heroSub);
  setText('card1Title', t.c1t); setText('card1Text', t.c1); setText('card2Title', t.c2t); setText('card2Text', t.c2); setText('formTitle', t.formTitle);
  setText('fullNameLabel', t.fullName); setText('usernameLabel', t.username); setText('emailLabel', t.email); setText('phoneLabel', t.phone); setText('jobTitleLabel', t.jobTitle); setText('genderLabel', t.gender); setText('birthDateLabel', t.birthDate); document.getElementById('privacyText').innerHTML = t.privacyText; setText('successTitle', t.successTitle); setText('successText', t.successText); setText('passwordLabel', t.password); setText('confirmPasswordLabel', t.confirmPassword); setText('securityQuestionLabel', t.securityQuestion); setText('securityAnswerLabel', t.securityAnswer); setText('captchaLabel', t.captcha); setText('reloadCaptchaBtn', t.refresh); setText('captchaHelp', t.captchaHelp); setText('submitBtn', t.submit); setText('loginBackBtn', t.loginBack);
  const sel = document.getElementById('securityQuestion'); const current = sel.value; sel.innerHTML = ''; questions[lang].forEach(q => { const opt = document.createElement('option'); opt.value = q; opt.textContent = q; sel.appendChild(opt); }); if (questions[lang].includes(current)) sel.value = current; const genderEl = document.getElementById('gender'); if (genderEl) { genderEl.options[0].textContent = t.genderSelect; genderEl.options[1].textContent = t.male; genderEl.options[2].textContent = t.female; }
}
function toggleAuthLang(){ applyAuthLang(authLang === 'en' ? 'ar' : 'en'); }
async function loadCaptcha(){ const res = await fetch('/api/captcha', {cache:'no-store'}); const data = await res.json(); captchaToken = data.token || ''; document.getElementById('captchaQuestion').textContent = data.question || '...'; }
function setStatus(msg, ok){ const box = document.getElementById('statusBox'); box.className = 'status ' + (ok ? 'ok' : 'err'); box.textContent = msg; }
function markInvalid(el){ if (el) el.classList.add('invalid'); }
function clearInvalid(){ document.querySelectorAll('.invalid').forEach(el => el.classList.remove('invalid')); }
function validateRegisterForm(){
  let ok = true;
  const emailOk = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.value.trim());
  const passOk = /[A-Za-z]/.test(password.value) && /\d/.test(password.value);
  const checks = [fullName, username, email, phone, jobTitle, gender, birthDate, password, confirmPassword, securityAnswer, captchaAnswer];
  checks.forEach(el => { if (!String(el.value || '').trim()) { markInvalid(el); ok = false; } });
  if (username.value.trim().length < 5 || ['admin','administrator','dev','developer','root','superadmin'].includes(username.value.trim().toLowerCase())) { markInvalid(username); ok = false; }
  if (!emailOk) { markInvalid(email); ok = false; }
  if (!passOk || password.value !== confirmPassword.value) { markInvalid(password); markInvalid(confirmPassword); ok = false; }
  if (!privacyAccepted.checked) { markInvalid(privacyAccepted); ok = false; }
  if (!ok) setStatus(AUTH_LANG[authLang].submitError, false);
  return ok;
}
function showSuccessModal(){ document.getElementById('successModal')?.classList.add('open'); }
document.getElementById('reloadCaptchaBtn').addEventListener('click', loadCaptcha);
document.getElementById('registerForm').addEventListener('submit', async e => {
  e.preventDefault();
  clearInvalid(); if (!validateRegisterForm()) return; const payload = { full_name: fullName.value.trim(), username: username.value.trim(), email: email.value.trim(), phone: phone.value.trim(), job_title: jobTitle.value.trim(), gender: gender.value, birth_date: birthDate.value, privacy_accepted: privacyAccepted.checked, password: password.value, confirm_password: confirmPassword.value, security_question: securityQuestion.value, security_answer: securityAnswer.value.trim(), captcha_answer: captchaAnswer.value.trim(), captcha_token: captchaToken };
  const btn = document.getElementById('submitBtn'); btn.disabled = true; btn.textContent = AUTH_LANG[authLang].sending;
  try { const res = await fetch('/api/register', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) }); const data = await res.json(); if(!res.ok || !data.success) throw new Error(data.message || AUTH_LANG[authLang].submitError); showSuccessModal(); e.target.reset(); applyAuthLang(authLang); await loadCaptcha(); setTimeout(() => window.location.href = '/login', 1800); }
  catch(err){ setStatus(err.message || AUTH_LANG[authLang].submitError, false); await loadCaptcha().catch(()=>{}); }
  finally { btn.disabled = false; btn.textContent = AUTH_LANG[authLang].submit; }
});
applyAuthLang(authLang); loadCaptcha().catch(() => setStatus(AUTH_LANG[authLang].captchaLoadError, false));
