/**
 * GranPocket - Symptom Area Definitions (SRS INT-02)
 * Chips for symptom-area selection plus free-form "something else" path
 */

import type { SymptomArea } from '../types';

export const SYMPTOM_AREAS: SymptomArea[] = [
  {
    code: 'fever',
    label: 'Fever',
    labelZh: '发烧 / 体温高',
    labelMs: 'Demam',
    icon: 'Thermometer',
    ailmentCodes: ['fever'],
  },
  {
    code: 'breathing',
    label: 'Breathing / Cough',
    labelZh: '呼吸 / 咳嗽',
    labelMs: 'Pernafasan / Batuk',
    icon: 'Wind',
    ailmentCodes: ['breathing_difficulty', 'cough', 'chest_pain'],
  },
  {
    code: 'neuro',
    label: 'Confusion / Stroke Signs',
    labelZh: '神志模糊 / 中风前兆',
    labelMs: 'Kekeliruan / Tanda Strok',
    icon: 'HelpCircle',
    ailmentCodes: ['confusion_neuro'],
  },
  {
    code: 'dizziness',
    label: 'Dizziness / Fall',
    labelZh: '头晕 / 跌倒',
    labelMs: 'Pening / Jatuh',
    icon: 'RotateCcw',
    ailmentCodes: ['dizziness_fall', 'confusion_neuro'],
  },
  {
    code: 'pain',
    label: 'Pain / Chest / Stomach',
    labelZh: '疼痛（胸/腹/头）',
    labelMs: 'Kesakitan (Dada/Perut)',
    icon: 'Zap',
    ailmentCodes: ['chest_pain', 'abdominal_pain', 'headache', 'earache'],
  },
  {
    code: 'digestive',
    label: 'Vomiting / Diarrhoea',
    labelZh: '呕吐 / 腹泻',
    labelMs: 'Muntah / Cirit-birit',
    icon: 'Droplets',
    ailmentCodes: ['vomiting_diarrhea', 'abdominal_pain'],
  },
  {
    code: 'skin',
    label: 'Skin / Rash / Wound',
    labelZh: '皮肤 / 皮疹 / 伤口',
    labelMs: 'Kulit / Ruam / Luka',
    icon: 'Layers',
    ailmentCodes: ['rash', 'injury_wound'],
  },
  {
    code: 'eye',
    label: 'Eye / Ear / Throat',
    labelZh: '眼 / 耳 / 喉咙',
    labelMs: 'Mata / Telinga / Tekak',
    icon: 'Eye',
    ailmentCodes: ['eye_symptoms', 'earache', 'sore_throat'],
  },
  {
    code: 'injury',
    label: 'Injury / Trauma',
    labelZh: '外伤 / 撞伤',
    labelMs: 'Kecederaan / Trauma',
    icon: 'Scissors',
    ailmentCodes: ['injury_wound'],
  },
  {
    code: 'urinary',
    label: 'Urinary (UTI)',
    labelZh: '排尿异常 / 尿痛',
    labelMs: 'Kencing Sakit (UTI)',
    icon: 'Droplet',
    ailmentCodes: ['uti'],
  },
  {
    code: 'allergy',
    label: 'Allergic Reaction',
    labelZh: '过敏反应',
    labelMs: 'Tindak Balas Alahan',
    icon: 'AlertTriangle',
    ailmentCodes: ['allergic_reaction'],
  },
  {
    code: 'other',
    label: 'Something Else',
    labelZh: '其他身体不适',
    labelMs: 'Gejala Lain',
    icon: 'HelpCircle',
    ailmentCodes: [],
  },
];
