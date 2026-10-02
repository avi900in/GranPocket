import { 
  Bot, 
  Code, 
  Globe,
  Sparkles,
  FileText,
  Lightbulb,
  Heart,
  Thermometer,
  Activity,
  AlertTriangle,
  Pill,
  Calendar,
  Building2,
  PhoneCall,
  ShieldCheck,
  Zap,
  Users
} from 'lucide-react';
import React from 'react';

// Icon 映射
export const ICON_MAP: Record<string, React.ElementType> = {
  Bot,
  Sparkles,
  Code,
  FileText,
  Globe,
  Lightbulb,
  Heart,
  Thermometer,
  Activity,
  AlertTriangle,
  Pill,
  Calendar,
  Building2,
  PhoneCall,
  ShieldCheck,
  Zap,
  Users,
};

export function getAvatarIcon(avatar?: string | null): string {
  if (!avatar) return '👤';
  if (avatar.startsWith('/icons/')) return avatar;
  
  const map: Record<string, string> = {
    '👦': '👶',
    '👶': '👶',
    '👨': '👤',
    '👴': '/icons/icon_grandpa.png',
    '👵': '/icons/icon_grandpa.png',
    '👩': '/icons/icon_helper.png',
    '🧕': '/icons/icon_helper.png',
    '👧': '/icons/icon_girl.png',
    '👤': '👤'
  };
  
  for (const [emoji, path] of Object.entries(map)) {
    if (avatar.includes(emoji)) return path;
  }
  
  return '👤';
}
