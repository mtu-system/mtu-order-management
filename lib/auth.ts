import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export type UserRole =
  | 'manager'
  | 'marketing'
  | 'operational'
  | 'hse'
  | 'pending'

export async function getCurrentUser() {
  const supabase = await createClient()

  const { data: claimsData, error: claimsError } =
    await supabase.auth.getClaims()

  if (claimsError || !claimsData?.claims) {
    return null
  }

  const userId = claimsData.claims.sub

  if (!userId) {
    return null
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, full_name, email, role, is_active')
    .eq('id', userId)
    .single()

  if (profileError || !profile || !profile.is_active) {
    return null
  }

  return {
    ...profile,
    role: profile.role as UserRole,
  }
}

export async function requireRole(allowedRoles: UserRole[]) {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/login')
  }

  if (!allowedRoles.includes(user.role)) {
    redirect(getRoleHome(user.role))
  }

  return user
}

export function getRoleHome(role: UserRole) {
  switch (role) {
    case 'manager':
      return '/manager'

    case 'marketing':
      return '/marketing'

    case 'operational':
      return '/operational'

    case 'hse':
      return '/hse'

    case 'pending':
      return '/pending'

    default:
      return '/login'
  }
}