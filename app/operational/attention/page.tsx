import { requireRole } from '@/lib/auth'
import DashboardShell from '@/app/components/dashboard-shell'
import PageHeader from '@/app/components/page-header'
import AttentionBoard from '@/app/components/attention-board'

export const dynamic = 'force-dynamic'

export default async function OperationalAttentionPage() {
  const user = await requireRole(['operational'])

  return (
    <DashboardShell user={user}>
      <PageHeader
        title="Perlu Perhatian"
        subtitle="Hanya unit yang menyimpang. Kalau semua kosong, semua trip berjalan normal. Diperbarui tiap menit."
      />
      <AttentionBoard base="/operational" />
    </DashboardShell>
  )
}
