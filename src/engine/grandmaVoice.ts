/**
 * GranPocket - Grandma Persona & Copy (SRS §4.8 PER-01 to PER-04)
 * Warm, calm, reassuring voice. Empathy before advice.
 * Warmth must NEVER dilute urgency (PER-02).
 * Multilingual support for English, Chinese (中文), and Malay (Bahasa Melayu).
 */

import type { Severity, Person, Language } from '../types';
import { getAgeDisplay } from './triageEngine';

// ===== Greetings (SRS PER-01, INT-01) =====
export function getGreeting(person: Person, lang: Language = 'en'): string {
  const hour = new Date().getHours();
  const name = person.name;

  if (lang === 'zh') {
    if (hour < 12) {
      return `早上好，孩子。别担心，阿婆在这里陪着你和 ${name}。今天有什么地方觉得不舒服吗？`;
    } else if (hour < 18) {
      return `下午好，孩子。放宽心，我们一步一步来。告诉我 ${name} 遇到了什么状况？`;
    } else if (hour < 22) {
      return `晚上好，孩子。家里有人不舒服总让人悬着心。慢慢跟阿婆说，${name} 现在怎么了？`;
    } else {
      return `夜深了，阿婆一直都在。深呼吸，别慌张。告诉我 ${name} 现在有什么症状？`;
    }
  }

  if (lang === 'ms') {
    if (hour < 12) {
      return `Selamat pagi, sayang. Nenek ada di sini bersama kamu dan ${name}. Apa masalah kesihatan hari ini?`;
    } else if (hour < 18) {
      return `Selamat petang. Jangan risau ya, kita selesaikan sama-sama. Ceritakan apa yang berlaku pada ${name}?`;
    } else if (hour < 22) {
      return `Selamat malam. Nenek faham risaunya bila ahli keluarga tak sihat. Beritahu Nenek apa yang dialami ${name}?`;
    } else {
      return `Walaupun lewat malam, Nenek sentiasa ada di sini. Ceritakan kepada Nenek apa yang sedang dialami ${name}.`;
    }
  }

  // English default
  if (hour < 12) {
    return `Good morning, dear. I am here for you and ${name}. Take a breath — what seems to be troubling them today?`;
  } else if (hour < 18) {
    return `Good afternoon, dear. Don't worry, we will look after this together. Tell me what is happening with ${name}?`;
  } else if (hour < 22) {
    return `Good evening. I know it is always stressful when someone at home is unwell. Tell Grandma — what is going on with ${name}?`;
  } else {
    return `I am right here with you, even in the middle of the night. Take a steady breath. Tell me what you are seeing with ${name}.`;
  }
}

// ===== Who Is Unwell Prompt =====
export function getWhoIsUnwellPrompt(lang: Language = 'en'): string {
  if (lang === 'zh') {
    return '告诉阿婆，今天是谁身体不舒服？你可以选择自己，或是你正在照看的小孩或长辈。';
  }
  if (lang === 'ms') {
    return 'Beritahu Nenek, siapa yang berasa tidak sihat hari ini? Anda boleh pilih diri sendiri atau ahli keluarga.';
  }
  return 'Now tell Grandma — who is unwell? You can check for yourself, your little one, or an elder in the family.';
}

// ===== Symptom Prompt =====
export function getSymptomPrompt(person: Person, lang: Language = 'en'): string {
  const name = person.name;
  if (lang === 'zh') {
    return `告诉我 ${name} 现在怎么了。你可以用打字、按住麦克风说话，或者拍下伤口/药盒照片。或者直接点选下方的身体部位：`;
  }
  if (lang === 'ms') {
    return `Ceritakan apa yang dialami oleh ${name}. Anda boleh taip, guna suara, atau muat naik foto. Anda juga boleh pilih bahagian di bawah:`;
  }
  return `Tell me what is happening with ${name}. You can type, speak by voice, or share a photo of a rash, wound, or medicine box. You can also pick a symptom area below:`;
}

// ===== Confirmation Phrasing =====
export function getAilmentConfirmation(ailmentName: string, person: Person, lang: Language = 'en'): string {
  const name = person.name;
  if (lang === 'zh') {
    return `听起来像是 ${name} 遇到了【${ailmentName}】的情况。阿婆理解得对吗？若不对可以重新告诉我。`;
  }
  if (lang === 'ms') {
    return `Nampaknya ini berkaitan dengan [${ailmentName}] untuk ${name}. Adakah pemahaman Nenek tepat?`;
  }
  return `It sounds like this might be about ${ailmentName} for ${name}. Am I understanding that right, dear?`;
}

