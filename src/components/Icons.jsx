// Centralized icon component using lucide-react
// Maps app-specific icon names to lucide-react components

import {
  Sun, Moon, Search, Globe, Bot, Copy, ClipboardList, Pencil, Trash2, Star,
  Volume2, Lock, Plus, FileText, Link as LinkIcon, Undo2, Archive, Download,
  Upload, Palette, BarChart3, Folder, Mic, Pause, Square, Play, Loader,
  X, ChevronLeft, ChevronRight, ChevronDown, Settings, MessageSquare,
  Image as ImageIcon, Code, Bold, Italic, List, BookOpen, Zap, Heart,
  MessageCircle, Paperclip, SendHorizonal, StopCircle, ArrowDown,
  Check, AlertCircle, Info, File, FileType,
} from 'lucide-react';

export const Icons = {
  // Theme
  Sun, Moon,

  // Navigation
  Search, ChevronLeft, ChevronRight, ChevronDown,

  // Actions
  Copy, ClipboardList, Pencil, Trash2, Download, Upload, Plus,
  Send: SendHorizonal, Stop: StopCircle, ArrowDown,

  // Communication
  Globe, Bot, Mic, Volume2, MessageSquare, MessageCircle,

  // Files
  FileText, File, FileType, Folder, Image: ImageIcon, Paperclip,

  // Formatting
  Bold, Italic, Code, List, BookOpen, Link: LinkIcon,

  // Status
  Star, Lock, Check, AlertCircle, Info, Heart, Loader,
  Pause, Play, Square: Square, Zap,

  // Misc
  X, Undo2, Archive, Palette, BarChart3, Settings,
};

// Map emoji/label to icon component for dynamic usage
export function getIcon(name) {
  const iconMap = {
    sun: Sun, moon: Moon, search: Search, globe: Globe, bot: Bot,
    copy: Copy, pencil: Pencil, trash: Trash2, star: Star, starfilled: Star,
    volume2: Volume2, lock: Lock, plus: Plus, filetext: FileText, link: LinkIcon,
    undo: Undo2, archive: Archive, download: Download, upload: Upload,
    palette: Palette, chart: BarChart3, folder: Folder, mic: Mic,
    pause: Pause, stop: Square, play: Play, loader: Loader,
    x: X, chevronleft: ChevronLeft, chevronright: ChevronRight,
    settings: Settings, send: SendHorizonal, 'arrow-down': ArrowDown,
    bold: Bold, italic: Italic, code: Code, list: List,
  };

  const IconComponent = iconMap[name?.toLowerCase().replace(/\s+/g, '')];
  return IconComponent;
}

// Render an icon with consistent sizing
export default function Icon({ name, size = 16, className = '', style = {} }) {
  const Component = getIcon(name);
  if (!Component) return null;
  return <Component size={size} className={className} style={style} />;
}
