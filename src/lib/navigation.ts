import type { Component } from 'vue'
import {
  BookOpen,
  Briefcase,
  Database,
  FileStack,
  GitBranch,
  KeyRound,
  LayoutDashboard,
  ListTree,
  MessageSquare,
  Settings2,
  ShieldCheck,
  User,
  UserCog,
  UserPlus,
  Users,
} from '@lucide/vue'

export interface NavigationItem {
  label: string
  to: string
  icon: Component
  relatedPaths?: string[]
}

export interface NavigationGroup {
  label: string
  items: NavigationItem[]
}

export const operationalNavigation: NavigationGroup[] = [
  {
    label: 'Mulai',
    items: [{ label: 'Panduan penggunaan', to: '/guide', icon: BookOpen }],
  },
  {
    label: 'Analitik',
    items: [
      { label: 'Dashboard', to: '/dashboard', icon: LayoutDashboard },
      { label: 'Chat data', to: '/chat', icon: MessageSquare },
    ],
  },
  {
    label: 'Operasional data',
    items: [
      {
        label: 'Workspace ETL',
        to: '/workspace',
        icon: Briefcase,
        relatedPaths: ['/configurations', '/sources'],
      },
      { label: 'Batch import', to: '/import-reviews', icon: FileStack },
      { label: 'Persetujuan tayang', to: '/release-approvals', icon: ShieldCheck },
      { label: 'Job & ETL', to: '/jobs', icon: GitBranch },
      { label: 'Kualitas data', to: '/quality', icon: ShieldCheck },
    ],
  },
  {
    label: 'Referensi & tata kelola',
    items: [
      { label: 'Registry master', to: '/masters', icon: Database },
      { label: 'Taxonomy', to: '/taxonomies', icon: ListTree },
      { label: 'Governance', to: '/governance', icon: Settings2 },
    ],
  },
]

export const administrationNavigation: NavigationItem[] = [
  { label: 'Administrasi', to: '/admin', icon: UserCog },
  { label: 'Pengguna', to: '/admin/users', icon: Users },
  { label: 'Registrasi', to: '/register', icon: UserPlus, relatedPaths: ['/admin/users/new'] },
]

export const accountNavigation: NavigationItem[] = [
  { label: 'Akun', to: '/account', icon: User },
  { label: 'Permintaan akses', to: '/access-requests', icon: KeyRound },
]

export function activeNavigationPath(path: string): string | undefined {
  const items = [
    ...operationalNavigation.flatMap((group) => group.items),
    ...administrationNavigation,
    ...accountNavigation,
  ]
  return items
    .flatMap((item) => [item.to, ...(item.relatedPaths || [])].map((prefix) => ({ item, prefix })))
    .filter(({ prefix }) => path === prefix || path.startsWith(`${prefix}/`))
    .sort((a, b) => b.prefix.length - a.prefix.length)[0]?.item.to
}