// ===== Question Introduction =====
export function getQuestionIntro(person: Person, lang: Language = 'en'): string {
  const name = person.name;
  if (lang === 'zh') {
    return `为了准确判断，阿婆需要问你几个简单的问题。请仔细看，很快就能评估好。`;
  }
  if (lang === 'ms') {
    return `Nenek akan tanya beberapa soalan ringkas untuk menilai keadaan ${name}. Ini hanya mengambil masa sekejap.`;
  }
  return `Grandma needs to ask just a few quick questions to assess ${name} safely. It will only take a minute or two, dear.`;
}

// ===== Result Phrasing (Urgency-Aware PER-02) =====
export function getResultPhrasing(severity: Severity, person: Person, lang: Language = 'en'): string {
  const name = person.name;
  const ageDisplay = getAgeDisplay(person.dob, lang);

  if (lang === 'zh') {
    switch (severity) {
      case 'RED':
        return `听阿婆说，这非常要紧！${name}（${ageDisplay}）现在需要立即紧急救助。千万不要拖延，请立刻按屏幕上方的按钮拨打 995 呼叫救护车。家庭住址和医疗备忘卡已经在屏幕上备好，你可以直接念给救护人员听。别害怕，立刻行动！`;
      case 'ORANGE':
        return `${name} 需要尽快看医生 — 请务必在接下来的几小时内前往诊所。虽然并非即刻致命，但绝不可拖到明天。阿婆已经在下方为你列出了最近的24小时急诊诊所与医疗机构。路上如果症状加重，立刻转拨 995。`;
      case 'YELLOW':
        return `放宽心，孩子，目前看这不属于紧急情况。不过 ${name} 还是应当在接下来的 1 到 3 天内由家庭医生或综合诊疗所（Polyclinic）医生把把脉。阿婆已经设置了随访提醒，会按时来过问情况。`;
      case 'GREEN':
        return `太好了，目前看 ${name} 的情况很平稳，在家细心照料即可。阿婆把家庭调理注意事项和观察要点写在下方了。别忘了多休息、多补水。阿婆稍后会再来询问情况。你把家里人照顾得很周到！`;
    }
  }

  if (lang === 'ms') {
    switch (severity) {
      case 'RED':
        return `Dengar sini baik-baik, anakku. ${name} (${ageDisplay}) perlukan bantuan kecemasan sekarang! Jangan tunggu lagi — sila dail 995 dengan segera. Alamat rumah sudah tersedia di skrin untuk dibacakan kepada operator 995. Bertindak sekarang!`;
      case 'ORANGE':
        return `${name} perlu berjumpa doktor segera — dalam masa beberapa jam ini. Jangan tunggu sehingga esok. Nenek telah senaraikan klinik 24 jam terdekat. Jika keadaan merosot, terus hubungi 995.`;
      case 'YELLOW':
        return `Alhamdulillah, ini bukan kecemasan. Namun ${name} perlu berjumpa doktor dalam tempoh 1 hingga 3 hari ini di Poliklinik atau klinik GP. Nenek akan hantar peringatan susulan nanti.`;
      case 'GREEN':
        return `Nenek gembira melihat keadaan ${name} boleh diuruskan di rumah buat masa ini. Nenek telah sediakan panduan penjagaan di bawah. Pastikan pesakit rehat dan minum secukupnya.`;
    }
  }

  // English default
  switch (severity) {
    case 'RED':
      return `Listen carefully, dear. ${name} (${ageDisplay}) needs emergency medical help right now. Please do not delay — tap the red button to call 995 immediately. I have placed your home address and emergency info card on the screen so you can read it directly to the 995 operator. You are doing the right thing by taking action immediately.`;
    case 'ORANGE':
      return `${name} needs to be seen by a doctor promptly — within the next few hours. While not a 995 siren emergency yet, please do not leave it until tomorrow. I have listed the nearest 24-hour clinics and urgent care centres below. If anything worsens before you reach the clinic, call 995 right away.`;
    case 'YELLOW':
      return `Good news, dear — this does not look like an emergency. But ${name} should still be examined by a doctor at a Polyclinic or GP within the next 1 to 3 days. I have noted down the clinic options and I will set a check-back reminder for you.`;
    case 'GREEN':
      return `I am glad to tell you that this looks manageable at home for now. I have set out simple home-care tips below, along with the warning signs to watch out for. I will check in with you in a little while to see how ${name} is progressing. You are taking great care of your family.`;
  }
}

