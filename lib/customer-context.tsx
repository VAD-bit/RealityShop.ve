'use client'

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Customer, getCustomerByAuthUser, createCustomer } from '@/lib/customers'

interface CustomerContextValue {
  customer: Customer | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<{ error: string | null }>
  register: (payload: {
    name: string
    email: string
    phone: string
    password: string
  }) => Promise<{ error: string | null }>
  logout: () => Promise<void>
  refresh: () => Promise<void>
  updateCustomerLocal: (patch: Partial<Customer>) => void
}

const CustomerContext = createContext<CustomerContextValue>({
  customer: null,
  isLoading: true,
  isAuthenticated: false,
  login: async () => ({ error: null }),
  register: async () => ({ error: null }),
  logout: async () => {},
  refresh: async () => {},
  updateCustomerLocal: () => {},
})

export function useCustomer() {
  return useContext(CustomerContext)
}

export function CustomerProvider({ children }: { children: React.ReactNode }) {
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const supabase = createClient()

  const loadCustomer = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const c = await getCustomerByAuthUser(user.id)
        setCustomer(c)
      } else {
        setCustomer(null)
      }
    } catch {
      setCustomer(null)
    }
    setIsLoading(false)
  }, [supabase])

  useEffect(() => {
    loadCustomer()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      loadCustomer()
    })

    return () => subscription.unsubscribe()
  }, [loadCustomer, supabase])

  const login = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return { error: error.message }
    await loadCustomer()
    return { error: null }
  }

  const register = async (payload: {
    name: string
    email: string
    phone: string
    password: string
  }) => {
    const { data, error } = await supabase.auth.signUp({
      email: payload.email,
      password: payload.password,
    })

    if (error) return { error: error.message }

    if (data.user) {
      await createCustomer({
        authUserId: data.user.id,
        name: payload.name,
        email: payload.email,
        phone: payload.phone,
      })
      await loadCustomer()
    }

    return { error: null }
  }

  const logout = async () => {
    await supabase.auth.signOut()
    setCustomer(null)
  }

  const updateCustomerLocal = (patch: Partial<Customer>) => {
    setCustomer((prev) => (prev ? { ...prev, ...patch } : prev))
  }

  return (
    <CustomerContext.Provider
      value={{
        customer,
        isLoading,
        isAuthenticated: Boolean(customer),
        login,
        register,
        logout,
        refresh: loadCustomer,
        updateCustomerLocal,
      }}
    >
      {children}
    </CustomerContext.Provider>
  )
}