// ===== Medication Duplicate Warning (SRS MED-04) =====
export function getDuplicateDoseWarning(
  medicine: string,
  lastGivenAtFormatted: string,
  minIntervalHours: number = 4,
  lang: Language = 'en'
): string {
  if (lang === 'zh') {
    return `等一等，孩子！系统显示【${medicine}】在 ${lastGivenAtFormatted} 才刚喂服过（安全间隔至少需要 ${minIntervalHours} 小时）。这么快再次给药可能会引起药物过量，伤害肝肾！请务必核对药盒标签或咨询医生。若经医生指示确需记录，方可继续。`;
  }
  if (lang === 'ms') {
    return `Tunggu sebentar! Ubat [${medicine}] baru sahaja diberikan pada ${lastGivenAtFormatted} (jarak selamat sekurang-kurangnya ${minIntervalHours} jam). Memberikan dos terlalu cepat boleh berbahaya! Sila semak dengan doktor atau ahli farmasi.`;
  }
  return `Hold on, dear! My records show that ${medicine} was already given at ${lastGivenAtFormatted} (the minimum safe interval is ${minIntervalHours} hours). Giving another dose so soon could risk an accidental overdose. Please double-check the label or consult a pharmacist before proceeding.`;
}

// ===== Wrong-Subject Reminder (SRS TRI-16) =====
export function getWrongSubjectReminder(person: Person, lang: Language = 'en'): string {
  const age = getAgeDisplay(person.dob, lang);
  if (lang === 'zh') {
    return `当前正在评估：${person.name}（${age}，${person.relationshipLabel}）`;
  }
  if (lang === 'ms') {
    return `Penilaian untuk: ${person.name} (${age}, ${person.relationshipLabel})`;
  }
  return `Currently assessing: ${person.name} (${age}, ${person.relationshipLabel})`;
}

// ===== Crisis Path Phrasing (SRS TRI-14) =====
export function getCrisisMessage(lang: Language = 'en'): string {
  if (lang === 'zh') {
    return `阿婆听到你心里的话了。请记住，你并不孤单，你的生命无比珍贵。如果你此时感到绝望、想伤害自己，请立即拨打以下24小时援助热线：

• 新加坡援人协会（SOS 24小时热线）：1-767 (或 WhatsApp 9151-1767)
• 关怀辅导中心（华语热线）：1800-353-5800
• 国家关怀热线（National Care Hotline）：1800-202-6844
• 若有迫切生命危险，请直接拨打：995

伸出手来，有人一直在等待帮助你度过难关。`;
  }
  if (lang === 'ms') {
    return `Nenek mendengar luahan hatimu. Ketahuilah bahawa kamu sangat bernilai dan tidak keseorangan. Jika anda mempunyai fikiran untuk mencederakan diri, sila hubungi talian bantuan 24 jam sekarang:

• Samaritans of Singapore (SOS): 1-767
• National Care Hotline: 1800-202-6844
• Talian Kecemasan: 995

Bantuan sentiasa ada untuk anda.`;
  }
  return `Grandma hears you, dear, and I want you to know that you are not alone and your life matters deeply. If you are having thoughts of self-harm, please reach out to someone who can help right away:

• Samaritans of Singapore (SOS 24/7): 1-767 (or WhatsApp 9151-1767)
• Care Corner Helpline: 1800-353-5800
• National Care Hotline: 1800-202-6844
• If in immediate danger: Call 995

Please stay safe. There are kind people waiting to listen and help you through this dark moment.`;
}

// ===== Disclaimer (SRS TRI-13) =====
export function getDisclaimer(lang: Language = 'en'): string {
  if (lang === 'zh') {
    return '免责声明：GranPocket 仅提供分诊指引与就医建议，不代表医学诊断或治疗方案。遇到紧急状况请立刻拨打 995。';
  }
  if (lang === 'ms') {
    return 'Penafian: GranPocket memberi panduan triaj sahaja, bukan diagnosis perubatan. Hubungi 995 dalam keadaan kecemasan.';
  }
  return 'Disclaimer: GranPocket provides triage guidance and care navigation only. It does not provide medical diagnosis or replace clinical judgment. When in doubt, call 995.';
}
